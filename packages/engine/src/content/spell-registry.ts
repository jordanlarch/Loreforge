/**
 * Authoritative in-engine spell registry (#40, E3).
 *
 * Hand-authored {@link SpellDefinition}s override Open5e-generated catalog entries
 * for combat resolution. The full SRD spell list is merged from
 * {@link OPEN5E_SPELL_REGISTRY} (regenerate via `npm run generate:spell-registry`).
 *
 * Golden cast snapshots (`engine.spells.golden.test.ts`) cover hand-authored spells
 * only ({@link HAND_AUTHORED_SPELL_IDS}).
 */
import type { SpellDefinition } from "./spells";
import { OPEN5E_SPELL_REGISTRY } from "./spell-registry-open5e.generated";

/** Magic Missile — three auto-hit force darts (1d4+1 each), +1 dart per upcast. */
const MAGIC_MISSILE: SpellDefinition = {
  id: "magic-missile",
  name: "Magic Missile",
  level: 1,
  school: "evocation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "multi",
  projectiles: { base: 3, perSlotLevel: 1 },
  damage: [{ dice: "1d4+1", type: "force" }],
  description:
    "You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range, dealing 1d4+1 force damage automatically. The darts strike simultaneously. When cast with a higher-level slot, the spell creates one more dart for each slot level above 1st.",
};

/** Guiding Bolt — a ranged spell attack for 4d6 radiant, +1d6 per upcast. */
const GUIDING_BOLT: SpellDefinition = {
  id: "guiding-bolt",
  name: "Guiding Bolt",
  level: 1,
  school: "evocation",
  classes: ["Cleric"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120 },
  components: { verbal: true, somatic: true },
  duration: { unit: "round", amount: 1 },
  concentration: false,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "ranged" },
  damage: [{ dice: "4d6", type: "radiant" }],
  upcastScaling: { perSlotDice: "1d6", appliesTo: "damage" },
  description:
    "A flash of light streaks toward a creature of your choice within range. Make a ranged spell attack. On a hit, the target takes 4d6 radiant damage, and the next attack roll made against it before the end of your next turn has advantage. When cast with a higher-level slot, the damage increases by 1d6 for each slot level above 1st.",
};

/** Fireball — a 20-ft-radius sphere, Dex save-for-half, 8d6 fire (+1d6/upcast). */
const FIREBALL: SpellDefinition = {
  id: "fireball",
  name: "Fireball",
  level: 3,
  school: "evocation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 150, area: { shape: "sphere", size: 20 } },
  components: {
    verbal: true,
    somatic: true,
    material: "a tiny ball of bat guano and sulfur",
  },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "8d6", type: "fire" }],
  upcastScaling: { perSlotDice: "1d6", appliesTo: "damage" },
  description:
    "A bright streak flashes to a point you choose within range and blossoms into a 20-foot-radius sphere of flame. Each creature in the area makes a Dexterity saving throw, taking 8d6 fire damage on a failed save, or half as much on a success. When cast with a slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.",
};

/** Burning Hands — a 15-ft cone from the caster, Dex save-for-half, 3d6 fire. */
const BURNING_HANDS: SpellDefinition = {
  id: "burning-hands",
  name: "Burning Hands",
  level: 1,
  school: "evocation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "self", area: { shape: "cone", size: 15 } },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "3d6", type: "fire" }],
  upcastScaling: { perSlotDice: "1d6", appliesTo: "damage" },
  description:
    "A thin sheet of flames shoots forth from your outstretched fingertips. Each creature in a 15-foot cone makes a Dexterity saving throw, taking 3d6 fire damage on a failed save, or half as much on a success. When cast with a slot of 2nd level or higher, the damage increases by 1d6 for each slot level above 1st.",
};

/** Sacred Flame — a single-target Dex save cantrip; 1d8 radiant on a fail. */
const SACRED_FLAME: SpellDefinition = {
  id: "sacred-flame",
  name: "Sacred Flame",
  level: 0,
  school: "evocation",
  classes: ["Cleric"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "1d8", type: "radiant" }],
  description:
    "Flame-like radiance descends on a creature that you can see within range. The target makes a Dexterity saving throw, taking 1d8 radiant damage on a failed save. The target gains no benefit from cover for this save. The damage increases by one die when you reach 5th level (2d8), 11th level (3d8), and 17th level (4d8).",
};

/** Cure Wounds — a touch heal of 1d8 + spell mod, +1d8 per upcast. */
const CURE_WOUNDS: SpellDefinition = {
  id: "cure-wounds",
  name: "Cure Wounds",
  level: 1,
  school: "abjuration",
  classes: ["Cleric", "Druid", "Paladin", "Ranger"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "touch" },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  healing: { dice: "1d8", addSpellMod: true },
  upcastScaling: { perSlotDice: "1d8", appliesTo: "healing" },
  description:
    "A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs. When cast with a slot of 2nd level or higher, the healing increases by 1d8 for each slot level above 1st.",
};

/** Healing Word — a bonus-action ranged heal of 1d4 + spell mod, +1d4/upcast. */
const HEALING_WORD: SpellDefinition = {
  id: "healing-word",
  name: "Healing Word",
  level: 1,
  school: "abjuration",
  classes: ["Bard", "Cleric", "Druid"],
  castingTime: { unit: "bonus", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: false },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  healing: { dice: "1d4", addSpellMod: true },
  upcastScaling: { perSlotDice: "1d4", appliesTo: "healing" },
  description:
    "A creature of your choice that you can see within range regains hit points equal to 1d4 + your spellcasting ability modifier. This spell has no effect on undead or constructs. When cast with a slot of 2nd level or higher, the healing increases by 1d4 for each slot level above 1st.",
};

/** Fire Bolt — a cantrip ranged spell attack for 1d10 fire, scaling by level. */
const FIRE_BOLT: SpellDefinition = {
  id: "fire-bolt",
  name: "Fire Bolt",
  level: 0,
  school: "evocation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "ranged" },
  damage: [{ dice: "1d10", type: "fire" }],
  description:
    "You hurl a mote of fire at a creature or object within range. Make a ranged spell attack. On a hit, the target takes 1d10 fire damage. This spell's damage increases by 1d10 when you reach 5th level (2d10), 11th level (3d10), and 17th level (4d10).",
};

// ───────────────────────── Batch 2 (C1 / ENG-2) ─────────────────────────

/** Ray of Frost — a cantrip ranged spell attack for 1d8 cold (slows on hit). */
const RAY_OF_FROST: SpellDefinition = {
  id: "ray-of-frost",
  name: "Ray of Frost",
  level: 0,
  school: "evocation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "ranged" },
  damage: [{ dice: "1d8", type: "cold" }],
  description:
    "A frigid beam of blue-white light streaks toward a creature within range. Make a ranged spell attack. On a hit, the target takes 1d8 cold damage, and its speed is reduced by 10 feet until the start of your next turn. The damage increases by 1d8 at 5th, 11th, and 17th level. (The speed reduction is narrated; the slow rider is not yet mechanized.)",
};

/** Shocking Grasp — a cantrip melee spell attack for 1d8 lightning. */
const SHOCKING_GRASP: SpellDefinition = {
  id: "shocking-grasp",
  name: "Shocking Grasp",
  level: 0,
  school: "evocation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "touch" },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "melee" },
  damage: [{ dice: "1d8", type: "lightning" }],
  description:
    "Lightning springs from your hand to a creature you try to touch. Make a melee spell attack; you have advantage if the target wears metal armor. On a hit, the target takes 1d8 lightning damage and can't take reactions until the start of its next turn. The damage increases by 1d8 at 5th, 11th, and 17th level. (The advantage-vs-metal and no-reaction riders are narrated, not yet mechanized.)",
};

/** Chill Touch — a cantrip ranged spell attack for 1d8 necrotic. */
const CHILL_TOUCH: SpellDefinition = {
  id: "chill-touch",
  name: "Chill Touch",
  level: 0,
  school: "necromancy",
  classes: ["Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120 },
  components: { verbal: true, somatic: true },
  duration: { unit: "round", amount: 1 },
  concentration: false,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "ranged" },
  damage: [{ dice: "1d8", type: "necrotic" }],
  description:
    "You create a ghostly, skeletal hand in the space of a creature within range. Make a ranged spell attack. On a hit, the target takes 1d8 necrotic damage and can't regain hit points until the start of your next turn. The damage increases by 1d8 at 5th, 11th, and 17th level. (The no-healing rider is narrated, not yet mechanized.)",
};

/** Produce Flame — a cantrip ranged spell attack for 1d8 fire (also a light). */
const PRODUCE_FLAME: SpellDefinition = {
  id: "produce-flame",
  name: "Produce Flame",
  level: 0,
  school: "conjuration",
  classes: ["Druid"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 30 },
  components: { verbal: true, somatic: true },
  duration: { unit: "minute", amount: 10 },
  concentration: false,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "ranged" },
  damage: [{ dice: "1d8", type: "fire" }],
  description:
    "A flickering flame appears in your hand, shedding light. You can hurl it at a creature within range: make a ranged spell attack, dealing 1d8 fire damage on a hit. The damage increases by 1d8 at 5th, 11th, and 17th level. (The shed-light effect is narrated, not yet mechanized.)",
};

/** Thorn Whip — a cantrip melee spell attack for 1d6 piercing (pulls on hit). */
const THORN_WHIP: SpellDefinition = {
  id: "thorn-whip",
  name: "Thorn Whip",
  level: 0,
  school: "transmutation",
  classes: ["Druid"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 30 },
  components: { verbal: true, somatic: true, material: "the stem of a plant with thorns" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "melee" },
  damage: [{ dice: "1d6", type: "piercing" }],
  description:
    "You create a long, vine-like whip covered in thorns that lashes out at a creature within range. Make a melee spell attack. On a hit, the target takes 1d6 piercing damage, and if it is Large or smaller you pull it up to 10 feet closer. The damage increases by 1d6 at 5th, 11th, and 17th level. (The forced pull is narrated, not yet mechanized.)",
};

/** Poison Spray — a cantrip Con-save cantrip; 1d12 poison on a fail. */
const POISON_SPRAY: SpellDefinition = {
  id: "poison-spray",
  name: "Poison Spray",
  level: 0,
  school: "conjuration",
  classes: ["Druid", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 10 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "1d12", type: "poison" }],
  description:
    "You extend your hand toward a creature you can see within range and project a puff of noxious gas. The target makes a Constitution saving throw, taking 1d12 poison damage on a failed save. The damage increases by 1d12 at 5th, 11th, and 17th level.",
};

