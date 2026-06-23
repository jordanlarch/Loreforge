/**
 * Loreforge WebSocket sync server (#14, scope A — Tier 4 transport).
 *
 * A Hocuspocus server that is the *authoritative* engine host for live play:
 * clients are observers of a server-written Y.Doc and submit commands over the
 * stateless channel; the engine validates/applies them and the resulting
 * projection is broadcast (`docs/engine/architecture.md` §10). No Vercel↔WS
 * backchannel exists — the engine runs here.
 *
 * Two room kinds are served, distinguished by documentName prefix:
 *   - `sandbox:{userId}` — the in-memory goblin-ambush fixture demo (scope A);
 *     a client may only join the room for its own id.
 *   - `campaign:{campaignId}` — a persisted, owner-scoped campaign (scope B);
 *     the WS server is the sole authoritative writer to the Postgres event
 *     store, and only the campaign owner may join.
 */
import { randomUUID } from "node:crypto";

import { Hocuspocus } from "@hocuspocus/server";

import {
  buildVerifier,
  jwksUrlFor,
  parseRoom,
  verifySupabaseToken,
} from "./auth.js";
import {
  checkAction,
  opportunityAttackAction,
  triggerReadiedAction,
  type WorldState,
} from "@app/engine";
import type { LlmClient } from "@app/llm";

import {
  appendChat,
  chatArray,
  checkEntry,
  composePlayerInput,
  gmEcho,
  gmEntry,
  isChatInput,
  resolutionEntry,
  type ChatDeps,
  type ChatEntry,
} from "./chat.js";
import {
  getCampaignEncounter,
  getCampaignParty,
  getEventStore,
  isCampaignOwner,
  loadChatMessages,
  loadRollingSummary,
  persistChatMessages,
} from "./db.js";
import {
  isSummaryConfigured,
  maybeUpdateRollingSummary,
} from "./session-summary.js";
import {
  abilityLabel,
  activePlayerEntity,
  decideCheck,
  decideMonsterTarget,
  getNarrationClient,
  narrate,
  narrateEnemyTurn,
} from "./narration.js";
import {
  activeEnemy,
  aiOpportunityAttacks,
  enemyTargets,
  monsterAttackProfile,
  planMonsterTurn,
  readiedTriggersToFire,
} from "./enemy-ai.js";
import { writeProjection } from "./projection.js";
import {
  retrievePinnedMemories,
  retrieveWorldKnowledge,
} from "./world-knowledge.js";
import { BattleRoom, CampaignRoom, isBattleAction, type LiveRoom } from "./room.js";

const PORT = Number(process.env.PORT ?? process.env.WS_PORT ?? 1234);
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const LEGACY_SECRET = process.env.SUPABASE_JWT_SECRET ?? "";

// Verify session tokens against the project's public JWKS (current ECC/RSA
// signing keys), with the legacy HS256 secret as an optional fallback.
const verifier = buildVerifier({
  jwksUrl: SUPABASE_URL ? jwksUrlFor(SUPABASE_URL) : undefined,
  legacySecret: LEGACY_SECRET || undefined,
});
const authConfigured = Boolean(SUPABASE_URL || LEGACY_SECRET);

/** Stateless message protocol (client → server). */
type ClientMessage =
  | { t: "cmd"; action: unknown }
  | { t: "reset" }
  | { t: "chat"; mode?: string; text: string };

function parseMessage(payload: string): ClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const message = value as { t?: unknown };
  if (message.t === "cmd" || message.t === "reset") {
    return message as ClientMessage;
  }
  if (message.t === "chat") {
    const { mode, text } = message as { mode?: unknown; text?: unknown };
    if (!isChatInput({ mode, text })) return null;
    return { t: "chat", mode: mode as string | undefined, text: text as string };
  }
  return null;
}

/** Server-side stamping for chat entries (id + wall-clock timestamp). */
const chatDeps: ChatDeps = { uuid: () => randomUUID(), now: () => Date.now() };

// Owner-only rooms in v1, so a single display label is sufficient; per-user
// names arrive with multiplayer.
const PLAYER_LABEL = "Player";

const REJECTED = JSON.stringify({ t: "rejected" });

