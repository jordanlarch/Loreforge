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
  getSpell,
  indomitableAvailable,
  indomitableFeatureKey,
  withinBurst,
  withinCone,
  withinCube,
  withinLine,
  type EntityState,
  type WorldState,
} from "@app/engine";

export type Cell = { x: number; y: number };

export type Damage = { notation: string; type: string };

/** A reach-5 melee strike; ranged weapons + sheet weapon lists land later. */
export const MELEE_REACH_FT = FEET_PER_CELL;

/** Area shape for an AoE spell — mirrors the engine spell registry (#99). */
export type SpellArea = {
  shape: "sphere" | "cone" | "line" | "cube";
  sizeFt: number;
};

/** Who the live cast picker should offer when arming a spell. */
export type CastTargetKind = "enemy" | "ally" | "self";

/**
 * Offensive spells the cast menu can fire — a subset of the engine registry
 * (`packages/engine/src/content/spell-registry.ts`). Single-target spells arm
 * the map's target picker; spells with `area` arm the AoE **aim picker** (#99):
 * the player places an origin/aim cell and the engine resolves caught creatures.
 */
export type CastableSpell = {
  id: string;
  name: string;
  /** Spell level; 0 = cantrip (consumes no slot). */
  level: number;
  /** Range to the target (single) or to the aim point (sphere); 0 for self. */
  rangeFt: number;
  /** Present → AoE spell needing the aim picker rather than a target pick. */
  area?: SpellArea;
  /** Who can be picked on the map; defaults to hostile enemies in range. */
  targetKind?: CastTargetKind;
  /** Multi-target spells (Bless): max creatures per cast. */
  maxTargets?: number;
  /** Reaction-only — omitted from the action-phase cast menu. */
  reaction?: boolean;
};

export const CASTABLE_SPELLS: readonly CastableSpell[] = [
  { id: "fire-bolt", name: "Fire Bolt", level: 0, rangeFt: 120 },
  { id: "sacred-flame", name: "Sacred Flame", level: 0, rangeFt: 60 },
  { id: "guiding-bolt", name: "Guiding Bolt", level: 1, rangeFt: 120 },
  { id: "bless", name: "Bless", level: 1, rangeFt: 30, targetKind: "ally", maxTargets: 3 },
  { id: "hunters-mark", name: "Hunter's Mark", level: 1, rangeFt: 90 },
  { id: "shield", name: "Shield", level: 1, rangeFt: 0, targetKind: "self", reaction: true },
  {
    id: "counterspell",
    name: "Counterspell",
    level: 3,
    rangeFt: 60,
    targetKind: "enemy",
    reaction: true,
  },
  {
    id: "burning-hands",
    name: "Burning Hands",
    level: 1,
    rangeFt: 0,
    area: { shape: "cone", sizeFt: 15 },
  },
  {
    id: "fireball",
    name: "Fireball",
    level: 3,
    rangeFt: 150,
    area: { shape: "sphere", sizeFt: 20 },
  },
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
    if (spell.reaction) return false;
    if (spell.level === 0) return true;
    const slot = slots[spell.level];
    return slot !== undefined && slot.current > 0;
  });
}

/** Reaction spells (Shield) when a reaction and slot are available. */
export function reactionSpellsFor(entity: EntityState): CastableSpell[] {
  if (!entity.spellcasting || entity.reaction !== "available") return [];
  const slots = entity.spellcasting.slots;
  return CASTABLE_SPELLS.filter((spell) => {
    if (!spell.reaction) return false;
    if (spell.level === 0) return true;
    const slot = slots[spell.level];
    return slot !== undefined && slot.current > 0;
  });
}

/**
 * Placed, alive enemies of `attackerId` within `rangeFt` in the same scene.
 * Line of sight is left to the engine (which rejects blocked attacks/casts).
 * Range is also enforced authoritatively when `rangeFt` is supplied on the command.
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
 * Same-side allies within `rangeFt` (Bless, Cure Wounds, …). Optionally includes
 * the caster (Bless may target self). Neutral/unassigned sides are excluded.
 */
