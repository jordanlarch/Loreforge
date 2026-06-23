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
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  areHostile,
  FEET_PER_CELL,
  FIXTURE_BATTLE_PARTY_SIDE,
  TUTORIAL_CHEST_LOOT,
  TUTORIAL_HOOK,
  TUTORIAL_SCENE_CROOKED_LANE,
  TUTORIAL_SCENE_HEARTH,
  TUTORIAL_SCENE_HOLLOWS_EDGE,
  TUTORIAL_SCENE_SPIRE_LOWER,
  type EntityState,
  type WorldState,
} from "@app/engine";

import { CoachmarkHost } from "@/components/coachmark";
import { trpc } from "@/lib/trpc/client";
import type { CoachmarkDef } from "@/lib/coachmark";
import type { EquipmentItem, SpellLoadout } from "@/lib/character";
import { buildExploreModel } from "@/lib/live-explore";
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
import { TutorialEntityDrawer } from "./tutorial-entity-drawer";
import { TutorialInventoryDrawer } from "./tutorial-inventory-drawer";
import { useSceneTransition } from "./use-scene-transition";
import { useLiveSession } from "./use-live-session";
import { TUTORIAL_SHOP } from "@/lib/tutorial-shop";

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
  tutorialControls,
  hudExtra,
  onEntityClick,
  onReactionPass,
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
  /** Tutorial-only controls rendered in exploration mode (TUT-1); absent elsewhere. */
  tutorialControls?: ReactNode;
  /** Extra HUD content under the exploration PC panel (tutorial inventory, #172). */
  hudExtra?: ReactNode;
  /** When set, narration @Entity chips become clickable (tutorial drawer, #171). */
  onEntityClick?: (name: string) => void;
  /** Tutorial Scene 5: resume the paused combat loop after a passed OA (#174). */
  onReactionPass?: () => void;
}) {
  const vm = useMemo(
    () => (session.state ? buildViewModel(session.state) : null),
    [session.state],
  );
  // Exploration view model (TUT-1, D2): a mapped scene with no active encounter.
  const explore = useMemo(
    () => (session.state ? buildExploreModel(session.state) : null),
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
    // Exploration mode (TUT-1, D2): a mapped scene with no encounter renders the
    // map + tokens + chat + HUD without combat chrome (no initiative/action bar).
    if (explore) {
      const pc = Object.values(session.state.entities).find(
        (e) => e.kind === "character",
      );
      return (
        <div className="mx-auto max-w-6xl px-4 py-6">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="font-display text-xl font-semibold">{title}</h1>
              <p className="text-sm text-lore-muted">
                {explore.sceneName ?? context}
                {session.peers > 1 ? ` · ${session.peers} here` : ""}
              </p>
            </div>
            {backHref && (
              <Link
                href={backHref}
                className="rounded border border-lore-border px-2 py-1 text-xs text-lore-muted transition-colors hover:text-lore-text"
              >
                ← Back
              </Link>
            )}
          </header>

          <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
            <section data-coachmark="tut-scene1-map">
              <MapViewport
                sceneBanner={sceneBanner}
                transitioning={transitioning}
                cols={explore.cols}
                rows={explore.rows}
                walls={explore.walls}
                tokens={explore.tokens}
                reachable={[]}
                onMoveToken={() => {}}
              />
              {explore.sceneDescription && (
                <p className="mt-2 max-w-[33rem] text-xs text-lore-muted">
                  {explore.sceneDescription}
                </p>
              )}
            </section>

            <aside className="space-y-4">
              {pc && (
                <div
                  data-coachmark="tut-scene1-hud"
                  className="rounded-lg border border-lore-border bg-lore-surface p-4"
                >
                  <div className="font-display text-lg leading-tight">
                    {pc.name}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-lore-muted">
                    <span>
                      {pc.hp.current}/{pc.hp.max} HP
                    </span>
                    <span>AC {pc.baseAc}</span>
                    <span>Speed {pc.speed}ft</span>
                  </div>
                  {hudExtra}
                </div>
              )}

              {tutorialControls}

              <div data-coachmark="tut-scene1-chat">
                <ChatZone
                  entries={session.chat}
                  onSend={session.sendChat}
                  thinking={session.gmThinking}
                  onEntityClick={onEntityClick}
                />
              </div>
            </aside>
          </div>

          <div data-coachmark="tut-party">
            <PartyRail state={session.state} />
          </div>
        </div>
      );
    }

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
          <div data-coachmark="tut-combat">
            <CombatOverlay
              round={vm.round}
              activeName={vm.activeName}
              order={vm.order}
            />
          </div>

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
                // Tutorial Scene 5: a passed/timed-out OA must resume the paused
                // server loop (the Shade's turn) so the fight plays on.
                onReactionPass?.();
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

/**
 * Tutorial play surface (TUT-1, M6) — the seeded onboarding campaign rendered
 * through the shared Live Play surface. It joins the same `campaign:{id}` room
 * (server-side it resolves to a `TutorialRoom`), so the first scene arrives in
 * exploration mode (D2). The scripted-trigger controls (continue + the offered
 * check) are passed into the exploration aside; the server drives all mechanics.
 */
/**
 * Scene 1's first-time coachmarks (TUT-1, D5) — point at the three core regions
 * of the play surface the first time the user lands in the Hollow. Shown one at
 * a time, in order, and never again once dismissed.
 */
const TUTORIAL_SCENE1_COACHMARKS: readonly CoachmarkDef[] = [
  {
    id: "tut-scene1-map",
    anchor: "tut-scene1-map",
    title: "The world, mapped",
    body: "This is where the story plays out. Your hero's token stands on the road into Last Light Hollow — scenes, tokens, and (soon) combat all live here.",
    trigger: { kind: "first_seen" },
  },
  {
    id: "tut-scene1-hud",
    anchor: "tut-scene1-hud",
    title: "Your hero",
    body: "Mira Thornwood at a glance — hit points, armor class, and speed. Her full sheet is a click away whenever you need it.",
    trigger: { kind: "first_seen" },
  },
  {
    id: "tut-scene1-chat",
    anchor: "tut-scene1-chat",
    title: "Tell the GM what you do",
    body: "Type your actions here and the Game Master narrates back. When the moment calls for it, use the Tutorial buttons above to roll the dice.",
    trigger: { kind: "first_seen" },
  },
];

/**
 * Scene 2's coachmarks (TUT-1, #171), fired by action rather than first-sight so
 * they land on the right beat: entering the tavern (chips), accepting the hook,
 * and the companion joining.
 */
const TUTORIAL_SCENE2_COACHMARKS: readonly CoachmarkDef[] = [
  {
    id: "tut-scene2-chips",
    anchor: "tut-scene1-chat",
    title: "These names are entities",
    body: "Tap any highlighted name in the story — people, places, items — to see what your character knows, and to speak with them.",
    trigger: { kind: "on_action", action: "scene2" },
  },
  {
    id: "tut-scene2-hook",
    anchor: "tut-hook",
    title: "Plot hooks live in your campaign",
    body: "Accepted hooks track through your sessions. You can see all of them anytime in the campaign's Hooks tab.",
    trigger: { kind: "on_action", action: "hook-accepted" },
  },
  {
    id: "tut-scene2-companion",
    anchor: "tut-party",
    title: "You have a companion",
    body: "Brennar follows you and takes his own turns in combat — a 2nd-level cleric, handy for healing.",
    trigger: { kind: "on_action", action: "companion-joined" },
  },
];

/**
 * Scene 3's coachmark (TUT-1, #172) — fired when Toric's scripted gift lands in
 * Mira's pack, pointing at the inventory button so the player learns items are
 * real and live on the sheet.
 */
const TUTORIAL_SCENE3_COACHMARKS: readonly CoachmarkDef[] = [
  {
    id: "tut-scene3-inventory",
    anchor: "tut-inventory",
    title: "Items work mechanically",
    body: "Oil of Brightness has a real game effect — use it on the lantern later and it'll do something. Your inventory lives on your sheet, here in the HUD.",
    trigger: { kind: "on_action", action: "oil-granted" },
  },
];

/**
 * Scene 4's coachmark (TUT-1, #173) — fires the first time the player accepts
 * Brennar's Help on the chest, explaining the engine's automatic advantage.
 */
const TUTORIAL_SCENE4_COACHMARKS: readonly CoachmarkDef[] = [
  {
    id: "tut-scene4-advantage",
    anchor: "tut-advantage",
    title: "Advantage rolls two dice",
    body: "When someone Helps you, the engine rolls two d20s and keeps the higher. Most 5E advantage/disadvantage is automatic — you never track it by hand.",
    trigger: { kind: "on_action", action: "help-used" },
  },
];

/**
 * Scene 5's coachmarks (TUT-1, #174) — the first real fight. Fired by server
 * signals: combat starting (Tier-4 framing), the companion taking his own turn,
 * and the Shade provoking the player's one Opportunity-Attack reaction.
 */
const TUTORIAL_SCENE5_COACHMARKS: readonly CoachmarkDef[] = [
  {
    id: "tut-scene5-combat",
    anchor: "tut-combat",
    title: "This is real combat",
    body: "Full Tier-4, multiplayer-ready combat — initiative, action economy, saves, and reactions all run on the deterministic engine. Move, then arm an Attack or Cast.",
    trigger: { kind: "on_action", action: "combat-start" },
  },
  {
    id: "tut-scene5-npc-turn",
    anchor: "tut-combat",
    title: "Brennar plays himself",
    body: "Companions act on their own initiative — Brennar will heal you when you're hurt or strike the foe with Sacred Flame. You only control your own character.",
    trigger: { kind: "on_action", action: "npc-turn" },
  },
  {
    id: "tut-scene5-reaction",
    anchor: "tut-combat",
    title: "You have a reaction",
    body: "The Shade broke away from you — that provokes an Opportunity Attack. Take it for a free swing, or pass. Reactions happen on other creatures' turns.",
    trigger: { kind: "on_action", action: "oa-reaction" },
  },
];

const TUTORIAL_COACHMARKS: readonly CoachmarkDef[] = [
  ...TUTORIAL_SCENE1_COACHMARKS,
  ...TUTORIAL_SCENE2_COACHMARKS,
  ...TUTORIAL_SCENE3_COACHMARKS,
  ...TUTORIAL_SCENE4_COACHMARKS,
  ...TUTORIAL_SCENE5_COACHMARKS,
];

export function TutorialPlaySurface({ campaignId }: { campaignId: string }) {
  const session = useLiveSession({ campaignId });
  const [drawerName, setDrawerName] = useState<string | null>(null);
  const [lilySpoken, setLilySpoken] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [helpUsed, setHelpUsed] = useState(false);

  const world = trpc.tutorial.world.useQuery();
  const inventory = trpc.tutorial.inventory.useQuery();
  const utils = trpc.useUtils();
  const acceptHook = trpc.tutorial.acceptHook.useMutation();
  const companionJoin = trpc.tutorial.companionJoin.useMutation();
  const grantOil = trpc.tutorial.grantOil.useMutation();

  const hookStatus = world.data?.hookStatus ?? null;
  const companionJoined = world.data?.companionJoined ?? false;
  const sceneId = session.state?.currentSceneId;
  const inScene1 = sceneId === TUTORIAL_SCENE_HOLLOWS_EDGE;
  const inScene2 = sceneId === TUTORIAL_SCENE_HEARTH;
  const inScene3 = sceneId === TUTORIAL_SCENE_CROOKED_LANE;
  const inScene4 = sceneId === TUTORIAL_SCENE_SPIRE_LOWER;
  const hookActive = hookStatus === "active";
  const hookOffered = lilySpoken || hookStatus === "active";

  const items = inventory.data?.items ?? [];
  const oilGranted = items.some((i) => i.name === TUTORIAL_SHOP.listings[0]?.name);
  const lootClaimed = items.some((i) => i.name === TUTORIAL_CHEST_LOOT[0]?.name);

  // Server signalled the scripted chest loot landed — refresh the drawer.
  useEffect(() => {
    if (session.lootNonce === 0) return;
    void utils.tutorial.inventory.invalidate();
    setInvOpen(true);
  }, [session.lootNonce, utils]);

  const signals = session.tutorialSignals;

  // Drive the action-triggered coachmarks off live state.
  const firedActions = useMemo(() => {
    const a: string[] = [];
    if (inScene2) a.push("scene2");
    if (hookActive) a.push("hook-accepted");
    if (companionJoined) a.push("companion-joined");
    if (oilGranted) a.push("oil-granted");
    if (helpUsed) a.push("help-used");
    // Scene 5 combat signals (server-driven, #174).
    if (signals.includes("combat")) a.push("combat-start");
    if (signals.includes("npc-turn")) a.push("npc-turn");
    if (signals.includes("reaction")) a.push("oa-reaction");
    return a;
  }, [inScene2, hookActive, companionJoined, oilGranted, helpUsed, signals]);

  function pickLock(help: boolean) {
    if (help) setHelpUsed(true);
    session.tutorialCheck(help);
  }

  function speak(topic: "barnaby" | "lily") {
    session.tutorialSay(topic);
    if (topic === "lily") setLilySpoken(true);
  }

  function acceptTheHook() {
    acceptHook.mutate(undefined, {
      onSuccess: () => {
        companionJoin.mutate(undefined, {
          onSettled: () => void utils.tutorial.world.invalidate(),
        });
        session.tutorialCompanion();
        void utils.tutorial.world.invalidate();
      },
    });
  }

  function takeTorricsGift() {
    grantOil.mutate(undefined, {
      onSuccess: () => {
        void utils.tutorial.inventory.invalidate();
        setInvOpen(true);
      },
    });
  }

  const accepting = acceptHook.isPending || companionJoin.isPending;

  // Inventory affordance on the HUD (#172) — the gift lands here; opening it
  // shows the real `equipment` rows. The coachmark anchors to this button.
  const hudExtra = (
    <button
      type="button"
      data-coachmark="tut-inventory"
      onClick={() => setInvOpen(true)}
      className={`mt-3 w-full rounded border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent ${
        oilGranted
          ? "animate-pulse border-lore-accent text-lore-accent"
          : "border-lore-border text-lore-muted"
      }`}
    >
      🎒 Inventory{items.length > 0 ? ` (${items.length})` : ""}
    </button>
  );

  const tutorialControls = (
    <div className="space-y-3">
      <div className="space-y-2 rounded-lg border border-lore-accent bg-lore-accent-dim p-3">
        <div className="text-[10px] uppercase tracking-widest text-lore-muted">
          Tutorial
        </div>
        <div className="flex flex-wrap gap-2">
          {inScene1 && (
            <button
              type="button"
              onClick={() => session.tutorialCheck()}
              disabled={session.isBusy}
              className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent disabled:opacity-40"
            >
              Look for tracks
            </button>
          )}
          {inScene2 && (
            <button
              type="button"
              onClick={() => speak("barnaby")}
              className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent"
            >
              Talk to Barnaby
            </button>
          )}
          <button
            type="button"
            onClick={session.tutorialAdvance}
            disabled={session.isBusy}
            className="rounded border border-lore-accent bg-lore-bg px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
          >
            Continue ▶
          </button>
        </div>
      </div>

      {inScene3 && (
        <div
          data-coachmark="tut-shop"
          className="space-y-2 rounded-lg border border-lore-accent bg-lore-surface p-3"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-lore-text">
            <span aria-hidden>🛒</span>
            {TUTORIAL_SHOP.name}
          </div>
          <div className="text-xs text-lore-muted">
            Shopkeeper: {TUTORIAL_SHOP.keeper} ({TUTORIAL_SHOP.keeperBlurb})
          </div>
          <ul className="flex flex-col gap-1.5">
            {TUTORIAL_SHOP.listings.map((listing) => (
              <li
                key={listing.name}
                className="rounded border border-lore-border bg-lore-bg p-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-lore-text">
                  <span>
                    {listing.icon} {listing.name}
                  </span>
                  <span className="text-lore-muted">{listing.price}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-lore-muted">
                  {listing.blurb}
                </p>
              </li>
            ))}
          </ul>
          {oilGranted ? (
            <div className="text-xs font-medium text-lore-accent">
              ✓ Toric pressed the Oil of Brightness into your hand — it&apos;s in
              your pack.
            </div>
          ) : (
            <>
              <p className="text-[11px] italic text-lore-muted">
                &ldquo;You&apos;ll need it. And if you&apos;re back tomorrow,
                we&apos;ll all owe you. If you&apos;re not… well.&rdquo;
              </p>
              <button
                type="button"
                onClick={takeTorricsGift}
                disabled={grantOil.isPending}
                className="rounded-lg border border-lore-accent bg-lore-accent-dim px-4 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
              >
                {grantOil.isPending ? "Taking…" : "Accept Toric's gift ▶"}
              </button>
            </>
          )}
        </div>
      )}

      {inScene4 && (
        <div className="space-y-2 rounded-lg border border-lore-accent bg-lore-surface p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-lore-text">
            <span aria-hidden>🧰</span>
            The iron chest
          </div>
          {lootClaimed ? (
            <div className="text-xs font-medium text-lore-accent">
              ✓ The chest is open — its contents are in your pack. The stair waits
              above; press Continue when you&apos;re ready.
            </div>
          ) : (
            <>
              <p className="text-xs text-lore-muted">
                A Dexterity check with Thieves&apos; Tools, DC 13. You&apos;re not
                proficient — but Brennar can Help, giving you advantage.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => pickLock(false)}
                  disabled={session.isBusy}
                  className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent disabled:opacity-40"
                >
                  Pick the lock
                </button>
                <button
                  type="button"
                  data-coachmark="tut-advantage"
                  onClick={() => pickLock(true)}
                  disabled={session.isBusy}
                  className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
                >
                  Accept Brennar&apos;s Help (Advantage)
                </button>
              </div>
              <p className="text-[11px] text-lore-muted">
                Or skip the chest — press Continue to climb the stair.
              </p>
            </>
          )}
        </div>
      )}

      {hookOffered && (
        <div
          data-coachmark="tut-hook"
          className="space-y-2 rounded-lg border border-lore-accent bg-lore-surface p-3"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-lore-text">
            <span aria-hidden>📜</span>
            {TUTORIAL_HOOK.title}
          </div>
          <p className="text-xs text-lore-muted">{TUTORIAL_HOOK.summary}</p>
          {hookActive ? (
            <div className="text-xs font-medium text-lore-accent">
              ✓ Accepted — now Active in your Hooks tab
              {companionJoined ? " · Old Brennar joined your party" : ""}
            </div>
          ) : (
            <button
              type="button"
              onClick={acceptTheHook}
              disabled={accepting}
              className="rounded-lg border border-lore-accent bg-lore-accent-dim px-4 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
            >
              {accepting ? "Accepting…" : "Accept ▶"}
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <LiveBattle
        session={session}
        title="The Lantern's Last Flicker"
        context="Tutorial"
        backHref="/"
        campaignId={campaignId}
        tutorialControls={tutorialControls}
        hudExtra={hudExtra}
        onEntityClick={setDrawerName}
        onReactionPass={session.tutorialResume}
      />
      <TutorialEntityDrawer
        name={drawerName}
        onClose={() => setDrawerName(null)}
        onSpeak={speak}
      />
      <TutorialInventoryDrawer
        open={invOpen}
        items={items}
        loading={inventory.isLoading}
        onClose={() => setInvOpen(false)}
      />
      <CoachmarkHost defs={TUTORIAL_COACHMARKS} firedActions={firedActions} />
    </>
  );
}
