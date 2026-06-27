import type { SubclassFeature } from "../schema/codex";

/** SRD 5.2 (2024) subclass feature rows keyed by subclass display name. */
export const SRD_SUBCLASS_FEATURES: Record<string, SubclassFeature[]> = {
  "Path of the Berserker": [
    {
      level: 3,
      name: "Frenzy",
      description:
        "You can go into a frenzy when you rage. While frenzied, you can make a single melee weapon attack as a Bonus Action on each of your turns. When your rage ends, you suffer one level of Exhaustion.",
    },
    {
      level: 6,
      name: "Mindless Rage",
      description:
        "You can't be charmed or frightened while raging. If you were charmed or frightened when you entered your rage, the effect is suspended for the duration.",
    },
    {
      level: 10,
      name: "Intimidating Presence",
      description:
        "As a Magic action, you can frighten a creature you can see within 30 feet. It makes a Wisdom save (DC 8 + Str + proficiency) or is frightened until the end of your next turn.",
    },
    {
      level: 14,
      name: "Retaliation",
      description:
        "When you take damage from a creature within 5 feet, you can use your Reaction to make a melee weapon attack against that creature.",
    },
  ],
  "College of Lore": [
    {
      level: 3,
      name: "Bonus Proficiencies",
      description:
        "You gain proficiency with three skills of your choice.",
    },
    {
      level: 3,
      name: "Cutting Words",
      description:
        "When a creature you can see within 60 feet makes an attack roll, ability check, or damage roll, you can use your Reaction to expend a Bardic Inspiration die and subtract the roll from the creature's total.",
    },
    {
      level: 6,
      name: "Additional Magical Secrets",
      description:
        "You learn two spells of your choice from any class. They count as Bard spells for you.",
    },
    {
      level: 14,
      name: "Peerless Skill",
      description:
        "When you make an ability check, you can expend a Bardic Inspiration die and add the roll to your total.",
    },
  ],
  "Life Domain": [
    {
      level: 3,
      name: "Life Domain Spells",
      description:
        "You always have Aid, Bless, Cure Wounds, Lesser Restoration, Mass Healing Word, and Revivify prepared.",
    },
    {
      level: 3,
      name: "Disciple of Life",
      description:
        "Your healing spells restore additional Hit Points equal to 2 + the spell's level.",
    },
    {
      level: 6,
      name: "Preserve Life",
      description:
        "As a Magic action, you restore Hit Points equal to five times your Cleric level divided among creatures within 30 feet (no creature above half its maximum).",
    },
    {
      level: 17,
      name: "Blessed Healer",
      description:
        "When you cast a spell that restores Hit Points to a creature other than yourself, you regain Hit Points equal to 2 + the spell's level.",
    },
  ],
  "Circle of the Land": [
    {
      level: 3,
      name: "Circle of the Land Spells",
      description:
        "Terrain-associated Druid spells are always prepared based on the land you chose (Arctic, Coast, Desert, Forest, Grassland, Mountain, Swamp, or Underdark).",
    },
    {
      level: 3,
      name: "Natural Recovery",
      description:
        "During a Short Rest, you can recover expended spell slots with a combined level up to half your Druid level (rounded up). Once per Long Rest.",
    },
    {
      level: 6,
      name: "Land's Aid",
      description:
        "When you cast a Circle of the Land spell, you can expend a use of Wild Shape to deal extra force damage or grant temporary Hit Points.",
    },
    {
      level: 10,
      name: "Nature's Ward",
      description:
        "You can't be charmed or frightened by elementals or fey, and you have resistance to poison damage.",
    },
  ],
  Champion: [
    {
      level: 3,
      name: "Improved Critical",
      description:
        "Your attack rolls with weapons and Unarmed Strikes can score a Critical Hit on a roll of 19 or 20.",
    },
    {
      level: 3,
      name: "Remarkable Athlete",
      description:
        "You have Advantage on Initiative rolls and Strength (Athletics) checks. After you score a Critical Hit, you can move up to half your Speed without provoking Opportunity Attacks.",
    },
    {
      level: 7,
      name: "Additional Fighting Style",
      description: "You gain another Fighting Style feat of your choice.",
    },
    {
      level: 10,
      name: "Heroic Warrior",
      description:
        "During combat, you can give yourself Heroic Inspiration whenever you start your turn without it.",
    },
    {
      level: 15,
      name: "Superior Critical",
      description:
        "Your attack rolls with weapons and Unarmed Strikes can now score a Critical Hit on a roll of 18–20.",
    },
    {
      level: 18,
      name: "Survivor",
      description:
        "You have Advantage on Death Saving Throws; rolling 18–20 counts as a 20. At the start of each turn while Bloodied, you regain 5 + your Constitution modifier Hit Points if you have at least 1 HP.",
    },
  ],
  "Warrior of the Open Hand": [
    {
      level: 3,
      name: "Open Hand Technique",
      description:
        "When you hit with one of the attacks granted by your Flurry of Blows, you can impose one of: knock prone, push 15 feet, or prevent reactions until the end of your next turn.",
    },
    {
      level: 6,
      name: "Wholeness of Body",
      description:
        "As a Bonus Action, you regain Hit Points equal to a roll of your Martial Arts die + your Wisdom modifier. You can use this a number of times equal to your proficiency bonus per Long Rest.",
    },
    {
      level: 11,
      name: "Tranquility",
      description:
        "At the end of a Long Rest, you gain the effect of a Sanctuary spell that lasts until you finish your next Long Rest or harm a creature.",
    },
    {
      level: 17,
      name: "Quivering Palm",
      description:
        "When you hit a creature with an Unarmed Strike, you can spend 3 Focus Points to set up lethal vibrations. You can use an action later to end them; the target must succeed on a Constitution save or drop to 0 HP.",
    },
  ],
  "Oath of Devotion": [
    {
      level: 3,
      name: "Oath of Devotion Spells",
      description:
        "You always have Protection from Evil and Good, Shield of Faith, Aid, Zone of Truth, Beacon of Hope, Dispel Magic, Freedom of Movement, Guardian of Faith, Commune, and Flame Strike prepared at the listed Paladin levels.",
    },
    {
      level: 3,
      name: "Sacred Weapon",
      description:
        "When you take the Attack action, you can use Channel Divinity to imbue a melee weapon for 10 minutes with radiant damage option and +Charisma modifier to attack rolls (minimum +1).",
    },
    {
      level: 7,
      name: "Aura of Devotion",
      description:
        "You and allies in your Aura of Protection have Immunity to the Charmed condition.",
    },
    {
      level: 15,
      name: "Smite of Protection",
      description:
        "When you cast Divine Smite, you and allies in your Aura of Protection have Half Cover until the start of your next turn.",
    },
    {
      level: 20,
      name: "Holy Nimbus",
      description:
        "For 10 minutes, fiends and undead have Disadvantage on saves against your features, enemies in your aura take radiant damage at the start of their turns, and the aura sheds sunlight.",
    },
  ],
  Hunter: [
    {
      level: 3,
      name: "Hunter's Lore",
      description:
        "While a creature is marked by your Hunter's Mark, you know whether it has Immunities, Resistances, or Vulnerabilities and what they are.",
    },
    {
      level: 3,
      name: "Hunter's Prey",
      description:
        "Choose Colossus Slayer (extra 1d8 once per turn vs. injured foes) or Horde Breaker (one extra attack vs. a nearby second target each turn). You can swap after a Short or Long Rest.",
    },
    {
      level: 7,
      name: "Defensive Tactics",
      description:
        "Choose Escape the Horde (disadvantage on opportunity attacks vs. you) or Multiattack Defense (attackers have disadvantage on subsequent attacks against you this turn). Swappable after rests.",
    },
    {
      level: 11,
      name: "Superior Hunter's Prey",
      description:
        "Once per turn when you deal Hunter's Mark damage, you can also deal that extra damage to another creature within 30 feet that you can see.",
    },
    {
      level: 15,
      name: "Superior Hunter's Defense",
      description:
        "When you take damage, you can use a Reaction to gain Resistance to that damage and other damage of the same type until end of turn.",
    },
  ],
  Thief: [
    {
      level: 3,
      name: "Fast Hands",
      description:
        "As a Bonus Action, you can Sleight of Hand, use thieves' tools, or Use an Object.",
    },
    {
      level: 3,
      name: "Second-Story Work",
      description:
        "Climbing no longer costs extra movement, and your running jump distance increases by your Dexterity modifier.",
    },
    {
      level: 9,
      name: "Supreme Sneak",
      description:
        "You have Advantage on Dexterity (Stealth) checks if you move no more than half your Speed on the same turn.",
    },
    {
      level: 13,
      name: "Use Magic Device",
      description:
        "You ignore class, race, and level requirements on magic items; you can use any magic item as a spell scroll if the spell is on your class list.",
    },
  ],
  "Draconic Sorcery": [
    {
      level: 3,
      name: "Draconic Resilience",
      description:
        "Your Hit Point maximum increases by 3 (and by 1 per Sorcerer level). When you aren't wearing armor, your AC equals 10 + Dexterity modifier + Charisma modifier.",
    },
    {
      level: 3,
      name: "Draconic Spells",
      description:
        "You always have Alter Self, Chromatic Orb, Command, Dragon's Breath, and Fear prepared.",
    },
    {
      level: 6,
      name: "Elemental Affinity",
      description:
        "When you cast a spell that deals acid, cold, fire, lightning, or poison damage, add your Charisma modifier to one damage roll.",
    },
    {
      level: 14,
      name: "Dragon Wings",
      description:
        "As a Bonus Action, you sprout spectral wings and gain a Fly Speed equal to your Speed for 10 minutes.",
    },
  ],
  "Fiend Patron": [
    {
      level: 3,
      name: "Dark One's Blessing",
      description:
        "When you reduce a hostile creature to 0 Hit Points, you gain temporary Hit Points equal to your Charisma modifier + your Warlock level.",
    },
    {
      level: 3,
      name: "Fiend Spells",
      description:
        "You always have Burning Hands, Command, Scorching Ray, Suggestion, Fireball, and Wall of Fire prepared.",
    },
    {
      level: 6,
      name: "Dark One's Own Luck",
      description:
        "You can add 1d10 to an ability check or saving throw after seeing the roll but before the outcome. You can use this a number of times equal to your Charisma modifier per Long Rest.",
    },
    {
      level: 10,
      name: "Fiendish Resilience",
      description:
        "You have Resistance to one damage type of your choice after each Short or Long Rest.",
    },
  ],
  Evoker: [
    {
      level: 3,
      name: "Evocation Savant",
      description:
        "Evocation spells cost half as much time and gold to copy into your spellbook.",
    },
    {
      level: 3,
      name: "Potent Cantrip",
      description:
        "When a creature succeeds on a saving throw against your Wizard cantrip, it still takes half the cantrip's damage (if any).",
    },
    {
      level: 6,
      name: "Sculpt Spells",
      description:
        "When you cast an Evocation spell, you can choose creatures equal to 1 + the spell's level to automatically succeed on saves and take no damage.",
    },
    {
      level: 10,
      name: "Empowered Evocation",
      description:
        "You add your Intelligence modifier to one damage roll of any Wizard Evocation spell you cast.",
    },
    {
      level: 14,
      name: "Overchannel",
      description:
        "When you cast a Wizard Evocation spell of level 5 or lower, you can deal maximum damage. The first use is safe; each additional use before a Long Rest deals 2d12 necrotic damage per spell level to you.",
    },
  ],
};
