/**
 * Curated subclass and fighting-style options for character creation / level-up.
 * Full Open5e subclass ingest is deferred; these match SRD display names.
 */

/** Level at which a class picks its subclass (SRD). */
export function subclassPickLevel(className: string): number | null {
  const map: Record<string, number> = {
    Barbarian: 3,
    Bard: 3,
    Cleric: 3,
    Druid: 3,
    Fighter: 3,
    Monk: 3,
    Paladin: 3,
    Ranger: 3,
    Rogue: 3,
    Sorcerer: 3,
    Warlock: 3,
    Wizard: 3,
  };
  return map[className] ?? null;
}

/** Classes that choose a fighting style (SRD 5.2 / 2024). */
export function fightingStylePickLevel(className: string): number | null {
  if (className === "Paladin" || className === "Ranger") return 2;
  if (className === "Fighter") return 1;
  return null;
}

/** SRD 5.2.1 fighting style feats (also ingested in Codex as featType "Fighting Style"). */
export const FIGHTING_STYLES = [
  "Archery",
  "Defense",
  "Great Weapon Fighting",
  "Two-Weapon Fighting",
] as const;

export type FightingStyle = (typeof FIGHTING_STYLES)[number];

/** SRD 5.2.1 fighting style rules — fallback when Codex description is unavailable. */
export const FIGHTING_STYLE_DESCRIPTIONS: Record<FightingStyle, string> = {
  Archery:
    "You gain a +2 bonus to attack rolls you make with Ranged weapons.",
  Defense:
    "While you're wearing Light, Medium, or Heavy armor, you gain a +1 bonus to Armor Class.",
  "Great Weapon Fighting":
    "When you roll damage for a Two-Handed or Versatile melee weapon held in two hands, you can treat any 1 or 2 on a damage die as a 3.",
  "Two-Weapon Fighting":
    "When you make an extra attack from a Light weapon, you can add your ability modifier to that attack's damage if you aren't already adding it.",
};

export function fightingStyleDescription(style: string): string | undefined {
  return FIGHTING_STYLE_DESCRIPTIONS[style as FightingStyle];
}

/** SRD 5.2 (2024) — one official subclass per class in the System Reference Document. */
export const SUBCLASS_OPTIONS: Record<string, readonly string[]> = {
  Barbarian: ["Path of the Berserker"],
  Bard: ["College of Lore"],
  Cleric: ["Life Domain"],
  Druid: ["Circle of the Land"],
  Fighter: ["Champion"],
  Monk: ["Warrior of the Open Hand"],
  Paladin: ["Oath of Devotion"],
  Ranger: ["Hunter"],
  Rogue: ["Thief"],
  Sorcerer: ["Draconic Sorcery"],
  Warlock: ["Fiend Patron"],
  Wizard: ["Evoker"],
};

export function subclassOptionsFor(className: string): readonly string[] {
  return SUBCLASS_OPTIONS[className] ?? [];
}

/** Whether `level` is when the class must pick (or could have picked) a subclass. */
export function needsSubclassPick(className: string, level: number): boolean {
  const pick = subclassPickLevel(className);
  return pick != null && level >= pick;
}

export function needsFightingStylePick(
  className: string,
  level: number,
): boolean {
  const pick = fightingStylePickLevel(className);
  return pick != null && level >= pick;
}

/** Fighting style on creation Features step (L1 Fighter); L2+ picks use Advancement. */
export function fightingStyleOnFeaturesStep(
  className: string,
  startingLevel: number,
): boolean {
  const pick = fightingStylePickLevel(className);
  if (pick == null || startingLevel < pick) return false;
  if (pick === 1) return true;
  return startingLevel <= 1;
}