/** In-memory rooms, keyed by documentName. Evicted when the last client leaves. */
const rooms = new Map<string, LiveRoom>();

function roomFor(documentName: string): LiveRoom {
  let room = rooms.get(documentName);
  if (!room) {
    const parsed = parseRoom(documentName);
    room =
      parsed?.kind === "campaign"
        ? new CampaignRoom(
            parsed.campaignId,
            getEventStore(),
            getCampaignParty,
            getCampaignEncounter,
          )
        : new BattleRoom();
    rooms.set(documentName, room);
  }
  return room;
}

/**
 * Append entries to the shared chat array and, for a persisted campaign room,
 * durably store them (#96). `seq` is the doc's chat length before the push,
 * which equals the persisted count, so re-hydration order is preserved. Sandbox
 * rooms stay ephemeral (no persistence).
 */
async function appendAndPersist(
  document: Parameters<typeof appendChat>[0],
  documentName: string,
  entries: ChatEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const startSeq = chatArray(document).length;
  appendChat(document, entries);
  const parsed = parseRoom(documentName);
  if (parsed?.kind === "campaign") {
    await persistChatMessages(parsed.campaignId, entries, startSeq);
  }
}

/** Broadcast the transient "GM is thinking" signal to every tab in the room. */
function setThinking(
  document: { broadcastStateless(payload: string): void },
  on: boolean,
): void {
  try {
    document.broadcastStateless(JSON.stringify({ t: "thinking", on }));
  } catch {
    // A best-effort UX hint; never let it break the turn.
  }
}

/**
 * Grounding for a player line: always-injected GM-pinned facts (MEM-8, #159)
 * followed by the similarity-reranked Realms lore + recaps (MEM-5). Empty for
 * non-campaign (sandbox) rooms; pins ground every turn (even with embeddings
 * off), lore/recaps only when the memory tier is configured. Always best-effort.
 */
async function gmKnowledge(
  documentName: string,
  text: string,
): Promise<string[]> {
  const parsed = parseRoom(documentName);
  if (parsed?.kind !== "campaign") return [];
  const { campaignId } = parsed;
  const [pins, similar] = await Promise.all([
    retrievePinnedMemories({ campaignId }),
    retrieveWorldKnowledge({ campaignId, queryText: text }),
  ]);
  return [...pins, ...similar];
}

/**
 * The campaign's rolling session summary (MEM-3) for narration, or "" for
 * non-campaign (sandbox) rooms / when none exists yet. Best-effort.
 */
async function gmSessionSummary(documentName: string): Promise<string> {
  const parsed = parseRoom(documentName);
  if (parsed?.kind !== "campaign") return "";
  try {
    const row = await loadRollingSummary(parsed.campaignId);
    return row?.summary ?? "";
  } catch {
    return "";
  }
}

/**
 * Regenerate the campaign's rolling session summary if the cadence threshold is
 * hit (MEM-3). Best-effort and env-gated; no-ops for sandbox rooms or offline.
 * Reads the post-turn chat from the live doc.
 */
async function refreshSessionSummary(
  document: Parameters<typeof appendChat>[0],
  documentName: string,
  client: LlmClient,
): Promise<void> {
  if (!isSummaryConfigured()) return;
  const parsed = parseRoom(documentName);
  if (parsed?.kind !== "campaign") return;
  await maybeUpdateRollingSummary({
    campaignId: parsed.campaignId,
    client,
    chat: chatArray(document).toArray(),
  });
}

/**
 * Produce the GM's narration for a player line (#96) with a known-configured
 * client, falling back to the stubbed echo on any narration failure. The
 * deterministic engine still owns all mechanics — this is fiction only.
 * Grounds the prose in retrieved world-knowledge when available (MEM-5).
 */
async function composeGmReply(
  room: LiveRoom,
  documentName: string,
  priorChat: ChatEntry[],
  message: { mode?: string; text: string },
  client: LlmClient,
): Promise<ChatEntry> {
  try {
    const result = await narrate({
      client,
      state: await room.getState(),
      recentChat: priorChat,
      playerLine: message.text,
      mode: message.mode,
      knowledge: await gmKnowledge(documentName, message.text),
      summary: await gmSessionSummary(documentName),
    });
    return gmEntry(result.text, chatDeps, { mentions: result.mentions });
  } catch {
    return gmEntry(gmEcho(message.mode, message.text), chatDeps);
  }
}

