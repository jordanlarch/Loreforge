/**
 * Concise SRD trait rules for Codex species detail (shared across lineages).
 * Paraphrased from the 5E SRD; full text lives in the official reference.
 */
export const TRAIT_DESCRIPTIONS: Record<string, string> = {
  Darkvision:
    "Accustomed to life underground or in twilight, you can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light. You can't discern color in darkness, only shades of gray.",
  "Dwarven Resilience":
    "You have advantage on saving throws against poison, and you have resistance against poison damage.",
  Stonecunning:
    "Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient and add double your proficiency bonus instead of your normal bonus.",
  "Dwarven Toughness":
    "Your hit point maximum increases by 1, and it increases by 1 every time you gain a level.",
  "Dwarven Armor Training":
    "You have proficiency with light and medium armor.",
  "Keen Senses":
    "You have proficiency in the Perception skill.",
  "Fey Ancestry":
    "You have advantage on saving throws against being charmed, and magic can't put you to sleep.",
  Trance:
    "Elves don't need to sleep. Instead they meditate deeply, remaining semiconscious, for 4 hours a day. After resting this way, you gain the same benefit a human does from 8 hours of sleep.",
  Cantrip:
    "You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it.",
  "Mask of the Wild":
    "You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena.",
  Lucky:
    "When you roll a 1 on an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.",
  Brave:
    "You have advantage on saving throws against being frightened.",
  "Halfling Nimbleness":
    "You can move through the space of any creature that is of a size larger than yours.",
  "Naturally Stealthy":
    "You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you.",
  "Stout Resilience":
    "You have advantage on saving throws against poison, and you have resistance against poison damage.",
  Versatile:
    "Humans gain +1 to every ability score, reflecting their adaptability and drive.",
  "Draconic Ancestry":
    "Choose one type of dragon. Your breath weapon and damage resistance are determined by the dragon type.",
  "Breath Weapon":
    "You can use your action to exhale destructive energy. Each creature in the area must make a saving throw (DC 8 + Con mod + proficiency), taking 2d6 damage on a failed save or half on a success. Damage type matches your draconic ancestry.",
  "Damage Resistance":
    "You have resistance to the damage type associated with your draconic ancestry.",
  "Gnome Cunning":
    "You have advantage on Intelligence, Wisdom, and Charisma saving throws against magic.",
  "Artificer's Lore":
    "Whenever you make an Intelligence (History) check related to magic items, alchemical objects, or technological devices, you add double your proficiency bonus instead of your normal bonus.",
  Tinker:
    "You have proficiency with artisan's tools (tinker's tools). Using those tools, you can spend 1 hour and 10 gp of materials to construct a Tiny clockwork device (AC 5, 1 hp). You can have up to three devices active at once.",
  "Natural Illusionist":
    "You know the minor illusion cantrip. Intelligence is your spellcasting ability for it.",
  "Speak with Small Beasts":
    "Through sounds and gestures, you can communicate simple ideas with Small or smaller beasts.",
  Menacing:
    "You have proficiency in the Intimidation skill.",
  "Relentless Endurance":
    "When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. You can't use this feature again until you finish a long rest.",
  "Savage Attacks":
    "When you score a critical hit with a melee weapon attack, you can roll one of the weapon's damage dice one additional time and add it to the extra damage.",
  "Hellish Resistance":
    "You have resistance to fire damage.",
  "Infernal Legacy":
    "You know the thaumaturgy cantrip. At 3rd level you can cast hellish rebuke once per long rest; at 5th level you can cast darkness once per long rest. Charisma is your spellcasting ability for these spells.",
};

export function traitDescription(name: string): string | undefined {
  return TRAIT_DESCRIPTIONS[name];
}
