/**
 * Curated SRD 5.2 (2024) class features by level — deterministic ingest for the
 * Features tab and level-up wizard (CHAR-8). Matches `SRD_CC_v5.2.1.pdf`.
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

const BARBARIAN: LevelMap = {
  1: [
    feat(
      "Rage",
      "Bonus Action while not wearing Heavy armor. Gain Resistance to B/P/S, Rage Damage bonus on STR attacks, and Advantage on STR checks/saves. Can't cast spells or Concentrate. Regain one use on a Short Rest, all on a Long Rest.",
      { uses: 2, recharge: "short_rest" },
    ),
    feat(
      "Unarmored Defense",
      "While not wearing armor, AC = 10 + DEX + CON (Shields allowed).",
    ),
    feat(
      "Weapon Mastery",
      "Use mastery properties of two Simple or Martial Melee weapons; swap one after each Long Rest.",
    ),
  ],
  2: [
    feat("Danger Sense", "Advantage on Dexterity saving throws unless Incapacitated."),
    feat(
      "Reckless Attack",
      "On your first attack each turn, gain Advantage on STR attacks until your next turn; attacks against you have Advantage until then.",
    ),
  ],
  3: [
    feat("Barbarian Subclass", "Choose Path of the Berserker (SRD)."),
    feat(
      "Primal Knowledge",
      "Gain one extra Barbarian skill proficiency. While raging, make Acrobatics, Intimidation, Perception, Stealth, or Survival checks using Strength.",
    ),
  ],
  5: [
    feat("Extra Attack", "Attack twice when you take the Attack action."),
    feat("Fast Movement", "+10 ft speed while not wearing Heavy armor."),
  ],
  7: [
    feat("Feral Instinct", "Advantage on Initiative rolls."),
    feat("Instinctive Pounce", "When you enter Rage, move up to half your Speed as part of that Bonus Action."),
  ],
  9: [
    feat(
      "Brutal Strike",
      "When using Reckless Attack, forgo Advantage on one STR attack to deal +1d10 damage and apply Forceful or Hamstring Blow.",
    ),
  ],
};

const BARD: LevelMap = {
  1: [
    feat(
      "Bardic Inspiration",
      "Bonus Action: ally within 60 ft gains a Bardic Inspiration die (d6, scales at 5/10/15) for 1 hour. Uses = CHA mod (min 1); regain all on Long Rest.",
      { uses: 3, recharge: "long_rest" },
    ),
    feat("Spellcasting", "Prepare bard spells using Charisma; Musical Instrument focus."),
  ],
  2: [
    feat("Expertise", "Expertise in two skills (two more at Bard 9)."),
    feat(
      "Jack of All Trades",
      "Add half Proficiency Bonus (round down) to ability checks using a skill you lack.",
    ),
  ],
  3: [feat("Bard Subclass", "Choose College of Lore (SRD).")],
  5: [
    feat(
      "Font of Inspiration",
      "Regain all Bardic Inspiration uses on Short or Long Rest; expend a spell slot to regain one use.",
    ),
  ],
  7: [
    feat(
      "Countercharm",
      "Reaction when you or an ally within 30 ft fails a save vs Charmed/Frightened: reroll with Advantage.",
    ),
  ],
  10: [
    feat(
      "Magical Secrets",
      "When Prepared Spells increase, add spells from Bard, Cleric, Druid, or Wizard lists.",
    ),
  ],
};

const CLERIC: LevelMap = {
  1: [
    feat("Spellcasting", "Prepare cleric spells using Wisdom; Holy Symbol focus."),
    feat(
      "Divine Order",
      "Protector: Martial weapons + Heavy armor training. Thaumaturge: extra cantrip + WIS mod to Arcana/Religion checks.",
    ),
  ],
  2: [
    feat(
      "Channel Divinity",
      "Divine Spark (heal or necrotic/radiant damage) or Turn Undead. Two uses; regain one on Short Rest, all on Long Rest.",
      { uses: 2, recharge: "short_rest" },
    ),
  ],
  3: [feat("Cleric Subclass", "Choose Life Domain (SRD).")],
  5: [
    feat(
      "Sear Undead",
      "When you Turn Undead, add WIS-mod d8s of Radiant damage to failed saves.",
    ),
  ],
  7: [
    feat(
      "Blessed Strikes",
      "Divine Strike (+1d8 on weapon hit) or Potent Spellcasting (WIS mod to cantrip damage).",
    ),
  ],
  10: [
    feat(
      "Divine Intervention",
      "Magic action: cast a level 5 or lower Cleric spell without a slot once per Long Rest.",
    ),
  ],
};

const DRUID: LevelMap = {
  1: [
    feat(
      "Spellcasting",
      "Prepare druid spells using Wisdom; Druidic Focus. Know Druidic and always have Speak with Animals prepared.",
    ),
    feat(
      "Primal Order",
      "Magician: extra cantrip + WIS mod to Arcana/Nature. Warden: Martial weapons + Medium armor training.",
    ),
  ],
  2: [
    feat(
      "Wild Shape",
      "Bonus Action: assume a known Beast form for hours = half Druid level. Two uses; regain one on Short Rest, all on Long Rest.",
      { uses: 2, recharge: "short_rest" },
    ),
    feat(
      "Wild Companion",
      "Magic action: expend a slot or Wild Shape use to cast Find Familiar (Fey familiar).",
    ),
  ],
  3: [feat("Druid Subclass", "Choose Circle of the Land (SRD).")],
  5: [
    feat(
      "Wild Resurgence",
      "Once per turn, if out of Wild Shape uses, regain one by expending a spell slot; or expend Wild Shape for a level 1 slot (once per Long Rest).",
    ),
  ],
  7: [
    feat(
      "Elemental Fury",
      "Potent Spellcasting (WIS mod to cantrip damage) or Primal Strike (+1d8 elemental on weapon/Beast-form hit).",
    ),
  ],
};

const FIGHTER: LevelMap = {
  1: [
    feat(
      "Fighting Style",
      "Gain a Fighting Style feat (Defense recommended). Replace when you gain Fighter levels.",
    ),
    feat(
      "Second Wind",
      "Bonus Action: regain 1d10 + Fighter level HP. Two uses; regain one on Short Rest, all on Long Rest.",
      { uses: 2, recharge: "short_rest" },
    ),
    feat(
      "Weapon Mastery",
      "Use mastery properties of three weapons; swap one after each Long Rest.",
    ),
  ],
  2: [
    feat(
      "Action Surge",
      "Take one additional action on your turn (not Magic). Once per Short or Long Rest until Fighter 17.",
      { uses: 1, recharge: "short_rest" },
    ),
    feat(
      "Tactical Mind",
      "When you fail an ability check, expend Second Wind to add 1d10 instead of healing.",
    ),
  ],
  3: [feat("Fighter Subclass", "Choose Champion (SRD).")],
  5: [
    feat("Extra Attack", "Attack twice when you take the Attack action."),
    feat(
      "Tactical Shift",
      "When you use Second Wind, move up to half Speed without provoking Opportunity Attacks.",
    ),
  ],
  9: [
    feat(
      "Indomitable",
      "Reroll a failed save with a bonus equal to Fighter level. Once per Long Rest (more at 13 and 17).",
      { uses: 1, recharge: "long_rest" },
    ),
    feat(
      "Tactical Master",
      "When attacking with a mastered weapon, swap its mastery property for Push, Sap, or Slow.",
    ),
  ],
};

const MONK: LevelMap = {
  1: [
    feat(
      "Martial Arts",
      "With Unarmed Strikes or Monk weapons and no armor/Shield: bonus Unarmed Strike, Martial Arts die damage, DEX for attacks.",
    ),
    feat("Unarmored Defense", "Without armor or Shield, AC = 10 + DEX + WIS."),
  ],
  2: [
    feat(
      "Monk's Focus",
      "Focus Points fuel Flurry of Blows, Patient Defense, and Step of the Wind. Regain all on Short or Long Rest.",
      { uses: 2, recharge: "short_rest" },
    ),
    feat("Unarmored Movement", "+10 ft speed without armor or Shield (scales later)."),
    feat(
      "Uncanny Metabolism",
      "On Initiative, regain all Focus Points and heal Monk level + Martial Arts die once per Long Rest.",
    ),
  ],
  3: [
    feat("Deflect Attacks", "Reaction: reduce B/P/S damage by 1d10 + DEX + Monk level; optionally redirect force."),
    feat("Monk Subclass", "Choose Warrior of the Open Hand (SRD)."),
  ],
  5: [
    feat("Extra Attack", "Attack twice when you take the Attack action."),
    feat(
      "Stunning Strike",
      "Once per turn on hit with Monk weapon or Unarmed Strike: spend 1 Focus Point to Stun or slow target.",
    ),
  ],
  7: [feat("Evasion", "On successful DEX save for half damage, take none; on fail, half.")],
};

const PALADIN: LevelMap = {
  1: [
    feat(
      "Lay On Hands",
      "Pool of 5 × Paladin level HP per Long Rest; Bonus Action touch to heal or spend 5 HP to remove Poisoned.",
      { uses: 1, recharge: "long_rest" },
    ),
    feat("Spellcasting", "Prepare paladin spells using Charisma; Holy Symbol focus."),
    feat(
      "Weapon Mastery",
      "Use mastery properties of two proficient weapons; swap after Long Rest.",
    ),
  ],
  2: [
    feat("Fighting Style", "Fighting Style feat or Blessed Warrior (two Cleric cantrips)."),
    feat(
      "Paladin's Smite",
      "Always have Divine Smite prepared; cast once without a slot per Long Rest.",
    ),
  ],
  3: [
    feat(
      "Channel Divinity",
      "Divine Sense and subclass options. Two uses; regain one on Short Rest, all on Long Rest.",
      { uses: 2, recharge: "short_rest" },
    ),
    feat("Paladin Subclass", "Choose Oath of Devotion (SRD)."),
  ],
  5: [
    feat("Extra Attack", "Attack twice when you take the Attack action."),
    feat(
      "Faithful Steed",
      "Always have Find Steed prepared; cast once without a slot per Long Rest.",
    ),
  ],
  6: [
    feat(
      "Aura of Protection",
      "10-ft aura: you and allies add CHA mod to saves while you're not Incapacitated.",
    ),
  ],
};

const RANGER: LevelMap = {
  1: [
    feat("Spellcasting", "Prepare ranger spells using Wisdom; Druidic Focus."),
    feat(
      "Favored Enemy",
      "Always have Hunter's Mark prepared; cast without a slot (uses per Long Rest = Favored Enemy column).",
    ),
    feat(
      "Weapon Mastery",
      "Use mastery properties of two weapons; swap after Long Rest.",
    ),
  ],
  2: [
    feat(
      "Deft Explorer",
      "Expertise in one skill lacking it; learn two languages.",
    ),
    feat("Fighting Style", "Fighting Style feat or Druidic Warrior (two Druid cantrips)."),
  ],
  3: [feat("Ranger Subclass", "Choose Hunter (SRD).")],
  5: [feat("Extra Attack", "Attack twice when you take the Attack action.")],
  6: [
    feat(
      "Roving",
      "+10 ft Speed without Heavy armor; Climb and Swim Speed equal to Speed.",
    ),
  ],
};

const ROGUE: LevelMap = {
  1: [
    feat("Expertise", "Expertise in two skills (two more at Rogue 6)."),
    feat(
      "Sneak Attack",
      "Once per turn, +Sneak Attack dice when you have Advantage with Finesse/Ranged weapon or ally within 5 ft.",
    ),
    feat("Thieves' Cant", "Know Thieves' Cant and one extra language."),
    feat(
      "Weapon Mastery",
      "Use mastery properties of two weapons; swap after Long Rest.",
    ),
  ],
  2: [
    feat(
      "Cunning Action",
      "Bonus Action: Dash, Disengage, or Hide.",
    ),
  ],
  3: [
    feat("Rogue Subclass", "Choose Thief (SRD)."),
    feat(
      "Steady Aim",
      "Bonus Action: Advantage on next attack if you haven't moved; Speed 0 until end of turn.",
    ),
  ],
  5: [
    feat("Cunning Strike", "Add Poison, Trip, or Withdraw effects when dealing Sneak Attack damage."),
    feat("Uncanny Dodge", "Reaction: halve damage from a visible attacker."),
  ],
  7: [
    feat("Evasion", "Successful DEX save for half → no damage; fail → half."),
    feat("Reliable Talent", "Treat d20 rolls of 9 or lower as 10 on proficient skill/tool checks."),
  ],
};

const SORCERER: LevelMap = {
  1: [
    feat("Spellcasting", "Prepare sorcerer spells using Charisma; Arcane Focus."),
    feat(
      "Innate Sorcery",
      "Bonus Action: for 1 minute, +1 spell save DC and Advantage on sorcerer spell attacks (uses per Long Rest scale with level).",
    ),
  ],
  2: [
    feat(
      "Font of Magic",
      "Sorcery Points fuel Metamagic and flexible slots; regain all on Long Rest.",
    ),
    feat("Metamagic", "Choose two Metamagic options (more at 10 and 17)."),
  ],
  3: [feat("Sorcerer Subclass", "Choose Draconic Sorcery (SRD).")],
  5: [
    feat(
      "Sorcerous Restoration",
      "On Short Rest, regain Sorcery Points up to half Sorcerer level once per Long Rest.",
    ),
  ],
};

const WARLOCK: LevelMap = {
  1: [
    feat("Pact Magic", "Pact slots refresh on Short Rest; prepare warlock spells with Charisma."),
    feat("Eldritch Invocations", "Choose invocations (see SRD); one at level 1, more as you level."),
  ],
  2: [
    feat(
      "Magical Cunning",
      "1-minute rite: regain expended Pact slots up to half max (round up) once per Long Rest.",
    ),
  ],
  3: [feat("Warlock Subclass", "Choose Fiend Patron (SRD).")],
};

const WIZARD: LevelMap = {
  1: [
    feat(
      "Spellcasting",
      "Spellbook with six level 1 spells; prepare wizard spells using Intelligence; Arcane Focus.",
    ),
    feat("Ritual Adept", "You can cast ritual spells from your spellbook even if not prepared."),
    feat(
      "Arcane Recovery",
      "Once per day after Short Rest, recover slots with combined level ≤ half wizard level (rounded up).",
      { uses: 1, recharge: "day" },
    ),
  ],
  2: [
    feat(
      "Scholar",
      "Loremaster: two INT skills gain Expertise. Mage: learn two Wizard cantrips and cast one at will.",
    ),
  ],
  3: [feat("Wizard Subclass", "Choose Evoker (SRD).")],
  5: [
    feat(
      "Memorize Spell",
      "After Long Rest, replace one prepared spell by spending 1 minute studying your spellbook.",
    ),
  ],
  18: [
    feat(
      "Spell Mastery",
      "Choose one level 1 and one level 2 wizard spell to cast at will.",
    ),
  ],
  20: [
    feat(
      "Signature Spells",
      "Choose two level 3 spells; cast each once per Short Rest without a slot.",
    ),
  ],
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
