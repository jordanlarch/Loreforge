/**
 * Curated subclass and fighting-style options for character creation / level-up.
 * Full Open5e subclass ingest is deferred; these match SRD display names.
 */

/** Level at which a class picks its subclass (PHB). */
export function subclassPickLevel(className: string): number | null {
  const map: Record<string, number> = {
    Barbarian: 3,
    Bard: 3,
    Cleric: 1,
    Druid: 2,
    Fighter: 3,
    Monk: 3,
    Paladin: 3,
    Ranger: 3,
    Rogue: 3,
    Sorcerer: 1,
    Warlock: 1,
    Wizard: 2,
  };
  return map[className] ?? null;
}

/** Classes that choose a fighting style at 1st level (or 2nd for Paladin). */
export function fightingStylePickLevel(className: string): number | null {
  if (className === "Paladin") return 2;
  if (className === "Fighter" || className === "Ranger") return 1;
  return null;
}

export const FIGHTING_STYLES = [
  "Archery",
  "Defense",
  "Dueling",
  "Great Weapon Fighting",
  "Protection",
  "Two-Weapon Fighting",
] as const;

export type FightingStyle = (typeof FIGHTING_STYLES)[number];

/** Subclass options keyed by class display name. */
export const SUBCLASS_OPTIONS: Record<string, readonly string[]> = {
  Barbarian: ["Path of the Berserker", "Path of the Totem Warrior"],
  Bard: ["College of Lore", "College of Valor"],
  Cleric: [
    "Life Domain",
    "Light Domain",
    "Nature Domain",
    "Tempest Domain",
    "Trickery Domain",
    "War Domain",
  ],
  Druid: ["Circle of the Land", "Circle of the Moon"],
  Fighter: ["Champion", "Battle Master", "Eldritch Knight"],
  Monk: ["Way of the Open Hand", "Way of Shadow", "Way of the Four Elements"],
  Paladin: ["Oath of Devotion", "Oath of the Ancients", "Oath of Vengeance"],
  Ranger: ["Hunter", "Beast Master"],
  Rogue: ["Thief", "Assassin", "Arcane Trickster"],
  Sorcerer: ["Draconic Bloodline", "Wild Magic"],
  Warlock: ["The Archfey", "The Fiend", "The Great Old One"],
  Wizard: [
    "School of Abjuration",
    "School of Conjuration",
    "School of Divination",
    "School of Enchantment",
    "School of Evocation",
    "School of Illusion",
    "School of Necromancy",
    "School of Transmutation",
  ],
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