/** Acid Splash — a cantrip Dex-save cantrip hitting up to two creatures. */
const ACID_SPLASH: SpellDefinition = {
  id: "acid-splash",
  name: "Acid Splash",
  level: 0,
  school: "conjuration",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "multi",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "1d6", type: "acid" }],
  description:
    "You hurl a bubble of acid at one creature, or two creatures within 5 feet of each other. Each target makes a Dexterity saving throw, taking 1d6 acid damage on a failed save. The damage increases by 1d6 at 5th, 11th, and 17th level.",
};

/** Vicious Mockery — a bard cantrip; Wis save, 1d4 psychic on a fail. */
const VICIOUS_MOCKERY: SpellDefinition = {
  id: "vicious-mockery",
  name: "Vicious Mockery",
  level: 0,
  school: "enchantment",
  classes: ["Bard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: false },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "1d4", type: "psychic" }],
  description:
    "You unleash a string of insults laced with subtle enchantments at a creature you can see within range. It makes a Wisdom saving throw, taking 1d4 psychic damage on a failed save and having disadvantage on its next attack roll before the end of its next turn. The damage increases by 1d4 at 5th, 11th, and 17th level. (The disadvantage rider is narrated, not yet mechanized.)",
};

/** Inflict Wounds — a level-1 melee spell attack for 3d10 necrotic. */
const INFLICT_WOUNDS: SpellDefinition = {
  id: "inflict-wounds",
  name: "Inflict Wounds",
  level: 1,
  school: "necromancy",
  classes: ["Cleric"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "touch" },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "melee" },
  damage: [{ dice: "3d10", type: "necrotic" }],
  upcastScaling: { perSlotDice: "1d10", appliesTo: "damage" },
  description:
    "Make a melee spell attack against a creature you can reach. On a hit, the target takes 3d10 necrotic damage. When cast with a slot of 2nd level or higher, the damage increases by 1d10 for each slot level above 1st.",
};

/** Shatter — a level-2 10-ft-radius sphere; Con save-for-half, 3d8 thunder. */
const SHATTER: SpellDefinition = {
  id: "shatter",
  name: "Shatter",
  level: 2,
  school: "evocation",
  classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60, area: { shape: "sphere", size: 10 } },
  components: { verbal: true, somatic: true, material: "a chip of mica" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "3d8", type: "thunder" }],
  upcastScaling: { perSlotDice: "1d8", appliesTo: "damage" },
  description:
    "A sudden loud ringing noise, painfully intense, erupts from a point of your choice within range. Each creature in a 10-foot-radius sphere centered on that point makes a Constitution saving throw, taking 3d8 thunder damage on a failed save, or half as much on a success. When cast with a slot of 3rd level or higher, the damage increases by 1d8 for each slot level above 2nd.",
};

/** Cone of Cold — a level-5 60-ft cone; Con save-for-half, 8d6 cold. */
const CONE_OF_COLD: SpellDefinition = {
  id: "cone-of-cold",
  name: "Cone of Cold",
  level: 5,
  school: "evocation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "self", area: { shape: "cone", size: 60 } },
  components: { verbal: true, somatic: true, material: "a small crystal or glass cone" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "8d6", type: "cold" }],
  upcastScaling: { perSlotDice: "1d6", appliesTo: "damage" },
  description:
    "A blast of cold air erupts from your hands. Each creature in a 60-foot cone makes a Constitution saving throw, taking 8d6 cold damage on a failed save, or half as much on a success. When cast with a slot of 6th level or higher, the damage increases by 1d6 for each slot level above 5th.",
};

/** Mass Healing Word — a level-3 bonus-action heal of 1d4 + mod to up to six. */
const MASS_HEALING_WORD: SpellDefinition = {
  id: "mass-healing-word",
  name: "Mass Healing Word",
  level: 3,
  school: "abjuration",
  classes: ["Cleric"],
  castingTime: { unit: "bonus", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: false },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "multi",
  healing: { dice: "1d4", addSpellMod: true },
  upcastScaling: { perSlotDice: "1d4", appliesTo: "healing" },
  description:
    "Up to six creatures of your choice that you can see within range each regain hit points equal to 1d4 + your spellcasting ability modifier. When cast with a slot of 4th level or higher, the healing increases by 1d4 for each slot level above 3rd.",
};

/** Prayer of Healing — a level-2 heal of 2d8 + mod to up to six creatures. */
const PRAYER_OF_HEALING: SpellDefinition = {
  id: "prayer-of-healing",
  name: "Prayer of Healing",
  level: 2,
  school: "abjuration",
  classes: ["Cleric"],
  castingTime: { unit: "minute", amount: 10 },
  range: { type: "feet", amount: 30 },
  components: { verbal: true, somatic: false },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "multi",
  healing: { dice: "2d8", addSpellMod: true },
  upcastScaling: { perSlotDice: "1d8", appliesTo: "healing" },
  description:
    "Up to six creatures of your choice that you can see within range each regain hit points equal to 2d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs. When cast with a slot of 3rd level or higher, the healing increases by 1d8 for each slot level above 2nd.",
};

/** Eldritch Blast — warlock cantrip; a ranged spell attack for 1d10 force. */
const ELDRITCH_BLAST: SpellDefinition = {
  id: "eldritch-blast",
  name: "Eldritch Blast",
  level: 0,
  school: "evocation",
  classes: ["Warlock"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "ranged" },
  damage: [{ dice: "1d10", type: "force" }],
  description:
    "A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack. On a hit, the target takes 1d10 force damage.",
};

/** Chromatic Orb — a level-1 ranged spell attack for 3d8 lightning. */
const CHROMATIC_ORB: SpellDefinition = {
  id: "chromatic-orb",
  name: "Chromatic Orb",
  level: 1,
  school: "evocation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 90 },
  components: {
    verbal: true,
    somatic: true,
    material: "a diamond worth at least 50 gp",
  },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "ranged" },
  damage: [{ dice: "3d8", type: "lightning" }],
  upcastScaling: { perSlotDice: "1d8", appliesTo: "damage" },
  description:
    "You hurl a 4-inch-diameter sphere of energy at a creature within range. Make a ranged spell attack. On a hit, the target takes 3d8 damage of a type you choose (lightning is used here).",
};

/** Scorching Ray — three 2d6 fire rays (+1 ray per upcast). */
const SCORCHING_RAY: SpellDefinition = {
  id: "scorching-ray",
  name: "Scorching Ray",
  level: 2,
  school: "evocation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "multi",
  projectiles: { base: 3, perSlotLevel: 1 },
  damage: [{ dice: "2d6", type: "fire" }],
  description:
    "You create three rays of fire and hurl them at targets within range. Each ray requires a separate ranged spell attack, dealing 2d6 fire damage on a hit.",
};

/** Toll the Dead — Wis save or 1d8 necrotic (wounded rider narrated). */
const TOLL_THE_DEAD: SpellDefinition = {
  id: "toll-the-dead",
  name: "Toll the Dead",
  level: 0,
  school: "necromancy",
  classes: ["Cleric", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "1d8", type: "necrotic" }],
  description:
    "The target makes a Wisdom saving throw, taking 1d8 necrotic damage on a failed save (1d12 if wounded — narrated, not yet mechanized).",
};

/** Dissonant Whispers — Wis save or 3d6 psychic. */
const DISSONANT_WHISPERS: SpellDefinition = {
  id: "dissonant-whispers",
  name: "Dissonant Whispers",
  level: 1,
  school: "enchantment",
  classes: ["Bard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: false },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "3d6", type: "psychic" }],
  upcastScaling: { perSlotDice: "1d6", appliesTo: "damage" },
  description:
    "The target makes a Wisdom saving throw, taking 3d6 psychic damage on a failed save (forced movement narrated, not yet mechanized).",
};

/** Ray of Sickness — Con save or 2d8 poison. */
const RAY_OF_SICKNESS: SpellDefinition = {
  id: "ray-of-sickness",
  name: "Ray of Sickness",
  level: 1,
  school: "necromancy",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "2d8", type: "poison" }],
  description:
    "The target makes a Constitution saving throw, taking 2d8 poison damage on a failed save (poisoned condition narrated, not yet mechanized).",
};

/** Melf's Acid Arrow — ranged spell attack for 4d4 acid. */
const MELFS_ACID_ARROW: SpellDefinition = {
  id: "melfs-acid-arrow",
  name: "Melf's Acid Arrow",
  level: 2,
  school: "evocation",
  classes: ["Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 90 },
  components: {
    verbal: true,
    somatic: true,
    material: "powdered rhubarb leaf and an adder's stomach",
  },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "ranged" },
  damage: [{ dice: "4d4", type: "acid" }],
  upcastScaling: { perSlotDice: "2d4", appliesTo: "damage" },
  description:
    "Make a ranged spell attack. On a hit, the target takes 4d4 acid damage immediately (end-of-turn splash narrated, not yet mechanized).",
};

/** Moonbeam — 5-ft sphere, Con save-for-half, 2d10 radiant. */
const MOONBEAM: SpellDefinition = {
  id: "moonbeam",
  name: "Moonbeam",
  level: 2,
  school: "evocation",
  classes: ["Druid"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120, area: { shape: "sphere", size: 5 } },
  components: {
    verbal: true,
    somatic: true,
    material: "several seeds of any moonseed plant and a piece of opalescent feldspar",
  },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "2d10", type: "radiant" }],
  upcastScaling: { perSlotDice: "1d10", appliesTo: "damage" },
  description:
    "Each creature in the cylinder makes a Constitution saving throw, taking 2d10 radiant damage on a failed save, or half as much on a success (ongoing turns narrated, not yet mechanized).",
};

