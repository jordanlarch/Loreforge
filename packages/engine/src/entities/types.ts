/**
 * Base entity model for the engine skeleton (E1).
 *
 * A deliberately small subset of the full data model in
 * `docs/engine/architecture.md` §3. It carries enough structure to exercise the
 * event store, projections, and command pipeline (HP, AC, ability scores, scene
 * placement) without yet modelling the full combat/spell state. Later phases
 * (E2+) extend these in place.
 */

import type { ConditionState } from "../combat/conditions";
import type { ActiveEffect } from "../combat/effects";

export type AbilityScores = {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
};

export type Ability = keyof AbilityScores;

export const ABILITIES: readonly Ability[] = [
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha",
] as const;

export type EntityKind = "character" | "npc" | "monster";

export type GridPosition = { x: number; y: number };

export type HitPoints = {
  current: number;
  max: number;
  temp: number;
};

/** A reference to an entity, used by events and commands. */
export type EntityRef = string;

export type SceneId = string;

export type ClassLevel = {
  class: string;
  level: number;
  subclass?: string;
};

/**
 * Availability of a single per-turn resource (action / bonus action / reaction).
 * `lost` is distinct from `used`: it means the resource was denied for a reason
 * (e.g. an incapacitating condition) rather than spent. Conditions (#12) set the
 * `lost` state; this slice only ever transitions available ↔ used on reset.
 * (Arch §5.1, trimmed: the `usedBy`/`at` command refs are deferred.)
 */
export type ResourceState = "available" | "used" | "lost";

/**
 * Per-combatant action economy for the current turn (arch §5.1).
 *
 * The reaction is deliberately *not* here: unlike action / bonus / movement it
 * spans other creatures' turns (granted at encounter start, refreshed at the
 * start of the owner's turn), so it lives on `EntityState.reaction`.
 */
export type ActionEconomyState = {
  action: ResourceState;
  bonusAction: ResourceState;
  movement: { used: number; total: number };
  /**
   * The Attack action's attack budget for this turn. `total` is the creature's
   * attacks-per-Attack-action — 1 for most creatures, 2+ with Extra Attack
   * (martial classes at level 5+) or a monster's Multiattack. `used` counts the
   * attacks already made this turn. Taking the Attack action spends the single
   * `action` once; the remaining attacks of that action ride on this budget
   * without re-spending the action.
   */
  attacks: { used: number; total: number };
  /** One free object interaction per turn. */
  freeInteractionUsed: boolean;
};

/** Canonical entity record held in the WorldState projection. */
export type EntityState = {
  id: EntityRef;
  kind: EntityKind;
  name: string;
  abilityScores: AbilityScores;
  hp: HitPoints;
  /** Base armor class before situational modifiers. */
  baseAc: number;
  speed: number;
  /** Class levels (PCs/NPCs). Monsters may leave this empty. */
  classes: ClassLevel[];
  /** Proficiency bonus, derived from total level / CR. */
  proficiencyBonus: number;
  /**
   * Attacks granted by a single Attack action. Defaults to the Extra Attack
   * value derived from {@link classes} (1, or 2+ for martial classes at level
   * 5+). Set explicitly to model a monster's Multiattack (e.g. 2 or 3). Read via
   * `attacksPerAction(entity)`.
   */
  attacksPerAction?: number;
  sceneId?: SceneId;
  position?: GridPosition;
  /** True while current HP > 0. Maintained by the projection. */
  alive: boolean;
  /**
   * Action economy for the current turn. Present only while it is this
   * combatant's turn in an active encounter; reset on `TurnStarted`, cleared on
   * `TurnEnded`. Undefined outside of combat.
   */
  actionEconomy?: ActionEconomyState;
  /** Active SRD conditions (`combat/conditions.ts`). */
  conditions: ConditionState[];
  /** Timed / concentration-bound modifiers (ENG-13). */
  effects?: ActiveEffect[];
  /**
   * True once truly dead (three death-save failures). Distinct from being downed
   * at 0 HP (`alive === false` but `dead === false`), which is recoverable.
   * Healing is refused only when `dead`.
   */
  dead: boolean;
  /** Death-save tally while dying at 0 HP; undefined when up or after stabilizing. */
  deathSaves?: DeathSaveTally;
  /** True once stabilized at 0 HP (stops rolling death saves). */
  stable?: boolean;
  /** The spell this creature is concentrating on, if any. */
  concentration?: ConcentrationState;
  /** Caster state (ability + spell slots); absent for non-casters. */
  spellcasting?: SpellcastingState;
  /**
   * The reaction budget for the round. Unlike `actionEconomy` (present only on
   * the active turn), the reaction spans other creatures' turns: it is granted
   * (`available`) at encounter start, refreshed at the start of the owner's turn,
   * spent (`used`) by opportunity attacks / readied actions, and forced to `lost`
   * while incapacitated (reconciled by the projection). Undefined outside of an
   * encounter.
   */
  reaction?: ResourceState;
  /** A queued Ready action awaiting its trigger; cleared on the owner's next turn. */
  readied?: ReadyState;
  /**
   * Melee reach in feet for opportunity-attack provoke detection (ENG-10).
   * Defaults to 5 ft when omitted. Set from equipped reach weapons at seed time.
   */
  meleeReachFt?: number;
  /** Ranged weapon reach for monster AI (PLAY-15). */
  rangedAttackRangeFt?: number;
  rangedAttackBonus?: number;
  rangedDamage?: { notation: string; type: string };
  /** Active poison instances after delivery (GRILL-LIVE-POISON Q2). */
  activePoisons?: ActivePoisonInstance[];
  /** Pending injury poison on weapon — cleared after one qualifying hit (Q4). */
  coatedPoisonSlug?: string;
  /** Active curse instances after delivery (GRILL-LIVE-CURSE Q2). */
  activeCurses?: ActiveCurseInstance[];
  /** Active environmental effect instances (GRILL-LIVE-ENV-EFFECT Q2). */
  activeEnvironmentalEffects?: ActiveEnvironmentalEffectInstance[];
};

