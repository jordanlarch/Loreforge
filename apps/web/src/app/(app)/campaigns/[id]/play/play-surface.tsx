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
import { useMemo, useState } from "react";

import {
  areHostile,
  FEET_PER_CELL,
  FIXTURE_BATTLE_PARTY_SIDE,
  type EntityState,
  type WorldState,
} from "@app/engine";

import { trpc } from "@/lib/trpc/client";
import { reachableCells, type Cell } from "@/lib/battle-map/geometry";
import {
  castableSpellsFor,
  controllableReactors,
  deriveStrike,
  MELEE_REACH_FT,
  reactionWindowKey,
  targetsInRange,
  type CastableSpell,
} from "@/lib/live-combat";
import type { BattleToken, TargetingOverlay } from "./battle-map";
import { CharacterHud } from "./character-hud";
import { ChatZone } from "./chat-zone";
import { CombatActionBar, type ArmedAction } from "./combat-action-bar";
import { CombatOverlay, type InitiativeChip } from "./combat-overlay";
import { ReactionPrompt } from "./reaction-prompt";
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
  order: InitiativeChip[];
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

  const order: InitiativeChip[] = encounter.order.map((entry) => {
    const e = state.entities[entry.entity];
    return {
      id: entry.entity,
      name: e?.name ?? entry.entity,
      isActive: entry.entity === activeRef,
      hostile: areHostile(FIXTURE_BATTLE_PARTY_SIDE, encounter.sides[entry.entity]),
      alive: e?.alive ?? true,
    };
  });

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

  // Combat-loop UI state: the armed action (driving the map target picker) and
  // the last reaction window the player already dismissed.
  const [armed, setArmed] = useState<ArmedAction>(null);
  const [dismissedReaction, setDismissedReaction] = useState<string | null>(null);

  const state = session.state;

  // The active combatant, and whether the local player controls this turn.
  const activeEntity: EntityState | undefined = useMemo(() => {
    if (!state?.encounter) return undefined;
    const ref = state.encounter.order[state.encounter.activeIndex]?.entity;
    return ref ? state.entities[ref] : undefined;
  }, [state]);

  const controllableTurn =
    !!activeEntity &&
    activeEntity.alive &&
    activeEntity.actionEconomy !== undefined &&
    state?.encounter?.sides[activeEntity.id] === FIXTURE_BATTLE_PARTY_SIDE;

  const castableSpells: CastableSpell[] = activeEntity
    ? castableSpellsFor(activeEntity)
    : [];

  // While an action is armed, resolve the range + valid targets for the picker.
  const targeting: TargetingOverlay | undefined = useMemo(() => {
    if (!state || !armed || !activeEntity?.position) return undefined;
    const rangeFt =
      armed.kind === "attack" ? MELEE_REACH_FT : armed.spell.rangeFt;
    const targetableIds = targetsInRange(state, activeEntity.id, rangeFt).map(
      (e) => e.id,
    );
    return {
      origin: activeEntity.position,
      rangeCells: Math.floor(rangeFt / FEET_PER_CELL),
      targetableIds,
    };
  }, [state, armed, activeEntity]);

  function onPickTarget(targetId: string) {
    if (!armed || !activeEntity) return;
    if (armed.kind === "attack") {
      const strike = deriveStrike(activeEntity);
      session.attack(activeEntity.id, targetId, strike.attackBonus, strike.damage);
    } else {
      session.castSpell(
        activeEntity.id,
        armed.spell.id,
        armed.spell.level,
        [targetId],
      );
    }
    setArmed(null);
  }

  // A pending opportunity-attack the local player can take (one at a time).
  const reaction = state ? controllableReactors(state, FIXTURE_BATTLE_PARTY_SIDE)[0] : undefined;
  const reactionKey = state ? reactionWindowKey(state) : null;
  const showReaction =
    !!reaction && !!reactionKey && reactionKey !== dismissedReaction;

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
          <CombatOverlay
            round={vm.round}
            activeName={vm.activeName}
            order={vm.order}
          />

          {controllableTurn && (
            <CombatActionBar
              spells={castableSpells}
              armed={armed}
              disabled={session.isBusy}
              onAttack={() => setArmed({ kind: "attack" })}
              onCast={(spell) => setArmed({ kind: "cast", spell })}
              onCancel={() => setArmed(null)}
            />
          )}

          <div className="inline-block overflow-hidden rounded-lg border border-lore-border bg-lore-bg">
            <BattleMap
              cols={vm.cols}
              rows={vm.rows}
              walls={vm.walls}
              tokens={vm.tokens}
              reachable={armed ? [] : vm.reachable}
              onMoveToken={session.moveToken}
              targeting={targeting}
              onPickTarget={onPickTarget}
            />
          </div>
          <p className="mt-2 text-xs text-lore-muted">
            {armed
              ? "Tap a highlighted enemy to resolve the action — the engine rolls and applies the result."
              : "Drag the highlighted active token within its movement radius, or arm an Attack/Cast above. The engine validates everything."}
          </p>
        </section>

        {/* HUD + initiative rail */}
        <aside className="space-y-4">
          {showReaction && reaction && (
            <ReactionPrompt
              reactorName={reaction.reactor.name}
              moverName={reaction.mover.name}
              onTake={() => {
                const strike = deriveStrike(reaction.reactor);
                session.opportunityAttack(
                  reaction.reactor.id,
                  reaction.mover.id,
                  strike.attackBonus,
                  strike.damage,
                );
                if (reactionKey) setDismissedReaction(reactionKey);
              }}
              onPass={() => {
                if (reactionKey) setDismissedReaction(reactionKey);
              }}
            />
          )}

          <CharacterHud session={session} />

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
