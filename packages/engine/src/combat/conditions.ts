/**
 * SRD conditions — pure data + resolvers (`architecture.md` §6.3).
 *
 * This is a focused subset of the full §6.1 Effect/Modifier pipeline: conditions
 * are stored on the entity and their mechanical consequences are derived on
 * demand by the resolvers below, which the command handlers consult during
 * attack / save / movement resolution. Spell-driven effects, auras, and the
 * stacking engine layer on top of this later.
 *
 * Modelled effects (the "primary effect" of each condition):
 *  - advantage / disadvantage on the creature's own attacks
 *  - advantage / disadvantage on attacks made against the creature
 *  - incapacitation (no actions or reactions)
 *  - speed reduced to zero
 *  - auto-failed STR/DEX saving throws; per-ability save disadvantage
 *  - charmed: cannot attack the charmer
 *  - melee attacks against a prone/paralyzed/unconscious creature crit when adjacent
 *
 * Not yet modelled (deferred to the Effect/spell systems): damage
 * resistance/immunity (petrified), condition immunities, perception/check
 * auto-fails (blinded sight checks, deafened hearing), and the social-only facets
 * of charmed.
 */
import type { Ability } from "../entities/types";

export const CONDITIONS = [
  "blinded",
  "charmed",
  "deafened",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
  "exhaustion",
] as const;

export type Condition = (typeof CONDITIONS)[number];

export function isCondition(value: string): value is Condition {
  return (CONDITIONS as readonly string[]).includes(value);
}

/** An applied condition instance carried on an entity. */
export type ConditionState = {
  condition: Condition;
  /** The originator (e.g. the charmer / grappler / fear source). */
  source?: string;
  /** Exhaustion tier 1-6; ignored for other conditions. */
  level?: number;
};

export const EXHAUSTION_MAX = 6 as const;

/** Static mechanical profile of a single condition (excludes exhaustion tiers). */
type ConditionMechanics = {
  incapacitated?: boolean;
  speedZero?: boolean;
  ownAttacksDisadvantage?: boolean;
  ownAttacksAdvantage?: boolean;
  attacksAgainstAdvantage?: boolean;
  attacksAgainstDisadvantage?: boolean;
  autoFailStrDex?: boolean;
  /** Saving throws made with disadvantage (by ability). */
  saveDisadvantage?: Ability[];
  /** Cannot attack the condition's source (charmed). */
  cannotAttackSource?: boolean;
  /** Melee attacks from an adjacent attacker are automatic crits on a hit. */
  meleeCritWhenAdjacent?: boolean;
  prone?: boolean;
};

const NO_MECHANICS: ConditionMechanics = {};

const CONDITION_MECHANICS: Record<Condition, ConditionMechanics> = {
  blinded: { ownAttacksDisadvantage: true, attacksAgainstAdvantage: true },
  charmed: { cannotAttackSource: true },
  deafened: NO_MECHANICS,
  // Simplified: disadvantage on attacks while frightened (SRD gates on the
  // source being in line of sight, which we approximate as always-on here).
  frightened: { ownAttacksDisadvantage: true },
  grappled: { speedZero: true },
  incapacitated: { incapacitated: true },
  invisible: { ownAttacksAdvantage: true, attacksAgainstDisadvantage: true },
  paralyzed: {
    incapacitated: true,
    speedZero: true,
    autoFailStrDex: true,
    attacksAgainstAdvantage: true,
    meleeCritWhenAdjacent: true,
  },
  petrified: {
    incapacitated: true,
    speedZero: true,
    autoFailStrDex: true,
    attacksAgainstAdvantage: true,
  },
  poisoned: { ownAttacksDisadvantage: true },
  prone: { ownAttacksDisadvantage: true, prone: true },
  restrained: {
    speedZero: true,
    ownAttacksDisadvantage: true,
    attacksAgainstAdvantage: true,
    saveDisadvantage: ["dex"],
  },
  stunned: {
    incapacitated: true,
    speedZero: true,
    autoFailStrDex: true,
    attacksAgainstAdvantage: true,
  },
  unconscious: {
    incapacitated: true,
    speedZero: true,
    autoFailStrDex: true,
    attacksAgainstAdvantage: true,
    meleeCritWhenAdjacent: true,
    prone: true,
  },
  exhaustion: NO_MECHANICS, // tier-driven; see exhaustionLevel handling
};

