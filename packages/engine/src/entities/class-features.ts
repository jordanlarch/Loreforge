/**
 * Curated SRD class features by level — deterministic ingest for the Features
 * tab and level-up wizard (CHAR-8). Full Open5e class-feature parse is deferred;
 * this hand-normalized dataset matches codex class display names.
 */

export type ClassFeature = {
  id: string;
  name: string;
  description: string;
  /** Max uses per short rest, long rest, or day when applicable. */
  uses?: number;
  /** When uses refresh: short_rest | long_rest | day */
  recharge?: "short_rest" | "long_rest" | "day";
};

type LevelMap = Record<number, ClassFeature[]>;

function feat(
  name: string,
  description: string,
  opts?: { uses?: number; recharge?: ClassFeature["recharge"] },
): ClassFeature {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return { id, name, description, ...opts };
}

const FIGHTER: LevelMap = {
  1: [
    feat(
      "Fighting Style",
      "You adopt a fighting style as your specialty (Archery, Defense, Dueling, Great Weapon Fighting, Protection, or Two-Weapon Fighting).",
    ),
    feat(
      "Second Wind",
      "On your turn, use a bonus action to regain 1d10 + fighter level HP. Once per short or long rest.",
      { uses: 1, recharge: "short_rest" },
    ),
  ],
  2: [
    feat(
      "Action Surge",
      "Take one additional action on your turn. Once per short or long rest.",
      { uses: 1, recharge: "short_rest" },
    ),
  ],
  3: [
    feat(
      "Martial Archetype",
      "Choose a martial archetype (Champion, Battle Master, or Eldritch Knight).",
    ),
  ],
  5: [
    feat(
      "Extra Attack",
      "You can attack twice, instead of once, when you take the Attack action.",
    ),
  ],
  9: [
    feat(
      "Indomitable",
      "Reroll a failed saving throw. Once per long rest.",
      { uses: 1, recharge: "long_rest" },
    ),
  ],
};

const WIZARD: LevelMap = {
  1: [
    feat("Spellcasting", "Prepare wizard spells from your spellbook using Intelligence."),
    feat(
      "Arcane Recovery",
      "Once per day when you finish a short rest, recover spell slots with combined level ≤ half wizard level (rounded up).",
      { uses: 1, recharge: "day" },
    ),
  ],
  2: [feat("Arcane Tradition", "Choose an arcane tradition (school of magic).")],
  18: [feat("Spell Mastery", "Choose a 1st-level and a 2nd-level wizard spell to cast at will.")],
  20: [feat("Signature Spells", "Choose two 3rd-level spells; each can be cast once per short or long rest without a slot.")],
};

const ROGUE: LevelMap = {
  1: [
    feat("Expertise", "Double proficiency bonus for two skills (more at higher levels)."),
    feat("Sneak Attack", "Deal extra damage when you have advantage or an ally is within 5 ft of the target."),
    feat("Thieves' Cant", "Secret mix of dialect, jargon, and code for rogues."),
  ],
  2: [
    feat(
      "Cunning Action",
      "Use a bonus action on your turn to Dash, Disengage, or Hide.",
    ),
  ],
  3: [feat("Roguish Archetype", "Choose a roguish archetype.")],
  5: [feat("Uncanny Dodge", "Halve damage from an attacker you can see.")],
  7: [feat("Evasion", "On a successful DEX save for half damage, take none instead.")],
};

const CLERIC: LevelMap = {
  1: [
    feat("Spellcasting", "Prepare cleric spells using Wisdom."),
    feat("Divine Domain", "Choose a domain granting spells and features at 1st, 2nd, 6th, and 8th level."),
  ],
  2: [
    feat(
      "Channel Divinity",
      "Channel divine energy for domain-specific effects. Uses increase with level.",
      { uses: 1, recharge: "short_rest" },
    ),
  ],
  5: [feat("Destroy Undead", "Turn Undead destroys low-CR undead that fail the save.")],
  8: [feat("Divine Domain Feature", "Gain an additional domain feature.")],
  10: [feat("Divine Intervention", "Call on your deity for aid. Once per week (or more at 20th).")],
};

const BARBARIAN: LevelMap = {
  1: [
    feat(
      "Rage",
      "Enter a rage for +2 damage (melee STR), resistance to B/P/S, and advantage on STR checks/saves. Uses per long rest.",
      { uses: 2, recharge: "long_rest" },
    ),
    feat("Unarmored Defense", "AC = 10 + DEX + CON when not wearing armor."),
  ],
  2: [
    feat("Reckless Attack", "Gain advantage on melee STR attacks; attacks against you have advantage until your next turn."),
    feat("Danger Sense", "Advantage on DEX saves against effects you can see."),
  ],
  3: [feat("Primal Path", "Choose a primal path (subclass).")],
  5: [
    feat("Extra Attack", "Attack twice when you take the Attack action."),
    feat("Fast Movement", "+10 ft speed while not wearing heavy armor."),
  ],
};

