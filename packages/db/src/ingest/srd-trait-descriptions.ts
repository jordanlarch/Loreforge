/**
 * Concise SRD 5.2 trait rules for Codex species detail (shared across lineages).
 * Paraphrased from the official SRD 5.2.1 PDF; full text lives in the reference doc.
 */
export const TRAIT_DESCRIPTIONS: Record<string, string> = {
  Darkvision:
    "You can see in dim light within your darkvision range as if it were bright light, and in darkness as if it were dim light. You can't discern color in darkness, only shades of gray. Range varies by species (often 60 feet; dwarves and orcs have 120 feet).",
  "Dwarven Resilience":
    "You have Resistance to Poison damage and Advantage on saving throws to avoid or end the Poisoned condition.",
  Stonecunning:
    "As a Bonus Action, you gain Tremorsense with a range of 60 feet for 10 minutes while on or touching stone (natural or worked). Uses equal to your Proficiency Bonus per Long Rest.",
  "Dwarven Toughness":
    "Your Hit Point maximum increases by 1, and increases by 1 again whenever you gain a level.",
  "Keen Senses":
    "You have proficiency in the Insight, Perception, or Survival skill (your choice).",
  "Fey Ancestry":
    "You have Advantage on saving throws to avoid or end the Charmed condition.",
  Trance:
    "You don't need to sleep and magic can't put you to sleep. You can finish a Long Rest in 4 hours of trance-like meditation while remaining conscious.",
  "Elven Lineage":
    "Choose Drow, High Elf, or Wood Elf. You gain that lineage's level 1 benefit and learn additional spells at character levels 3 and 5 (always prepared; cast once per Long Rest without a slot, or with slots).",
  "Gnomish Cunning":
    "You have Advantage on Intelligence, Wisdom, and Charisma saving throws.",
  "Gnomish Lineage":
    "Choose Forest Gnome or Rock Gnome for cantrips, spells, and (for Rock Gnome) clockwork devices built with Prestidigitation.",
  Versatile:
    "You gain an Origin feat of your choice (Skilled is recommended).",
  Resourceful:
    "You gain Heroic Inspiration whenever you finish a Long Rest.",
  Skillful:
    "You gain proficiency in one skill of your choice.",
  "Draconic Ancestry":
    "Choose a dragon type from the SRD table. Your Breath Weapon damage type and Damage Resistance match that ancestry.",
  "Breath Weapon":
    "When you take the Attack action, you can replace one attack with a 15-foot Cone or 30-foot Line (5 ft wide). Creatures in the area make a Dexterity save (DC 8 + Con mod + PB); damage is 1d10 of your ancestry type (scales at levels 5, 11, 17). Uses equal to PB per Long Rest.",
  "Damage Resistance":
    "You have Resistance to the damage type determined by your Draconic Ancestry.",
  "Draconic Flight":
    "At character level 5+, as a Bonus Action you sprout spectral wings for 10 minutes, gaining Fly Speed equal to your Speed. Once per Long Rest.",
  "Giant Ancestry":
    "Choose a giant boon (Cloud's Jaunt, Fire's Burn, Frost's Chill, Hill's Tumble, Stone's Endurance, or Storm's Thunder). Uses equal to PB per Long Rest.",
  "Large Form":
    "Starting at character level 5, as a Bonus Action you become Large for 10 minutes (if space allows), gaining Advantage on Strength checks and +10 ft Speed. Once per Long Rest.",
  "Powerful Build":
    "You have Advantage on ability checks to end the Grappled condition and count as one size larger for carrying capacity.",
  Brave:
    "You have Advantage on saving throws to avoid or end the Frightened condition.",
  "Halfling Nimbleness":
    "You can move through the space of any creature that is a size larger than you, but you can't stop in the same space.",
  Luck:
    "When you roll a 1 on the d20 of a D20 Test, you can reroll the die and must use the new roll.",
  "Naturally Stealthy":
    "You can take the Hide action even when obscured only by a creature at least one size larger than you.",
  "Adrenaline Rush":
    "You can take the Dash action as a Bonus Action and gain Temporary Hit Points equal to your Proficiency Bonus. Uses equal to PB per Short or Long Rest.",
  "Relentless Endurance":
    "When reduced to 0 Hit Points without being killed outright, you can drop to 1 Hit Point instead. Once per Long Rest.",
  "Fiendish Legacy":
    "Choose Abyssal, Chthonic, or Infernal legacy for damage resistance and lineage spells at levels 1, 3, and 5 (always prepared; cast once per Long Rest without a slot, or with slots).",
  "Otherworldly Presence":
    "You know the Thaumaturgy cantrip. When you cast it with this trait, the spell uses the same spellcasting ability you use for Fiendish Legacy.",
};

export function traitDescription(name: string): string | undefined {
  return TRAIT_DESCRIPTIONS[name];
}