/**
 * Route a free-text "Check" through the engine (#97): the orchestrator picks the
 * ability/skill + DC, the engine rolls it deterministically, the result is shown
 * as an engine-event row, and the GM narrates the outcome (honouring the dice).
 * Falls back to plain narration if there is no PC or the orchestrator fails.
 */
async function runCheck(
  room: LiveRoom,
  document: Parameters<typeof appendChat>[0],
  documentName: string,
  priorChat: ChatEntry[],
  message: { mode?: string; text: string },
  client: LlmClient,
): Promise<void> {
  const state = await room.getState();
  const actor = activePlayerEntity(state);
  if (!actor) {
    const gm = await composeGmReply(room, documentName, priorChat, message, client);
    await appendAndPersist(document, documentName, [gm]);
    return;
  }

  let decision;
  try {
    decision = await decideCheck({ client, state, playerLine: message.text });
  } catch {
    const gm = await composeGmReply(room, documentName, priorChat, message, client);
    await appendAndPersist(document, documentName, [gm]);
    return;
  }

  const applied = await room.apply(
    checkAction(actor.id, decision.ability, {
      skill: decision.skill,
      dc: decision.dc,
      proficient: decision.proficient,
    }),
  );
  const summary = applied.summary as
    | { total?: number; success?: boolean }
    | undefined;
  if (!applied.accepted || !summary || typeof summary.total !== "number") {
    const gm = await composeGmReply(room, documentName, priorChat, message, client);
    await appendAndPersist(document, documentName, [gm]);
    return;
  }

  const success = summary.success ?? false;
  await appendAndPersist(document, documentName, [
    checkEntry(
      {
        actorName: actor.name,
        abilityLabel: abilityLabel(decision.ability),
        skill: decision.skill,
        total: summary.total,
        dc: decision.dc,
        success,
      },
      chatDeps,
    ),
  ]);

  const outcome = `${actor.name}'s ${abilityLabel(decision.ability)}${
    decision.skill ? ` (${decision.skill})` : ""
  } check ${success ? "succeeds" : "fails"} (rolled ${summary.total} vs DC ${decision.dc}).`;
  let gm: ChatEntry;
  try {
    const narration = await narrate({
      client,
      state,
      recentChat: priorChat,
      playerLine: message.text,
      mode: "check",
      outcome,
      knowledge: await gmKnowledge(documentName, message.text),
      summary: await gmSessionSummary(documentName),
    });
    gm = gmEntry(narration.text, chatDeps, { mentions: narration.mentions });
  } catch {
    gm = gmEntry(success ? "Your effort pays off." : "It doesn't work.", chatDeps);
  }
  await appendAndPersist(document, documentName, [gm]);
}

/** Resolve entity ids to display names from a state snapshot. */
function nameResolver(state: WorldState): (id: string) => string {
  return (id) => state.entities[id]?.name ?? id;
}

/** Hard cap on autonomous turns per trigger, so a stuck loop can't run forever. */
const MAX_ENEMY_TURNS = 24;

/** The factual one-line result of an enemy turn, for narration (undefined = skip). */
function enemyTurnOutcome(
  enemyName: string,
  actions: readonly { type: string }[],
  attackSummary: Record<string, unknown> | undefined,
  nameOf: (id: string) => string,
): string | undefined {
  if (attackSummary) {
    const target = nameOf(String(attackSummary.target ?? ""));
    if (attackSummary.hit === true) {
      const dmg =
        typeof attackSummary.damage === "number" ? attackSummary.damage : 0;
      const downed =
        attackSummary.downed === true ? `, dropping ${target}` : "";
      return `${enemyName} hits ${target} for ${dmg} damage${downed}.`;
    }
    return `${enemyName} attacks ${target} but misses.`;
  }
  if (actions.some((a) => a.type === "move_entity")) {
    return `${enemyName} advances toward the party.`;
  }
  return undefined;
}