/** Mind Sliver — Int save or 1d6 psychic. */
const MIND_SLIVER: SpellDefinition = {
  id: "mind-sliver",
  name: "Mind Sliver",
  level: 0,
  school: "enchantment",
  classes: ["Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: false },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "int", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "1d6", type: "psychic" }],
  description:
    "The target makes an Intelligence saving throw, taking 1d6 psychic damage on a failed save (save penalty narrated, not yet mechanized).",
};

/** Chaos Bolt — ranged spell attack for 2d8 force (simplified). */
const CHAOS_BOLT: SpellDefinition = {
  id: "chaos-bolt",
  name: "Chaos Bolt",
  level: 1,
  school: "evocation",
  classes: ["Sorcerer"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "ranged" },
  damage: [{ dice: "2d8", type: "force" }],
  upcastScaling: { perSlotDice: "1d6", appliesTo: "damage" },
  description:
    "Make a ranged spell attack. On a hit, the target takes 2d8 force damage (random type + bounce narrated, not yet mechanized).",
};

// ───────────────────────── Batch 4 (ENG-2) ─────────────────────────

/** Thunderclap — 5-ft emanation, Con save or 1d6 thunder. */
const THUNDERCLAP: SpellDefinition = {
  id: "thunderclap",
  name: "Thunderclap",
  level: 0,
  school: "evocation",
  classes: ["Bard", "Druid", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "self", area: { shape: "sphere", size: 5 } },
  components: { verbal: true, somatic: false },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "1d6", type: "thunder" }],
  description:
    "Each creature other than you within 5 feet makes a Constitution saving throw, taking 1d6 thunder damage on a failed save (the caster is excluded narratively; the burst is centered on you).",
};

/** Word of Radiance — Con save or 1d6 radiant to chosen creatures within 5 ft. */
const WORD_OF_RADIANCE: SpellDefinition = {
  id: "word-of-radiance",
  name: "Word of Radiance",
  level: 0,
  school: "evocation",
  classes: ["Cleric"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 5 },
  components: { verbal: true, somatic: true, material: "a holy symbol" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "multi",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "1d6", type: "radiant" }],
  description:
    "Each creature of your choice within 5 feet makes a Constitution saving throw, taking 1d6 radiant damage on a failed save.",
};

/** Lightning Lure — Str save or 1d8 lightning (pull narrated). */
const LIGHTNING_LURE: SpellDefinition = {
  id: "lightning-lure",
  name: "Lightning Lure",
  level: 0,
  school: "evocation",
  classes: ["Artificer", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 15 },
  components: { verbal: true, somatic: false },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "str", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "1d8", type: "lightning" }],
  description:
    "The target makes a Strength saving throw, taking 1d8 lightning damage on a failed save and being pulled up to 10 feet closer (pull narrated, not yet mechanized).",
};

/** Arms of Hadar — 10-ft cone, Str save or 2d6 necrotic. */
const ARMS_OF_HADAR: SpellDefinition = {
  id: "arms-of-hadar",
  name: "Arms of Hadar",
  level: 1,
  school: "conjuration",
  classes: ["Warlock"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "self", area: { shape: "cone", size: 10 } },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "str", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "2d6", type: "necrotic" }],
  upcastScaling: { perSlotDice: "1d6", appliesTo: "damage" },
  description:
    "Each creature in a 10-foot cone makes a Strength saving throw, taking 2d6 necrotic damage on a failed save (can't take reactions rider narrated).",
};

/** Witch Bolt — ranged spell attack for 1d12 lightning (ongoing turns narrated). */
const WITCH_BOLT: SpellDefinition = {
  id: "witch-bolt",
  name: "Witch Bolt",
  level: 1,
  school: "evocation",
  classes: ["Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 30 },
  components: { verbal: true, somatic: true, material: "a twig from a tree struck by lightning" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "ranged" },
  damage: [{ dice: "1d12", type: "lightning" }],
  upcastScaling: { perSlotDice: "1d12", appliesTo: "damage" },
  description:
    "Make a ranged spell attack. On a hit, the target takes 1d12 lightning damage (bonus-action re-zap on later turns narrated, not yet mechanized).",
};

/** Hellish Rebuke — reaction, Dex save or 2d10 fire. */
const HELLISH_REBUKE: SpellDefinition = {
  id: "hellish-rebuke",
  name: "Hellish Rebuke",
  level: 1,
  school: "evocation",
  classes: ["Warlock"],
  castingTime: { unit: "reaction", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "2d10", type: "fire" }],
  upcastScaling: { perSlotDice: "1d10", appliesTo: "damage" },
  description:
    "The attacker makes a Dexterity saving throw, taking 2d10 fire damage on a failed save (reaction trigger narrated, not yet mechanized).",
};

/** Catapult — Str save or 3d8 bludgeoning. */
const CATAPULT: SpellDefinition = {
  id: "catapult",
  name: "Catapult",
  level: 1,
  school: "transmutation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: false, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "str", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "3d8", type: "bludgeoning" }],
  upcastScaling: { perSlotDice: "1d8", appliesTo: "damage" },
  description:
    "The target makes a Strength saving throw, taking 3d8 bludgeoning damage on a failed save (object-flight setup narrated).",
};

/** Snilloc's Snowball Swarm — 5-ft sphere, Dex save or 3d6 cold. */
const SNILLOCS_SNOWBALL_SWARM: SpellDefinition = {
  id: "snillocs-snowball-swarm",
  name: "Snilloc's Snowball Swarm",
  level: 2,
  school: "evocation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 90, area: { shape: "sphere", size: 5 } },
  components: { verbal: true, somatic: true, material: "a piece of ice or a small white rock chip" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "3d6", type: "cold" }],
  upcastScaling: { perSlotDice: "1d6", appliesTo: "damage" },
  description:
    "Each creature in a 5-foot-radius sphere centered on a point within range makes a Dexterity saving throw, taking 3d6 cold damage on a failed save.",
};

/** Mind Spike — Int save or 3d6 psychic. */
const MIND_SPIKE: SpellDefinition = {
  id: "mind-spike",
  name: "Mind Spike",
  level: 2,
  school: "divination",
  classes: ["Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: false, somatic: true },
  duration: { unit: "hour", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "int", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "3d6", type: "psychic" }],
  upcastScaling: { perSlotDice: "1d6", appliesTo: "damage" },
  description:
    "The target makes an Intelligence saving throw, taking 3d6 psychic damage on a failed save (always-know-location rider narrated).",
};

/** Heat Metal — 2d8 fire to a metal-clad target (no save). */
const HEAT_METAL: SpellDefinition = {
  id: "heat-metal",
  name: "Heat Metal",
  level: 2,
  school: "transmutation",
  classes: ["Bard", "Druid"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true, material: "a piece of iron and a flame" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  damage: [{ dice: "2d8", type: "fire" }],
  upcastScaling: { perSlotDice: "1d8", appliesTo: "damage" },
  description:
    "Choose a manufactured metal object; a creature in contact with it takes 2d8 fire damage (ongoing turns + drop-object riders narrated).",
};

/** Maximilian's Earthen Grasp — Str save or 2d6 bludgeoning. */
const MAXIMILIANS_EARTHEN_GRASP: SpellDefinition = {
  id: "maximilians-earthen-grasp",
  name: "Maximilian's Earthen Grasp",
  level: 2,
  school: "transmutation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 30 },
  components: { verbal: true, somatic: true, material: "a miniature hand sculpted from clay" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "str", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "2d6", type: "bludgeoning" }],
  upcastScaling: { perSlotDice: "1d6", appliesTo: "damage" },
  description:
    "The target makes a Strength saving throw, taking 2d6 bludgeoning damage on a failed save and being restrained (restraint + bonus-action crush narrated).",
};

/** Phantasmal Force — Int save or 1d6 psychic (first-turn simplified). */
const PHANTASMAL_FORCE: SpellDefinition = {
  id: "phantasmal-force",
  name: "Phantasmal Force",
  level: 2,
  school: "illusion",
  classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true, material: "a bit of fleece" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "int", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "1d6", type: "psychic" }],
  description:
    "The target makes an Intelligence saving throw, taking 1d6 psychic damage on a failed save (ongoing illusion damage narrated; first-turn only mechanized).",
};

/** Vampiric Touch — melee spell attack for 3d6 necrotic. */
const VAMPIRIC_TOUCH: SpellDefinition = {
  id: "vampiric-touch",
  name: "Vampiric Touch",
  level: 3,
  school: "necromancy",
  classes: ["Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "touch" },
  components: { verbal: true, somatic: true },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "melee" },
  damage: [{ dice: "3d6", type: "necrotic" }],
  upcastScaling: { perSlotDice: "1d6", appliesTo: "damage" },
  description:
    "Make a melee spell attack. On a hit, the target takes 3d6 necrotic damage and you regain hit points equal to half the damage dealt (heal-to-caster narrated, not yet mechanized).",
};

/** Spirit Guardians — 15-ft aura, Wis save-for-half, 3d8 radiant. */
const SPIRIT_GUARDIANS: SpellDefinition = {
  id: "spirit-guardians",
  name: "Spirit Guardians",
  level: 3,
  school: "conjuration",
  classes: ["Cleric"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "self", area: { shape: "emanation", size: 15 } },
  components: {
    verbal: true,
    somatic: true,
    material: "a holy symbol",
  },
  duration: { unit: "minute", amount: 10 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "3d8", type: "radiant" }],
  upcastScaling: { perSlotDice: "1d8", appliesTo: "damage" },
  description:
    "Protective spirits flit around you in a 15-foot Emanation. A creature in the Emanation has its Speed halved and makes a Wisdom saving throw, taking 3d8 radiant damage on a failed save or half as much on a success (once per turn; ongoing turns narrated).",
};

/** Hunger of Hadar — 20-ft sphere, Dex save or 2d6 cold on cast. */
const HUNGER_OF_HADAR: SpellDefinition = {
  id: "hunger-of-hadar",
  name: "Hunger of Hadar",
  level: 3,
  school: "conjuration",
  classes: ["Warlock"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 150, area: { shape: "sphere", size: 20 } },
  components: { verbal: true, somatic: true, material: "a pickled octopus tentacle" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "2d6", type: "cold" }],
  description:
    "Each creature in a 20-foot-radius sphere makes a Dexterity saving throw when the spell is cast, taking 2d6 cold damage on a failed save (blindness + acid on later turns narrated).",
};

// ───────────────────────── Batch 6 (ENG-2) ─────────────────────────

/** Frostbite — Con save or 1d6 cold (cantrip). */
const FROSTBITE: SpellDefinition = {
  id: "frostbite",
  name: "Frostbite",
  level: 0,
  school: "evocation",
  classes: ["Druid", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "1d6", type: "cold" }],
  description:
    "The target makes a Constitution saving throw, taking 1d6 cold damage on a failed save (disadvantage on the next weapon attack narrated).",
};

