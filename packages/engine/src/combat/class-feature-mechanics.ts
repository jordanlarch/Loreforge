/**
 * SRD class-feature combat math (SRD-FID-21).
 */
import type { SaveOutcome } from "../content/spells";
import { abilityModifier } from "../entities/abilities";
import { parseFeatureChoiceValues } from "../entities/class-feature-choices";
import {
  featureResourceKey,
  remainingFeatureUses,
} from "../entities/feature-resources";
import { distanceFeet } from "./grid";
import { entityReactionsSuppressed } from "./effects";
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

/** True when an entity holds the given subclass for a class (SRD-FID-21b). */
export function hasClassSubclass(
  classes: readonly ClassLevel[] | undefined,
  className: string,
  subclass: string,
): boolean {
  if (!classes?.length) return false;
  const cn = className.trim().toLowerCase();
  const sc = subclass.trim().toLowerCase();
  return classes.some(
    (c) =>
      c.class.trim().toLowerCase() === cn &&
      (c.subclass?.trim().toLowerCase() ?? "") === sc,
  );
}

/**
 * Life Domain — Disciple of Life: when a spell of level 1+ restores Hit Points
 * to a creature, it regains an extra 2 + the spell slot's level HP (SRD 5.2.1).
 * Cantrips (slot level 0) do not qualify.
 */
export function discipleOfLifeBonus(slotLevel: number): number {
  return slotLevel >= 1 ? 2 + slotLevel : 0;
}

/** Hunter — Colossus Slayer extra damage dice (SRD 5.2.1). */
export const COLOSSUS_SLAYER_DICE = "1d8";

/** True when Colossus Slayer +1d8 applies (injured target; once per turn). */
export function colossusSlayerEligible(
  attacker: EntityState,
  target: EntityState,
  colossusSlayerUsed: boolean | undefined,
): boolean {
  if (colossusSlayerUsed) return false;
  if (classLevel(attacker.classes, "Ranger") < 3) return false;
  if (!hasClassSubclass(attacker.classes, "Ranger", "Hunter")) return false;
  return target.hp.current < target.hp.max;
}

/**
 * Evoker — Potent Cantrip: successful saves against Wizard cantrips still deal
 * half damage when the spell would otherwise deal none on a success.
 */
export function potentCantripSaveOutcome(
  spell: { level: number; damage?: readonly unknown[] },
  caster: Pick<EntityState, "classes">,
  baseOutcome: SaveOutcome,
): SaveOutcome {
  if (
    spell.level === 0 &&
    spell.damage?.length &&
    baseOutcome === "no_effect" &&
    hasClassSubclass(caster.classes, "Wizard", "Evoker") &&
    classLevel(caster.classes, "Wizard") >= 3
  ) {
    return "half_damage";
  }
  return baseOutcome;
}

/**
 * Fiend Patron — Dark One's Blessing temp HP on reducing a hostile creature to 0 HP.
 */
export function darkOnesBlessingTempHp(
  classes: readonly ClassLevel[] | undefined,
  scores: AbilityScores,
): number {
  if (!hasClassSubclass(classes, "Warlock", "Fiend Patron")) return 0;
  const warlockLevel = classLevel(classes, "Warlock");
  if (warlockLevel < 3) return 0;
  return Math.max(0, abilityModifier(scores.cha) + warlockLevel);
}

/** Draconic Sorcery — Draconic Resilience max HP bonus (+3 at level 1, +1/level). */
export function draconicResilienceHpBonus(sorcererLevel: number): number {
  return sorcererLevel >= 1 ? 2 + sorcererLevel : 0;
}

/** Draconic Resilience unarmored AC: 10 + DEX + CHA. */
export function draconicResilienceAc(scores: AbilityScores): number {
  return (
    10 +
    abilityModifier(scores.dex) +
    abilityModifier(scores.cha)
  );
}

/** Open Hand Technique push distance (feet). */
export const OPEN_HAND_PUSH_FEET = 15;

export type OpenHandTechnique = "prone" | "push" | "no_reactions";

/** Champion — Improved Critical / Superior Critical natural-d20 crit range. */
export function championCritThreshold(
  classes: readonly ClassLevel[] | undefined,
): number | undefined {
  if (!hasClassSubclass(classes, "Fighter", "Champion")) return undefined;
  const fighterLevel = classLevel(classes, "Fighter");
  if (fighterLevel < 3) return undefined;
  return fighterLevel >= 15 ? 18 : 19;
}

/** Circle of the Land — Natural Recovery slot budget on a Short Rest. */
export function naturalRecoveryMaximum(druidLevel: number): number {
  return druidLevel >= 2 ? Math.ceil(druidLevel / 2) : 0;
}

export const NATURAL_RECOVERY_RESOURCE_KEY = featureResourceKey(
  "Druid",
  3,
  "natural-recovery",
);

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

export type MetamagicOptionId =
  | "empowered"
  | "heightened"
  | "quickened"
  | "distant"
  | "seeking"
  | "subtle"
  | "extended";

