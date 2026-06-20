/**
 * Loreforge WebSocket sync server (#14, scope A — Tier 4 transport).
 *
 * A Hocuspocus server that is the *authoritative* engine host for live play:
 * clients are observers of a server-written Y.Doc and submit commands over the
 * stateless channel; the engine validates/applies them and the resulting
 * projection is broadcast (`docs/engine/architecture.md` §10). No Vercel↔WS
 * backchannel exists — the engine runs here.
 *
 * Scope A drives the in-memory goblin-ambush fixture (no persistence, per-user
 * `sandbox:{userId}` rooms). Scope B swaps the room seed for a persisted
 * per-campaign event store and keys rooms off campaign membership.
 */
import { Hocuspocus } from "@hocuspocus/server";

import {
  buildVerifier,
  jwksUrlFor,
  roomForUser,
  verifySupabaseToken,
} from "./auth.js";
import { writeProjection } from "./projection.js";
import { BattleRoom, isBattleAction } from "./room.js";

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
  | { t: "reset" };

function parseMessage(payload: string): ClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const message = value as { t?: unknown };
  if (message.t === "cmd" || message.t === "reset") return message as ClientMessage;
  return null;
}

const REJECTED = JSON.stringify({ t: "rejected" });

/** In-memory rooms, keyed by documentName. Evicted when the last client leaves. */
const rooms = new Map<string, BattleRoom>();

function roomFor(documentName: string): BattleRoom {
  let room = rooms.get(documentName);
  if (!room) {
    room = new BattleRoom();
    rooms.set(documentName, room);
  }
  return room;
}

const server = new Hocuspocus({
  name: "loreforge-ws",
  port: PORT,
  quiet: true,
  // Scope A keeps no document state; drop rooms as soon as everyone leaves.
  unloadImmediately: true,

  async onAuthenticate({ token, documentName }) {
    if (!authConfigured) {
      throw new Error(
        "Auth not configured: set SUPABASE_URL (JWKS) and/or SUPABASE_JWT_SECRET",
      );
    }
    const { userId } = await verifySupabaseToken(token, verifier);
    if (documentName !== roomForUser(userId)) {
      throw new Error("forbidden: room does not belong to authenticated user");
    }
    return { userId };
  },

  async onLoadDocument({ document, documentName }) {
    const room = roomFor(documentName);
    await room.ensureSeeded();
    writeProjection(document, await room.getState());
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
      const { accepted } = await room.apply(message.action);
      if (accepted) {
        writeProjection(document, await room.getState());
      } else {
        connection.sendStateless(REJECTED);
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
