"use client";

/**
 * Live session source (#14) — the Yjs-backed replacement for `useSandboxSession`.
 *
 * Connects to the `@app/ws-server` Hocuspocus server, which is the authoritative
 * engine host: this hook is a pure *observer* of a server-written Y.Doc plus a
 * command sender. It never computes mechanics. Commands ride the stateless
 * channel; the server validates them, writes the resulting projection into the
 * doc, and broadcasts it to every connected tab (`docs/engine/architecture.md`
 * §10). It returns the same shape as `useSandboxSession`, so the view model and
 * PixiJS renderer are unchanged.
 */
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";

import type {
  EncounterState,
  EntityState,
  SceneState,
  WorldState,
} from "@app/engine";

import { createClient } from "@/lib/supabase/client";
import type { Cell } from "@/lib/battle-map/geometry";
import type { ChatEntry } from "@/lib/live-chat";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:1234";

/** Y.Doc field contract — must match `@app/ws-server`'s `projection.ts`. */
const BATTLE_ROOT = "battle";
/** Top-level chat log field — must match `@app/ws-server`'s `chat.ts`. */
const CHAT_ROOT = "chat";

type BattleMeta = {
  campaignId: string;
  currentSceneId: string | null;
  lastSequence: number;
};

/** Reassemble the WorldState subset the view model reads from the synced doc. */
function readBattleDoc(doc: Y.Doc): WorldState | undefined {
  const root = doc.getMap(BATTLE_ROOT);
  const meta = root.get("meta") as BattleMeta | undefined;
  if (!meta) return undefined;

  const scene = (root.get("scene") as SceneState | null) ?? null;
  const encounter = (root.get("encounter") as EncounterState | null) ?? null;
  const entities: Record<string, EntityState> = {};
  const map = root.get("entities");
  if (map instanceof Y.Map) {
    for (const [id, entity] of map.entries()) {
      entities[id] = entity as EntityState;
    }
  }

  return {
    campaignId: meta.campaignId,
    currentSceneId: meta.currentSceneId ?? undefined,
    lastSequence: meta.lastSequence,
    scenes: scene ? { [scene.id]: scene } : {},
    entities,
    encounter: encounter ?? undefined,
  };
}

/** Stable per-user presence color. */
function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360}, 70%, 60%)`;
}

type LiveStatus = "connecting" | "synced" | "error";

/**
 * Options select which room to observe. With a `campaignId`, the hook joins the
 * persisted `campaign:{id}` room (owner-only, server-authoritative); otherwise
 * it joins the per-user `sandbox:{userId}` fixture demo.
 */
export type LiveSessionOptions = { campaignId?: string };

export function useLiveSession({ campaignId }: LiveSessionOptions = {}) {
  const [state, setState] = useState<WorldState | undefined>(undefined);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [rejected, setRejected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [peers, setPeers] = useState(1);
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [gmThinking, setGmThinking] = useState(false);
  const providerRef = useRef<HocuspocusProvider | null>(null);

  useEffect(() => {
    let disposed = false;
    let provider: HocuspocusProvider | null = null;

    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (disposed) return;
      if (!session) {
        setStatus("error");
        return;
      }

      const roomName = campaignId
        ? `campaign:${campaignId}`
        : `sandbox:${session.user.id}`;

      const doc = new Y.Doc();
      provider = new HocuspocusProvider({
        url: WS_URL,
        name: roomName,
        document: doc,
        token: async () => {
          const current = await createClient().auth.getSession();
          return current.data.session?.access_token ?? "";
        },
        onSynced: () => {
          setState(readBattleDoc(doc));
          setChat(doc.getArray<ChatEntry>(CHAT_ROOT).toArray());
          setStatus("synced");
        },
        onStateless: ({ payload }) => {
          try {
            const message = JSON.parse(payload) as { t?: string; on?: boolean };
            if (message?.t === "rejected") {
              setBusy(false);
              setRejected(true);
            } else if (message?.t === "thinking") {
              // Server signal that the AI-GM is composing a reply (#97).
              setGmThinking(Boolean(message.on));
            }
          } catch {
            // ignore malformed server messages
          }
        },
        onAwarenessChange: ({ states }) => setPeers(Math.max(1, states.length)),
        onAuthenticationFailed: () => setStatus("error"),
      });

      if (disposed) {
        provider.destroy();
        return;
      }
      providerRef.current = provider;

      doc.getMap(BATTLE_ROOT).observeDeep(() => {
        setState(readBattleDoc(doc));
        setBusy(false);
      });

      const chatArr = doc.getArray<ChatEntry>(CHAT_ROOT);
      chatArr.observe(() => {
        setChat(chatArr.toArray());
        // A new entry means the GM has produced output; clear any stale
        // "thinking" indicator even if the off-signal was missed.
        setGmThinking(false);
      });

      provider.setAwarenessField("user", {
        id: session.user.id,
        name: session.user.email ?? "Adventurer",
        color: colorFor(session.user.id),
      });
    })();

    return () => {
      disposed = true;
      provider?.destroy();
      providerRef.current = null;
    };
  }, [campaignId]);

  useEffect(() => {
    if (!rejected) return;
    const timer = setTimeout(() => setRejected(false), 2500);
    return () => clearTimeout(timer);
  }, [rejected]);

  function send(message: Record<string, unknown>) {
    const provider = providerRef.current;
    if (!provider) return;
    setBusy(true);
    setRejected(false);
    provider.sendStateless(JSON.stringify(message));
  }

  /** Fire-and-forget chat send — doesn't gate the map's `isBusy` like commands. */
  function sendChat(text: string, mode?: string) {
    const provider = providerRef.current;
    if (!provider) return;
    provider.sendStateless(JSON.stringify({ t: "chat", mode, text }));
  }

  return {
    state,
    isLoading: status === "connecting" && state === undefined,
    error: status === "error",
    isBusy: busy,
    rejected,
    peers,
    chat,
    gmThinking,
    sendChat,
    moveToken: (id: string, to: Cell) =>
      send({ t: "cmd", action: { type: "move_entity", entity: id, to } }),
    endTurn: () => send({ t: "cmd", action: { type: "end_turn" } }),
    attack: (
      attacker: string,
      target: string,
      attackBonus: number,
      damage: { notation: string; type: string },
    ) =>
      send({
        t: "cmd",
        action: { type: "attack", attacker, target, attackBonus, damage },
      }),
    castSpell: (
      caster: string,
      spellId: string,
      slotLevel: number,
      targets?: string[],
      origin?: { x: number; y: number },
    ) =>
      send({
        t: "cmd",
        action: {
          type: "cast_spell",
          caster,
          spellId,
          slotLevel,
          targets: targets ?? [],
          ...(origin ? { origin } : {}),
        },
      }),
    opportunityAttack: (
      reactor: string,
      target: string,
      attackBonus: number,
      damage: { notation: string; type: string },
    ) =>
      send({
        t: "cmd",
        action: { type: "opportunity_attack", reactor, target, attackBonus, damage },
      }),
    reset: () => send({ t: "reset" }),
  };
}
