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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  areHostile,
  FEET_PER_CELL,
  FIXTURE_BATTLE_PARTY_SIDE,
  type EntityState,
  type WorldState,
} from "@app/engine";

import { trpc } from "@/lib/trpc/client";
import type { EquipmentItem, SpellLoadout } from "@/lib/character";
import { joinedSincePrompt } from "@/lib/live-presence";
import { usePacingPrefs, useTurnTimer } from "@/lib/live-pacing";
import { reachableCells, type Cell } from "@/lib/battle-map/geometry";
import {
  aoeAffectedCells,
  aoeCaughtIds,
  castableSpellsFor,
  controllableReactors,
  hostilesInScene,
  reactionWindowKey,
  targetsInRange,
  type CastableSpell,
} from "@/lib/live-combat";
import {
  deriveWeaponAttacks,
  genericStrike,
  preparedSpellNames,
  quickUseItems,
  sheetCastableSpells,
  type WeaponAttack,
} from "@/lib/sheet-loadout";
import type { AimOverlay, BattleToken, TargetingOverlay } from "./battle-map";
import { CharacterHud } from "./character-hud";
import { ChatZone } from "./chat-zone";
import { CombatActionBar, type ArmedAction } from "./combat-action-bar";
import { CombatOverlay, type InitiativeChip } from "./combat-overlay";
import { LivePlayTopBar } from "./live-top-bar";
import { MapViewport } from "./map-viewport";
import { PartyRail } from "./party-rail";
import { ReactionPrompt } from "./reaction-prompt";
import { useSceneTransition } from "./use-scene-transition";
import { useLiveSession } from "./use-live-session";

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

/** A live combatant's sheet bits (#98), keyed by entity id, for HUD/action bar. */
export type SheetData = { equipment: EquipmentItem[]; spells: SpellLoadout };

/**
 * Shared live battle surface. Driven by a session source (`useLiveSession`) and
 * a heading; identical for the sandbox fixture and a persisted campaign. With a
 * `loadouts` map (#98) the HUD + action bar are driven by real weapons + spells.
 */