/** Sapping Sting — Con save or 1d4 necrotic (cantrip). */
const SAPPING_STING: SpellDefinition = {
  id: "sapping-sting",
  name: "Sapping Sting",
  level: 0,
  school: "necromancy",
  classes: ["Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 30 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "1d4", type: "necrotic" }],
  description:
    "The target makes a Constitution saving throw, taking 1d4 necrotic damage on a failed save (prone if Large or smaller narrated).",
};

/** Create Bonfire — 5-ft cube, Dex save or 1d8 fire (concentration cantrip). */
const CREATE_BONFIRE: SpellDefinition = {
  id: "create-bonfire",
  name: "Create Bonfire",
  level: 0,
  school: "conjuration",
  classes: ["Druid", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60, area: { shape: "cube", size: 5 } },
  components: { verbal: true, somatic: true },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "1d8", type: "fire" }],
  description:
    "Creatures in the 5-foot cube when the spell appears make a Dexterity saving throw, taking 1d8 fire damage on a failed save (ongoing damage narrated).",
};

/** Green-Flame Blade — melee spell attack for 1d8 fire. */
const GREEN_FLAME_BLADE: SpellDefinition = {
  id: "green-flame-blade",
  name: "Green-Flame Blade",
  level: 0,
  school: "evocation",
  classes: ["Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "touch" },
  components: { verbal: true, somatic: true, material: "a melee weapon worth at least 1 sp" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "melee" },
  damage: [{ dice: "1d8", type: "fire" }],
  description:
    "Make a melee spell attack. On a hit, the target takes 1d8 fire damage (leaping flame to a second target narrated).",
};

/** Booming Blade — melee spell attack for 1d8 thunder. */
const BOOMING_BLADE: SpellDefinition = {
  id: "booming-blade",
  name: "Booming Blade",
  level: 0,
  school: "evocation",
  classes: ["Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 5 },
  components: { verbal: true, somatic: true, material: "a melee weapon worth at least 1 sp" },
  duration: { unit: "round", amount: 1 },
  concentration: false,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "melee" },
  damage: [{ dice: "1d8", type: "thunder" }],
  description:
    "Make a melee spell attack. On a hit, the target takes 1d8 thunder damage (extra damage if it willingly moves narrated).",
};

/** Thunderwave — 15-ft emanation, Con save or 2d8 thunder. */
const THUNDERWAVE: SpellDefinition = {
  id: "thunderwave",
  name: "Thunderwave",
  level: 1,
  school: "evocation",
  classes: ["Bard", "Druid", "Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "self", area: { shape: "sphere", size: 15 } },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "2d8", type: "thunder" }],
  description:
    "Each creature in a 15-foot cube originating from you makes a Constitution saving throw, taking 2d8 thunder damage on a failed save (push narrated).",
};

/** Ice Knife — ranged spell attack for 1d10 piercing. */
const ICE_KNIFE: SpellDefinition = {
  id: "ice-knife",
  name: "Ice Knife",
  level: 1,
  school: "conjuration",
  classes: ["Druid", "Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true, material: "a drop of water or piece of ice" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "ranged" },
  damage: [{ dice: "1d10", type: "piercing" }],
  upcastScaling: { perSlotDice: "1d6", appliesTo: "damage" },
  description:
    "Make a ranged spell attack. On a hit, the target takes 1d10 piercing damage (Dex-save splash narrated).",
};

/** Shield of Faith — +2 AC on one ally (concentration). */
const SHIELD_OF_FAITH: SpellDefinition = {
  id: "shield-of-faith",
  name: "Shield of Faith",
  level: 1,
  school: "abjuration",
  classes: ["Cleric", "Paladin"],
  castingTime: { unit: "bonus", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true, material: "a small parchment with a bit of holy text" },
  duration: { unit: "minute", amount: 10 },
  concentration: true,
  ritual: false,
  targeting: "single",
  appliedEffects: [
    {
      name: "Shield of Faith",
      scope: "targets",
      modifier: { type: "ac_bonus", amount: 2 },
      concentration: true,
    },
  ],
  description:
    "A shimmering field surrounds a creature, granting a +2 bonus to AC for the duration.",
};

/** Mage Armor — +3 AC on self (8 hours). */
const MAGE_ARMOR: SpellDefinition = {
  id: "mage-armor",
  name: "Mage Armor",
  level: 1,
  school: "abjuration",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "touch" },
  components: { verbal: true, somatic: true, material: "a piece of cured leather" },
  duration: { unit: "hour", amount: 8 },
  concentration: false,
  ritual: false,
  targeting: "single",
  appliedEffects: [
    {
      name: "Mage Armor",
      scope: "targets",
      modifier: { type: "ac_bonus", amount: 3 },
    },
  ],
  description:
    "The target's base AC becomes 13 + its Dexterity modifier (simplified as +3 AC bonus at tracer depth).",
};

/** Barkskin — +2 AC on one ally (concentration; min AC 16 narrated). */
const BARKSKIN: SpellDefinition = {
  id: "barkskin",
  name: "Barkskin",
  level: 2,
  school: "transmutation",
  classes: ["Druid", "Ranger"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "touch" },
  components: { verbal: true, somatic: true, material: "a handful of oak bark" },
  duration: { unit: "hour", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  appliedEffects: [
    {
      name: "Barkskin",
      scope: "targets",
      modifier: { type: "ac_bonus", amount: 2 },
      concentration: true,
    },
  ],
  description:
    "The target's skin becomes bark-like; its AC can't be less than 16 (simplified as +2 AC at tracer depth).",
};

/** Goodberry — up to six creatures regain 1 HP each. */
const GOODBERRY: SpellDefinition = {
  id: "goodberry",
  name: "Goodberry",
  level: 1,
  school: "transmutation",
  classes: ["Druid", "Ranger"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 30 },
  components: { verbal: true, somatic: true, material: "a sprig of mistletoe" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "multi",
  healing: { dice: "1d1", addSpellMod: false },
  description:
    "Up to six creatures regain 1 hit point each (berries as rations narrated).",
};

// ───────────────────────── Batch 5 (ENG-13 proof spells) ─────────────────

/** Bless — up to three allies gain +1d4 on attack rolls (concentration). */
const BLESS: SpellDefinition = {
  id: "bless",
  name: "Bless",
  level: 1,
  school: "enchantment",
  classes: ["Cleric", "Paladin"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 30 },
  components: { verbal: true, somatic: true, material: "a sprinkling of holy water" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "multi",
  appliedEffects: [
    {
      name: "Blessed",
      scope: "targets",
      modifier: { type: "attack_roll_bonus", dice: "1d4" },
      concentration: true,
    },
  ],
  description:
    "Up to three creatures of your choice gain a +1d4 bonus to attack rolls for the duration.",
};

/** Shield — reaction; +5 AC until the start of your next turn. */
const SHIELD: SpellDefinition = {
  id: "shield",
  name: "Shield",
  level: 1,
  school: "abjuration",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "reaction", amount: 1 },
  range: { type: "self" },
  components: { verbal: true, somatic: true },
  duration: { unit: "round", amount: 1 },
  concentration: false,
  ritual: false,
  targeting: "self",
  appliedEffects: [
    {
      name: "Shield",
      scope: "caster",
      modifier: { type: "ac_bonus", amount: 5 },
      expiresStartOfNextTurn: true,
    },
  ],
  description:
    "An invisible barrier grants you a +5 bonus to AC until the start of your next turn (including against the triggering attack narratively).",
};

/** Hunter's Mark — mark a foe; weapon hits from you deal +1d6 force. */
const HUNTERS_MARK: SpellDefinition = {
  id: "hunters-mark",
  name: "Hunter's Mark",
  level: 1,
  school: "divination",
  classes: ["Ranger"],
  castingTime: { unit: "bonus", amount: 1 },
  range: { type: "feet", amount: 90 },
  components: { verbal: true, somatic: false },
  duration: { unit: "hour", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  appliedEffects: [
    {
      name: "Hunter's Mark",
      scope: "targets",
      modifier: { type: "hunters_mark", dice: "1d6" },
      concentration: true,
    },
  ],
  description:
    "The target is mystically marked; you deal an extra 1d6 force damage to it whenever you hit it with a weapon attack.",
};

// ───────────────────────── Batch 7 (ENG-2 / ENG-13) ─────────────────────

const HEX: SpellDefinition = {
  id: "hex",
  name: "Hex",
  level: 1,
  school: "enchantment",
  classes: ["Warlock"],
  castingTime: { unit: "bonus", amount: 1 },
  range: { type: "feet", amount: 90 },
  components: { verbal: true, somatic: true, material: "the petrified eye of a newt" },
  duration: { unit: "hour", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  appliedEffects: [
    {
      name: "Hex",
      scope: "targets",
      modifier: { type: "hunters_mark", dice: "1d6" },
      concentration: true,
    },
  ],
  description:
    "The target is cursed; you deal an extra 1d6 necrotic damage when you hit it with an attack.",
};

const BANE: SpellDefinition = {
  id: "bane",
  name: "Bane",
  level: 1,
  school: "enchantment",
  classes: ["Bard", "Cleric"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 30 },
  components: { verbal: true, somatic: true, material: "a drop of blood" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "multi",
  saveAgainst: { ability: "cha", dc: "spellsave", onSuccess: "no_effect" },
  appliedEffects: [
    {
      name: "Baned",
      scope: "targets",
      modifier: { type: "attack_roll_penalty", dice: "1d4" },
      concentration: true,
    },
  ],
  description:
    "Up to three creatures make a Charisma save or subtract 1d4 from attack rolls for the duration.",
};

const FAERIE_FIRE: SpellDefinition = {
  id: "faerie-fire",
  name: "Faerie Fire",
  level: 1,
  school: "evocation",
  classes: ["Bard", "Druid"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60, area: { shape: "cube", size: 20 } },
  components: { verbal: true, somatic: false },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "no_effect" },
  appliedEffects: [
    {
      name: "Faerie Fire",
      scope: "targets",
      modifier: { type: "attacks_against_advantage" },
      concentration: true,
    },
  ],
  description:
    "Creatures in a 20-foot cube make a Dexterity save or shed light; attack rolls against them have advantage.",
};

const BLUR: SpellDefinition = {
  id: "blur",
  name: "Blur",
  level: 2,
  school: "illusion",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "self" },
  components: { verbal: true, somatic: false },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "self",
  appliedEffects: [
    {
      name: "Blur",
      scope: "caster",
      modifier: { type: "attacks_against_disadvantage" },
      concentration: true,
    },
  ],
  description:
    "Your form shifts; attacks against you have disadvantage for the duration.",
};

const AID: SpellDefinition = {
  id: "aid",
  name: "Aid",
  level: 2,
  school: "abjuration",
  classes: ["Bard", "Cleric", "Druid", "Paladin", "Ranger"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 30 },
  components: { verbal: true, somatic: true, material: "a tiny strip of white cloth" },
  duration: { unit: "hour", amount: 8 },
  concentration: false,
  ritual: false,
  targeting: "multi",
  healing: { dice: "1d1+4" },
  description:
    "Up to three creatures each gain 5 current and maximum hit points for 8 hours (tracer: flat 5 HP heal).",
};

const FALSE_LIFE: SpellDefinition = {
  id: "false-life",
  name: "False Life",
  level: 1,
  school: "necromancy",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "self" },
  components: { verbal: true, somatic: true, material: "a small amount of alcohol or distilled spirits" },
  duration: { unit: "hour", amount: 1 },
  concentration: false,
  ritual: false,
  targeting: "self",
  healing: { dice: "1d4+4" },
  description: "You gain 1d4 + 4 temporary hit points for 1 hour (tracer: heals current HP).",
};

const COLOR_SPRAY: SpellDefinition = {
  id: "color-spray",
  name: "Color Spray",
  level: 1,
  school: "illusion",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "self", area: { shape: "cone", size: 15 } },
  components: { verbal: true, somatic: true, material: "a pinch of powder or sand" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "3d6", type: "psychic" }],
  description:
    "Each creature in a 15-foot cone makes a Constitution save or takes 3d6 psychic damage.",
};

const GREASE: SpellDefinition = {
  id: "grease",
  name: "Grease",
  level: 1,
  school: "conjuration",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60, area: { shape: "sphere", size: 10 } },
  components: { verbal: true, somatic: true, material: "a bit of pork rind or butter" },
  duration: { unit: "minute", amount: 1 },
  concentration: false,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "1d4", type: "bludgeoning" }],
  description:
    "Creatures in a 10-foot square make a Dexterity save or fall prone (tracer: 1d4 bludgeoning on fail).",
};

