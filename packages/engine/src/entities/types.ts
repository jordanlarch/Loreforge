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
};

export type SceneState = {
  id: SceneId;
  name: string;
  description?: string;
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