function LiveBattle({
  session,
  title,
  context,
  backHref,
  loadouts,
  campaignId,
}: {
  session: LiveSession;
  title: string;
  context: string;
  /** Optional "back to workspace" target (absent for the sandbox). */
  backHref?: string;
  /** Per-entity sheet loadouts (#98); absent for the sandbox fixture. */
  loadouts?: Record<string, SheetData>;
  /** Owning campaign id; scopes persisted pacing prefs (#104). */
  campaignId?: string;
}) {
  const vm = useMemo(
    () => (session.state ? buildViewModel(session.state) : null),
    [session.state],
  );

  // Combat-loop UI state: the armed action (driving the map target picker), the
  // AoE aim cell (#99), and the last reaction window the player already dismissed.
  const [armed, setArmed] = useState<ArmedAction>(null);
  const [aimCell, setAimCell] = useState<Cell | null>(null);
  const [dismissedReaction, setDismissedReaction] = useState<string | null>(null);
  // Client-side session pause (#101): freezes the local turn UI + clock. The
  // server-authoritative engine freeze is a deferred follow-up.
  const [paused, setPaused] = useState(false);

  // End-session (PLAY-12, #151): record the session + generate a recap (MEM-4),
  // then return to the workspace Sessions tab where the recap appears. Only for
  // real campaigns (the sandbox has nothing to record against).
  const router = useRouter();
  const endSession = trpc.sessions.end.useMutation({
    onSettled: () => {
      if (campaignId) router.push(`/campaigns/${campaignId}?tab=sessions`);
    },
  });

  // Scene transition (#103): watch the synced scene id and cross-fade + drop a
  // location banner when the engine advances to a new scene.
  const transitionSceneId = session.state?.currentSceneId;
  const transitionSceneName = transitionSceneId
    ? session.state?.scenes[transitionSceneId]?.name
    : undefined;
  const { banner: sceneBanner, transitioning } = useSceneTransition(
    transitionSceneId,
    transitionSceneName,
  );

  // Async → Live affordance (#105): when a peer joins, surface a dismissible
  // "you're now Live" prompt. The shell is identical in both modes.
  const [joinPrompt, setJoinPrompt] = useState<string | null>(null);
  const prevPeers = useRef(session.peers);
  useEffect(() => {
    const msg = joinedSincePrompt(prevPeers.current, session.peers);
    prevPeers.current = session.peers;
    if (msg) setJoinPrompt(msg);
  }, [session.peers]);

  // Pacing controls (#104): persisted style + soft round timer + Continue/Hold/
  // Skip quick controls. Continue/Skip nudge the AI through chat; Hold is local.
  const { prefs: pacingPrefs, update: updatePacing } = usePacingPrefs(campaignId);
  const [holding, setHolding] = useState(false);
  const inCombat = session.state?.encounter !== undefined;
  const turnKey =
    inCombat && vm ? `${vm.round}:${vm.activeName ?? ""}` : undefined;
  const turnElapsed = useTurnTimer(turnKey, paused || holding);

  // A fresh arm clears any stale aim from a prior AoE cast.
  useEffect(() => {
    setAimCell(null);
  }, [armed]);

  const state = session.state;

  // Whether the armed action is an AoE spell that uses the aim picker (#99).
  const isAreaCast = armed?.kind === "cast" && armed.spell.area !== undefined;

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

  // Sheet-driven loadout for the active combatant (#98): real weapons + spells
  // + consumables when the roster is bridged in; generic fallback otherwise.
  const activeSheet = activeEntity ? loadouts?.[activeEntity.id] : undefined;
  const weapons: WeaponAttack[] = activeEntity
    ? activeSheet
      ? deriveWeaponAttacks(activeEntity, activeSheet.equipment)
      : [genericStrike(activeEntity)]
    : [];
  const quickItems = activeSheet ? quickUseItems(activeSheet.equipment) : [];
  const castableSpells: CastableSpell[] = activeEntity
    ? activeSheet
      ? sheetCastableSpells(activeEntity, preparedSpellNames(activeSheet.spells))
      : castableSpellsFor(activeEntity)
    : [];

  // A confirmation line while the active PC holds a readied action (#104). The
  // engine clears `readied` at the start of the owner's next turn.
  const readiedNote =
    activeEntity?.readied && state
      ? `Readied a strike against ${
          state.entities[activeEntity.readied.action.target]?.name ?? "a foe"
        } — fires when they enter range.`
      : undefined;

  // While a single-target action is armed, resolve the range + valid targets for
  // the picker. AoE casts use the aim overlay below instead.
  const targeting: TargetingOverlay | undefined = useMemo(() => {
    if (!state || !armed || isAreaCast || !activeEntity?.position) {
      return undefined;
    }
    const rangeFt =
      armed.kind === "cast" ? armed.spell.rangeFt : armed.attack.rangeFt;
    // A readied strike picks any hostile in the scene (it fires later, when that
    // foe enters range); an immediate attack/cast is limited to current range.
    const targetableIds =
      armed.kind === "ready"
        ? hostilesInScene(state, activeEntity).map((e) => e.id)
        : targetsInRange(state, activeEntity.id, rangeFt).map((e) => e.id);
    return {
      origin: activeEntity.position,
      rangeCells: Math.floor(rangeFt / FEET_PER_CELL),
      targetableIds,
    };
  }, [state, armed, isAreaCast, activeEntity]);

  // AoE aim overlay (#99): placement range + the area/caught preview for the
  // current aim cell, using the engine's own shape math (so it matches exactly).
  const aiming: AimOverlay | undefined = useMemo(() => {
    if (
      !state ||
      armed?.kind !== "cast" ||
      !armed.spell.area ||
      !activeEntity?.position
    ) {
      return undefined;
    }
    const area = armed.spell.area;
    return {
      origin: activeEntity.position,
      rangeCells: Math.floor(armed.spell.rangeFt / FEET_PER_CELL),
      areaCells: aimCell
        ? aoeAffectedCells(state, activeEntity.id, area, aimCell)
        : [],
      caughtIds: aimCell
        ? aoeCaughtIds(state, activeEntity.id, area, aimCell)
        : [],
    };
  }, [state, armed, activeEntity, aimCell]);

  function onPickTarget(targetId: string) {
    if (!armed || !activeEntity) return;
    if (armed.kind === "attack") {
      session.attack(
        activeEntity.id,
        targetId,
        armed.attack.attackBonus,
        armed.attack.damage,
      );
    } else if (armed.kind === "ready") {
      // Hold the strike; the server fires it when the foe enters this range.
      session.readyAction(
        activeEntity.id,
        `in_range:${armed.attack.rangeFt}`,
        targetId,
        armed.attack.attackBonus,
        armed.attack.damage,
      );
    } else {
      // Single-target spell (AoE casts confirm via the aim picker, not here).
      session.castSpell(activeEntity.id, armed.spell.id, armed.spell.level, [
        targetId,
      ]);
    }
    setArmed(null);
  }

  function onConfirmAim() {
    if (!isAreaCast || armed?.kind !== "cast" || !activeEntity || !aimCell) {
      return;
    }
    session.castSpell(
      activeEntity.id,
      armed.spell.id,
      armed.spell.level,
      undefined,
      aimCell,
    );
    setArmed(null);
    setAimCell(null);
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

  const sceneName = session.state.currentSceneId
    ? session.state.scenes[session.state.currentSceneId]?.name
    : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <LivePlayTopBar
        title={title}
        sceneName={sceneName ?? context}
        peers={session.peers}
        round={vm.round}
        activeName={vm.activeName}
        movementLeft={vm.movement ? vm.movement.total - vm.movement.used : undefined}
        movementTotal={vm.movement?.total}
        backHref={backHref}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        isBusy={session.isBusy}
        showTurnActions={controllableTurn}
        onEndTurn={session.endTurn}
        onReset={session.reset}
        onEndSession={
          campaignId ? () => endSession.mutate({ campaignId }) : undefined
        }
        endingSession={endSession.isPending}
        rejected={session.rejected}
        pacing={{
          prefs: pacingPrefs,
          onUpdate: updatePacing,
          holding,
          onToggleHold: () => setHolding((h) => !h),
          onContinue: () => session.sendChat("(Continue the scene.)", "continue"),
          onSkip: (duration) => session.sendChat(`/skip ${duration}`, "skip"),
          turnElapsedSec: inCombat ? turnElapsed : undefined,
          disabled: session.isBusy || paused,
        }}
      />

      {joinPrompt && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-lore-accent bg-lore-accent-dim px-3 py-2 text-sm text-lore-text">
          <span>⚡ {joinPrompt}</span>
          <button
            type="button"
            onClick={() => setJoinPrompt(null)}
            className="shrink-0 rounded border border-lore-border px-2 py-1 text-xs text-lore-muted transition-colors hover:text-lore-text"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        {/* Map zone */}
        <section>
          <CombatOverlay
            round={vm.round}
            activeName={vm.activeName}
            order={vm.order}
          />

          {controllableTurn && !paused && (
            <CombatActionBar
              weapons={weapons}
              spells={castableSpells}
              armed={armed}
              disabled={session.isBusy}
              aimReady={aimCell !== null}
              readiedNote={readiedNote}
              onAttack={(attack) => setArmed({ kind: "attack", attack })}
              onCast={(spell) => setArmed({ kind: "cast", spell })}
              onReady={(attack) => setArmed({ kind: "ready", attack })}
              onConfirm={onConfirmAim}
              onCancel={() => setArmed(null)}
            />
          )}

          {paused && (
            <div className="mb-3 rounded-lg border border-lore-accent bg-lore-accent-dim px-3 py-2 text-sm text-lore-text">
              ⏸ Session paused — turn actions are frozen. Press Resume to continue.
            </div>
          )}

          <MapViewport
            sceneBanner={sceneBanner}
            transitioning={transitioning}
            cols={vm.cols}
            rows={vm.rows}
            walls={vm.walls}
            tokens={vm.tokens}
            reachable={paused || armed ? [] : vm.reachable}
            onMoveToken={paused ? () => {} : session.moveToken}
            targeting={paused ? undefined : targeting}
            onPickTarget={paused ? () => {} : onPickTarget}
            aiming={paused ? undefined : aiming}
            onAimCell={paused ? () => {} : setAimCell}
          />
          <p className="mt-2 text-xs text-lore-muted">
            {isAreaCast
              ? "Tap a cell to place the blast — the highlighted area shows who's caught — then Confirm. The engine resolves saves + damage."
              : armed?.kind === "ready"
                ? "Tap a foe to hold your strike for — the engine fires it automatically when they enter range on their turn."
                : armed
                  ? "Tap a highlighted enemy to resolve the action — the engine rolls and applies the result."
                  : "Drag the highlighted active token within its movement radius, or arm an Attack/Cast/Ready above. The engine validates everything."}
          </p>
        </section>

        {/* HUD + initiative rail */}
        <aside className="space-y-4">
          {showReaction && reaction && (
            <ReactionPrompt
              reactorName={reaction.reactor.name}
              moverName={reaction.mover.name}
              onTake={() => {
                const reactorSheet = loadouts?.[reaction.reactor.id];
                const strike = reactorSheet
                  ? (deriveWeaponAttacks(
                      reaction.reactor,
                      reactorSheet.equipment,
                    )[0] ?? genericStrike(reaction.reactor))
                  : genericStrike(reaction.reactor);
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

          <CharacterHud session={session} weapons={weapons} items={quickItems} />

          <ChatZone
            entries={session.chat}
            onSend={session.sendChat}
            thinking={session.gmThinking}
          />
        </aside>
      </div>

      <PartyRail state={session.state} />
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

  // Sheet bridge (#98): map each roster character's equipment + spells by id (=
  // the live entity id the WS server seeds), so the HUD + action bar are driven
  // by real loadouts. Absent rows simply fall back to the generic behavior.
  const loadoutQuery = trpc.campaigns.partyLoadout.useQuery({ campaignId });
  const loadouts = useMemo(() => {
    const map: Record<string, SheetData> = {};
    for (const row of loadoutQuery.data ?? []) {
      map[row.id] = { equipment: row.equipment, spells: row.spells };
    }
    return map;
  }, [loadoutQuery.data]);

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
      loadouts={loadouts}
      campaignId={campaignId}
    />
  );
}
