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
import { checkAction } from "@app/engine";
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
  getCampaignParty,
  getEventStore,
  isCampaignOwner,
  loadChatMessages,
  persistChatMessages,
} from "./db.js";
import {
  abilityLabel,
  activePlayerEntity,
  decideCheck,
  getNarrationClient,
  narrate,
} from "./narration.js";
import { writeProjection } from "./projection.js";
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
        ? new CampaignRoom(parsed.campaignId, getEventStore(), getCampaignParty)
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
 * Produce the GM's narration for a player line (#96) with a known-configured
 * client, falling back to the stubbed echo on any narration failure. The
 * deterministic engine still owns all mechanics — this is fiction only.
 */
async function composeGmReply(
  room: LiveRoom,
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
    const gm = await composeGmReply(room, priorChat, message, client);
    await appendAndPersist(document, documentName, [gm]);
    return;
  }

  let decision;
  try {
    decision = await decideCheck({ client, state, playerLine: message.text });
  } catch {
    const gm = await composeGmReply(room, priorChat, message, client);
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
    const gm = await composeGmReply(room, priorChat, message, client);
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
    });
    gm = gmEntry(narration.text, chatDeps, { mentions: narration.mentions });
  } catch {
    gm = gmEntry(success ? "Your effort pays off." : "It doesn't work.", chatDeps);
  }
  await appendAndPersist(document, documentName, [gm]);
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
          const gm = await composeGmReply(room, priorChat, message, client);
          await appendAndPersist(document, documentName, [gm]);
        }
      } finally {
        setThinking(document, false);
      }
      return;
    }

    // message.t === "reset"
    await room.reset();
    writeProjection(document, await room.getState());
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
