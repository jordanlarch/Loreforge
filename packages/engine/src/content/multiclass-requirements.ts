import type { Ability, AbilityScores } from "../entities/types";

/** SRD multiclass ability minimums per class. */
export type MulticlassRequirement =
  | { kind: "all"; abilities: Partial<Record<Ability, number>> }
  | { kind: "any"; options: Partial<Record<Ability, number>>[] };

const MULTICLASS_REQUIREMENTS: Record<string, MulticlassRequirement> = {
  Barbarian: { kind: "all", abilities: { str: 13, dex: 13 } },
  Bard: { kind: "all", abilities: { cha: 13 } },
  Cleric: { kind: "all", abilities: { wis: 13 } },
  Druid: { kind: "all", abilities: { wis: 13 } },
  Fighter: { kind: "any", options: [{ str: 13 }, { dex: 13 }] },
  Monk: { kind: "all", abilities: { dex: 13, wis: 13 } },
  Paladin: { kind: "all", abilities: { str: 13, cha: 13 } },
  Ranger: { kind: "all", abilities: { dex: 13, wis: 13 } },
  Rogue: { kind: "all", abilities: { dex: 13 } },
  Sorcerer: { kind: "all", abilities: { cha: 13 } },
  Warlock: { kind: "all", abilities: { cha: 13 } },
  Wizard: { kind: "all", abilities: { int: 13 } },
};

const ABILITY_LABELS: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

function meetsRequirement(
  scores: AbilityScores,
  req: MulticlassRequirement,
): boolean {
  if (req.kind === "all") {
    return Object.entries(req.abilities).every(
      ([ability, min]) => scores[ability as Ability] >= min!,
    );
  }
  return req.options.some((option) =>
    Object.entries(option).every(
      ([ability, min]) => scores[ability as Ability] >= min!,
    ),
  );
}

function requirementLabel(className: string): string {
  const req = MULTICLASS_REQUIREMENTS[className];
  if (!req) return `${className} (no SRD requirement on file)`;
  if (req.kind === "all") {
    const parts = Object.entries(req.abilities).map(
      ([a, min]) => `${ABILITY_LABELS[a as Ability]} ${min}+`,
    );
    return `${className}: ${parts.join(" and ")}`;
  }
  const parts = req.options.map((option) =>
    Object.entries(option)
      .map(([a, min]) => `${ABILITY_LABELS[a as Ability]} ${min}+`)
      .join(" and "),
  );
  return `${className}: ${parts.join(" or ")}`;
}

/** Whether ability scores meet the SRD prerequisite for one class. */
export function meetsMulticlassRequirement(
  className: string,
  scores: AbilityScores,
): boolean {
  const req = MULTICLASS_REQUIREMENTS[className];
  if (!req) return true;
  return meetsRequirement(scores, req);
}

/** Whether a character meets multiclass prerequisites for every class they have (or will have). */
export function multiclassEligible(
  classNames: readonly string[],
  scores: AbilityScores,
): boolean {
  return classNames.every((name) => meetsMulticlassRequirement(name, scores));
}

/** First failing class requirement message, or null if all pass. */
export function multiclassIneligibilityReason(
  classNames: readonly string[],
  scores: AbilityScores,
): string | null {
  for (const name of classNames) {
    if (!meetsMulticlassRequirement(name, scores)) {
      return requirementLabel(name);
    }
  }
  return null;
}

export function multiclassRequirementLabel(className: string): string {
  return requirementLabel(className);
}