export type RollAdjust = "normal" | "advantage" | "disadvantage";

/** Combine d20 roll modes per SRD: any advantage + any disadvantage → normal. */
export function combineMode(...modes: RollAdjust[]): RollAdjust {
  const adv = modes.includes("advantage");
  const dis = modes.includes("disadvantage");
  if (adv && dis) return "normal";
  if (adv) return "advantage";
  if (dis) return "disadvantage";
  return "normal";
}

function exhaustionLevel(conditions: readonly ConditionState[]): number {
  const ex = conditions.find((c) => c.condition === "exhaustion");
  return ex ? Math.max(0, Math.min(EXHAUSTION_MAX, ex.level ?? 1)) : 0;
}

/** True if any condition incapacitates the creature (no actions / reactions). */
export function isIncapacitated(conditions: readonly ConditionState[]): boolean {
  return conditions.some((c) => CONDITION_MECHANICS[c.condition].incapacitated);
}

/** Effective speed after speed-zeroing conditions and exhaustion tiers. */
export function effectiveSpeed(
  baseSpeed: number,
  conditions: readonly ConditionState[],
): number {
  if (conditions.some((c) => CONDITION_MECHANICS[c.condition].speedZero)) {
    return 0;
  }
  const ex = exhaustionLevel(conditions);
  if (ex >= 5) return 0;
  if (ex >= 2) return Math.floor(baseSpeed / 2);
  return baseSpeed;
}

/** Roll mode for the creature's own attack rolls, from its conditions. */
export function ownAttackMode(
  conditions: readonly ConditionState[],
): RollAdjust {
  const modes: RollAdjust[] = [];
  for (const c of conditions) {
    const m = CONDITION_MECHANICS[c.condition];
    if (m.ownAttacksDisadvantage) modes.push("disadvantage");
    if (m.ownAttacksAdvantage) modes.push("advantage");
  }
  if (exhaustionLevel(conditions) >= 3) modes.push("disadvantage");
  return combineMode(...modes);
}

/** Roll mode for attacks made *against* the creature, from its conditions. */
export function attackedMode(
  conditions: readonly ConditionState[],
): RollAdjust {
  const modes: RollAdjust[] = [];
  for (const c of conditions) {
    const m = CONDITION_MECHANICS[c.condition];
    if (m.attacksAgainstAdvantage) modes.push("advantage");
    if (m.attacksAgainstDisadvantage) modes.push("disadvantage");
  }
  return combineMode(...modes);
}

export function isProne(conditions: readonly ConditionState[]): boolean {
  return conditions.some((c) => CONDITION_MECHANICS[c.condition].prone);
}

/** True if a hit by an adjacent melee attacker should be upgraded to a crit. */
export function critsWhenAdjacent(
  conditions: readonly ConditionState[],
): boolean {
  return conditions.some(
    (c) => CONDITION_MECHANICS[c.condition].meleeCritWhenAdjacent,
  );
}

/** The set of source entities this creature is charmed by (cannot attack). */
export function charmedSources(
  conditions: readonly ConditionState[],
): Set<string> {
  const sources = new Set<string>();
  for (const c of conditions) {
    if (CONDITION_MECHANICS[c.condition].cannotAttackSource && c.source) {
      sources.add(c.source);
    }
  }
  return sources;
}

/** Saving-throw resolution for an ability given the creature's conditions. */
export function saveResolution(
  ability: Ability,
  conditions: readonly ConditionState[],
): { autoFail: boolean; mode: RollAdjust } {
  const autoFail =
    (ability === "str" || ability === "dex") &&
    conditions.some((c) => CONDITION_MECHANICS[c.condition].autoFailStrDex);

  const modes: RollAdjust[] = [];
  for (const c of conditions) {
    const m = CONDITION_MECHANICS[c.condition];
    if (m.saveDisadvantage?.includes(ability)) modes.push("disadvantage");
  }
  if (exhaustionLevel(conditions) >= 3) modes.push("disadvantage");
  return { autoFail, mode: combineMode(...modes) };
}
