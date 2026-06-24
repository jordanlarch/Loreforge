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
  classifyScene2Topic,
  classifyTutorialLeaveIntent,
  classifyTutorialRelightIntent,
  isTutorialFriendlyFireTarget,
  opportunityAttackAction,
  triggerReadiedAction,
  TUTORIAL_ATTACK_ALLY_DEFLECT,
  TUTORIAL_LEAVE_VILLAGE_RAIL,
  TUTORIAL_SCENE_HEARTH,
  TUTORIAL_SCENE_HOLLOWS_EDGE,
  TUTORIAL_SCENE_SPIRE_UPPER,
  tutorialChatFallback,
  tutorialHintForScene,
  tutorialRelightPath,
  tutorialScene,
  TUTORIAL_SHADE_ID,
  TUTORIAL_WRAP,
  type TutorialRelightPath,
  type WorldState,
} from "@app/engine";
import type { LlmClient } from "@app/llm";

import {
  appendChat,
  chatArray,
  checkEntry,
  clearChat,
  composePlayerInput,
  gmEcho,
  gmEntry,
  isChatInput,
  resolutionEntry,
  type ChatDeps,
  type ChatEntry,
} from "./chat.js";
import {
  awardTutorialXp,
  clearCampaignChat,
  consumeTutorialItem,
  getCampaignEncounter,
  getCampaignParty,
  getEventStore,
  getTutorialHookStatus,
  grantTutorialLoot,
  isCampaignOwner,
  isTutorialCampaign,
  loadChatMessages,
  loadRollingSummary,
  persistChatMessages,
  resetTutorialState,
  resolveTutorialHook,
  setTutorialScene,
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
import {
  COMPANION_ID,
  activeCombatant,
  leadPc,
  partyReactionPending,
  planCompanionTurn,
  shadeFleeMove,
  tutorialCombatOver,
} from "./tutorial-combat.js";
import { writeProjection } from "./projection.js";
import {
  retrievePinnedMemories,
  retrieveWorldKnowledge,
} from "./world-knowledge.js";
import { BattleRoom, CampaignRoom, isBattleAction, type LiveRoom } from "./room.js";
import { TutorialRoom } from "./tutorial-room.js";

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

/** A scripted tutorial trigger from the client (TUT-1). */
type TutorialAction =
  | "advance"
  | "check"
  | "say"
  | "companion"
  | "resume"
  | "relight"
  | "wrap"
  | "auto-hint";

/** Stateless message protocol (client → server). */
type ClientMessage =
  | { t: "cmd"; action: unknown }
  | { t: "reset" }
  | { t: "chat"; mode?: string; text: string }
  | { t: "tutorial"; action: TutorialAction; topic?: string; help?: boolean };

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
  if (message.t === "tutorial") {
    const { action, topic, help } = message as {
      action?: unknown;
      topic?: unknown;
      help?: unknown;
    };
    if (
      action === "advance" ||
      action === "check" ||
      action === "say" ||
      action === "companion" ||
      action === "resume" ||
      action === "relight" ||
      action === "wrap" ||
      action === "auto-hint"
    ) {
      return {
        t: "tutorial",
        action,
        topic: typeof topic === "string" ? topic : undefined,
        help: help === true,
      };
    }
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

async function roomFor(documentName: string): Promise<LiveRoom> {
  let room = rooms.get(documentName);
  if (!room) {
    const parsed = parseRoom(documentName);
    if (parsed?.kind === "campaign") {
      // The per-user onboarding campaign runs the scripted TutorialRoom (its
      // own scene graph + advance driver) rather than the default encounter.
      room = (await isTutorialCampaign(parsed.campaignId))
        ? new TutorialRoom(parsed.campaignId, getEventStore(), getCampaignParty)
        : new CampaignRoom(
            parsed.campaignId,
            getEventStore(),
            getCampaignParty,
            getCampaignEncounter,
          );
    } else {
      room = new BattleRoom();
    }
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
    if (room instanceof TutorialRoom) {
      const sceneId = (await room.getState()).currentSceneId;
      return gmEntry(tutorialChatFallback(sceneId, message.text), chatDeps);
    }
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

/* ------------------------------------------------------------------------- *
 *  Tutorial Scene 5 — scripted combat driver (TUT-1, #174)
 * ------------------------------------------------------------------------- */

/** HP the safety net restores when the lead is downed (a guaranteed rescue). */
const TUTORIAL_RESCUE_HP = 8;

/** Broadcast a tutorial UI signal (loot/combat coachmarks) to every tab. */
function tutorialSignal(
  document: { broadcastStateless(payload: string): void },
  event: string,
): void {
  try {
    document.broadcastStateless(JSON.stringify({ t: "tutorial", event }));
  } catch {
    // Best-effort UX hint; never let it break the loop.
  }
}

/** Clear the client's `isBusy` latch when a tutorial action no-ops (#bug2). */
function clearClientBusy(document: { broadcastStateless(payload: string): void }): void {
  try {
    document.broadcastStateless(JSON.stringify({ t: "busy", on: false }));
  } catch {
    // Best-effort; the client also clears on projection updates.
  }
}

/**
 * Whether the Shade should run its scripted disengage now: past the opening
 * round, not already fled, and currently biting the lead (adjacent) so that
 * leaving provokes her one Opportunity-Attack beat.
 */
function shouldShadeFlee(room: TutorialRoom, state: WorldState): boolean {
  if (room.shadeHasFled()) return false;
  const enc = state.encounter;
  if (!enc || enc.round < 2) return false;
  const lead = leadPc(state);
  return Boolean(lead?.alive) && shadeFleeMove(state) !== undefined;
}

/**
 * Run the foe (Hungering Shade) turns until a party turn — like `runEnemyTurns`
 * but air-gapped (no LLM narration) and with the scripted disengage that fires
 * the player's Opportunity-Attack beat. Returns having either reached a party
 * turn or paused on an open party reaction window (the OA prompt).
 */
async function runTutorialShadeTurns(
  room: TutorialRoom,
  document: Parameters<typeof appendChat>[0] & {
    broadcastStateless(payload: string): void;
  },
  documentName: string,
  client: LlmClient | undefined,
): Promise<void> {
  let guard = 0;
  while (guard < MAX_ENEMY_TURNS) {
    guard += 1;
    let state = await room.getState();
    const enemy = activeEnemy(state);
    if (!enemy) return;

    // Scripted disengage (once): step out of the lead's reach to provoke her OA.
    if (enemy.id === TUTORIAL_SHADE_ID && shouldShadeFlee(room, state)) {
      const step = shadeFleeMove(state);
      if (step) {
        room.markShadeFled();
        const { accepted } = await room.apply({
          type: "move_entity",
          entity: enemy.id,
          to: step,
        });
        if (accepted) {
          state = await room.getState();
          writeProjection(document, state);
          await appendAndPersist(document, documentName, [
            gmEntry(
              `The ${enemy.name} lunges past you toward Brennar — leaving your reach!`,
              chatDeps,
            ),
          ]);
          if (partyReactionPending(state)) {
            tutorialSignal(document, "reaction");
            return; // pause: the player takes (or passes) their Opportunity Attack
          }
        }
      }
    }

    // A normal Shade turn: plan + apply, posting engine resolution rows.
    const actions = planMonsterTurn(state, enemy.id);
    for (const action of actions) {
      const { accepted, summary } = await room.apply(action);
      if (!accepted) continue;
      state = await room.getState();
      writeProjection(document, state);
      if (action.type === "attack") {
        await appendAndPersist(document, documentName, [
          resolutionEntry(
            action,
            summary as Record<string, unknown> | undefined,
            nameResolver(state),
            chatDeps,
          ),
        ]);
      }
      await runReadiedTriggers(room, document, documentName, client);
      state = await room.getState();
    }
  }
}

/** Run Old Brennar's AI turn (heal the lead or Sacred Flame the foe). */
async function runCompanionTurn(
  room: TutorialRoom,
  document: Parameters<typeof appendChat>[0] & {
    broadcastStateless(payload: string): void;
  },
  documentName: string,
): Promise<void> {
  let state = await room.getState();
  if (!state.entities[COMPANION_ID]) return;
  const actions = planCompanionTurn(state);
  for (const action of actions) {
    const { accepted, summary } = await room.apply(action);
    if (!accepted) continue;
    state = await room.getState();
    writeProjection(document, state);
    if (action.type === "cast_spell") {
      await appendAndPersist(document, documentName, [
        resolutionEntry(
          action,
          summary as Record<string, unknown> | undefined,
          nameResolver(state),
          chatDeps,
        ),
      ]);
      const healed = (summary as { healing?: number } | undefined)?.healing;
      if (typeof healed === "number" && healed > 0) {
        await appendAndPersist(document, documentName, [
          gmEntry(
            `Brennar's eyes flash white-gold — ${healed} HP knit back into the wound.`,
            chatDeps,
          ),
        ]);
      }
    }
  }
  tutorialSignal(document, "npc-turn");
}

/** Guaranteed safety net: if the lead is downed (0 HP, not dead), Brennar steadies
 * her before any death save resolves — the tutorial cannot be lost (D-spec). */
async function tutorialSafetyNet(
  room: TutorialRoom,
  document: Parameters<typeof appendChat>[0] & {
    broadcastStateless(payload: string): void;
  },
  documentName: string,
): Promise<void> {
  const state = await room.getState();
  const lead = leadPc(state);
  if (!lead || lead.dead || lead.hp.current > 0) return;
  const rescued = await room.rescueLead(TUTORIAL_RESCUE_HP);
  if (!rescued) return;
  writeProjection(document, await room.getState());
  await appendAndPersist(document, documentName, [
    gmEntry(
      `"I've got you." Brennar's hand closes over the wound and warmth floods ` +
        `back — you're on your feet before the dark can take you.`,
      chatDeps,
    ),
  ]);
  tutorialSignal(document, "rescue");
}

/** Victory: end the fight narratively and advance to Scene 6 (post-combat). */
async function tutorialVictory(
  room: TutorialRoom,
  document: Parameters<typeof appendChat>[0] & {
    broadcastStateless(payload: string): void;
  },
  documentName: string,
): Promise<void> {
  if (!room.markOnce("combat-victory")) return;

  await appendAndPersist(document, documentName, [
    gmEntry(
      `The Hungering Shade collapses in on itself like extinguished smoke. ` +
        `Cold leaves the room in a single, silent rush.`,
      chatDeps,
    ),
  ]);

  await room.endEncounter();
  writeProjection(document, await room.getState());

  const result = await room.advance();
  writeProjection(document, await room.getState());
  if (!result) return;
  const parsed = parseRoom(documentName);
  if (parsed?.kind === "campaign") {
    await setTutorialScene(parsed.campaignId, result.sceneId);
  }
  await appendAndPersist(document, documentName, [
    gmEntry(result.narration, chatDeps, { mentions: result.mentions }),
  ]);
}

/**
 * Scene 6 finale (TUT-1, #175): light the great lantern via the chosen path, then
 * run the shared resolution — resolve the central hook, award XP + fire the
 * level-up notice, note reputation, and post the memory-pin demo beat. LLM-free
 * (D3); every effect hits real data (D4). Fires exactly once, guarded on the hook
 * already being resolved (re-clicks after the lantern is lit are no-ops).
 */
async function tutorialRelight(
  room: TutorialRoom,
  document: Parameters<typeof appendChat>[0] & {
    broadcastStateless(payload: string): void;
  },
  documentName: string,
  pathId: string,
): Promise<void> {
  const state = await room.getState();
  const resolution = tutorialScene(state.currentSceneId)?.resolution;
  if (!resolution) return; // not the finale scene

  const path: TutorialRelightPath | undefined =
    tutorialRelightPath(pathId) ??
    resolution.paths.find((p) => p.id === "improv");
  if (!path) return;

  const parsed = parseRoom(documentName);
  const campaignId = parsed?.kind === "campaign" ? parsed.campaignId : undefined;

  // Fire once: a resolved hook means the lantern is already lit.
  if (campaignId && (await getTutorialHookStatus(campaignId)) === "resolved") {
    return;
  }

  // A checked path (the prayer, D3) rolls a real engine d20; on a failure the
  // narration converges on the standard outcome.
  let relightText = path.text;
  if (path.check) {
    const result = await room.runRelightCheck(path.check);
    writeProjection(document, await room.getState());
    const summary = result?.summary as
      | { total?: number; success?: boolean }
      | undefined;
    if (result?.accepted && summary && typeof summary.total === "number") {
      const success = summary.success ?? false;
      await appendAndPersist(document, documentName, [
        checkEntry(
          {
            actorName: result.actorName,
            abilityLabel: abilityLabel(path.check.ability),
            skill: path.check.skill,
            total: summary.total,
            dc: path.check.dc,
            success,
          },
          chatDeps,
        ),
      ]);
      if (!success) relightText = path.check.failureText;
    }
  }

  // Consume the scripted item (D4) — the Oil of Brightness on the best path.
  let consumedNote = "";
  if (path.consumesItem && campaignId) {
    if (await consumeTutorialItem(campaignId, path.consumesItem)) {
      consumedNote = ` (${path.consumesItem} used)`;
      try {
        document.broadcastStateless(
          JSON.stringify({ t: "tutorial", event: "loot" }),
        );
      } catch {
        // Drawer refresh is best-effort; the consume is already persisted.
      }
    }
  }

  // The relight beat, then the shared resolution beat.
  await appendAndPersist(document, documentName, [
    gmEntry(relightText + consumedNote, chatDeps),
    gmEntry(resolution.resolution, chatDeps),
  ]);

  // Real-data effects: resolve the hook, award XP / make the hero level-up
  // eligible, and signal the matching coachmarks.
  if (campaignId) {
    await resolveTutorialHook(campaignId);
    const { leveledUp } = await awardTutorialXp(campaignId);
    if (leveledUp) tutorialSignal(document, "leveled-up");
  }

  // Reputation flavor (narration-only this slice; real reputation deferred), the
  // level-up notice, and the pinnable memory beat (the pin coachmark fires last).
  await appendAndPersist(document, documentName, [
    gmEntry(resolution.reputationNote, chatDeps),
    gmEntry(resolution.levelUp.notice, chatDeps),
    gmEntry(resolution.memory.text, chatDeps, {
      mentions: resolution.memory.mentions,
    }),
  ]);
  tutorialSignal(document, "pin");
}

/**
 * Scene 7 wrap (TUT-1, #176): post the closing GM beat + the session-complete
 * summary line, then broadcast the `graduated` signal so the surface opens the
 * graduation modal. LLM-free (D3); fires exactly once per room (re-sends are
 * no-ops). The completion DB write + achievement unlock are owned by the web
 * `tutorial.complete` mutation (D4) — this only narrates the handoff.
 */
async function tutorialWrap(
  room: TutorialRoom,
  document: Parameters<typeof appendChat>[0] & {
    broadcastStateless(payload: string): void;
  },
  documentName: string,
): Promise<void> {
  if (room.hasGraduated()) return;
  // Only wrap once the finale has actually resolved (the lantern is lit).
  const parsed = parseRoom(documentName);
  const campaignId = parsed?.kind === "campaign" ? parsed.campaignId : undefined;
  if (campaignId && (await getTutorialHookStatus(campaignId)) !== "resolved") {
    return;
  }
  room.markGraduated();
  await appendAndPersist(document, documentName, [
    gmEntry(TUTORIAL_WRAP.narration, chatDeps),
    gmEntry(TUTORIAL_WRAP.sessionComplete, chatDeps),
  ]);
  tutorialSignal(document, "graduated");
}

/**
 * The Scene 5 combat driver (TUT-1): after the player acts, run the Shade and
 * companion turns through the real engine, apply the near-death safety net, and
 * on victory advance to Scene 6. Pauses on an open party reaction window so the
 * player gets their Opportunity-Attack prompt. LLM-free (D3), so it plays
 * air-gapped. Resuming after the OA is just the next call to this driver.
 */
async function runTutorialCombat(
  room: TutorialRoom,
  document: Parameters<typeof appendChat>[0] & {
    broadcastStateless(payload: string): void;
  },
  documentName: string,
  client: LlmClient | undefined,
): Promise<void> {
  const initial = await room.getState();
  if (!initial.encounter) return;

  let guard = 0;
  while (guard < MAX_ENEMY_TURNS) {
    guard += 1;
    // Foe-side opportunity attacks first (a player move may have provoked one).
    await runEnemyReactions(room, document, documentName, client);
    await runTutorialShadeTurns(room, document, documentName, client);

    let state = await room.getState();
    if (partyReactionPending(state)) return; // wait for the player's OA

    await tutorialSafetyNet(room, document, documentName);
    state = await room.getState();

    if (tutorialCombatOver(state)) {
      await tutorialVictory(room, document, documentName);
      return;
    }

    const active = activeCombatant(state);
    if (!active) return;
    if (active.id === COMPANION_ID) {
      await runCompanionTurn(room, document, documentName);
      continue;
    }
    return; // the lead's (player's) turn — hand control back
  }
}

/**
 * Drive a scripted tutorial trigger (TUT-1). `advance` runs the next scene's
 * commands, broadcasts the new projection, persists the resume pointer (D6), and
 * posts the scene's canned GM narration. `check` resolves the scene's offered
 * ability check through the engine (a real deterministic roll), then posts the
 * engine row + the pre-written success/failure copy. Both are LLM-free, so the
 * tutorial works air-gapped.
 */
async function handleTutorial(
  room: TutorialRoom,
  document: Parameters<typeof appendChat>[0] & {
    broadcastStateless(payload: string): void;
  },
  documentName: string,
  action: TutorialAction,
  topic: string | undefined,
  help: boolean | undefined,
): Promise<void> {
  // Serialize tutorial actions per room so a double-click can't double-process
  // (advance twice, re-roll a check, repeat a dialogue beat). The duplicate is
  // simply dropped (#bug2).
  if (!room.acquireAction()) {
    clearClientBusy(document);
    return;
  }
  try {
    await handleTutorialInner(room, document, documentName, action, topic, help);
  } finally {
    room.releaseAction();
    // Inner handlers may return early (one-shot guard, duplicate click) without
    // writing a new projection — still release the client's busy latch.
    clearClientBusy(document);
  }
}

async function handleTutorialInner(
  room: TutorialRoom,
  document: Parameters<typeof appendChat>[0] & {
    broadcastStateless(payload: string): void;
  },
  documentName: string,
  action: TutorialAction,
  topic: string | undefined,
  help: boolean | undefined,
): Promise<void> {
  if (action === "advance") {
    const state = await room.getState();
    if (!room.markOnce(`advance:${state.currentSceneId}`)) return;
    const result = await room.advance();
    writeProjection(document, await room.getState());
    if (!result) return;
    const parsed = parseRoom(documentName);
    if (parsed?.kind === "campaign") {
      await setTutorialScene(parsed.campaignId, result.sceneId);
    }
    await appendAndPersist(document, documentName, [
      gmEntry(result.narration, chatDeps, { mentions: result.mentions }),
    ]);
    // Entering a combat scene: signal the combat coachmarks and let any
    // combatant ahead of the lead in initiative act before her first turn.
    if (result.combat) {
      tutorialSignal(document, "combat");
      await runTutorialCombat(room, document, documentName, getNarrationClient());
    }
    return;
  }

  if (action === "say") {
    // A scripted NPC dialogue beat (the soft rail): post the canned GM line with
    // its @Entity chips. Deterministic + air-gapped — no LLM in the loop. Played
    // at most once per topic so re-clicks don't repeat the GM (#bug2).
    const beat = topic ? room.say(topic) : undefined;
    if (!beat) return;
    if (!room.markOnce(`say:${topic}`)) return;
    await appendAndPersist(document, documentName, [
      gmEntry(beat.text, chatDeps, { mentions: beat.mentions }),
    ]);
    return;
  }

  if (action === "resume") {
    // The player passed (or timed out) their Opportunity-Attack reaction: the
    // paused Scene 5 loop finishes the Shade's turn (clearing the window) and
    // plays on. A no-op outside combat.
    await runTutorialCombat(room, document, documentName, getNarrationClient());
    return;
  }

  if (action === "relight") {
    // Scene 6 finale: light the lantern via the chosen path (`topic`), then run
    // the shared resolution (hook resolved, XP/level, reputation, memory pin).
    await tutorialRelight(room, document, documentName, topic ?? "improv");
    return;
  }

  if (action === "wrap") {
    // Scene 7 wrap: post the closing narration + session-complete summary and
    // signal the surface to open the graduation modal (completion + achievement
    // writes are owned by the web `tutorial.complete` mutation).
    await tutorialWrap(room, document, documentName);
    return;
  }

  if (action === "auto-hint") {
    // Idle-hint auto-progress (#178): post the scene's nudge copy, then advance
    // when not mid-combat (combat scenes only get the narration nudge).
    const state = await room.getState();
    const hint = tutorialHintForScene(state.currentSceneId);
    if (!hint) return;
    if (!room.markOnce(`auto-hint:${state.currentSceneId}`)) return;
    await appendAndPersist(document, documentName, [
      gmEntry(hint.autoProgressNarration, chatDeps),
    ]);
    if (state.encounter) return;
    const result = await room.advance();
    writeProjection(document, await room.getState());
    if (!result) return;
    const parsed = parseRoom(documentName);
    if (parsed?.kind === "campaign") {
      await setTutorialScene(parsed.campaignId, result.sceneId);
    }
    await appendAndPersist(document, documentName, [
      gmEntry(result.narration, chatDeps, { mentions: result.mentions }),
    ]);
    if (result.combat) {
      tutorialSignal(document, "combat");
      await runTutorialCombat(room, document, documentName, getNarrationClient());
    }
    return;
  }

  if (action === "companion") {
    // Old Brennar steps in and joins the party (the engine entity; the DB
    // membership row is written by the tutorial tRPC router, D4).
    const joined = await room.summonCompanion();
    writeProjection(document, await room.getState());
    if (!joined) return;
    await appendAndPersist(document, documentName, [
      gmEntry(
        `An old cleric steps in from the back room, eyes on the door. ` +
          `"Then I'm coming too. I knew Marlowe." ${joined} has joined your party.`,
        chatDeps,
      ),
    ]);
    return;
  }

  // action === "check" — `help` grants advantage (the companion's Help action).
  const checkScene = (await room.getState()).currentSceneId;
  if (!checkScene || !room.markOnce(`check:${checkScene}`)) return;
  const result = await room.runScriptedCheck(
    help ? { mode: "advantage" } : undefined,
  );
  writeProjection(document, await room.getState());
  if (!result) return;
  const summary = result.summary as
    | { total?: number; success?: boolean }
    | undefined;
  if (!result.accepted || !summary || typeof summary.total !== "number") return;

  const success = summary.success ?? false;
  await appendAndPersist(document, documentName, [
    checkEntry(
      {
        actorName: result.actorName,
        abilityLabel: abilityLabel(result.check.ability),
        skill: result.check.skill,
        total: summary.total,
        dc: result.check.dc,
        success,
      },
      chatDeps,
    ),
    gmEntry(success ? result.check.successText : result.check.failureText, chatDeps),
  ]);

  // Scripted loot (D4): a successful check with loot claims it into the hero's
  // real inventory, then signals connected tabs to refresh the drawer.
  if (success && result.check.loot && result.check.loot.length > 0) {
    const parsed = parseRoom(documentName);
    if (parsed?.kind === "campaign") {
      const granted = await grantTutorialLoot(parsed.campaignId, result.check.loot);
      if (granted.length > 0) {
        await appendAndPersist(document, documentName, [
          gmEntry(`Claimed: ${granted.join(", ")}.`, chatDeps),
        ]);
        try {
          document.broadcastStateless(
            JSON.stringify({ t: "tutorial", event: "loot" }),
          );
        } catch {
          // The drawer refresh is best-effort; the items are already persisted.
        }
      }
    }
  }
}

/**
 * Tutorial free-text chat rails (#178): classify into scripted beats before the
 * LLM runs. Returns true when the line was handled (caller should skip LLM).
 */
async function handleTutorialChat(
  room: TutorialRoom,
  document: Parameters<typeof appendChat>[0] & {
    broadcastStateless(payload: string): void;
  },
  documentName: string,
  message: { text: string },
): Promise<boolean> {
  const state = await room.getState();
  const sceneId = state.currentSceneId;

  if (sceneId === TUTORIAL_SCENE_HEARTH) {
    const topic = classifyScene2Topic(message.text);
    const beat = room.say(topic);
    if (beat && room.markOnce(`chat:say:${topic}`)) {
      await appendAndPersist(document, documentName, [
        gmEntry(beat.text, chatDeps, { mentions: beat.mentions }),
      ]);
      return true;
    }
  }

  if (
    sceneId === TUTORIAL_SCENE_HOLLOWS_EDGE &&
    classifyTutorialLeaveIntent(message.text)
  ) {
    if (room.markOnce("chat:leave-rail")) {
      await appendAndPersist(document, documentName, [
        gmEntry(TUTORIAL_LEAVE_VILLAGE_RAIL, chatDeps),
      ]);
      return true;
    }
  }

  if (sceneId === TUTORIAL_SCENE_SPIRE_UPPER && !state.encounter) {
    const pathId = classifyTutorialRelightIntent(message.text);
    if (pathId) {
      await tutorialRelight(room, document, documentName, pathId);
      return true;
    }
  }

  return false;
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
    const room = await roomFor(documentName);
    await room.ensureSeeded();
    writeProjection(document, await room.getState());
    // Re-hydrate persisted chat so a cold-loaded campaign room resumes the
    // conversation instead of starting blank (#96). Sandbox rooms are ephemeral.
    const parsed = parseRoom(documentName);
    if (parsed?.kind === "campaign") {
      const history = await loadChatMessages(parsed.campaignId);
      if (history.length > 0) {
        appendChat(document, history);
      } else if (room instanceof TutorialRoom) {
        // First load of a fresh tutorial: open with the scripted GM hook (TUT-1)
        // so the player lands in-fiction, even with the LLM unconfigured.
        const opening = tutorialScene((await room.getState()).currentSceneId);
        if (opening) {
          await appendAndPersist(document, documentName, [
            gmEntry(opening.narration, chatDeps, { mentions: opening.mentions }),
          ]);
        }
      }
    }
    // If a foe won initiative, let it act before the first player join sees the
    // board — so combat never opens stuck on an enemy's turn.
    await runEnemyTurns(room, document, documentName, getNarrationClient());
    return document;
  },

  async onStateless({ connection, document, documentName, payload }) {
    const message = parseMessage(payload);
    if (!message) return;
    const room = await roomFor(documentName);

    if (message.t === "tutorial") {
      if (room instanceof TutorialRoom) {
        await handleTutorial(
          room,
          document,
          documentName,
          message.action,
          message.topic,
          message.help,
        );
      }
      return;
    }

    if (message.t === "cmd") {
      if (!isBattleAction(message.action)) {
        connection.sendStateless(REJECTED);
        return;
      }
      if (room instanceof TutorialRoom && message.action.type === "attack") {
        const state = await room.getState();
        const target = state.entities[message.action.target];
        if (
          target &&
          isTutorialFriendlyFireTarget(target, message.action.attacker)
        ) {
          await appendAndPersist(document, documentName, [
            gmEntry(TUTORIAL_ATTACK_ALLY_DEFLECT, chatDeps),
          ]);
          return;
        }
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
        // Tutorial rooms run the scripted Scene 5 driver (companion AI, safety
        // net, victory→advance) instead of the generic enemy loop.
        if (room instanceof TutorialRoom) {
          await runTutorialCombat(room, document, documentName, getNarrationClient());
        } else {
          await runEnemyReactions(room, document, documentName, getNarrationClient());
          await runEnemyTurns(room, document, documentName, getNarrationClient());
        }
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

      if (room instanceof TutorialRoom) {
        if (await handleTutorialChat(room, document, documentName, message)) {
          return;
        }
      }

      if (!respond) return;

      const client = getNarrationClient();
      if (!client) {
        // Unconfigured: canned tutorial fallback or the instant stub.
        if (room instanceof TutorialRoom) {
          const sceneId = (await room.getState()).currentSceneId;
          await appendAndPersist(document, documentName, [
            gmEntry(tutorialChatFallback(sceneId, message.text), chatDeps),
          ]);
          return;
        }
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
    const resetParsed = parseRoom(documentName);
    // Tutorial reset is a full replay-from-scratch (#bug3): clear the chat window
    // (live doc + persisted rows) and restore the seeded DB state, then re-post
    // the opening scene so the player lands back in-fiction on a clean slate.
    if (room instanceof TutorialRoom && resetParsed?.kind === "campaign") {
      clearChat(document);
      await clearCampaignChat(resetParsed.campaignId);
      await resetTutorialState(resetParsed.campaignId);
      const opening = tutorialScene((await room.getState()).currentSceneId);
      if (opening) {
        await appendAndPersist(document, documentName, [
          gmEntry(opening.narration, chatDeps, { mentions: opening.mentions }),
        ]);
      }
      // Nudge connected tabs to refetch the tutorial DB state + clear local
      // fire-once guards (the new projection alone doesn't cover tRPC queries).
      tutorialSignal(document, "reset");
    }
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