export type MetamagicOption = {
  id: MetamagicOptionId;
  name: string;
  cost: number;
};

export const METAMAGIC_OPTIONS: Record<MetamagicOptionId, MetamagicOption> = {
  empowered: { id: "empowered", name: "Empowered Spell", cost: 1 },
  heightened: { id: "heightened", name: "Heightened Spell", cost: 2 },
  quickened: { id: "quickened", name: "Quickened Spell", cost: 2 },
  distant: { id: "distant", name: "Distant Spell", cost: 1 },
  seeking: { id: "seeking", name: "Seeking Spell", cost: 2 },
  subtle: { id: "subtle", name: "Subtle Spell", cost: 1 },
  extended: { id: "extended", name: "Extended Spell", cost: 1 },
};

export type EldritchInvocationId =
  | "agonizing-blast"
  | "devils-sight"
  | "repelling-blast"
  | "eldritch-spear"
  | "eldritch-mind";

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
  "repelling-blast": { id: "repelling-blast", name: "Repelling Blast" },
  "eldritch-spear": { id: "eldritch-spear", name: "Eldritch Spear" },
  "eldritch-mind": { id: "eldritch-mind", name: "Eldritch Mind" },
};

/** Eldritch Spear extends Eldritch Blast's range to 300 ft (SRD 5.2.1). */
export const ELDRITCH_SPEAR_RANGE_FEET = 300;

/** Repelling Blast pushes a creature 10 ft straight away on a hit. */
export const REPELLING_BLAST_PUSH_FEET = 10;

/**
 * Distant Spell: a touch spell reaches 30 ft; any other ranged spell's range
 * doubles (SRD 5.2.1).
 */
export function distantSpellRange(baseFeet: number, isTouch: boolean): number {
  return isTouch ? 30 : baseFeet * 2;
}

const METAMAGIC_CHOICE_KEY = "Sorcerer:2:metamagic";
const INVOCATION_CHOICE_KEY = "Warlock:1:eldritch-invocations";

function normalizeMetamagicId(raw: string): MetamagicOptionId | undefined {
  const slug = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (slug in METAMAGIC_OPTIONS) return slug as MetamagicOptionId;
  for (const id of Object.keys(METAMAGIC_OPTIONS) as MetamagicOptionId[]) {
    if (slug.startsWith(id)) return id;
  }
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

type CuttingWordsWorld = {
  entities: Record<string, EntityState | undefined>;
};

/** Bards who may react with Cutting Words to an attack roll (SRD 5.2.1). */
export function cuttingWordsEligibleReactors(
  world: CuttingWordsWorld,
  attackerId: string,
): string[] {
  const attacker = world.entities[attackerId];
  if (!attacker?.alive) return [];
  const biKey = featureResourceKey("Bard", 1, "bardic-inspiration");
  const eligible: string[] = [];
  for (const [id, entity] of Object.entries(world.entities)) {
    if (!entity?.alive) continue;
    if (!hasClassSubclass(entity.classes, "Bard", "College of Lore")) continue;
    if (classLevel(entity.classes, "Bard") < 3) continue;
    if (entity.reaction !== undefined && entity.reaction !== "available") continue;
    if (entityReactionsSuppressed(entity)) continue;
    const poolSize = Math.max(0, entity.proficiencyBonus);
    if (
      remainingFeatureUses(entity.resourceUses?.[biKey], poolSize) < 1
    ) {
      continue;
    }
    if (
      entity.position &&
      attacker.position &&
      entity.sceneId &&
      entity.sceneId === attacker.sceneId &&
      distanceFeet(entity.position, attacker.position) > 60
    ) {
      continue;
    }
    eligible.push(id);
  }
  return eligible;
}

/** Spellcasters who may react with Counterspell to a visible cast (SRD). */
export function counterspellEligibleReactors(
  world: CuttingWordsWorld,
  castingCasterId: string,
): string[] {
  const caster = world.entities[castingCasterId];
  if (!caster?.alive) return [];
  const eligible: string[] = [];
  for (const [id, entity] of Object.entries(world.entities)) {
    if (!entity?.alive || id === castingCasterId) continue;
    if (entity.reaction !== undefined && entity.reaction !== "available") {
      continue;
    }
    if (entityReactionsSuppressed(entity)) continue;
    if (!entity.spellcasting) continue;
    const prepared = entity.spellcasting.preparedSpellIds;
    if (!prepared?.includes("counterspell")) continue;
    const slots = entity.spellcasting.slots ?? {};
    const hasSlot = Object.entries(slots).some(
      ([level, slot]) => Number(level) >= 3 && slot.current > 0,
    );
    if (!hasSlot) continue;
    if (
      entity.position &&
      caster.position &&
      entity.sceneId &&
      entity.sceneId === caster.sceneId &&
      distanceFeet(entity.position, caster.position) > 60
    ) {
      continue;
    }
    eligible.push(id);
  }
  return eligible;
}