const BARD: LevelMap = {
  1: [
    feat(
      "Bardic Inspiration",
      "Grant a d6 inspiration die (scales with level) as a bonus action. Uses per long rest.",
      { uses: 3, recharge: "long_rest" },
    ),
    feat("Spellcasting", "Known bard spells using Charisma."),
  ],
  2: [
    feat("Jack of All Trades", "Add half proficiency (rounded down) to ability checks you aren't proficient in."),
    feat("Song of Rest", "Allies regain extra HP when spending hit dice during a short rest."),
  ],
  3: [
    feat("Expertise", "Double proficiency for two skills."),
    feat("Bard College", "Choose a bard college (subclass)."),
  ],
  5: [feat("Font of Inspiration", "Regain all uses of Bardic Inspiration on a short or long rest.")],
};

const DRUID: LevelMap = {
  1: [
    feat("Druidic", "Secret language of druids."),
    feat("Spellcasting", "Prepare druid spells using Wisdom."),
  ],
  2: [
    feat("Wild Shape", "Assume beast forms. Uses and CR limits scale with level.", {
      uses: 2,
      recharge: "short_rest",
    }),
    feat("Druid Circle", "Choose a druid circle (subclass)."),
  ],
};

const MONK: LevelMap = {
  1: [
    feat("Unarmored Defense", "AC = 10 + DEX + WIS when unarmored."),
    feat("Martial Arts", "Use DEX for unarmed strikes; bonus unarmed strike as bonus action."),
  ],
  2: [
    feat(
      "Ki",
      "Spend ki points for Flurry of Blows, Patient Defense, or Step of the Wind.",
      { uses: 2, recharge: "short_rest" },
    ),
    feat("Unarmored Movement", "+10 ft speed while unarmored (scales later)."),
  ],
  3: [
    feat("Monastic Tradition", "Choose a monastic tradition (subclass)."),
    feat("Deflect Missiles", "Reduce damage from ranged weapon attacks; catch and throw on 0 damage."),
  ],
};

const PALADIN: LevelMap = {
  1: [
    feat("Divine Sense", "Detect celestials, fiends, and undead within 60 ft.", {
      uses: 1,
      recharge: "long_rest",
    }),
    feat("Lay on Hands", "Healing pool of 5 × paladin level HP per long rest.", {
      uses: 1,
      recharge: "long_rest",
    }),
  ],
  2: [
    feat("Fighting Style", "Adopt a fighting style."),
    feat("Spellcasting", "Prepare paladin spells using Charisma."),
    feat(
      "Divine Smite",
      "Expend spell slots to deal radiant damage on melee hits.",
    ),
  ],
  3: [feat("Sacred Oath", "Choose a sacred oath (subclass).")],
  5: [feat("Extra Attack", "Attack twice when you take the Attack action.")],
  6: [feat("Aura of Protection", "You and allies within 10 ft add CHA mod to saves.")],
};

const RANGER: LevelMap = {
  1: [
    feat("Favored Enemy", "Advantage on Survival checks to track and INT checks to recall info about a chosen enemy type."),
    feat("Natural Explorer", "Benefits in a chosen terrain (difficult terrain, foraging, etc.)."),
  ],
  2: [
    feat("Fighting Style", "Adopt a fighting style."),
    feat("Spellcasting", "Known ranger spells using Wisdom."),
  ],
  3: [feat("Ranger Archetype", "Choose a ranger archetype (subclass).")],
  5: [feat("Extra Attack", "Attack twice when you take the Attack action.")],
};

const SORCERER: LevelMap = {
  1: [
    feat("Spellcasting", "Known sorcerer spells using Charisma."),
    feat("Sorcerous Origin", "Choose a sorcerous origin (subclass)."),
  ],
  2: [
    feat(
      "Font of Magic",
      "Convert sorcery points ↔ spell slots; fuel Metamagic.",
    ),
  ],
  3: [feat("Metamagic", "Choose two Metamagic options.")],
};

const WARLOCK: LevelMap = {
  1: [
    feat("Otherworldly Patron", "Choose a patron (subclass)."),
    feat("Pact Magic", "Known warlock spells; slots refresh on short rest."),
  ],
  2: [feat("Eldritch Invocations", "Choose invocations (two at 2nd level).")],
  3: [feat("Pact Boon", "Choose Pact of the Chain, Blade, or Tome.")],
};

const BY_CLASS: Record<string, LevelMap> = {
  Barbarian: BARBARIAN,
  Bard: BARD,
  Cleric: CLERIC,
  Druid: DRUID,
  Fighter: FIGHTER,
  Monk: MONK,
  Paladin: PALADIN,
  Ranger: RANGER,
  Rogue: ROGUE,
  Sorcerer: SORCERER,
  Warlock: WARLOCK,
  Wizard: WIZARD,
};

/** Class features gained at exactly this class level (empty if none curated). */
export function classFeaturesForLevel(
  className: string,
  level: number,
): ClassFeature[] {
  return BY_CLASS[className]?.[level] ?? [];
}

/** All features from class level 1 through `level` inclusive. */
export function accumulatedClassFeatures(
  className: string,
  level: number,
): ClassFeature[] {
  const out: ClassFeature[] = [];
  for (let l = 1; l <= level; l++) {
    out.push(...classFeaturesForLevel(className, l));
  }
  return out;
}
