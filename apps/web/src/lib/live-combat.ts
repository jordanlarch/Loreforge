/**
 * Browser-safe helpers for the live combat loop (#58).
 *
 * Pure derivations the play surface and HUD share: a generic weapon "Strike"
 * derived from a live entity, a curated cast menu mapped to the engine spell
 * registry, grid-range math (SRD 5-5-5 / Chebyshev), in-range hostile target
 * resolution, and reaction-window eligibility. The deterministic engine remains
 * the authority — these only drive the targeting UI and compose the command the
 * client submits.
 */
import {
  abilityModifier,
  areHostile,
  FEET_PER_CELL,
  type EntityState,
  type WorldState,
} from "@app/engine";

export type Cell = { x: number; y: number };

export type Damage = { notation: string; type: string };

/** A reach-5 melee strike; ranged weapons + sheet weapon lists land later. */
export const MELEE_REACH_FT = FEET_PER_CELL;

/**
 * Curated single-target offensive spells the cast menu can fire. A subset of the
 * engine registry (`packages/engine/src/content/spell-registry.ts`) restricted
 * to single-target spells — area spells need the AoE aim picker (deferred).
 */
export type CastableSpell = {
  id: string;
  name: string;
  /** Spell level; 0 = cantrip (consumes no slot). */
  level: number;
  rangeFt: number;
};

export const CASTABLE_SPELLS: readonly CastableSpell[] = [
  { id: "fire-bolt", name: "Fire Bolt", level: 0, rangeFt: 120 },
  { id: "sacred-flame", name: "Sacred Flame", level: 0, rangeFt: 60 },
  { id: "guiding-bolt", name: "Guiding Bolt", level: 1, rangeFt: 120 },
];

function fmtMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** Derive a generic weapon strike (best of STR/DEX + proficiency, 1d8). */
export function deriveStrike(entity: EntityState): {
  attackBonus: number;
  damage: Damage;
  label: string;
} {
  const strMod = abilityModifier(entity.abilityScores.str);
  const dexMod = abilityModifier(entity.abilityScores.dex);
  const atkMod = Math.max(strMod, dexMod);
  const attackBonus = entity.proficiencyBonus + atkMod;
  const notation = atkMod !== 0 ? `1d8${fmtMod(atkMod)}` : "1d8";
  return {
    attackBonus,
    damage: { notation, type: "slashing" },
    label: `Strike ${fmtMod(attackBonus)} · ${notation}`,
  };
}

/** Chebyshev grid distance in feet (SRD 5-5-5: every step costs 5 ft). */
export function gridDistanceFeet(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * FEET_PER_CELL;
}

/** Spells the entity can cast right now: cantrips always; leveled if a slot is free. */
export function castableSpellsFor(entity: EntityState): CastableSpell[] {
  if (!entity.spellcasting) return [];
  const slots = entity.spellcasting.slots;
  return CASTABLE_SPELLS.filter((spell) => {
    if (spell.level === 0) return true;
    const slot = slots[spell.level];
    return slot !== undefined && slot.current > 0;
  });
}

/**
 * Placed, alive enemies of `attackerId` within `rangeFt` in the same scene.
 * Line of sight is left to the engine (which rejects blocked casts/attacks).
 */
export function targetsInRange(
  state: WorldState,
  attackerId: string,
  rangeFt: number,
): EntityState[] {
  const attacker = state.entities[attackerId];
  const encounter = state.encounter;
  if (!attacker?.position || !encounter) return [];
  const mySide = encounter.sides[attacker.id];
  return Object.values(state.entities).filter(
    (e) =>
      e.id !== attacker.id &&
      e.alive &&
      e.position !== undefined &&
      e.sceneId === attacker.sceneId &&
      areHostile(mySide, encounter.sides[e.id]) &&
      gridDistanceFeet(attacker.position!, e.position) <= rangeFt,
  );
}

/**
 * Reactors in an open opportunity-attack window that the local player controls
 * (on `controlledSide`), so we only prompt for reactions the user can take.
 */
export function controllableReactors(
  state: WorldState,
  controlledSide: string,
): { reactor: EntityState; mover: EntityState }[] {
  const encounter = state.encounter;
  const window = encounter?.reactionWindow;
  if (!encounter || !window) return [];
  const mover = state.entities[window.mover];
  if (!mover) return [];
  return window.eligible
    .filter((id) => encounter.sides[id] === controlledSide)
    .map((id) => state.entities[id])
    .filter((e): e is EntityState => e !== undefined && e.alive)
    .map((reactor) => ({ reactor, mover }));
}

/** A stable key for a reaction window, so a dismissed prompt stays dismissed. */
export function reactionWindowKey(state: WorldState): string | null {
  const window = state.encounter?.reactionWindow;
  if (!window) return null;
  return `${window.mover}:${[...window.eligible].sort().join(",")}`;
}