export function alliesInRange(
  state: WorldState,
  casterId: string,
  rangeFt: number,
  options: { includeSelf?: boolean } = {},
): EntityState[] {
  const caster = state.entities[casterId];
  const encounter = state.encounter;
  if (!caster?.position || !encounter) return [];
  const mySide = encounter.sides[caster.id];
  if (mySide === undefined) return [];
  return Object.values(state.entities).filter((e) => {
    if (!e.alive || e.position === undefined || e.sceneId !== caster.sceneId) {
      return false;
    }
    if (e.id === casterId) {
      return options.includeSelf === true;
    }
    const theirSide = encounter.sides[e.id];
    if (theirSide !== mySide || areHostile(mySide, theirSide)) return false;
    return gridDistanceFeet(caster.position!, e.position) <= rangeFt;
  });
}

/** Valid single-target cast recipients for the map picker. */
export function castTargetCandidates(
  state: WorldState,
  casterId: string,
  spell: CastableSpell,
): EntityState[] {
  const kind = spell.targetKind ?? "enemy";
  if (kind === "self") {
    const caster = state.entities[casterId];
    return caster?.alive ? [caster] : [];
  }
  if (kind === "ally") {
    return alliesInRange(state, casterId, spell.rangeFt, { includeSelf: true });
  }
  return targetsInRange(state, casterId, spell.rangeFt);
}

/**
 * Every alive, placed hostile to `actor` in its scene, regardless of range — the
 * candidate set for a *readied* strike (#104), which targets a foe that hasn't
 * closed yet and fires once it enters range.
 */
