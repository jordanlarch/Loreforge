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
  TUTORIAL_COMPANION,
  TUTORIAL_FALLBACK_PARTY,
  TUTORIAL_HOOK,
  TUTORIAL_OIL_NAME,
  TUTORIAL_RESOLUTION,
  TUTORIAL_SCENE_CROOKED_LANE,
  TUTORIAL_SCENE_HEARTH,
  TUTORIAL_SCENE_HOLLOWS_EDGE,
  TUTORIAL_SCENE_SPIRE_LOWER,
  TUTORIAL_SCENE_SPIRE_UPPER,
  tutorialHintForScene,
  tutorialScene,
  tutorialSceneRequiresCompanion,
  type EntityState,
  type WorldState,
} from "@app/engine";

import { CoachmarkHost } from "@/components/coachmark";
import { CharacterSheetOverlay } from "@/components/character-sheet-overlay";
import { TutorialCatalogOverlay } from "@/components/tutorial-catalog-overlay";
import { TutorialHintChip } from "@/components/tutorial-hint-chip";
import { trpc } from "@/lib/trpc/client";
import { trackTutorialEvent } from "@/lib/observability/tutorial-telemetry";
import {
  shouldAutoProgressScene,
  shouldShowTutorialHint,
} from "@/lib/tutorial-hint";
import type { CoachmarkDef } from "@/lib/coachmark";
import type { EquipmentItem, SpellLoadout } from "@/lib/character";
import { buildExploreModel } from "@/lib/live-explore";
import { resolveCurrentMapLevel } from "@/lib/map-zoom-level";
import { joinedSincePrompt } from "@/lib/live-presence";
import type { PartyRosterRow } from "@/lib/live-party";
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
  castTargetCandidates,
  reactionSpellsFor,
  type CastableSpell,
} from "@/lib/live-combat";
import {
  deriveWeaponAttacks,
  genericStrike,
  preparedSpellNames,
  quickUseItems,
  sheetCastableSpells,
  sheetReactionSpells,
  type WeaponAttack,
} from "@/lib/sheet-loadout";
import type { AimOverlay, BattleToken, TargetingOverlay } from "./battle-map";
import { ChatZone } from "./chat-zone";
import { type ArmedAction } from "./combat-action-bar";
import { CombatTurnBar } from "./combat-turn-bar";
import { CombatOverlay, type InitiativeChip } from "./combat-overlay";
import { GraduationModal } from "./graduation-modal";
import { LivePlayTopBar } from "./live-top-bar";
import { MapViewport } from "./map-viewport";
import { PlayShellChrome } from "./play-shell-chrome";
import { TutorialEntityDrawer } from "./tutorial-entity-drawer";
import { TutorialInventoryDrawer } from "./tutorial-inventory-drawer";
import { useSceneTransition, useCombatTransition } from "./use-scene-transition";
import { useLiveSession, LIVE_WS_URL } from "./use-live-session";