/** The factual one-line result of an AI opportunity attack, for narration. */
function opportunityOutcome(
  reactorName: string,
  moverName: string,
  summary: Record<string, unknown> | undefined,
): string {
  if (summary?.hit === true) {
    const dmg = typeof summary.damage === "number" ? summary.damage : 0;
    const downed = summary.downed === true ? `, dropping ${moverName}` : "";
    return `${reactorName} catches ${moverName} with an opportunity attack for ${dmg} damage${downed}.`;
  }
  return `${reactorName}'s opportunity attack misses ${moverName}.`;
}

/**
 * Resolve any opportunity attacks an AI reactor is entitled to from the current
 * reaction window (combat loop). Players are *prompted* to take an OA (#58);
 * AI-controlled reactors take theirs automatically here — the tracer policy is
 * "always strike a fleeing foe". Each `opportunity_attack` is engine-validated
 * (reaction availability, the provoke window) and removes the reactor from the
 * window, so the loop terminates; bounded by a guard regardless. No-ops when no
 * window is open or only players are eligible.
 */
async function runEnemyReactions(
  room: LiveRoom,
  document: Parameters<typeof appendChat>[0] & {
    broadcastStateless(payload: string): void;
  },
  documentName: string,
  client: LlmClient | undefined,
): Promise<void> {
  let state = await room.getState();
  if (aiOpportunityAttacks(state).length === 0) return;

  if (client) setThinking(document, true);
  try {
    let guard = 0;
    while (guard < MAX_ENEMY_TURNS) {
      guard += 1;
      const oas = aiOpportunityAttacks(state);
      if (oas.length === 0) break;
      const { reactor, mover } = oas[0]!;
      const profile = monsterAttackProfile(reactor);
      const action = opportunityAttackAction(
        reactor.id,
        mover.id,
        profile.attackBonus,
        profile.damage,
      );
      const { accepted, summary } = await room.apply(action);
      if (!accepted) break; // shouldn't happen; guards against a stuck loop
      state = await room.getState();
      writeProjection(document, state);
      const detail = summary as Record<string, unknown> | undefined;
      await appendAndPersist(document, documentName, [
        resolutionEntry(action, detail, nameResolver(state), chatDeps),
      ]);

      if (client) {
        try {
          const narration = await narrateEnemyTurn({
            client,
            state,
            recentChat: chatArray(document).toArray(),
            actorName: reactor.name,
            outcome: opportunityOutcome(reactor.name, mover.name, detail),
            situation: `${reactor.name} takes an opportunity attack as ${mover.name} leaves its reach.`,
          });
          await appendAndPersist(document, documentName, [
            gmEntry(narration.text, chatDeps, { mentions: narration.mentions }),
          ]);
        } catch {
          // Narration is optional; the engine row already told the story.
        }
      }
    }
  } finally {
    if (client) setThinking(document, false);
  }
}

/**
 * Fire any readied actions whose trigger condition is now met (combat loop):
 * when a foe advances into the range a player readied a strike for, resolve that
 * held attack via the engine `trigger_readied` before the foe acts further. Each
 * fire consumes the reactor's reaction + clears its readied slot, so the loop
 * terminates; bounded by a guard. No-ops when nothing is triggered.
 */
async function runReadiedTriggers(
  room: LiveRoom,
  document: Parameters<typeof appendChat>[0] & {
    broadcastStateless(payload: string): void;
  },
  documentName: string,
  client: LlmClient | undefined,
): Promise<void> {
  let state = await room.getState();
  if (readiedTriggersToFire(state).length === 0) return;

  if (client) setThinking(document, true);
  try {
    let guard = 0;
    while (guard < MAX_ENEMY_TURNS) {
      guard += 1;
      const fired = readiedTriggersToFire(state);
      if (fired.length === 0) break;
      const { reactor, target } = fired[0]!;
      const action = triggerReadiedAction(reactor.id);
      const { accepted, summary } = await room.apply(action);
      if (!accepted) break; // shouldn't happen; guards against a stuck loop
      state = await room.getState();
      writeProjection(document, state);
      const detail = summary as Record<string, unknown> | undefined;
      await appendAndPersist(document, documentName, [
        resolutionEntry(action, detail, nameResolver(state), chatDeps),
      ]);

      if (client) {
        try {
          const narration = await narrateEnemyTurn({
            client,
            state,
            recentChat: chatArray(document).toArray(),
            actorName: reactor.name,
            outcome: opportunityOutcome(reactor.name, target.name, detail),
            situation: `${reactor.name}'s readied strike triggers as ${target.name} advances into range.`,
          });
          await appendAndPersist(document, documentName, [
            gmEntry(narration.text, chatDeps, { mentions: narration.mentions }),
          ]);
        } catch {
          // Narration is optional; the engine row already told the story.
        }
      }
    }
  } finally {
    if (client) setThinking(document, false);
  }
}