const CLOUD_OF_DAGGERS: SpellDefinition = {
  id: "cloud-of-daggers",
  name: "Cloud of Daggers",
  level: 2,
  school: "conjuration",
  classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60, area: { shape: "sphere", size: 5 } },
  components: { verbal: true, somatic: true, material: "a sliver of glass" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "4d4", type: "slashing" }],
  description:
    "Each creature in a 5-foot cube makes a Dexterity save, taking 4d4 slashing on a failure or half on a success.",
};

const MAGIC_WEAPON: SpellDefinition = {
  id: "magic-weapon",
  name: "Magic Weapon",
  level: 2,
  school: "transmutation",
  classes: ["Paladin", "Ranger", "Sorcerer", "Wizard"],
  castingTime: { unit: "bonus", amount: 1 },
  range: { type: "touch" },
  components: { verbal: true, somatic: true },
  duration: { unit: "hour", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  appliedEffects: [
    {
      name: "Magic Weapon",
      scope: "targets",
      modifier: { type: "attack_roll_bonus", dice: "1d1" },
      concentration: true,
    },
  ],
  description:
    "One nonmagical weapon becomes +1 (tracer: +1 flat to attack rolls via a fixed bonus).",
};

const RAY_OF_ENFEEBLEMENT: SpellDefinition = {
  id: "ray-of-enfeeblement",
  name: "Ray of Enfeeblement",
  level: 2,
  school: "necromancy",
  classes: ["Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "ranged" },
  damage: [{ dice: "2d8", type: "necrotic" }],
  description:
    "Ranged spell attack for 2d8 necrotic; on a hit the target's attacks deal half damage (tracer: damage only).",
};

/** Lightning Bolt — 100-ft line; Dex save half 8d6 lightning. */
const LIGHTNING_BOLT: SpellDefinition = {
  id: "lightning-bolt",
  name: "Lightning Bolt",
  level: 3,
  school: "evocation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120, area: { shape: "line", size: 100 } },
  components: { verbal: true, somatic: true, material: "a bit of fur and a rod of amber, crystal, or glass" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "8d6", type: "lightning" }],
  upcastScaling: { perSlotDice: "1d6", appliesTo: "damage" },
  description:
    "A stroke of lightning forming a line 100 feet long and 5 feet wide. Each creature in the area makes a Dexterity save, taking 8d6 lightning on a failure or half on a success.",
};

const INVISIBILITY: SpellDefinition = {
  id: "invisibility",
  name: "Invisibility",
  level: 2,
  school: "illusion",
  classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "touch" },
  components: { verbal: true, somatic: true, material: "an eyelash encased in gum arabic" },
  duration: { unit: "hour", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  appliedCondition: "invisible",
  description:
    "A creature you touch becomes invisible until the spell ends. Anything it wears or carries is invisible as long as it stays on the target.",
};

const HOLD_PERSON: SpellDefinition = {
  id: "hold-person",
  name: "Hold Person",
  level: 2,
  school: "enchantment",
  classes: ["Bard", "Cleric", "Druid", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true, material: "a small, straight piece of iron" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "paralyzed",
  description:
    "Choose a humanoid you can see. The target must succeed on a Wisdom saving throw or be paralyzed for the duration.",
};

const WEB: SpellDefinition = {
  id: "web",
  name: "Web",
  level: 2,
  school: "conjuration",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60, area: { shape: "sphere", size: 20 } },
  components: { verbal: true, somatic: true, material: "a bit of spiderweb" },
  duration: { unit: "hour", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "restrained",
  description:
    "Thick, sticky webs fill a 20-foot cube. Each creature that starts its turn in the webs or enters them must succeed on a Dexterity saving throw or become restrained.",
};

const ENTANGLE: SpellDefinition = {
  id: "entangle",
  name: "Entangle",
  level: 1,
  school: "conjuration",
  classes: ["Druid", "Ranger"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 90, area: { shape: "sphere", size: 20 } },
  components: { verbal: true, somatic: true },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "str", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "restrained",
  description:
    "Grasping weeds sprout in a 20-foot square. A creature in the area must succeed on a Strength saving throw or be restrained.",
};

const FLAME_STRIKE: SpellDefinition = {
  id: "flame-strike",
  name: "Flame Strike",
  level: 5,
  school: "evocation",
  classes: ["Cleric"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60, area: { shape: "cylinder", size: 10 } },
  components: { verbal: true, somatic: true, material: "pinch of sulfur" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "half_damage" },
  damage: [
    { dice: "5d6", type: "fire" },
    { dice: "5d6", type: "radiant" },
  ],
  description:
    "A vertical column of divine flame roars down in a 10-foot-radius, 40-foot-high cylinder. Each creature in the area makes a Dexterity save, taking 5d6 fire damage plus 5d6 radiant damage on a failure or half as much on a success.",
};

const PHANTASMAL_KILLER: SpellDefinition = {
  id: "phantasmal-killer",
  name: "Phantasmal Killer",
  level: 4,
  school: "illusion",
  classes: ["Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120 },
  components: { verbal: true, somatic: true },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "4d10", type: "psychic" }],
  description:
    "You tap into a creature's nightmares. The target makes a Wisdom saving throw, taking 4d10 psychic damage on a failure (ongoing fright save each turn narrated).",
};

const STINKING_CLOUD: SpellDefinition = {
  id: "stinking-cloud",
  name: "Stinking Cloud",
  level: 3,
  school: "conjuration",
  classes: ["Bard", "Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 90, area: { shape: "sphere", size: 20 } },
  components: { verbal: true, somatic: true, material: "a rotten egg or several skunk cabbage leaves" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "poisoned",
  description:
    "You create a 20-foot-radius sphere of yellow, nauseating gas. Each creature in the area must succeed on a Constitution saving throw or spend its action retching (tracer: poisoned on a failed save).",
};

const HASTE: SpellDefinition = {
  id: "haste",
  name: "Haste",
  level: 3,
  school: "transmutation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 30 },
  components: { verbal: true, somatic: true, material: "a shaving of licorice root" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  appliedEffects: [
    {
      name: "Haste",
      scope: "targets",
      modifier: { type: "ac_bonus", amount: 2 },
      concentration: true,
    },
    {
      name: "Haste",
      scope: "targets",
      modifier: { type: "speed_bonus", amount: 30 },
      concentration: true,
    },
  ],
  description:
    "Choose a willing creature. Until the spell ends, its speed is doubled (+30 ft at tracer depth), it gains +2 AC, it has advantage on Dexterity saving throws, and it gains an additional action (tracer: +2 AC and +30 speed).",
};

const HYPNOTIC_PATTERN: SpellDefinition = {
  id: "hypnotic-pattern",
  name: "Hypnotic Pattern",
  level: 3,
  school: "illusion",
  classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120, area: { shape: "sphere", size: 30 } },
  components: { verbal: false, somatic: true, material: "a glowing stick of incense or a crystal vial filled with phosphorescent material" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "charmed",
  description:
    "You create a twisting pattern of colors in a 30-foot cube. Each creature in the area who sees the pattern must succeed on a Wisdom saving throw or become charmed for the duration.",
};

/** Spiritual Weapon — bonus-action ranged spell attack for 1d8+mod force (+1d8/upcast). */
const SPIRITUAL_WEAPON: SpellDefinition = {
  id: "spiritual-weapon",
  name: "Spiritual Weapon",
  level: 2,
  school: "evocation",
  classes: ["Cleric"],
  castingTime: { unit: "bonus", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true },
  duration: { unit: "minute", amount: 1 },
  concentration: false,
  ritual: false,
  targeting: "single",
  attackAgainst: { type: "ranged" },
  damage: [{ dice: "1d8+4", type: "force" }],
  upcastScaling: { perSlotDice: "1d8", appliesTo: "damage" },
  description:
    "You create a floating, spectral weapon that attacks once as a bonus action on subsequent turns (tracer: one immediate ranged spell attack for 1d8 + spellcasting modifier force damage).",
};

const MIRROR_IMAGE: SpellDefinition = {
  id: "mirror-image",
  name: "Mirror Image",
  level: 2,
  school: "illusion",
  classes: ["Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "self" },
  components: { verbal: true, somatic: true },
  duration: { unit: "minute", amount: 1 },
  concentration: false,
  ritual: false,
  targeting: "self",
  appliedEffects: [
    {
      name: "Mirror Image",
      scope: "caster",
      modifier: { type: "attacks_against_disadvantage" },
    },
  ],
  description:
    "Three illusory duplicates appear; attack rolls against you have disadvantage while any duplicate remains (tracer: Blur-style disadvantage).",
};

const CHARM_PERSON: SpellDefinition = {
  id: "charm-person",
  name: "Charm Person",
  level: 1,
  school: "enchantment",
  classes: ["Bard", "Druid", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 30 },
  components: { verbal: true, somatic: true },
  duration: { unit: "hour", amount: 1 },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "charmed",
  description:
    "You attempt to charm a humanoid you can see. It must succeed on a Wisdom saving throw or be charmed by you for the duration.",
};

const BLINDNESS_DEAFNESS: SpellDefinition = {
  id: "blindness-deafness",
  name: "Blindness/Deafness",
  level: 2,
  school: "necromancy",
  classes: ["Bard", "Cleric", "Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 30 },
  components: { verbal: true, somatic: false },
  duration: { unit: "minute", amount: 1 },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "blinded",
  description:
    "One creature you can see must succeed on a Constitution saving throw or become blinded for the duration (deafness rider narrated).",
};

const CALL_LIGHTNING: SpellDefinition = {
  id: "call-lightning",
  name: "Call Lightning",
  level: 3,
  school: "conjuration",
  classes: ["Druid"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120, area: { shape: "sphere", size: 10 } },
  components: { verbal: true, somatic: true },
  duration: { unit: "minute", amount: 10 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "3d10", type: "lightning" }],
  description:
    "A storm cloud appears; the first bolt strikes a point you choose (tracer: 10-ft sphere, Dex save half 3d10 lightning). Subsequent bolts on later turns are narrated.",
};

const BLIGHT: SpellDefinition = {
  id: "blight",
  name: "Blight",
  level: 4,
  school: "necromancy",
  classes: ["Druid", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 30 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "8d8", type: "necrotic" }],
  description:
    "Necromantic energy withers a creature you can see. The target makes a Constitution saving throw, taking 8d8 necrotic damage on a failure or half as much on a success.",
};

const REVIVIFY: SpellDefinition = {
  id: "revivify",
  name: "Revivify",
  level: 3,
  school: "necromancy",
  classes: ["Cleric", "Druid", "Paladin", "Ranger"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "touch" },
  components: { verbal: true, somatic: true, material: "diamonds worth 300 gp" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  healing: { dice: "1d1+1" },
  description:
    "You touch a creature that died within the last minute and return it to life with 1 hit point (tracer: flat 2 HP heal on a living wounded ally).",
};

const TASHAS_HIDEOUS_LAUGHTER: SpellDefinition = {
  id: "tashas-hideous-laughter",
  name: "Tasha's Hideous Laughter",
  level: 1,
  school: "enchantment",
  classes: ["Bard", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 30 },
  components: { verbal: true, somatic: true, material: "tiny tarts and a feather" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "incapacitated",
  description:
    "A creature of your choice must succeed on a Wisdom saving throw or fall prone, becoming incapacitated and unable to stand (tracer: incapacitated on failed save).",
};

const COMMAND: SpellDefinition = {
  id: "command",
  name: "Command",
  level: 1,
  school: "enchantment",
  classes: ["Cleric", "Paladin"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: false },
  duration: { unit: "round", amount: 1 },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "prone",
  description:
    "You speak a one-word command to a creature you can see. On a failed Wisdom save it obeys (tracer: prone for one-word commands like 'Grovel').",
};

const GREATER_INVISIBILITY: SpellDefinition = {
  id: "greater-invisibility",
  name: "Greater Invisibility",
  level: 4,
  school: "illusion",
  classes: ["Bard", "Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "touch" },
  components: { verbal: true, somatic: true, material: "an eyelash encased in gum arabic" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  appliedCondition: "invisible",
  description:
    "A creature you touch becomes invisible until the spell ends. Anything it wears or carries is invisible as long as it stays on the target.",
};

const MASS_CURE_WOUNDS: SpellDefinition = {
  id: "mass-cure-wounds",
  name: "Mass Cure Wounds",
  level: 5,
  school: "evocation",
  classes: ["Cleric", "Druid"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "multi",
  healing: { dice: "3d8", addSpellMod: true },
  upcastScaling: { perSlotDice: "1d8", appliesTo: "healing" },
  description:
    "Up to six creatures of your choice in range each regain 3d8 + your spellcasting modifier hit points. When cast with a slot of 6th level or higher, the healing increases by 1d8 for each slot level above 5th.",
};

// ───────────────────────── Batch 10 (ENG-2) ─────────────────────────

const HOLD_MONSTER: SpellDefinition = {
  id: "hold-monster",
  name: "Hold Monster",
  level: 5,
  school: "enchantment",
  classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 90 },
  components: { verbal: true, somatic: true, material: "a small, straight piece of iron" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "paralyzed",
  description:
    "Choose a creature you can see. The target must succeed on a Wisdom saving throw or be paralyzed for the duration.",
};

const DOMINATE_PERSON: SpellDefinition = {
  id: "dominate-person",
  name: "Dominate Person",
  level: 5,
  school: "enchantment",
  classes: ["Bard", "Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "charmed",
  description:
    "You attempt to beguile a humanoid you can see. It must succeed on a Wisdom saving throw or be charmed by you for the duration.",
};

const FEAR: SpellDefinition = {
  id: "fear",
  name: "Fear",
  level: 3,
  school: "illusion",
  classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "self", area: { shape: "cone", size: 30 } },
  components: { verbal: true, somatic: true, material: "a white feather or the heart of a hen" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "frightened",
  description:
    "Each creature in a 30-foot cone must succeed on a Wisdom saving throw or drop what it is holding and become frightened for the duration.",
};

const SUGGESTION: SpellDefinition = {
  id: "suggestion",
  name: "Suggestion",
  level: 2,
  school: "enchantment",
  classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 30 },
  components: { verbal: true, somatic: false, material: "a snake's tongue and either a bit of honeycomb or a drop of sweet oil" },
  duration: { unit: "hour", amount: 8 },
  concentration: true,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "charmed",
  description:
    "You suggest a course of activity to a creature you can see. It must succeed on a Wisdom saving throw or be charmed for the duration and pursue the suggested activity.",
};

const WALL_OF_FIRE: SpellDefinition = {
  id: "wall-of-fire",
  name: "Wall of Fire",
  level: 4,
  school: "evocation",
  classes: ["Druid", "Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120, area: { shape: "sphere", size: 20 } },
  components: { verbal: true, somatic: true, material: "a small piece of phosphorus" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "5d8", type: "fire" }],
  description:
    "You create a wall of fire on a solid surface (tracer: 20-ft burst at a point). Each creature in the area when the wall appears makes a Dexterity save, taking 5d8 fire damage on a failure or half on a success.",
};

const CHAIN_LIGHTNING: SpellDefinition = {
  id: "chain-lightning",
  name: "Chain Lightning",
  level: 6,
  school: "evocation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 150 },
  components: { verbal: true, somatic: true, material: "a bit of fur; a piece of amber, glass, or a crystal rod; and three silver pins" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "10d8", type: "lightning" }],
  description:
    "A bolt of lightning leaps toward a target you can see. The target makes a Dexterity saving throw, taking 10d8 lightning damage on a failure or half on a success (arcs to three more targets narrated).",
};

const OTTOS_IRRESISTIBLE_DANCE: SpellDefinition = {
  id: "ottos-irresistible-dance",
  name: "Otto's Irresistible Dance",
  level: 6,
  school: "enchantment",
  classes: ["Bard", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 30 },
  components: { verbal: true, somatic: true },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "incapacitated",
  description:
    "Choose one creature you can see. The target must succeed on a Wisdom saving throw or begin a comic dance, becoming incapacitated and unable to move voluntarily for the duration.",
};

const POWER_WORD_STUN: SpellDefinition = {
  id: "power-word-stun",
  name: "Power Word Stun",
  level: 8,
  school: "enchantment",
  classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: false },
  duration: { unit: "minute", amount: 1 },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "stunned",
  description:
    "You speak a word of power that can overwhelm a creature. If the target has 150 hit points or fewer it is stunned (tracer: Constitution save or stunned for creatures above that threshold narrated).",
};

const SLEEP: SpellDefinition = {
  id: "sleep",
  name: "Sleep",
  level: 1,
  school: "enchantment",
  classes: ["Bard", "Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60, area: { shape: "sphere", size: 5 } },
  components: { verbal: true, somatic: true, material: "a pinch of fine sand, rose petals, or a cricket" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "unconscious",
  description:
    "Each creature of your choice in a 5-foot-radius Sphere makes a Wisdom saving throw or has the Incapacitated condition until the end of its next turn, repeating the save then; a second failure leaves it Unconscious for the duration (tracer: Wisdom save or Unconscious in the area).",
};

const GREATER_RESTORATION: SpellDefinition = {
  id: "greater-restoration",
  name: "Greater Restoration",
  level: 5,
  school: "abjuration",
  classes: ["Bard", "Cleric", "Druid"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "touch" },
  components: { verbal: true, somatic: true, material: "diamond dust worth at least 100 gp" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  healing: { dice: "4d4", addSpellMod: true },
  description:
    "You imbue a creature you touch with positive energy to end one debilitating effect and restore vitality (tracer: 4d4 + spellcasting modifier HP restored).",
};

const CROWN_OF_MADNESS: SpellDefinition = {
  id: "crown-of-madness",
  name: "Crown of Madness",
  level: 2,
  school: "enchantment",
  classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120 },
  components: { verbal: true, somatic: true },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "charmed",
  description:
    "One humanoid you can see must succeed on a Wisdom saving throw or be charmed for the duration and must use its action before moving on each turn to make a melee attack against a creature other than itself that you mentally choose.",
};

// ───────────────────────── Batch 11 (ENG-2) — top-120 complete ─────────

const BANISHMENT: SpellDefinition = {
  id: "banishment",
  name: "Banishment",
  level: 4,
  school: "abjuration",
  classes: ["Cleric", "Paladin", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true, material: "an item distasteful to the target" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "cha", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "incapacitated",
  description:
    "You attempt to send one creature you can see to another plane of existence. On a failed Charisma save the target is incapacitated (tracer: removed from play narrated).",
};

const SLOW: SpellDefinition = {
  id: "slow",
  name: "Slow",
  level: 3,
  school: "transmutation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120, area: { shape: "sphere", size: 40 } },
  components: { verbal: true, somatic: true, material: "a drop of molasses" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "poisoned",
  description:
    "Up to six creatures in a 40-foot cube must succeed on a Wisdom saving throw or have speed halved and −2 AC (tracer: poisoned on a failed save).",
};

const DARKNESS: SpellDefinition = {
  id: "darkness",
  name: "Darkness",
  level: 2,
  school: "evocation",
  classes: ["Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60, area: { shape: "sphere", size: 15 } },
  components: { verbal: true, somatic: false, material: "bat fur and a drop of pitch or piece of coal" },
  duration: { unit: "minute", amount: 10 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "blinded",
  description:
    "Magical darkness spreads from a point (tracer: creatures in the 15-foot sphere fail a Wisdom save or become blinded until they leave the darkness).",
};

const SILENCE: SpellDefinition = {
  id: "silence",
  name: "Silence",
  level: 2,
  school: "illusion",
  classes: ["Bard", "Cleric", "Ranger"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120, area: { shape: "sphere", size: 20 } },
  components: { verbal: true, somatic: true },
  duration: { unit: "minute", amount: 10 },
  concentration: true,
  ritual: true,
  targeting: "area",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "deafened",
  description:
    "For the duration, no sound can be created within or pass through a 20-foot-radius sphere (tracer: Constitution save or deafened).",
};

const LESSER_RESTORATION: SpellDefinition = {
  id: "lesser-restoration",
  name: "Lesser Restoration",
  level: 2,
  school: "abjuration",
  classes: ["Bard", "Cleric", "Druid", "Paladin", "Ranger"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "touch" },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  healing: { dice: "2d4", addSpellMod: true },
  description:
    "You touch a creature and end one disease or condition afflicting it (tracer: 2d4 + spellcasting modifier HP restored).",
};

const COMPULSION: SpellDefinition = {
  id: "compulsion",
  name: "Compulsion",
  level: 4,
  school: "enchantment",
  classes: ["Bard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 30 },
  components: { verbal: true, somatic: true },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "charmed",
  description:
    "Creatures of your choice that you can see must succeed on a Wisdom saving throw or be charmed until the spell ends (tracer: single target).",
};

const HEROISM: SpellDefinition = {
  id: "heroism",
  name: "Heroism",
  level: 1,
  school: "enchantment",
  classes: ["Bard", "Paladin"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "touch" },
  components: { verbal: true, somatic: true },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  appliedEffects: [
    {
      name: "Heroism",
      scope: "targets",
      modifier: { type: "attack_roll_bonus", dice: "1d4" },
      concentration: true,
    },
  ],
  description:
    "A willing creature you touch is imbued with bravery: it can't be frightened and makes attack rolls with a +1d4 bonus (tracer: attack bonus only).",
};

const ICE_STORM: SpellDefinition = {
  id: "ice-storm",
  name: "Ice Storm",
  level: 4,
  school: "evocation",
  classes: ["Druid", "Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 300, area: { shape: "sphere", size: 20 } },
  components: { verbal: true, somatic: true, material: "a pinch of dust and a few drops of water" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "half_damage" },
  damage: [
    { dice: "2d8", type: "bludgeoning" },
    { dice: "4d6", type: "cold" },
  ],
  description:
    "Hail falls in a 20-foot-radius, 40-foot-high cylinder. Each creature in the area makes a Dexterity save, taking 2d8 bludgeoning + 4d6 cold on a failure or half on a success.",
};

const SUNBURST: SpellDefinition = {
  id: "sunburst",
  name: "Sunburst",
  level: 8,
  school: "evocation",
  classes: ["Cleric", "Druid", "Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 150, area: { shape: "sphere", size: 60 } },
  components: { verbal: true, somatic: true, material: "fire and a piece of sunstone" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "12d6", type: "radiant" }],
  failedSaveCondition: "blinded",
  description:
    "Brilliant sunlight flashes in a 60-foot radius. Each creature in the area makes a Constitution save, taking 12d6 radiant on a failure or half on a success, and is blinded on a failure.",
};

const METEOR_SWARM: SpellDefinition = {
  id: "meteor-swarm",
  name: "Meteor Swarm",
  level: 9,
  school: "evocation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 5280, area: { shape: "sphere", size: 40 } },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "20d6", type: "fire" }],
  description:
    "Blazing orbs plummet to the ground at four points you can see (tracer: 40-ft burst, Dex save half 20d6 fire; bludgeoning splash narrated).",
};

const DOMINATE_MONSTER: SpellDefinition = {
  id: "dominate-monster",
  name: "Dominate Monster",
  level: 8,
  school: "enchantment",
  classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true },
  duration: { unit: "hour", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "charmed",
  description:
    "You attempt to beguile a creature you can see. It must succeed on a Wisdom saving throw or be charmed by you for the duration.",
};

const MASS_SUGGESTION: SpellDefinition = {
  id: "mass-suggestion",
  name: "Mass Suggestion",
  level: 6,
  school: "enchantment",
  classes: ["Bard", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true, material: "a snake's tongue and either a bit of honeycomb or a drop of sweet oil" },
  duration: { unit: "hour", amount: 24 },
  concentration: true,
  ritual: false,
  targeting: "multi",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  failedSaveCondition: "charmed",
  description:
    "Up to twelve creatures of your choice that you can see must succeed on a Wisdom saving throw or be charmed for the duration (tracer: up to three targets).",
};

const CLOUDKILL: SpellDefinition = {
  id: "cloudkill",
  name: "Cloudkill",
  level: 5,
  school: "conjuration",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120, area: { shape: "sphere", size: 20 } },
  components: { verbal: true, somatic: true },
  duration: { unit: "minute", amount: 10 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "no_effect" },
  damage: [{ dice: "5d8", type: "poison" }],
  description:
    "A poisonous yellow fog fills a 20-foot-radius sphere. Each creature in the area when the spell is cast makes a Constitution save, taking 5d8 poison damage on a failure.",
};

const INSECT_PLAGUE: SpellDefinition = {
  id: "insect-plague",
  name: "Insect Plague",
  level: 5,
  school: "conjuration",
  classes: ["Cleric", "Druid", "Sorcerer"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 300, area: { shape: "sphere", size: 20 } },
  components: { verbal: true, somatic: true, material: "a few grains of sugar, some kernels of grain, and a smear of fat" },
  duration: { unit: "minute", amount: 10 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "4d10", type: "piercing" }],
  description:
    "Swarming, biting locusts fill a 20-foot-radius sphere. Each creature in the area makes a Dexterity save, taking 4d10 piercing damage on a failure or half on a success.",
};

const FINGER_OF_DEATH: SpellDefinition = {
  id: "finger-of-death",
  name: "Finger of Death",
  level: 7,
  school: "necromancy",
  classes: ["Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "7d8+30", type: "necrotic" }],
  description:
    "You send negative energy coursing through a creature you can see. The target makes a Constitution saving throw, taking 7d8 + 30 necrotic damage on a failure or half as much on a success.",
};

const POWER_WORD_HEAL: SpellDefinition = {
  id: "power-word-heal",
  name: "Power Word Heal",
  level: 9,
  school: "evocation",
  classes: ["Bard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: false },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  healing: { dice: "4d4", addSpellMod: true },
  description:
    "A wave of healing energy washes over a creature you can see, restoring all its hit points (tracer: 4d4 + spellcasting modifier HP restored).",
};

const SUNBEAM: SpellDefinition = {
  id: "sunbeam",
  name: "Sunbeam",
  level: 6,
  school: "evocation",
  classes: ["Druid", "Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "self", area: { shape: "line", size: 60 } },
  components: { verbal: true, somatic: true, material: "a magnifying glass" },
  duration: { unit: "minute", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "con", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "6d8", type: "radiant" }],
  failedSaveCondition: "blinded",
  description:
    "A beam of brilliant light shines in a 60-foot line. Each creature in the area makes a Constitution save, taking 6d8 radiant on a failure or half on a success, and is blinded on a failure.",
};

const MISTY_STEP: SpellDefinition = {
  id: "misty-step",
  name: "Misty Step",
  level: 2,
  school: "conjuration",
  classes: ["Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "bonus", amount: 1 },
  range: { type: "self" },
  components: { verbal: true, somatic: false },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "self",
  description:
    "Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space you can see.",
};

const DISPEL_MAGIC: SpellDefinition = {
  id: "dispel-magic",
  name: "Dispel Magic",
  level: 3,
  school: "abjuration",
  classes: ["Bard", "Cleric", "Druid", "Paladin", "Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  description:
    "Choose one creature, object, or magical effect within range. Any ongoing spell of level 3 or lower on the target ends.",
};

const COUNTERSPELL: SpellDefinition = {
  id: "counterspell",
  name: "Counterspell",
  level: 3,
  school: "abjuration",
  classes: ["Sorcerer", "Warlock", "Wizard"],
  castingTime: { unit: "reaction", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: false, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  description:
    "You interrupt a creature in the process of casting a spell. If the spell is 3rd level or lower, it fails (tracer: reaction slot spent).",
};

const POLYMORPH: SpellDefinition = {
  id: "polymorph",
  name: "Polymorph",
  level: 4,
  school: "transmutation",
  classes: ["Bard", "Druid", "Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 60 },
  components: { verbal: true, somatic: true, material: "a caterpillar cocoon" },
  duration: { unit: "hour", amount: 1 },
  concentration: true,
  ritual: false,
  targeting: "single",
  description:
    "Transform a willing creature or one that fails a Wisdom save into a new form (tracer: restrained until concentration ends).",
};

const REMOVE_CURSE: SpellDefinition = {
  id: "srd-2024_remove-curse",
  name: "Remove Curse",
  level: 3,
  school: "abjuration",
  classes: ["Cleric", "Paladin", "Warlock", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "touch", amount: 0 },
  components: { verbal: true, somatic: true },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  description:
    "At your touch, all curses affecting one creature or object end (tracer: clears active curses on target).",
};

const BESTOW_CURSE: SpellDefinition = {
  id: "srd-2024_bestow-curse",
  name: "Bestow Curse",
  level: 3,
  school: "necromancy",
  classes: ["Bard", "Cleric", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "touch", amount: 0 },
  components: { verbal: true, somatic: true },
  duration: { unit: "minute", amount: 1 },
  concentration: false,
  ritual: false,
  targeting: "single",
  saveAgainst: { ability: "wis", dc: "spellsave", onSuccess: "no_effect" },
  description:
    "You touch a creature, which must succeed on a Wisdom saving throw or become cursed (tracer: applies srd-spell_bestow-curse).",
};

/** Hand-authored combat spells — override Open5e catalog entries by id. */
const HAND_AUTHORED_SPELLS: Record<string, SpellDefinition> = {
  [MAGIC_MISSILE.id]: MAGIC_MISSILE,
  [GUIDING_BOLT.id]: GUIDING_BOLT,
  [FIREBALL.id]: FIREBALL,
  [BURNING_HANDS.id]: BURNING_HANDS,
  [SACRED_FLAME.id]: SACRED_FLAME,
  [CURE_WOUNDS.id]: CURE_WOUNDS,
  [HEALING_WORD.id]: HEALING_WORD,
  [FIRE_BOLT.id]: FIRE_BOLT,
  [RAY_OF_FROST.id]: RAY_OF_FROST,
  [SHOCKING_GRASP.id]: SHOCKING_GRASP,
  [CHILL_TOUCH.id]: CHILL_TOUCH,
  [PRODUCE_FLAME.id]: PRODUCE_FLAME,
  [THORN_WHIP.id]: THORN_WHIP,
  [POISON_SPRAY.id]: POISON_SPRAY,
  [ACID_SPLASH.id]: ACID_SPLASH,
  [VICIOUS_MOCKERY.id]: VICIOUS_MOCKERY,
  [INFLICT_WOUNDS.id]: INFLICT_WOUNDS,
  [SHATTER.id]: SHATTER,
  [CONE_OF_COLD.id]: CONE_OF_COLD,
  [MASS_HEALING_WORD.id]: MASS_HEALING_WORD,
  [PRAYER_OF_HEALING.id]: PRAYER_OF_HEALING,
  [ELDRITCH_BLAST.id]: ELDRITCH_BLAST,
  [CHROMATIC_ORB.id]: CHROMATIC_ORB,
  [SCORCHING_RAY.id]: SCORCHING_RAY,
  [TOLL_THE_DEAD.id]: TOLL_THE_DEAD,
  [DISSONANT_WHISPERS.id]: DISSONANT_WHISPERS,
  [RAY_OF_SICKNESS.id]: RAY_OF_SICKNESS,
  [MELFS_ACID_ARROW.id]: MELFS_ACID_ARROW,
  [MOONBEAM.id]: MOONBEAM,
  [MIND_SLIVER.id]: MIND_SLIVER,
  [CHAOS_BOLT.id]: CHAOS_BOLT,
  [THUNDERCLAP.id]: THUNDERCLAP,
  [WORD_OF_RADIANCE.id]: WORD_OF_RADIANCE,
  [LIGHTNING_LURE.id]: LIGHTNING_LURE,
  [ARMS_OF_HADAR.id]: ARMS_OF_HADAR,
  [WITCH_BOLT.id]: WITCH_BOLT,
  [HELLISH_REBUKE.id]: HELLISH_REBUKE,
  [CATAPULT.id]: CATAPULT,
  [SNILLOCS_SNOWBALL_SWARM.id]: SNILLOCS_SNOWBALL_SWARM,
  [MIND_SPIKE.id]: MIND_SPIKE,
  [HEAT_METAL.id]: HEAT_METAL,
  [MAXIMILIANS_EARTHEN_GRASP.id]: MAXIMILIANS_EARTHEN_GRASP,
  [PHANTASMAL_FORCE.id]: PHANTASMAL_FORCE,
  [VAMPIRIC_TOUCH.id]: VAMPIRIC_TOUCH,
  [SPIRIT_GUARDIANS.id]: SPIRIT_GUARDIANS,
  [HUNGER_OF_HADAR.id]: HUNGER_OF_HADAR,
  [FROSTBITE.id]: FROSTBITE,
  [SAPPING_STING.id]: SAPPING_STING,
  [CREATE_BONFIRE.id]: CREATE_BONFIRE,
  [GREEN_FLAME_BLADE.id]: GREEN_FLAME_BLADE,
  [BOOMING_BLADE.id]: BOOMING_BLADE,
  [THUNDERWAVE.id]: THUNDERWAVE,
  [ICE_KNIFE.id]: ICE_KNIFE,
  [SHIELD_OF_FAITH.id]: SHIELD_OF_FAITH,
  [MAGE_ARMOR.id]: MAGE_ARMOR,
  [BARKSKIN.id]: BARKSKIN,
  [GOODBERRY.id]: GOODBERRY,
  [BLESS.id]: BLESS,
  [SHIELD.id]: SHIELD,
  [HUNTERS_MARK.id]: HUNTERS_MARK,
  [HEX.id]: HEX,
  [BANE.id]: BANE,
  [FAERIE_FIRE.id]: FAERIE_FIRE,
  [BLUR.id]: BLUR,
  [AID.id]: AID,
  [FALSE_LIFE.id]: FALSE_LIFE,
  [COLOR_SPRAY.id]: COLOR_SPRAY,
  [GREASE.id]: GREASE,
  [CLOUD_OF_DAGGERS.id]: CLOUD_OF_DAGGERS,
  [MAGIC_WEAPON.id]: MAGIC_WEAPON,
  [RAY_OF_ENFEEBLEMENT.id]: RAY_OF_ENFEEBLEMENT,
  [LIGHTNING_BOLT.id]: LIGHTNING_BOLT,
  [INVISIBILITY.id]: INVISIBILITY,
  [HOLD_PERSON.id]: HOLD_PERSON,
  [WEB.id]: WEB,
  [ENTANGLE.id]: ENTANGLE,
  [FLAME_STRIKE.id]: FLAME_STRIKE,
  [PHANTASMAL_KILLER.id]: PHANTASMAL_KILLER,
  [STINKING_CLOUD.id]: STINKING_CLOUD,
  [HASTE.id]: HASTE,
  [HYPNOTIC_PATTERN.id]: HYPNOTIC_PATTERN,
  [SPIRITUAL_WEAPON.id]: SPIRITUAL_WEAPON,
  [MIRROR_IMAGE.id]: MIRROR_IMAGE,
  [CHARM_PERSON.id]: CHARM_PERSON,
  [BLINDNESS_DEAFNESS.id]: BLINDNESS_DEAFNESS,
  [CALL_LIGHTNING.id]: CALL_LIGHTNING,
  [BLIGHT.id]: BLIGHT,
  [REVIVIFY.id]: REVIVIFY,
  [TASHAS_HIDEOUS_LAUGHTER.id]: TASHAS_HIDEOUS_LAUGHTER,
  [COMMAND.id]: COMMAND,
  [GREATER_INVISIBILITY.id]: GREATER_INVISIBILITY,
  [MASS_CURE_WOUNDS.id]: MASS_CURE_WOUNDS,
  [HOLD_MONSTER.id]: HOLD_MONSTER,
  [DOMINATE_PERSON.id]: DOMINATE_PERSON,
  [FEAR.id]: FEAR,
  [SUGGESTION.id]: SUGGESTION,
  [WALL_OF_FIRE.id]: WALL_OF_FIRE,
  [CHAIN_LIGHTNING.id]: CHAIN_LIGHTNING,
  [OTTOS_IRRESISTIBLE_DANCE.id]: OTTOS_IRRESISTIBLE_DANCE,
  [POWER_WORD_STUN.id]: POWER_WORD_STUN,
  [SLEEP.id]: SLEEP,
  [GREATER_RESTORATION.id]: GREATER_RESTORATION,
  [CROWN_OF_MADNESS.id]: CROWN_OF_MADNESS,
  [BANISHMENT.id]: BANISHMENT,
  [SLOW.id]: SLOW,
  [DARKNESS.id]: DARKNESS,
  [SILENCE.id]: SILENCE,
  [LESSER_RESTORATION.id]: LESSER_RESTORATION,
  [COMPULSION.id]: COMPULSION,
  [HEROISM.id]: HEROISM,
  [ICE_STORM.id]: ICE_STORM,
  [SUNBURST.id]: SUNBURST,
  [METEOR_SWARM.id]: METEOR_SWARM,
  [DOMINATE_MONSTER.id]: DOMINATE_MONSTER,
  [MASS_SUGGESTION.id]: MASS_SUGGESTION,
  [CLOUDKILL.id]: CLOUDKILL,
  [INSECT_PLAGUE.id]: INSECT_PLAGUE,
  [FINGER_OF_DEATH.id]: FINGER_OF_DEATH,
  [POWER_WORD_HEAL.id]: POWER_WORD_HEAL,
  [SUNBEAM.id]: SUNBEAM,
  [MISTY_STEP.id]: MISTY_STEP,
  [DISPEL_MAGIC.id]: DISPEL_MAGIC,
  [COUNTERSPELL.id]: COUNTERSPELL,
  [POLYMORPH.id]: POLYMORPH,
  [REMOVE_CURSE.id]: REMOVE_CURSE,
  [BESTOW_CURSE.id]: BESTOW_CURSE,
};

export const HAND_AUTHORED_SPELL_IDS = new Set(Object.keys(HAND_AUTHORED_SPELLS));

/** Full SRD spell catalog (Open5e + hand-authored overrides). */
export const SPELL_REGISTRY: Record<string, SpellDefinition> = {
  ...OPEN5E_SPELL_REGISTRY,
  ...HAND_AUTHORED_SPELLS,
};

/** Look up an authored spell definition by slug id. */
export function getSpell(id: string): SpellDefinition | undefined {
  return SPELL_REGISTRY[id];
}
