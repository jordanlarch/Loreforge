/**
 * Base entity model for the engine skeleton (E1).
 *
 * A deliberately small subset of the full data model in
 * `docs/engine/architecture.md` §3. It carries enough structure to exercise the
 * event store, projections, and command pipeline (HP, AC, ability scores, scene
 * placement) without yet modelling the full combat/spell state. Later phases
 * (E2+) extend these in place.
 */

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

/** Per-combatant action economy for the current turn (arch §5.1). */
export type ActionEconomyState = {
  action: ResourceState;
  bonusAction: ResourceState;
  reaction: ResourceState;
  movement: { used: number; total: number };
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
};

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

export type SceneState = {
  id: SceneId;
  name: string;
  description?: string;
  map?: SceneMap;
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
  sceneId?: SceneId;
  position?: GridPosition;
};