/**
 * Run every queued non-player turn after a state change (combat loop). The
 * deterministic planner (`planMonsterTurn`) is authoritative; the engine
 * validates each action. When a narration client is present it (a) lets the LLM
 * pick the target among legal candidates — the #97 "model proposes, engine
 * disposes" pattern — and (b) narrates each turn. No-ops when it is a PC's turn.
 */
async function runEnemyTurns(
  room: LiveRoom,
  document: Parameters<typeof appendChat>[0] & {
    broadcastStateless(payload: string): void;
  },
  documentName: string,
  client: LlmClient | undefined,
): Promise<void> {
  let state = await room.getState();
  if (!activeEnemy(state)) return;

  if (client) setThinking(document, true);
  try {
    let guard = 0;
    while (guard < MAX_ENEMY_TURNS) {
      guard += 1;
      const enemy = activeEnemy(state);
      if (!enemy) break;

      // Optional LLM target intent — only worth a call with a real choice.
      let preferred: string | undefined;
      if (client && enemy.alive) {
        const candidates = enemyTargets(state, enemy).map((t) => ({
          id: t.id,
          name: t.name,
          hp: t.hp.current,
        }));
        if (candidates.length > 1) {
          try {
            preferred = await decideMonsterTarget({
              client,
              state,
              monsterName: enemy.name,
              candidates,
            });
          } catch {
            // Best-effort; the deterministic planner still picks a target.
          }
        }
      }

      const actions = planMonsterTurn(state, enemy.id, preferred);
      let attackSummary: Record<string, unknown> | undefined;
      for (const action of actions) {
        const { accepted, summary } = await room.apply(action);
        if (!accepted) continue;
        state = await room.getState();
        writeProjection(document, state);
        if (action.type === "attack") {
          attackSummary = summary as Record<string, unknown> | undefined;
          await appendAndPersist(document, documentName, [
            resolutionEntry(action, attackSummary, nameResolver(state), chatDeps),
          ]);
        }
        // A foe advancing may step into the range a player readied a strike for;
        // resolve held actions now (it can interrupt the foe's own attack).
        await runReadiedTriggers(room, document, documentName, client);
        state = await room.getState();
      }

      if (client) {
        const outcome = enemyTurnOutcome(
          enemy.name,
          actions,
          attackSummary,
          nameResolver(state),
        );
        if (outcome) {
          try {
            const narration = await narrateEnemyTurn({
              client,
              state,
              recentChat: chatArray(document).toArray(),
              actorName: enemy.name,
              outcome,
            });
            await appendAndPersist(document, documentName, [
              gmEntry(narration.text, chatDeps, {
                mentions: narration.mentions,
              }),
            ]);
          } catch {
            // Narration is optional; the engine row already told the story.
          }
        }
      }
    }
  } finally {
    if (client) setThinking(document, false);
  }
}