import {
  PostSessionPins,
  type EndedSessionState,
} from "../post-session-pins";
import { StartSceneConfirm } from "./start-scene-confirm";
import { mergeChatEntries } from "@/lib/scene-transition-chat";
import type { ChatEntry } from "@/lib/live-chat";
import { TUTORIAL_SHOP } from "@/lib/tutorial-shop";
import { TUTORIAL_TAVERN } from "@/lib/tutorial-tavern";
import { tutorialLilyHookOfferedInChat } from "@/lib/tutorial-hook";

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
  onPin,
  pinnedTexts,
  pcCharacterId,
  partyRoster,
  companionExpected = false,
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
  /** Tutorial Scene 6: pin a GM message to memory (#175); absent elsewhere. */
  onPin?: (text: string) => void;
  /** Texts already pinned, so the pin affordance reflects state (#175). */
  pinnedTexts?: ReadonlySet<string>;
  /** Roster character id for the PC — opens the full sheet overlay. */
  pcCharacterId?: string;
  /** Active campaign roster — backfills the party rail when engine sync lags. */
  partyRoster?: readonly PartyRosterRow[];
  /** Hook accepted — Brennar should appear even before engine/DB fully sync. */
  companionExpected?: boolean;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetPeekId, setSheetPeekId] = useState<string | null>(null);
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
  const [castTargets, setCastTargets] = useState<string[]>([]);
  const [aimCell, setAimCell] = useState<Cell | null>(null);
  const [dismissedReaction, setDismissedReaction] = useState<string | null>(null);
  // Client-side session pause (#101): freezes the local turn UI + clock. The
  // server-authoritative engine freeze is a deferred follow-up.
  const [paused, setPaused] = useState(false);

  // End-session (PLAY-12, #151): record the session + generate a recap (MEM-4),
  // then show the memory-pin lightbox (CAMP-UX: stay in play on dismiss).
  const [endedSession, setEndedSession] = useState<EndedSessionState | null>(
    null,
  );
  const endSession = trpc.sessions.end.useMutation({
    onSuccess: (res) => {
      setEndedSession({
        sessionId: res.session.id,
        recap: res.session.recap ?? "",
        pending: res.recapPending,
      });
    },
  });
  const endSessionError = endSession.isError ? (
    <p className="mt-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {endSession.error.message}
    </p>
  ) : null;

  // Scene transition (#103): watch the synced scene id and cross-fade + drop a
  // location banner + chat divider when the engine advances to a new scene.
  const inCombat = session.state?.encounter !== undefined;
  const transitionSceneId = session.state?.currentSceneId;
  const transitionScene = transitionSceneId
    ? session.state?.scenes[transitionSceneId]
    : undefined;
  const currentMapLevel = resolveCurrentMapLevel(inCombat);
  const currentSceneName = transitionScene?.name;
  const { banner: sceneBanner, transitioning, dividers: sceneDividers } =
    useSceneTransition(
      transitionSceneId,
      transitionScene?.name,
      transitionScene?.description,
    );
  const combatDividers = useCombatTransition(inCombat);
  const chatEntries = useMemo(
    () => mergeChatEntries(session.chat, [...sceneDividers, ...combatDividers]),
    [session.chat, sceneDividers, combatDividers],
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
  const turnKey =
    inCombat && vm ? `${vm.round}:${vm.activeName ?? ""}` : undefined;
  const turnElapsed = useTurnTimer(turnKey, paused || holding);

  // A fresh arm clears any stale aim from a prior AoE cast.
  useEffect(() => {
    setAimCell(null);
    setCastTargets([]);
  }, [armed]);

  const rosterSyncKey = partyRoster?.map((m) => m.id).join(",") ?? "";
  useEffect(() => {
    if (!campaignId || !session.state) return;
    session.syncParty();
  }, [campaignId, session.state?.lastSequence, rosterSyncKey, session.syncParty]);

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
  const castableSpells: CastableSpell[] = activeEntity
    ? activeSheet
      ? sheetCastableSpells(activeEntity, preparedSpellNames(activeSheet.spells))
      : castableSpellsFor(activeEntity)
    : [];

  // Action-economy gating for the action bar:
  // Attack action's budget (Extra Attack / Multiattack) and whether the single
  // action is still free (cast / ready). One attack per turn for most PCs.
  const econ = activeEntity?.actionEconomy;
  const attacksLeft = econ ? Math.max(0, econ.attacks.total - econ.attacks.used) : 0;
  const canAttack = attacksLeft > 0;
  const canAct = econ?.action === "available";

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
        : armed.kind === "cast"
          ? castTargetCandidates(state, activeEntity.id, armed.spell).map(
              (e) => e.id,
            )
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

  function onConfirmMultiCast() {
    if (!armed || armed.kind !== "cast" || !activeEntity || castTargets.length < 1) {
      return;
    }
    session.castSpell(
      activeEntity.id,
      armed.spell.id,
      armed.spell.level,
      castTargets,
    );
    setArmed(null);
    setCastTargets([]);
  }

  function onPickTarget(targetId: string) {
    if (!armed || !activeEntity) return;
    if (armed.kind === "attack") {
      session.attack(
        activeEntity.id,
        targetId,
        armed.attack.attackBonus,
        armed.attack.damage,
        armed.attack.rangeFt,
      );
    } else if (armed.kind === "ready") {
      // Hold the strike; the server fires it when the foe enters this range.
      session.readyAction(
        activeEntity.id,
        `in_range:${armed.attack.rangeFt}`,
        targetId,
        armed.attack.attackBonus,
        armed.attack.damage,
        armed.attack.rangeFt,
      );
    } else {
      const maxTargets = armed.spell.maxTargets ?? 1;
      if (maxTargets > 1) {
        setCastTargets((prev) => {
          if (prev.includes(targetId)) {
            return prev.filter((id) => id !== targetId);
          }
          if (prev.length >= maxTargets) return prev;
          return [...prev, targetId];
        });
        return;
      }
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
  const reactorSheet = reaction ? loadouts?.[reaction.reactor.id] : undefined;
  const reactorReactionSpells = reaction
    ? reactorSheet
      ? sheetReactionSpells(
          reaction.reactor,
          preparedSpellNames(reactorSheet.spells),
        )
      : reactionSpellsFor(reaction.reactor)
    : [];
  const activeReactionSpells = activeEntity
    ? activeSheet
      ? sheetReactionSpells(activeEntity, preparedSpellNames(activeSheet.spells))
      : reactionSpellsFor(activeEntity)
    : [];

  const viewPartySheet = (characterId: string) => setSheetPeekId(characterId);

  function onCastFromBar(spell: CastableSpell) {
    if (spell.targetKind === "self" && !spell.reaction && activeEntity) {
      session.castSpell(
        activeEntity.id,
        spell.id,
        spell.level,
        [activeEntity.id],
      );
      return;
    }
    setArmed({ kind: "cast", spell });
  }

  function onReactionAttack() {
    if (!reaction) return;
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
      strike.rangeFt,
    );
    if (reactionKey) setDismissedReaction(reactionKey);
  }

  function onReactionPassHandler() {
    if (reactionKey) setDismissedReaction(reactionKey);
    onReactionPass?.();
  }

  function onCastShieldReaction() {
    if (!reaction || !reactorReactionSpells[0]) return;
    const spell = reactorReactionSpells[0];
    session.castSpell(
      reaction.reactor.id,
      spell.id,
      spell.level,
      [reaction.reactor.id],
    );
    if (reactionKey) setDismissedReaction(reactionKey);
  }

  function onCastShieldSelf() {
    if (!activeEntity || !activeReactionSpells[0]) return;
    const spell = activeReactionSpells[0];
    session.castSpell(
      activeEntity.id,
      spell.id,
      spell.level,
      [activeEntity.id],
    );
  }

  const quickItems =
    controllableTurn && activeSheet
      ? quickUseItems(activeSheet.equipment)
      : undefined;

  if (session.error) {
    const wsMisconfigured =
      LIVE_WS_URL.includes("localhost") || LIVE_WS_URL.includes("127.0.0.1");
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lore-muted">
          Couldn&apos;t reach the live session. Check that you&apos;re signed in
          and the sync server is reachable.
        </p>
        {wsMisconfigured ? (
          <p className="mt-3 text-sm text-lore-muted">
            This deployment is pointing at a local sync URL — set{" "}
            <code className="text-lore-text">NEXT_PUBLIC_WS_URL</code> to the
            hosted ws-server (INFRA-2).
          </p>
        ) : null}
      </div>
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
      const openSheet = pcCharacterId
        ? () => setSheetOpen(true)
        : undefined;
      function onExploreTokenSelect(entityId: string) {
        const entity = session.state!.entities[entityId];
        if (entity?.name) onEntityClick?.(entity.name);
      }
      return (
        <>
          <PlayShellChrome
            campaignId={campaignId}
            state={session.state}
            partyRoster={partyRoster}
            companionExpected={companionExpected}
            pcCharacterId={pcCharacterId}
            onViewSheet={viewPartySheet}
            onEnterLocation={(id) => session.enterLocation(id)}
            onOpenCharacterSheet={openSheet}
            tutorialControls={tutorialControls}
            playerHudExtra={hudExtra}
            header={
              <>
                <LivePlayTopBar
                  title={title}
                  sceneName={explore.sceneName ?? context}
                  peers={session.peers}
                  backHref={backHref}
                  paused={paused}
                  onTogglePause={() => setPaused((p) => !p)}
                  isBusy={session.isBusy}
                  showTurnActions={false}
                  onEndTurn={session.endTurn}
                  onReset={session.reset}
                  onEndSession={
                    campaignId
                      ? () => endSession.mutate({ campaignId })
                      : undefined
                  }
                  endingSession={endSession.isPending}
                  rejected={session.rejected}
                  pacing={{
                    prefs: pacingPrefs,
                    onUpdate: updatePacing,
                    holding,
                    onToggleHold: () => setHolding((h) => !h),
                    onContinue: () =>
                      session.sendChat("(Continue the scene.)", "continue"),
                    onSkip: (duration) =>
                      session.sendChat(`/skip ${duration}`, "skip"),
                    disabled: session.isBusy || paused,
                  }}
                />
                {endSessionError}
                {joinPrompt && (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-lore-accent bg-lore-accent-dim px-3 py-2 text-sm text-lore-text">
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
              </>
            }
            mapCurrent={
              <section
                className="flex h-full min-h-0 flex-1 flex-col"
                data-coachmark="tut-scene1-map"
              >
                <MapViewport
                  fill
                  sceneBanner={sceneBanner}
                  transitioning={transitioning}
                  mapLevel={currentMapLevel}
                  sceneName={currentSceneName}
                  cols={explore.cols}
                  rows={explore.rows}
                  walls={explore.walls}
                  tokens={explore.tokens}
                  reachable={explore.reachable}
                  onMoveToken={(id, to) => session.moveToken(id, to)}
                  onSelectToken={
                    onEntityClick ? onExploreTokenSelect : undefined
                  }
                />
              </section>
            }
            mapFooter={
              explore.sceneDescription ? (
                <p className="max-w-[33rem] text-xs text-lore-muted">
                  {explore.sceneDescription}
                </p>
              ) : undefined
            }
            chat={
              <div
                className="flex min-h-0 flex-1 flex-col"
                data-coachmark="tut-scene1-chat"
              >
                <ChatZone
                  fill
                  entries={chatEntries}
                  onSend={session.sendChat}
                  thinking={session.gmThinking}
                  onEntityClick={onEntityClick}
                  onPin={onPin}
                  pinnedTexts={pinnedTexts}
                />
              </div>
            }
          />
          {sheetOpen && pcCharacterId ? (
            <CharacterSheetOverlay
              characterId={pcCharacterId}
              onClose={() => setSheetOpen(false)}
            />
          ) : null}
          {sheetPeekId ? (
            <CharacterSheetOverlay
              characterId={sheetPeekId}
              onClose={() => setSheetPeekId(null)}
            />
          ) : null}
        </>
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

  const openPlayerSheet = pcCharacterId
    ? () => setSheetOpen(true)
    : undefined;

  return (
    <>
      <PlayShellChrome
        campaignId={campaignId}
        state={session.state}
        partyRoster={partyRoster}
        companionExpected={companionExpected}
        pcCharacterId={pcCharacterId}
        onViewSheet={viewPartySheet}
        onEnterLocation={(id) => session.enterLocation(id)}
        onOpenCharacterSheet={openPlayerSheet}
        tutorialControls={tutorialControls}
        playerHudExtra={hudExtra}
        header={
          <>
            <LivePlayTopBar
              title={title}
              sceneName={sceneName ?? context}
              peers={session.peers}
              backHref={backHref}
              paused={paused}
              onTogglePause={() => setPaused((p) => !p)}
              isBusy={session.isBusy}
              showTurnActions={false}
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
                onContinue: () =>
                  session.sendChat("(Continue the scene.)", "continue"),
                onSkip: (duration) => session.sendChat(`/skip ${duration}`, "skip"),
                turnElapsedSec: inCombat ? turnElapsed : undefined,
                disabled: session.isBusy || paused,
              }}
            />
            {endSessionError}
            {joinPrompt && (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-lore-accent bg-lore-accent-dim px-3 py-2 text-sm text-lore-text">
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
          </>
        }
        combatStrip={
          <div data-coachmark="tut-combat">
            <CombatOverlay
              round={vm.round}
              activeName={vm.activeName}
              order={vm.order}
            />
          </div>
        }
        mapCurrent={
          <section
            className="flex h-full min-h-0 flex-1 flex-col"
            data-coachmark="tut-scene1-map"
          >
            <MapViewport
              fill
              sceneBanner={sceneBanner}
              transitioning={transitioning}
              mapLevel={currentMapLevel}
              sceneName={currentSceneName}
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
          </section>
        }
        mapFooter={
          <p className="text-[11px] text-lore-muted">
            {isAreaCast
              ? "Tap a cell to place the blast — the highlighted area shows who's caught — then Confirm. The engine resolves saves + damage."
              : armed?.kind === "ready"
                ? "Tap a foe to hold your strike for — the engine fires it automatically when they enter range on their turn."
                : armed?.kind === "cast" &&
                    armed.spell.maxTargets !== undefined &&
                    armed.spell.maxTargets > 1
                  ? "Tap allies to bless (up to three) — selected chips highlight — then Confirm."
                  : armed?.kind === "cast" &&
                      armed.spell.targetKind === "ally"
                    ? "Tap a highlighted ally (or yourself) to cast — the engine applies the effect."
                    : armed
                      ? "Tap a highlighted enemy to resolve the action — the engine rolls and applies the result."
                      : "Drag the highlighted active token within its movement radius, or arm an Attack/Cast/Ready in the panel. The engine validates everything."}
          </p>
        }
        actionBar={
          <CombatTurnBar
            activeEntity={activeEntity}
            activeName={vm.activeName}
            controllableTurn={controllableTurn}
            paused={paused}
            isBusy={session.isBusy}
            onEndTurn={session.endTurn}
            weapons={weapons}
            spells={castableSpells}
            armed={armed}
            aimReady={aimCell !== null}
            readiedNote={readiedNote}
            canAttack={canAttack}
            canAct={canAct}
            attacksLeft={attacksLeft}
            onAttack={(attack) => setArmed({ kind: "attack", attack })}
            onCast={onCastFromBar}
            onReady={(attack) => setArmed({ kind: "ready", attack })}
            onConfirmAim={onConfirmAim}
            onCancelArmed={() => {
              setArmed(null);
              setCastTargets([]);
            }}
            castTargetCount={castTargets.length}
            castTargetMax={
              armed?.kind === "cast" ? armed.spell.maxTargets : undefined
            }
            onConfirmMultiCast={onConfirmMultiCast}
            items={quickItems}
            onQuickUse={(name) =>
              session.sendChat(`uses ${name}`, "use_item")
            }
            showReaction={showReaction}
            reaction={reaction}
            reactorReactionSpells={reactorReactionSpells}
            onReactionAttack={onReactionAttack}
            onReactionPass={onReactionPassHandler}
            onCastShield={
              reactorReactionSpells[0] ? onCastShieldReaction : undefined
            }
            activeReactionSpells={activeReactionSpells}
            onCastShieldSelf={
              activeReactionSpells[0] ? onCastShieldSelf : undefined
            }
          />
        }
        chat={
          <ChatZone
            fill
            entries={chatEntries}
            onSend={session.sendChat}
            thinking={session.gmThinking}
            onEntityClick={onEntityClick}
            onPin={onPin}
            pinnedTexts={pinnedTexts}
          />
        }
      />
      {sheetOpen && pcCharacterId ? (
        <CharacterSheetOverlay
          characterId={pcCharacterId}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}
      {sheetPeekId ? (
        <CharacterSheetOverlay
          characterId={sheetPeekId}
          onClose={() => setSheetPeekId(null)}
        />
      ) : null}
      {endedSession && campaignId ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[8vh]">
          <div className="w-full max-w-xl">
            <PostSessionPins
              campaignId={campaignId}
              ended={endedSession}
              onClose={() => setEndedSession(null)}
            />
          </div>
        </div>
      ) : null}
    </>
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
export function CampaignPlaySurface({
  campaignId,
  reloadKey,
  enterEntityId,
}: {
  campaignId: string;
  /** Bumped after Combat tab Run Now to force a fresh WS connection (CAMP-8). */
  reloadKey?: string;
  /** World-tab entity to enter on connect (Rung 4 Slice 2). */
  enterEntityId?: string;
}) {
  const campaign = trpc.campaigns.get.useQuery({ id: campaignId });
  const readinessQuery = trpc.campaigns.playReadiness.useQuery({ campaignId });
  const [beginConfirmed, setBeginConfirmed] = useState(false);

  if (campaign.isLoading || readinessQuery.isLoading) {
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

  const readiness = readinessQuery.data;
  const canContinue = (readiness?.engineEventCount ?? 0) > 0;
  const canFirstPlay =
    !canContinue &&
    Boolean(readiness?.startingSceneId) &&
    (readiness?.activePcCount ?? 0) > 0;
  const testInPlayBypass = Boolean(enterEntityId || reloadKey);

  if (!testInPlayBypass && !canContinue && !canFirstPlay) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Not ready to play</h1>
        <p className="mt-3 text-sm text-lore-muted">
          Set a starting location in Settings and add at least one player
          character to the party before your first session.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href={`/campaigns/${campaignId}?tab=settings`}
            className="rounded border border-lore-border px-4 py-2 text-sm hover:border-lore-accent"
          >
            Settings
          </Link>
          <Link
            href={`/campaigns/${campaignId}?tab=party`}
            className="rounded border border-lore-border px-4 py-2 text-sm hover:border-lore-accent"
          >
            Party
          </Link>
          <Link
            href={`/campaigns/${campaignId}`}
            className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm hover:border-lore-accent"
          >
            ← Back to prep
          </Link>
        </div>
      </div>
    );
  }

  if (!testInPlayBypass && canFirstPlay && !beginConfirmed) {
    return (
      <StartSceneConfirm
        campaignId={campaignId}
        locationName={
          readiness?.startingLocationName ?? "your starting location"
        }
        onBegin={() => setBeginConfirmed(true)}
      />
    );
  }

  return (
    <CampaignPlaySession
      campaignId={campaignId}
      reloadKey={reloadKey}
      enterEntityId={enterEntityId}
      title={campaign.data.name}
    />
  );
}

function CampaignPlaySession({
  campaignId,
  reloadKey,
  enterEntityId,
  title,
}: {
  campaignId: string;
  reloadKey?: string;
  enterEntityId?: string;
  title: string;
}) {
  const session = useLiveSession({ campaignId, reloadKey, enterEntityId });

  // Sheet bridge (#98): map each roster character's equipment + spells by id (=
  // the live entity id the WS server seeds), so the HUD + action bar are driven
  // by real loadouts. Absent rows simply fall back to the generic behavior.
  const loadoutQuery = trpc.campaigns.partyLoadout.useQuery({ campaignId });
  const partyQuery = trpc.campaigns.party.useQuery({ campaignId });
  const pcCharacterId = partyQuery.data?.find((m) => m.role === "pc")?.id;
  const loadouts = useMemo(() => {
    const map: Record<string, SheetData> = {};
    for (const row of loadoutQuery.data ?? []) {
      map[row.id] = { equipment: row.equipment, spells: row.spells };
    }
    return map;
  }, [loadoutQuery.data]);

  return (
    <LiveBattle
      session={session}
      title={title}
      context="Live campaign"
      backHref={`/campaigns/${campaignId}`}
      loadouts={loadouts}
      campaignId={campaignId}
      pcCharacterId={pcCharacterId}
      partyRoster={partyQuery.data}
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
    body: "Drag your token toward the village — north on the map — to follow the road into Last Light Hollow. Scenes, tokens, and combat all play out here.",
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

/**
 * Scene 6's coachmarks (TUT-1, #175) — the finale. Fired by server signals: the
 * level-up notice when the hero crosses the threshold, and the pin affordance on
 * the memory-demo beat.
 */
const TUTORIAL_SCENE6_COACHMARKS: readonly CoachmarkDef[] = [
  {
    id: "tut-scene6-levelup",
    anchor: "tut-levelup",
    title: "You leveled up",
    body: "In a normal campaign you'd open the Level-Up Wizard to pick new features. We'll skip that for the tutorial — but it lives on your character sheet anytime you're ready to advance.",
    trigger: { kind: "on_action", action: "leveled-up" },
  },
  {
    id: "tut-scene6-pin",
    anchor: "tut-pin",
    title: "You can pin anything to memory",
    body: "The AI-GM uses pinned facts in future sessions to stay consistent. Try pinning the moment Lily gives you her father's key — it'll show in your campaign's Memory panel.",
    trigger: { kind: "on_action", action: "pin-demo" },
  },
];

const TUTORIAL_COACHMARKS: readonly CoachmarkDef[] = [
  ...TUTORIAL_SCENE1_COACHMARKS,
  ...TUTORIAL_SCENE2_COACHMARKS,
  ...TUTORIAL_SCENE3_COACHMARKS,
  ...TUTORIAL_SCENE4_COACHMARKS,
  ...TUTORIAL_SCENE5_COACHMARKS,
  ...TUTORIAL_SCENE6_COACHMARKS,
];

const TUTORIAL_REPLAY_KEY = "loreforge:tutorial-replay";

/** Whether the engine already logged this scene's scripted check in chat. */
function tutorialCheckDoneInChat(
  chat: readonly ChatEntry[],
  sceneId: string | undefined,
): boolean {
  if (!sceneId) return false;
  const skill = tutorialScene(sceneId)?.check?.skill;
  if (!skill) return false;
  return chat.some(
    (e) =>
      e.kind === "event" &&
      e.author === "Engine" &&
      e.text.includes(skill) &&
      e.text.includes(" check:"),
  );
}

export function TutorialPlaySurface({
  campaignId,
  replayFromStart = false,
}: {
  campaignId: string;
  /** When true, truncate the engine log on first sync (replay-from-start, #178). */
  replayFromStart?: boolean;
}) {
  const router = useRouter();
  const session = useLiveSession({ campaignId });
  const partyQuery = trpc.campaigns.party.useQuery({ campaignId });
  const loadoutQuery = trpc.campaigns.partyLoadout.useQuery({ campaignId });
  const pcCharacterId = partyQuery.data?.find((m) => m.role === "pc")?.id;
  const loadouts = useMemo(() => {
    const map: Record<string, SheetData> = {};
    for (const row of loadoutQuery.data ?? []) {
      map[row.id] = { equipment: row.equipment, spells: row.spells };
    }
    const pcRow = partyQuery.data?.find((m) => m.role === "pc");
    if (pcRow && map[pcRow.id]) {
      // Legacy tutorial seeds used the fixture entity id before the roster row existed.
      map[TUTORIAL_FALLBACK_PARTY[0]!.id] = map[pcRow.id]!;
    }
    const brennarRow = partyQuery.data?.find(
      (m) => m.role === "companion" || m.name === TUTORIAL_COMPANION.name,
    );
    if (brennarRow && map[brennarRow.id]) {
      map[TUTORIAL_COMPANION.id] = map[brennarRow.id]!;
    }
    return map;
  }, [loadoutQuery.data, partyQuery.data]);
  const [drawerName, setDrawerName] = useState<string | null>(null);
  const [catalogKind, setCatalogKind] = useState<"shop" | "tavern" | null>(
    null,
  );
  const [lilySpoken, setLilySpoken] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [helpUsed, setHelpUsed] = useState(false);
  const [relightSent, setRelightSent] = useState(false);
  const [finishSent, setFinishSent] = useState(false);
  // Fire-once guards so a re-click can't repeat a scripted beat (#bug2): the set
  // of dialogue topics already requested, and an in-flight "advancing" latch.
  const [spokenTopics, setSpokenTopics] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [advancing, setAdvancing] = useState(false);
  // Ignore check rows from chat before the last reset (replay clears chat, but
  // the baseline guards against a stale latch if sync races the truncate).
  const checkChatBaseline = useRef(0);

  const replay = trpc.tutorial.replay.useMutation({
    onSuccess: () => {
      sessionStorage.setItem(TUTORIAL_REPLAY_KEY, "1");
      router.push("/tutorial/play?replay=1");
    },
  });

  // Replay-from-start (#178): once the live channel syncs, truncate the engine log.
  const replayPending = useRef(replayFromStart);
  const resetSession = useRef(session.reset);
  resetSession.current = session.reset;

  useEffect(() => {
    if (replayFromStart) {
      sessionStorage.setItem(TUTORIAL_REPLAY_KEY, "1");
    } else if (sessionStorage.getItem(TUTORIAL_REPLAY_KEY) === "1") {
      replayPending.current = true;
    }
  }, [replayFromStart]);

  // Idle hint system (#178): track activity + per-scene dismissals.
  const lastActivity = useRef(Date.now());
  const [hintDismissals, setHintDismissals] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const prevSceneForTelemetry = useRef<string | undefined>(undefined);

  function bumpActivity() {
    lastActivity.current = Date.now();
    setHintVisible(false);
  }

  const [pinnedTexts, setPinnedTexts] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const world = trpc.tutorial.world.useQuery();
  const inventory = trpc.tutorial.inventory.useQuery();
  const progress = trpc.tutorial.get.useQuery();
  const achievements = trpc.tutorial.achievements.useQuery();
  const utils = trpc.useUtils();
  const acceptHook = trpc.tutorial.acceptHook.useMutation();
  const companionJoin = trpc.tutorial.companionJoin.useMutation();
  const grantOil = trpc.tutorial.grantOil.useMutation();
  const completeTutorial = trpc.tutorial.complete.useMutation();
  const createPin = trpc.pins.create.useMutation();

  // Graduation (Scene 7, #176): open the modal when the player finishes, or when
  // the run is already completed on load (D7, graduation always).
  const [graduated, setGraduated] = useState(false);

  const hookStatus = world.data?.hookStatus ?? null;
  const companionJoined = world.data?.companionJoined ?? false;
  const signals = session.tutorialSignals;
  const sceneId = session.state?.currentSceneId;
  const inScene1 = sceneId === TUTORIAL_SCENE_HOLLOWS_EDGE;
  const inScene2 = sceneId === TUTORIAL_SCENE_HEARTH;
  const inScene3 = sceneId === TUTORIAL_SCENE_CROOKED_LANE;
  const inScene4 = sceneId === TUTORIAL_SCENE_SPIRE_LOWER;
  const inScene6 = sceneId === TUTORIAL_SCENE_SPIRE_UPPER;
  const hookActive = hookStatus === "active" || hookStatus === "resolved";
  const lilyHookInChat = useMemo(
    () =>
      tutorialLilyHookOfferedInChat(
        session.chat.slice(checkChatBaseline.current),
      ),
    [session.chat, session.resetNonce],
  );
  const hookOffered =
    lilySpoken ||
    lilyHookInChat ||
    signals.includes("hook-offered") ||
    hookActive;
  const companionExpected =
    hookActive ||
    companionJoined ||
    (sceneId ? tutorialSceneRequiresCompanion(sceneId) : false);
  const brennarInEngine = Boolean(
    session.state?.entities[TUTORIAL_COMPANION.id],
  );

  // Release the advancing latch once the scene changes or the server clears busy
  // without advancing (duplicate click / stale one-shot after refresh, #bug2).
  useEffect(() => {
    setAdvancing(false);
  }, [sceneId]);
  useEffect(() => {
    if (!advancing || session.isBusy) return;
    setAdvancing(false);
  }, [advancing, session.isBusy]);
  // The lantern is lit once the central hook is resolved (Scene 6 finale).
  const lanternLit = hookStatus === "resolved";

  useEffect(() => {
    if (!replayPending.current || session.isLoading) return;
    replayPending.current = false;
    sessionStorage.removeItem(TUTORIAL_REPLAY_KEY);
    checkChatBaseline.current = session.chat.length;
    resetSession.current();
    setGraduated(false);
  }, [session.isLoading, session.chat.length]);

  useEffect(() => {
    setHintDismissals(0);
    setHintVisible(false);
    lastActivity.current = Date.now();
  }, [sceneId]);

  useEffect(() => {
    if (graduated || lanternLit) return;
    const hint = tutorialHintForScene(sceneId);
    if (!hint) return;

    const timer = window.setInterval(() => {
      const idleMs = Date.now() - lastActivity.current;
      if (shouldShowTutorialHint(idleMs, hintDismissals)) {
        setHintVisible(true);
      }
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [sceneId, hintDismissals, graduated, lanternLit, session]);

  useEffect(() => {
    if (!sceneId || sceneId === prevSceneForTelemetry.current) return;
    if (prevSceneForTelemetry.current) {
      trackTutorialEvent({
        name: "tutorial_scene_complete",
        sceneId: prevSceneForTelemetry.current,
      });
    }
    prevSceneForTelemetry.current = sceneId;
  }, [sceneId]);

  const sceneHint = tutorialHintForScene(sceneId);

  const items = inventory.data?.items ?? [];
  const oilGranted = items.some((i) => i.name === TUTORIAL_SHOP.listings[0]?.name);
  const oilInPack = items.some((i) => i.name === TUTORIAL_OIL_NAME);
  const lootClaimed = items.some((i) => i.name === TUTORIAL_CHEST_LOOT[0]?.name);

  // Server signalled the scripted chest loot landed (or Scene 6 consumed the
  // oil) — refresh the drawer + the inventory query.
  useEffect(() => {
    if (session.lootNonce === 0) return;
    void utils.tutorial.inventory.invalidate();
  }, [session.lootNonce, utils]);

  // Scene 6 resolution signals (server-driven, #175): once the finale fires, the
  // hook is resolved + XP awarded — refetch the world (and inventory) so the
  // relight controls retire and the level-up state is current.
  const sawPin = signals.includes("pin");
  useEffect(() => {
    if (!sawPin) return;
    void utils.tutorial.world.invalidate();
    void utils.tutorial.inventory.invalidate();
  }, [sawPin, utils]);

  // Full reset (#bug3): the server cleared the chat + restored the seeded DB
  // state, so refetch the DB-backed world/inventory and clear every local
  // fire-once guard, returning the surface to a pristine Scene 1.
  const resetNonce = session.resetNonce;
  useEffect(() => {
    if (resetNonce === 0) return;
    checkChatBaseline.current = session.chat.length;
    setSpokenTopics(new Set());
    setLilySpoken(false);
    setHelpUsed(false);
    setRelightSent(false);
    setFinishSent(false);
    setAdvancing(false);
    setPinnedTexts(new Set());
    sessionStorage.removeItem(TUTORIAL_REPLAY_KEY);
    void utils.tutorial.world.invalidate();
    void utils.tutorial.inventory.invalidate();
  }, [resetNonce, utils, session.chat.length]);

  const checkUsed = useMemo(
    () =>
      tutorialCheckDoneInChat(
        session.chat.slice(checkChatBaseline.current),
        sceneId,
      ),
    [session.chat, sceneId, resetNonce],
  );

  // Drive the action-triggered coachmarks off live state.
  const firedActions = useMemo(() => {
    const a: string[] = [];
    if (inScene2) a.push("scene2");
    if (hookActive) a.push("hook-accepted");
    if (hookOffered && !hookActive) a.push("hook-offered");
    if (companionJoined) a.push("companion-joined");
    if (oilGranted) a.push("oil-granted");
    if (helpUsed) a.push("help-used");
    // Scene 5 combat signals (server-driven, #174).
    if (signals.includes("combat")) a.push("combat-start");
    if (signals.includes("npc-turn")) a.push("npc-turn");
    if (signals.includes("reaction")) a.push("oa-reaction");
    // Scene 6 finale signals (server-driven, #175).
    if (signals.includes("leveled-up")) a.push("leveled-up");
    if (sawPin) a.push("pin-demo");
    return a;
  }, [inScene2, hookActive, hookOffered, companionJoined, oilGranted, helpUsed, signals, sawPin]);

  function pinMessage(text: string) {
    if (pinnedTexts.has(text)) return;
    setPinnedTexts((prev) => new Set(prev).add(text));
    createPin.mutate(
      { campaignId, content: text },
      {
        onError: () =>
          // Roll back the optimistic pin if the write failed.
          setPinnedTexts((prev) => {
            const next = new Set(prev);
            next.delete(text);
            return next;
          }),
      },
    );
  }

  const leveledUp = signals.includes("leveled-up");

  function runCheck(help = false) {
    if (checkUsed || advancing) return;
    bumpActivity();
    if (help) setHelpUsed(true);
    session.tutorialCheck(help);
  }

  function pickLock(help: boolean) {
    if (checkUsed || advancing) return;
    bumpActivity();
    if (help) setHelpUsed(true);

    const runHelpCheck = () => session.tutorialCheck(help);
    const summonThenCheck = () => {
      session.tutorialCompanion();
      runHelpCheck();
    };

    if (help && !brennarInEngine) {
      const afterDb = () => {
        summonThenCheck();
        void utils.campaigns.party.invalidate({ campaignId });
        void utils.tutorial.world.invalidate();
      };
      if (!companionJoined && !companionJoin.isPending) {
        companionJoin.mutate(undefined, { onSuccess: afterDb });
      } else {
        afterDb();
      }
      return;
    }

    runCheck(help);
  }

  function speak(topic: "barnaby" | "lily") {
    bumpActivity();
    if (spokenTopics.has(topic)) {
      if (topic === "lily") setLilySpoken(true);
      return;
    }
    setSpokenTopics((prev) => new Set(prev).add(topic));
    session.tutorialSay(topic);
    if (topic === "lily") setLilySpoken(true);
  }

  // Keep hook UI in sync when Lily was reached via chat or a reconnect.
  useEffect(() => {
    if (lilyHookInChat || signals.includes("hook-offered")) {
      setLilySpoken(true);
      setSpokenTopics((prev) =>
        prev.has("lily") ? prev : new Set(prev).add("lily"),
      );
    }
  }, [lilyHookInChat, signals]);

  // Advance with an in-flight latch only while the server is processing (#bug2).
  function advance() {
    bumpActivity();
    if (advancing || !sceneId) return;
    setAdvancing(true);
    session.tutorialAdvance();
  }

  function acceptTheHook() {
    acceptHook.mutate(undefined, {
      onSuccess: () => {
        session.tutorialCompanion();
        void utils.campaigns.party.invalidate({ campaignId });
        void utils.tutorial.world.invalidate();
      },
    });
  }

  const companionSummonPending = useRef(false);
  useEffect(() => {
    if (!companionExpected || session.isLoading || !session.state) return;
    if (session.state.entities[TUTORIAL_COMPANION.id]) return;

    if (!companionJoined && hookActive && !companionJoin.isPending) {
      companionJoin.mutate(undefined, {
        onSuccess: () => {
          session.tutorialCompanion();
          void utils.campaigns.party.invalidate({ campaignId });
          void utils.tutorial.world.invalidate();
        },
      });
      return;
    }

    if (companionSummonPending.current) return;
    companionSummonPending.current = true;
    session.tutorialCompanion();
  }, [
    companionExpected,
    hookActive,
    companionJoined,
    session.isLoading,
    session.state,
    session,
    companionJoin,
    campaignId,
    utils.campaigns.party,
    utils.tutorial.world,
  ]);

  // Retry WS summon until Brennar appears (handles reconnect / race after advance).
  useEffect(() => {
    if (!companionExpected || brennarInEngine || session.isLoading) return;

    let attempts = 0;
    const timer = window.setInterval(() => {
      if (session.state?.entities[TUTORIAL_COMPANION.id]) {
        window.clearInterval(timer);
        return;
      }
      attempts += 1;
      if (attempts > 8) {
        window.clearInterval(timer);
        return;
      }
      companionSummonPending.current = false;
      session.tutorialCompanion();
    }, 2500);

    return () => window.clearInterval(timer);
  }, [
    companionExpected,
    brennarInEngine,
    session.isLoading,
    session.state?.currentSceneId,
    session,
  ]);

  useEffect(() => {
    if (session.state?.entities[TUTORIAL_COMPANION.id]) {
      companionSummonPending.current = false;
      return;
    }
    // Allow a fresh WS summon attempt on each scene (prior attempt may have raced).
    companionSummonPending.current = false;
  }, [session.state?.currentSceneId, session.state?.entities]);

  function takeTorricsGift() {
    grantOil.mutate(undefined, {
      onSuccess: () => {
        void utils.tutorial.inventory.invalidate();
        setInvOpen(true);
        setCatalogKind(null);
      },
    });
  }

  function relight(path: string) {
    setRelightSent(true);
    session.tutorialRelight(path);
  }

  function finishTutorial() {
    if (finishSent) return;
    setFinishSent(true);
    // Post the closing GM beat over chat, then mark the run complete + unlock
    // First Light; the modal opens on the completion write.
    session.tutorialWrap();
    completeTutorial.mutate(undefined, {
      onSuccess: () => {
        void utils.tutorial.get.invalidate();
        void utils.tutorial.achievements.invalidate();
        setGraduated(true);
      },
      onError: () => setFinishSent(false),
    });
  }

  // Open the graduation modal when the server broadcasts the wrap (covers a
  // second tab) or when the run is already completed on load.
  const sawGraduated = signals.includes("graduated");
  const alreadyCompleted = progress.data?.status === "completed";
  useEffect(() => {
    if (sawGraduated || alreadyCompleted) setGraduated(true);
  }, [sawGraduated, alreadyCompleted]);

  // The achievement ids to light up in the modal: the completion mutation's
  // fresh set when present, else the query.
  const unlockedAchievements =
    completeTutorial.data?.achievements ?? achievements.data ?? [];

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
              onClick={() => runCheck()}
              disabled={checkUsed}
              className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent disabled:opacity-40"
            >
              {session.isBusy && !checkUsed
                ? "Looking…"
                : checkUsed
                  ? "Looked for tracks ✓"
                  : "Look for tracks"}
            </button>
          )}
          {inScene2 && (
            <>
              <button
                type="button"
                onClick={() => speak("barnaby")}
                disabled={spokenTopics.has("barnaby")}
                className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent disabled:opacity-40"
              >
                {spokenTopics.has("barnaby")
                  ? "Spoke to Barnaby ✓"
                  : "Talk to Barnaby"}
              </button>
              <button
                type="button"
                data-coachmark="tut-lily"
                onClick={() => speak("lily")}
                disabled={spokenTopics.has("lily")}
                className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent disabled:opacity-40"
              >
                {spokenTopics.has("lily")
                  ? "Spoke to Lily ✓"
                  : "Talk to Lily"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={advance}
            disabled={advancing}
            className="rounded border border-lore-accent bg-lore-bg px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
          >
            {advancing ? "Continuing…" : "Continue ▶"}
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
          <p className="text-xs text-lore-muted">
            Toric Pennywhistle&apos;s stall on Crooked Lane — lamp oil, silvered
            arrows, and tinder.
          </p>
          {oilGranted ? (
            <div className="text-xs font-medium text-lore-accent">
              ✓ Toric pressed the Oil of Brightness into your hand — it&apos;s in
              your pack.
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setCatalogKind("shop")}
            className="rounded-lg border border-lore-accent bg-lore-accent-dim px-4 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
          >
            Browse wares ▶
          </button>
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
                proficient — Old Brennar can grant Help (advantage). If he isn&apos;t
                in your party yet, accepting his Help adds him first.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => pickLock(false)}
                  disabled={checkUsed}
                  className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent disabled:opacity-40"
                >
                  {checkUsed ? "Lock picked ✓" : "Pick the lock"}
                </button>
                <button
                  type="button"
                  data-coachmark="tut-advantage"
                  onClick={() => pickLock(true)}
                  disabled={checkUsed || helpUsed}
                  className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
                >
                  {helpUsed
                    ? "Brennar helped ✓"
                    : "Accept Brennar's Help (Advantage)"}
                </button>
              </div>
              <p className="text-[11px] text-lore-muted">
                Or skip the chest — press Continue to climb the stair.
              </p>
            </>
          )}
        </div>
      )}

      {inScene6 && (
        <div className="space-y-2 rounded-lg border border-lore-accent bg-lore-surface p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-lore-text">
            <span aria-hidden>🪔</span>
            The great lantern
          </div>
          {lanternLit ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-lore-accent">
                ✓ The lantern burns again — the Hungering Forest pulls back from
                the village. Pin a memory below, then finish your adventure.
              </div>
              <button
                type="button"
                onClick={finishTutorial}
                disabled={completeTutorial.isPending || finishSent}
                className="rounded-lg border border-lore-accent bg-lore-accent-dim px-4 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
              >
                {completeTutorial.isPending
                  ? "Finishing…"
                  : finishSent
                    ? "Finishing…"
                    : "Finish the adventure ▶"}
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-lore-muted">
                Light it however you can — each way tells a slightly different
                story, and the engine resolves what your choice can do.
              </p>
              <div className="flex flex-wrap gap-2">
                {oilInPack && (
                  <button
                    type="button"
                    onClick={() => relight("oil")}
                    disabled={relightSent}
                    className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
                  >
                    Use the Oil of Brightness
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => relight("flint")}
                  disabled={relightSent}
                  className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent disabled:opacity-40"
                >
                  Marlowe&apos;s flint &amp; oil
                </button>
                <button
                  type="button"
                  onClick={() => relight("prayer")}
                  disabled={relightSent}
                  className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent disabled:opacity-40"
                >
                  Recite the Order&apos;s prayer (Religion)
                </button>
                <button
                  type="button"
                  onClick={() => relight("improv")}
                  disabled={relightSent}
                  className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent disabled:opacity-40"
                >
                  Try something else
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {leveledUp && (
        <div
          data-coachmark="tut-levelup"
          className="space-y-1 rounded-lg border border-lore-accent bg-lore-accent-dim p-3"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-lore-text">
            <span aria-hidden>✨</span>
            You leveled up!
          </div>
          <p className="text-xs text-lore-muted">
            {TUTORIAL_RESOLUTION.levelUp.notice}
          </p>
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
        pcCharacterId={pcCharacterId}
        partyRoster={partyQuery.data}
        companionExpected={companionExpected}
        loadouts={loadouts}
        tutorialControls={tutorialControls}
        hudExtra={hudExtra}
        onEntityClick={setDrawerName}
        onReactionPass={session.tutorialResume}
        onPin={pinMessage}
        pinnedTexts={pinnedTexts}
      />
      <TutorialEntityDrawer
        name={drawerName}
        onClose={() => setDrawerName(null)}
        onSpeak={speak}
        onBrowse={(kind) => setCatalogKind(kind)}
        spokenTopics={spokenTopics}
      />
      {catalogKind === "shop" ? (
        <TutorialCatalogOverlay
          title={TUTORIAL_SHOP.name}
          subtitle={`Shopkeeper: ${TUTORIAL_SHOP.keeper} (${TUTORIAL_SHOP.keeperBlurb})`}
          listings={TUTORIAL_SHOP.listings}
          onClose={() => setCatalogKind(null)}
          footer={
            oilGranted ? undefined : (
              <p className="text-[11px] italic text-lore-muted">
                &ldquo;You&apos;ll need it. And if you&apos;re back tomorrow,
                we&apos;ll all owe you. If you&apos;re not… well.&rdquo;
              </p>
            )
          }
          primaryAction={
            oilGranted
              ? undefined
              : {
                  label: "Accept Toric's gift ▶",
                  onClick: takeTorricsGift,
                  pending: grantOil.isPending,
                }
          }
        />
      ) : null}
      {catalogKind === "tavern" ? (
        <TutorialCatalogOverlay
          title={TUTORIAL_TAVERN.name}
          subtitle={`Keeper: ${TUTORIAL_TAVERN.keeper} (${TUTORIAL_TAVERN.keeperBlurb})`}
          listings={TUTORIAL_TAVERN.listings}
          purseGp={TUTORIAL_TAVERN.purseGp}
          onClose={() => setCatalogKind(null)}
        />
      ) : null}
      <TutorialInventoryDrawer
        open={invOpen}
        items={items}
        loading={inventory.isLoading}
        onClose={() => setInvOpen(false)}
      />
      <CoachmarkHost defs={TUTORIAL_COACHMARKS} firedActions={firedActions} />
      <GraduationModal
        open={graduated}
        unlockedAchievementIds={unlockedAchievements}
        onClose={() => setGraduated(false)}
        onReplay={() => replay.mutate()}
        replayBusy={replay.isPending}
      />
      {hintVisible && sceneHint && !graduated && (
        <TutorialHintChip
          hint={sceneHint}
          onDismiss={() => {
            const next = hintDismissals + 1;
            setHintDismissals(next);
            setHintVisible(false);
            lastActivity.current = Date.now();
            if (shouldAutoProgressScene(next)) {
              setHintDismissals(0);
              session.tutorialAutoHint();
            }
          }}
        />
      )}
    </>
  );
}
