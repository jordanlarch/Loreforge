import type { Ability, AbilityScores } from "../entities/types";

export type FeatEligibilityContext = {
  characterLevel: number;
  abilityScores: AbilityScores;
};

const ABILITY_NAMES: Record<string, Ability> = {
  strength: "str",
  str: "str",
  dexterity: "dex",
  dex: "dex",
  constitution: "con",
  con: "con",
  intelligence: "int",
  int: "int",
  wisdom: "wis",
  wis: "wis",
  charisma: "cha",
  cha: "cha",
};

const ORDINAL_LEVELS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
};

function minLevelFromPrerequisite(text: string): number | null {
  const levelMatch = text.match(/\blevel\s+(\d+)\b/i);
  if (levelMatch) return Number(levelMatch[1]);

  const ordinalMatch = text.match(
    /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth)\s+level\b/i,
  );
  if (ordinalMatch?.[1]) {
    return ORDINAL_LEVELS[ordinalMatch[1].toLowerCase()] ?? null;
  }

  return null;
}

function abilityRequirementsMet(
  text: string,
  scores: AbilityScores,
): boolean {
  const pattern =
    /\b(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\s+(\d+)\s*(?:\+|or higher)\b/gi;
  let match: RegExpExecArray | null;
  let found = false;
  while ((match = pattern.exec(text)) !== null) {
    found = true;
    const rawAbility = match[1];
    if (!rawAbility) continue;
    const ability = ABILITY_NAMES[rawAbility.toLowerCase()];
    const min = Number(match[2]);
    if (!ability || scores[ability] < min) return false;
  }
  return !found || true;
}

/** Whether a character meets an SRD feat's prerequisite string (best-effort parse). */
export function featMeetsPrerequisite(
  prerequisite: string | null | undefined,
  ctx: FeatEligibilityContext,
): boolean {
  const text = prerequisite?.trim();
  if (!text) return true;

  const minLevel = minLevelFromPrerequisite(text);
  if (minLevel != null && ctx.characterLevel < minLevel) return false;

  if (!abilityRequirementsMet(text, ctx.abilityScores)) return false;

  return true;
}

/** Human-readable reason when a feat is ineligible, or null if eligible. */
export function featIneligibilityReason(
  prerequisite: string | null | undefined,
  ctx: FeatEligibilityContext,
): string | null {
  if (featMeetsPrerequisite(prerequisite, ctx)) return null;
  if (prerequisite?.trim()) return prerequisite.trim();
  return "Prerequisites not met.";
}