const server = new Hocuspocus({
  name: "loreforge-ws",
  port: PORT,
  quiet: true,
  // The Y.Doc is a disposable projection (campaign state lives in Postgres,
  // sandbox state in the fixture), so drop rooms as soon as everyone leaves.
  unloadImmediately: true,

  async onAuthenticate({ token, documentName }) {
    if (!authConfigured) {
      throw new Error(
        "Auth not configured: set SUPABASE_URL (JWKS) and/or SUPABASE_JWT_SECRET",
      );
    }
    const { userId } = await verifySupabaseToken(token, verifier);
    const parsed = parseRoom(documentName);
    if (!parsed) throw new Error("forbidden: unknown room");

    if (parsed.kind === "sandbox") {
      if (parsed.userId !== userId) {
        throw new Error("forbidden: room does not belong to authenticated user");
      }
    } else if (!(await isCampaignOwner(parsed.campaignId, userId))) {
      throw new Error("forbidden: not the campaign owner");
    }

    return { userId };
  },

  async onLoadDocument({ document, documentName }) {
    const room = roomFor(documentName);
    await room.ensureSeeded();
    writeProjection(document, await room.getState());
    // Re-hydrate persisted chat so a cold-loaded campaign room resumes the
    // conversation instead of starting blank (#96). Sandbox rooms are ephemeral.
    const parsed = parseRoom(documentName);
    if (parsed?.kind === "campaign") {
      const history = await loadChatMessages(parsed.campaignId);
      if (history.length > 0) appendChat(document, history);
    }
    // If a foe won initiative, let it act before the first player join sees the
    // board — so combat never opens stuck on an enemy's turn.
    await runEnemyTurns(room, document, documentName, getNarrationClient());
    return document;
  },

  async onStateless({ connection, document, documentName, payload }) {
    const message = parseMessage(payload);
    if (!message) return;
    const room = roomFor(documentName);

    if (message.t === "cmd") {
      if (!isBattleAction(message.action)) {
        connection.sendStateless(REJECTED);
        return;
      }
      const { accepted, summary } = await room.apply(message.action);
      if (accepted) {
        const state = await room.getState();
        writeProjection(document, state);
        // Surface the accepted engine action as a chat event row enriched with
        // the resolution detail from the command summary (#57, #96, #99).
        const nameOf = (id: string): string =>
          state.entities[id]?.name ?? id;
        await appendAndPersist(document, documentName, [
          resolutionEntry(
            message.action,
            summary as Record<string, unknown> | undefined,
            nameOf,
            chatDeps,
          ),
        ]);
        // A move may have fled an AI reactor's reach — let foes take their
        // opportunity attacks first, then (if the turn ended) their full turns.
        await runEnemyReactions(room, document, documentName, getNarrationClient());
        await runEnemyTurns(room, document, documentName, getNarrationClient());
      } else {
        connection.sendStateless(REJECTED);
      }
      return;
    }

    if (message.t === "chat") {
      const { entries, respond } = composePlayerInput(
        { author: PLAYER_LABEL, mode: message.mode, text: message.text },
        chatDeps,
      );
      // Capture the conversation *before* the player's line so it isn't echoed
      // back to the narrator as duplicate context.
      const priorChat = chatArray(document).toArray();
      await appendAndPersist(document, documentName, entries);

      if (!respond) return;

      const client = getNarrationClient();
      if (!client) {
        // Unconfigured: the instant stub, no "thinking" indicator needed.
        await appendAndPersist(document, documentName, [
          gmEntry(gmEcho(message.mode, message.text), chatDeps),
        ]);
        return;
      }

      // Real LLM work follows: signal "GM is thinking" until it resolves (#97).
      setThinking(document, true);
      try {
        if (message.mode === "check") {
          await runCheck(room, document, documentName, priorChat, message, client);
        } else {
          const gm = await composeGmReply(
            room,
            documentName,
            priorChat,
            message,
            client,
          );
          await appendAndPersist(document, documentName, [gm]);
        }
        // Refresh the rolling session summary between turns (MEM-3, best-effort).
        await refreshSessionSummary(document, documentName, client);
      } finally {
        setThinking(document, false);
      }
      return;
    }

    // message.t === "reset"
    await room.reset();
    writeProjection(document, await room.getState());
    // A fresh encounter may open on an enemy's initiative.
    await runEnemyTurns(room, document, documentName, getNarrationClient());
  },

  async onDisconnect({ documentName, clientsCount }) {
    if (clientsCount === 0) {
      rooms.delete(documentName);
    }
  },
});

server.listen().then(() => {
  // eslint-disable-next-line no-console
  console.log(`[ws-server] Loreforge sync server listening on :${PORT}`);
});
