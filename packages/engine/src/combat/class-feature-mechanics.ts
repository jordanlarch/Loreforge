/**
 * SRD class-feature combat math (SRD-FID-21).
 */
import { abilityModifier } from "../entities/abilities";
import { parseFeatureChoiceValues } from "../entities/class-feature-choices";
import { distanceFeet } from "./grid";
import type { RollAdjust } from "./conditions";
import type { AbilityScores, ClassLevel, EntityState } from "../entities/types";

export function classLevel(
  classes: readonly ClassLevel[] | undefined,
  className: string,
): number {
  if (!classes?.length) return 0;
  const needle = className.trim().toLowerCase();
  return classes
    .filter((c) => c.class.trim().toLowerCase() === needle)
    .reduce((sum, c) => sum + c.level, 0);
}

/** Sneak Attack dice count by rogue level (SRD 5.2.1). */
export function sneakAttackDiceCount(rogueLevel: number): number {
  if (rogueLevel < 1) return 0;
  return Math.ceil(rogueLevel / 2);
}

export function sneakAttackNotation(rogueLevel: number): string {
  const dice = sneakAttackDiceCount(rogueLevel);
  return dice > 0 ? `${dice}d6` : "0";
}

/** Rage damage bonus on Strength-based weapon attacks. */
export function rageDamageBonus(barbarianLevel: number): number {
  if (barbarianLevel < 1) return 0;
  if (barbarianLevel >= 16) return 4;
  if (barbarianLevel >= 9) return 3;
  return 2;
}

/** Bardic Inspiration die notation by bard level. */
export function bardicInspirationDie(bardLevel: number): string {
  if (bardLevel >= 15) return "1d12";
  if (bardLevel >= 10) return "1d10";
  if (bardLevel >= 5) return "1d8";
  return "1d6";
}

type SneakWorld = {
  entities: Record<string, EntityState | undefined>;
};

/** True when Sneak Attack extra damage applies (once per turn; caller checks hit + budget). */
export function sneakAttackEligible(
  attacker: EntityState,
  target: EntityState,
  world: SneakWorld,
  attackMode: RollAdjust,
  opts: { finesseOrRanged?: boolean },
): boolean {
  const rogueLevel = classLevel(attacker.classes, "Rogue");
  if (rogueLevel < 1 || !opts.finesseOrRanged) return false;
  if (attackMode === "advantage") return true;
  if (!target.position || !target.sceneId) return false;
  for (const [id, entity] of Object.entries(world.entities)) {
    if (!entity?.position || entity.sceneId !== target.sceneId) continue;
    if (id === attacker.id || id === target.id) continue;
    if (distanceFeet(entity.position, target.position) <= 5) return true;
  }
  return false;
}

export function allyWithinFiveFeet(
  target: Pick<EntityState, "position" | "sceneId">,
  ally: Pick<EntityState, "position" | "sceneId">,
): boolean {
  if (
    !target.position ||
    !ally.position ||
    target.sceneId !== ally.sceneId
  ) {
    return false;
  }
  return distanceFeet(target.position, ally.position) <= 5;
}

/** Focus Point pool maximum by Monk level (SRD 5.2.1). */
export function focusPointMaximum(monkLevel: number): number {
  if (monkLevel < 2) return 0;
  if (monkLevel === 2) return 2;
  return monkLevel;
}

/** Sorcery Point pool maximum by Sorcerer level. */
export function sorceryPointMaximum(sorcererLevel: number): number {
  return sorcererLevel >= 2 ? sorcererLevel : 0;
}

/** Lay on Hands pool maximum — 5 HP per Paladin level (SRD 5.2.1). */
export function layOnHandsMaximum(paladinLevel: number): number {
  return paladinLevel >= 1 ? paladinLevel * 5 : 0;
}

/** Channel Divinity save DC: 8 + proficiency + Charisma modifier. */
export function channelDivinitySaveDc(
  paladin: Pick<EntityState, "proficiencyBonus" | "abilityScores">,
): number {
  return (
    8 +
    paladin.proficiencyBonus +
    abilityModifier(paladin.abilityScores.cha)
  );
}

