"use client";

/**
 * Sandbox play surface (#16) — the always-on battle map above a stub
 * chat/HUD shell, wired to the deterministic engine through a *session source*.
 *
 * The session source is `useLiveSession` (#14): a Yjs subscription to the
 * server-authoritative `@app/ws-server`. The client only observes the synced
 * projection and sends commands — the engine runs on the server. Two tabs on
 * the same account share one live battle. The renderer below is unchanged.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";

import {
  areHostile,
  FEET_PER_CELL,
  FIXTURE_BATTLE_PARTY_SIDE,
  type WorldState,
} from "@app/engine";

import { trpc } from "@/lib/trpc/client";
import { reachableCells, type Cell } from "@/lib/battle-map/geometry";
import type { BattleToken } from "./battle-map";
import { CharacterHud } from "./character-hud";
import { ChatZone } from "./chat-zone";
import { useLiveSession } from "./use-live-session";

const BattleMap = dynamic(() => import("./battle-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[440px] w-[528px] items-center justify-center rounded-lg border border-lore-border bg-lore-bg text-sm text-lore-muted">
      Loading map…
    </div>
  ),
});

type ViewModel = {
  cols: number;
  rows: number;
  walls: Cell[];
  tokens: BattleToken[];
  reachable: Cell[];
  activeName: string | undefined;
  round: number;
  movement: { used: number; total: number } | undefined;
  order: { id: string; name: string; isActive: boolean }[];
};

function buildViewModel(state: WorldState): ViewModel | null {
  const sceneId = state.currentSceneId;
  const scene = sceneId ? state.scenes[sceneId] : undefined;
  const map = scene?.map;
  const encounter = state.encounter;
  if (!scene || !map || !encounter) return null;

  const activeRef = encounter.order[encounter.activeIndex]?.entity;
  const activeEntity = activeRef ? state.entities[activeRef] : undefined;

  const placed = Object.values(state.entities).filter(
    (e) => e.sceneId === sceneId && e.position !== undefined,
  );

  const tokens: BattleToken[] = placed.map((e) => {
    const side = encounter.sides[e.id];
    return {
      id: e.id,
      name: e.name,
      kind: e.kind,
      position: e.position!,
      hp: { current: e.hp.current, max: e.hp.max },
      alive: e.alive,
      hostile: areHostile(FIXTURE_BATTLE_PARTY_SIDE, side),
      isActive: e.id === activeRef,
      draggable: e.id === activeRef && e.actionEconomy !== undefined && e.alive,
    };
  });

  // Movement radius for the active combatant.
  let reachable: Cell[] = [];
  const movement = activeEntity?.actionEconomy?.movement;
  if (activeEntity?.position && movement) {
    const maxSteps = Math.floor((movement.total - movement.used) / FEET_PER_CELL);
    const wallSet = new Set(map.blockedCells.map((c) => `${c.x},${c.y}`));
    const occupied = new Set(
      placed
        .filter((e) => e.alive && e.id !== activeEntity.id)
        .map((e) => `${e.position!.x},${e.position!.y}`),
    );
    reachable = reachableCells(
      activeEntity.position,
      maxSteps,
      (c) => c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height,
      (c) => wallSet.has(`${c.x},${c.y}`),
    ).filter((c) => !occupied.has(`${c.x},${c.y}`));
  }

  const order = encounter.order.map((entry) => ({
    id: entry.entity,
    name: state.entities[entry.entity]?.name ?? entry.entity,
    isActive: entry.entity === activeRef,
  }));

  return {
    cols: map.width,
    rows: map.height,
    walls: map.blockedCells,
    tokens,
    reachable,
    activeName: activeEntity?.name,
    round: encounter.round,
    movement,
    order,
  };
}

type LiveSession = ReturnType<typeof useLiveSession>;

/**
 * Shared live battle surface. Driven by a session source (`useLiveSession`) and
 * a heading; identical for the sandbox fixture and a persisted campaign.
 */
