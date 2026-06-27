/**
 * Curated subclass and fighting-style options for character creation / level-up.
 * Full Open5e subclass ingest is deferred; these match SRD display names.
 */

/** Level at which a class picks its subclass (SRD). */
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

/** Classes that choose a fighting style (SRD 5.2 / 2024). */
export function fightingStylePickLevel(className: string): number | null {
  if (className === "Paladin" || className === "Ranger") return 2;
  if (className === "Fighter") return 1;
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

/** SRD fighting style rules text for sheet tooltips. */
export const FIGHTING_STYLE_DESCRIPTIONS: Record<FightingStyle, string> = {
  Archery:
    "You gain a +2 bonus to attack rolls you make with ranged weapons.",
  Defense: "While you are wearing armor, you gain a +1 bonus to AC.",
  Dueling:
    "When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.",
  "Great Weapon Fighting":
    "When you roll a 1 or 2 on a damage die for an attack with a melee weapon you are wielding with two hands, you can reroll the die and must use the new roll, even if the new roll is a 1 or a 2.",
  Protection:
    "When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield.",
  "Two-Weapon Fighting":
    "When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.",
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

/** Legacy PHB names → SRD 5.2 display names (for existing characters). */
export const SUBCLASS_NAME_ALIASES: Record<string, string> = {
  "Way of the Open Hand": "Warrior of the Open Hand",
  "Draconic Bloodline": "Draconic Sorcery",
  "The Fiend": "Fiend Patron",
  "The Archfey": "Fiend Patron",
  "The Great Old One": "Fiend Patron",
  "School of Evocation": "Evoker",
  "School of Abjuration": "Evoker",
  "School of Conjuration": "Evoker",
  "School of Divination": "Evoker",
  "School of Enchantment": "Evoker",
  "School of Illusion": "Evoker",
  "School of Necromancy": "Evoker",
  "School of Transmutation": "Evoker",
  "Battle Master": "Champion",
  "Eldritch Knight": "Champion",
  "Beast Master": "Hunter",
  Assassin: "Thief",
  "Arcane Trickster": "Thief",
  "College of Valor": "College of Lore",
  "Path of the Totem Warrior": "Path of the Berserker",
  "Circle of the Moon": "Circle of the Land",
  "Way of Shadow": "Warrior of the Open Hand",
  "Way of the Four Elements": "Warrior of the Open Hand",
  "Oath of the Ancients": "Oath of Devotion",
  "Oath of Vengeance": "Oath of Devotion",
  "Wild Magic": "Draconic Sorcery",
  "Light Domain": "Life Domain",
  "Nature Domain": "Life Domain",
  "Tempest Domain": "Life Domain",
  "Trickery Domain": "Life Domain",
  "War Domain": "Life Domain",
};

export function normalizeSubclassName(name: string): string {
  return SUBCLASS_NAME_ALIASES[name] ?? name;
}

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