/** Divine Smite radiant dice notation for a spell slot level. */
export function divineSmiteNotation(
  slotLevel: number,
  fiendOrUndead: boolean,
): string {
  const dice = 2 + Math.max(0, slotLevel - 1) + (fiendOrUndead ? 1 : 0);
  return dice > 0 ? `${dice}d8` : "0";
}

export function isFiendOrUndead(
  creatureTypes: readonly string[] | undefined,
): boolean {
  if (!creatureTypes?.length) return false;
  const normalized = creatureTypes.map((t) => t.trim().toLowerCase());
  return normalized.includes("fiend") || normalized.includes("undead");
}

/** Martial Arts die by Monk level. */
export function martialArtsDie(monkLevel: number): string {
  if (monkLevel >= 17) return "1d10";
  if (monkLevel >= 11) return "1d8";
  if (monkLevel >= 5) return "1d6";
  return "1d4";
}

/** Stunning Strike save DC: 8 + proficiency + Wisdom modifier. */
export function stunningStrikeSaveDc(
  monk: Pick<EntityState, "proficiencyBonus" | "abilityScores">,
): number {
  return (
    8 +
    monk.proficiencyBonus +
    abilityModifier(monk.abilityScores.wis)
  );
}

export type MetamagicOptionId = "empowered" | "heightened";

export type MetamagicOption = {
  id: MetamagicOptionId;
  name: string;
  cost: number;
};

export const METAMAGIC_OPTIONS: Record<MetamagicOptionId, MetamagicOption> = {
  empowered: { id: "empowered", name: "Empowered Spell", cost: 1 },
  heightened: { id: "heightened", name: "Heightened Spell", cost: 2 },
};

export type EldritchInvocationId = "agonizing-blast" | "devils-sight";

export type EldritchInvocation = {
  id: EldritchInvocationId;
  name: string;
};

export const ELDRITCH_INVOCATIONS: Record<
  EldritchInvocationId,
  EldritchInvocation
> = {
  "agonizing-blast": { id: "agonizing-blast", name: "Agonizing Blast" },
  "devils-sight": { id: "devils-sight", name: "Devil's Sight" },
};

const METAMAGIC_CHOICE_KEY = "Sorcerer:2:metamagic";
const INVOCATION_CHOICE_KEY = "Warlock:1:eldritch-invocations";

function normalizeMetamagicId(raw: string): MetamagicOptionId | undefined {
  const slug = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (slug in METAMAGIC_OPTIONS) return slug as MetamagicOptionId;
  if (slug.startsWith("empowered")) return "empowered";
  if (slug.startsWith("heightened")) return "heightened";
  return undefined;
}

export function selectedMetamagicOptions(
  featureChoices: Record<string, string> | undefined,
): MetamagicOptionId[] {
  const raw = parseFeatureChoiceValues(featureChoices?.[METAMAGIC_CHOICE_KEY]);
  return raw
    .map(normalizeMetamagicId)
    .filter((v): v is MetamagicOptionId => v !== undefined);
}

export function hasEldritchInvocation(
  featureChoices: Record<string, string> | undefined,
  invocation: EldritchInvocationId,
): boolean {
  const raw = parseFeatureChoiceValues(
    featureChoices?.[INVOCATION_CHOICE_KEY],
  );
  const name = ELDRITCH_INVOCATIONS[invocation].name;
  return raw.some(
    (v) =>
      v === invocation ||
      v.toLowerCase() === name.toLowerCase() ||
      v.toLowerCase().replace(/[^a-z0-9]+/g, "-") === invocation,
  );
}

/** Agonizing Blast — add Charisma modifier to Eldritch Blast damage. */
export function agonizingBlastBonus(scores: AbilityScores): number {
  return Math.max(0, abilityModifier(scores.cha));
}

/** Empowered Spell — reroll up to this many damage dice (Charisma modifier, min 1). */
export function empoweredRerollCount(scores: AbilityScores): number {
  return Math.max(1, abilityModifier(scores.cha));
}