export function hostilesInScene(
  state: WorldState,
  actor: EntityState,
): EntityState[] {
  const encounter = state.encounter;
  if (!encounter) return [];
  const mySide = encounter.sides[actor.id];
  return Object.values(state.entities).filter(
    (e) =>
      e.id !== actor.id &&
      e.alive &&
      e.position !== undefined &&
      e.sceneId === actor.sceneId &&
      areHostile(mySide, encounter.sides[e.id]),
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

/** Party-controlled bard who may use Cutting Words on a staged attack. */
export function controllableCuttingWords(
  state: WorldState,
  controlledSide: string,
):
  | {
      reactor: EntityState;
      against: EntityState;
      target: EntityState;
      natural: number;
      total: number;
      targetAc: number;
      hit: boolean;
    }
  | undefined {
  const pending = state.encounter?.pendingAttack;
  if (!pending || !state.encounter) return undefined;
  const against = state.entities[pending.cmd.attacker];
  const target = state.entities[pending.cmd.target];
  if (!against || !target) return undefined;
  for (const id of pending.eligible) {
    if (pending.declined.includes(id)) continue;
    if (state.encounter.sides[id] !== controlledSide) continue;
    const reactor = state.entities[id];
    if (!reactor?.alive) continue;
    return {
      reactor,
      against,
      target,
      natural: pending.natural,
      total: pending.total,
      targetAc: pending.targetAc,
      hit: pending.hit,
    };
  }
  return undefined;
}

/** Stable key for a staged Cutting Words window. */
export function cuttingWordsWindowKey(state: WorldState): string | null {
  const pending = state.encounter?.pendingAttack;
  if (!pending) return null;
  return `${pending.cmd.attacker}:${pending.cmd.target}:${pending.total}:${pending.natural}`;
}

/** Lowest spell slot the reactor can spend to Counterspell a pending cast. */
function counterspellSlotFor(
  entity: EntityState,
  pendingSlotLevel: number,
): number | undefined {
  const slots = entity.spellcasting?.slots ?? {};
  const minAuto = Math.max(3, pendingSlotLevel);
  for (let level = minAuto; level <= 9; level += 1) {
    if ((slots[level]?.current ?? 0) > 0) return level;
  }
  for (let level = 3; level < minAuto; level += 1) {
    if ((slots[level]?.current ?? 0) > 0) return level;
  }
  return undefined;
}

/** Party-controlled caster who may Counterspell a staged spell cast. */
export function controllableCounterspell(
  state: WorldState,
  controlledSide: string,
):
  | {
      reactor: EntityState;
      casting: EntityState;
      spellId: string;
      spellName: string;
      slotLevel: number;
      counterspellSlotLevel: number;
    }
  | undefined {
  const pending = state.encounter?.pendingSpellCast;
  if (!pending || !state.encounter) return undefined;
  const casting = state.entities[pending.cmd.caster];
  if (!casting) return undefined;
  const spellName =
    getSpell(pending.cmd.spellId)?.name ?? pending.cmd.spellId;
  for (const id of pending.eligible) {
    if (pending.declined.includes(id)) continue;
    if (state.encounter.sides[id] !== controlledSide) continue;
    const reactor = state.entities[id];
    if (!reactor?.alive) continue;
    const counterspellSlotLevel = counterspellSlotFor(reactor, pending.slotLevel);
    if (counterspellSlotLevel === undefined) continue;
    return {
      reactor,
      casting,
      spellId: pending.cmd.spellId,
      spellName,
      slotLevel: pending.slotLevel,
      counterspellSlotLevel,
    };
  }
  return undefined;
}

/** Stable key for a staged Counterspell window. */
export function counterspellWindowKey(state: WorldState): string | null {
  const pending = state.encounter?.pendingSpellCast;
  if (!pending) return null;
  return `${pending.cmd.caster}:${pending.cmd.spellId}:${pending.slotLevel}`;
}

/** Party-controlled Fighter who may reroll a staged failed save with Indomitable. */
export function controllableIndomitable(
  state: WorldState,
  controlledSide: string,
):
  | {
      entity: EntityState;
      ability: string;
      dc: number;
      featureKey: string;
    }
  | undefined {
  const pending = state.encounter?.pendingIndomitable;
  if (!pending || !state.encounter) return undefined;
  if (state.encounter.sides[pending.entity] !== controlledSide) return undefined;
  const entity = state.entities[pending.entity];
  if (!entity?.alive || !indomitableAvailable(entity)) return undefined;
  const featureKey = indomitableFeatureKey(entity);
  if (!featureKey) return undefined;
  return {
    entity,
    ability: pending.ability,
    dc: pending.dc,
    featureKey,
  };
}

/** Stable key for a staged Indomitable window. */
export function indomitableWindowKey(state: WorldState): string | null {
  const pending = state.encounter?.pendingIndomitable;
  if (!pending) return null;
  return `${pending.entity}:${pending.ability}:${pending.dc}`;
}

/**
 * Whether `cell` falls inside `spell`'s area aimed at `aim` from `casterId`,
 * reusing the engine's own `withinBurst`/`withinCone` so the preview matches
 * resolution exactly (a sphere bursts from the aim point; a cone emanates from
 * the caster toward the aim cell). Line of sight is left to the engine.
 */
function cellInArea(
  state: WorldState,
  casterId: string,
  area: SpellArea,
  aim: Cell,
  cell: Cell,
): boolean {
  if (area.shape === "cone") {
    const caster = state.entities[casterId];
    if (!caster?.position) return false;
    return withinCone(caster.position, aim, cell, area.sizeFt);
  }
  if (area.shape === "line") {
    const caster = state.entities[casterId];
    if (!caster?.position) return false;
    return withinLine(caster.position, aim, cell, area.sizeFt);
  }
  if (area.shape === "cube") {
    return withinCube(aim, cell, area.sizeFt);
  }
  return withinBurst(aim, cell, area.sizeFt);
}

/** The grid cells `spell`'s area covers for the current aim (AoE preview, #99). */
export function aoeAffectedCells(
  state: WorldState,
  casterId: string,
  area: SpellArea,
  aim: Cell,
): Cell[] {
  const caster = state.entities[casterId];
  const scene = caster?.sceneId ? state.scenes[caster.sceneId] : undefined;
  const map = scene?.map;
  if (!map) return [];
  const cells: Cell[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (cellInArea(state, casterId, area, aim, { x, y })) cells.push({ x, y });
    }
  }
  return cells;
}

/**
 * Ids of placed, alive creatures caught in `spell`'s area for the current aim —
 * friend *and* foe (an AoE doesn't discriminate). Drives the caught-target
 * highlight; the engine re-resolves authoritatively (incl. line of sight).
 */
export function aoeCaughtIds(
  state: WorldState,
  casterId: string,
  area: SpellArea,
  aim: Cell,
): string[] {
  const caster = state.entities[casterId];
  if (!caster) return [];
  return Object.values(state.entities)
    .filter(
      (e) =>
        e.alive &&
        e.position !== undefined &&
        e.sceneId === caster.sceneId &&
        cellInArea(state, casterId, area, aim, e.position),
    )
    .map((e) => e.id);
}
