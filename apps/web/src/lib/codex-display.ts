import { ABILITIES, type Ability, type AbilityScores } from "@app/engine";

export const ABILITY_LABELS: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function abilityBonusLine(bonuses: Partial<AbilityScores>): string {
  const parts = ABILITIES.filter((a) => bonuses[a]).map(
    (a) => `${signed(bonuses[a]!)} ${ABILITY_LABELS[a]}`,
  );
  return parts.length > 0 ? parts.join(", ") : "—";
}