/** Ongoing poison tracked on an entity (injury or ingested after delivery). */
export type ActivePoisonInstance = {
  instanceId: string;
  poisonSlug: string;
  /** Repeat save at turn start until removed (Pale Tincture, Burnt Othur). */
  pendingRepeat: boolean;
  /** Successful repeat saves toward ending (Burnt Othur: 3). */
  repeatSuccesses?: number;
};

/** Ongoing curse tracked on an entity after a failed initial save. */
export type ActiveCurseInstance = {
  instanceId: string;
  curseSlug: string;
  /** Turn-start recovery save (Demonic Possession v1). */
  pendingRecovery: boolean;
  recoverySuccesses?: number;
};

/** Ongoing environmental effect exposure on an entity (GRILL-LIVE-ENV-EFFECT Q2). */
export type ActiveEnvironmentalEffectInstance = {
  instanceId: string;
  effectSlug: string;
  /** Turn-start repeat save (Slippery Ice v1). */
  pendingRepeat: boolean;
};

export type DeathSaveTally = { successes: number; failures: number };

export type ConcentrationState = { spell: string };

/** A single spell-slot pool for one spell level. */
export type SpellSlotState = { max: number; current: number };

/** Spell slots keyed by spell level (1–9). Cantrips use no slot. */
export type SpellSlots = Record<number, SpellSlotState>;

/**
 * Caster state (#40, E3). Holds the spellcasting ability (so save DC / spell
 * attack are derived at cast time, never stored) and the per-level slot pools.
 * Present only on creatures that can cast; absent for non-casters.
 */
export type SpellcastingState = {
  ability: Ability;
  slots: SpellSlots;
  /**
   * Registry spell ids the caster may cast (ENG-12). Cantrips + prepared +
   * always-prepared from the character sheet. When omitted (monsters, fixtures,
   * golden tests), any registry spell is allowed.
   */
  preparedSpellIds?: string[];
};

/** The action a Ready'd creature will take when its trigger fires. */
export type ReadiedAction = {
  kind: "attack";
  target: EntityRef;
  attackBonus: number;
  damage: { notation: string; type: string };
  /** Weapon range encoded in the ready trigger; used when the strike fires. */
  rangeFt?: number;
};

export type ReadyState = { trigger: string; action: ReadiedAction };

/**
 * Optional square-grid map for a scene. Distances use the SRD **5-5-5
 * (Chebyshev)** convention: every step — orthogonal or diagonal — costs 5 ft
 * (see `combat/grid.ts`). `blockedCells` are walls: they block both movement and
 * line of sight.
 */
export type SceneMap = {
  width: number;
  height: number;
  blockedCells: GridPosition[];
};

/** Live Play map category — gates trap placement (GRILL-LIVE-TOOLBOX Q2b). */
export type SceneKind =
  | "encounter"
  | "dungeon"
  | "building"
  | "shop"
  | "tavern"
  | "settlement"
  | "region";

/** Scene-placed trap instance (GRILL-LIVE-TOOLBOX Q2). */
export type SceneTrapInstance = {
  instanceId: string;
  /** Codex / registry slug, e.g. `srd-2024_poison-needle`. */
  trapSlug: string;
  position: GridPosition;
  detected: boolean;
  disabled: boolean;
  /** Set after a `once` trap fires. */
  triggered: boolean;
};

export type SceneState = {
  id: SceneId;
  name: string;
  description?: string;
  map?: SceneMap;
  /** When set, gates trap placement — settlement/region never carry traps. */
  sceneKind?: SceneKind;
  /** Traps placed on this scene's grid (Live Play toolbox resolution). */
  traps?: SceneTrapInstance[];
  /** Ambient environmental effects active in this scene (GRILL-LIVE-ENV-EFFECT Q2). */
  environmentalEffectSlugs?: string[];
};

/**
 * Init for a caster: the spellcasting ability plus the caster level whose
 * full-caster slot table seeds the pools. `casterLevel` defaults to the
 * entity's total class level (required for classless monsters).
 */
export type SpellcastingInit = {
  ability: Ability;
  casterLevel?: number;
  /** See {@link SpellcastingState.preparedSpellIds}. */
  preparedSpellIds?: string[];
};

/** Input shape for creating an entity (defaults filled by the factory). */
export type EntityInit = {
  id: EntityRef;
  kind: EntityKind;
  name: string;
  abilityScores: AbilityScores;
  maxHp: number;
  baseAc: number;
  speed?: number;
  classes?: ClassLevel[];
  /** Override attacks-per-Attack-action (monster Multiattack). Defaults to the
   * Extra Attack value derived from `classes`. */
  attacksPerAction?: number;
  /** Melee reach for OA provoke (reach weapons). Defaults to 5 ft. */
  meleeReachFt?: number;
  /** Ranged weapon profile for monster AI (PLAY-15). */
  rangedAttackRangeFt?: number;
  rangedAttackBonus?: number;
  rangedDamage?: { notation: string; type: string };
  sceneId?: SceneId;
  position?: GridPosition;
  spellcasting?: SpellcastingInit;
  /** Pre-coated injury poison (GRILL-LIVE-POISON demo foes). */
  coatedPoisonSlug?: string;
};