function LiveBattle({
  session,
  title,
  context,
  backHref,
}: {
  session: LiveSession;
  title: string;
  context: string;
  /** Optional "back to workspace" target (absent for the sandbox). */
  backHref?: string;
}) {
  const vm = useMemo(
    () => (session.state ? buildViewModel(session.state) : null),
    [session.state],
  );

  if (session.error) {
    return (
      <p className="px-4 py-16 text-center text-lore-muted">
        Couldn&apos;t reach the live session. Check that the sync server is
        running and you&apos;re signed in.
      </p>
    );
  }
  if (session.isLoading || !session.state) {
    return (
      <p className="px-4 py-16 text-center text-lore-muted">
        Connecting to live session…
      </p>
    );
  }
  if (!vm) {
    return (
      <p className="px-4 py-16 text-center text-lore-muted">
        No active encounter in this scene.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {backHref && (
        <Link
          href={backHref}
          className="mb-2 inline-block text-sm text-lore-muted transition-colors hover:text-lore-text"
        >
          ← Back to Workspace
        </Link>
      )}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-lore-muted">
            {context} · Round {vm.round}
            {vm.activeName ? ` · ${vm.activeName}'s turn` : ""}
            {vm.movement
              ? ` · ${vm.movement.total - vm.movement.used}/${vm.movement.total} ft`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded border border-lore-border bg-lore-surface px-2 py-1 text-xs text-lore-muted"
            title="Connected clients in this live session"
          >
            {session.peers} online
          </span>
          {session.rejected && (
            <span className="rounded border border-lore-border bg-lore-surface px-2 py-1 text-xs text-lore-muted">
              Illegal move — out of range, blocked, or occupied.
            </span>
          )}
          <button
            onClick={session.endTurn}
            disabled={session.isBusy}
            className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent disabled:opacity-40"
          >
            End turn
          </button>
          <button
            onClick={session.reset}
            disabled={session.isBusy}
            className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent disabled:opacity-40"
          >
            Reset
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        {/* Map zone */}
        <section>
          <div className="inline-block overflow-hidden rounded-lg border border-lore-border bg-lore-bg">
            <BattleMap
              cols={vm.cols}
              rows={vm.rows}
              walls={vm.walls}
              tokens={vm.tokens}
              reachable={vm.reachable}
              onMoveToken={session.moveToken}
            />
          </div>
          <p className="mt-2 text-xs text-lore-muted">
            Drag the highlighted active token within its movement radius. The
            engine validates every move — illegal drops snap back.
          </p>
        </section>

        {/* HUD + initiative rail */}
        <aside className="space-y-4">
          <CharacterHud session={session} />

          <div className="rounded-lg border border-lore-border bg-lore-surface p-4">
            <h2 className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
              Initiative
            </h2>
            <ol className="space-y-1 text-sm">
              {vm.order.map((c) => (
                <li
                  key={c.id}
                  className={`flex items-center gap-2 rounded px-2 py-1 ${
                    c.isActive
                      ? "bg-lore-accent-dim text-lore-text"
                      : "text-lore-muted"
                  }`}
                >
                  {c.isActive && <span aria-hidden>▶</span>}
                  {c.name}
                </li>
              ))}
            </ol>
          </div>

          <ChatZone entries={session.chat} onSend={session.sendChat} />
        </aside>
      </div>
    </div>
  );
}

/** The per-user sandbox fixture demo (scope A). */
export function SandboxPlaySurface() {
  const session = useLiveSession();
  return (
    <LiveBattle session={session} title="Salt Way Ambush" context="Sandbox battle" />
  );
}

/**
 * Live play for a persisted, owner-scoped campaign (#14 scope B). Observes the
 * `campaign:{id}` room; the WS server enforces ownership authoritatively, so
 * this client check is UX only. The seeded goblin ambush makes a new campaign
 * immediately playable until real encounter authoring lands.
 */
export function CampaignPlaySurface({ campaignId }: { campaignId: string }) {
  const campaign = trpc.campaigns.get.useQuery({ id: campaignId });
  const session = useLiveSession({ campaignId });

  if (campaign.isLoading) {
    return (
      <p className="px-4 py-16 text-center text-lore-muted">Loading campaign…</p>
    );
  }
  if (!campaign.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Campaign not found</h1>
        <p className="mt-4 text-lore-muted">
          This campaign doesn&apos;t exist or isn&apos;t yours.
        </p>
        <p className="mt-6 text-sm">
          <Link className="text-lore-accent underline" href="/campaigns">
            Back to campaigns
          </Link>
        </p>
      </div>
    );
  }

  return (
    <LiveBattle
      session={session}
      title={campaign.data.name}
      context="Live campaign"
      backHref={`/campaigns/${campaignId}`}
    />
  );
}
