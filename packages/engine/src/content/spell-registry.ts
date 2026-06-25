/**
 * Authoritative in-engine spell registry (#40, E3).
 *
 * Hand-authored {@link SpellDefinition}s are the source of truth for *spell
 * resolution* — the engine never resolves from Codex DB prose. The Codex DB
 * stays the browsable reference and Smithy homebrew store; entries here are
 * linked to it by `id` (slug). The proof set grows slice by slice:
 *
 *   - Slice #40: Magic Missile, Guiding Bolt
 *   - Slice #42: Fireball, Burning Hands, Sacred Flame
 *   - Slice #43: Cure Wounds, Healing Word, Fire Bolt
 *
 *   - Slice #40: Magic Missile, Guiding Bolt
 *   - Slice #42: Fireball, Burning Hands, Sacred Flame
 *   - Slice #43: Cure Wounds, Healing Word, Fire Bolt
 *   - Batch 2 (C1 / ENG-2): the cleanly-declarative SRD spells that resolve on
 *     today's pipeline (single-component damage via attack / save / auto-hit,
 *     plus healing) — Ray of Frost, Shocking Grasp, Chill Touch, Produce Flame,
 *     Thorn Whip, Poison Spray, Acid Splash, Vicious Mockery, Inflict Wounds,
 *     Shatter, Cone of Cold, Mass Healing Word, Prayer of Healing. Spells whose
 *     core effect is a *condition/rider* (Bless, Hold Person, Shield, …) wait on
 *     the Effect system; their non-damage riders are noted in `description`.
 *   - Batch 3 (ENG-2): Eldritch Blast, Chromatic Orb, Scorching Ray, Toll the
 *     Dead, Dissonant Whispers, Ray of Sickness, Melf's Acid Arrow, Moonbeam,
 *     Mind Sliver, Chaos Bolt.
 *   - Batch 4 (ENG-2): Thunderclap, Word of Radiance, Lightning Lure, Arms of
 *     Hadar, Witch Bolt, Hellish Rebuke, Catapult, Snilloc's Snowball Swarm,
 *     Mind Spike, Heat Metal, Maximilian's Earthen Grasp, Phantasmal Force,
 *     Vampiric Touch, Spirit Guardians, Hunger of Hadar.
 *   - Batch 5 (ENG-13): Bless, Shield, Hunter's Mark (appliedEffects proof set).
 *   - Batch 8 (ENG-2 / Rung 2): Lightning Bolt, Invisibility, Hold Person, Web,
 *     Entangle, Flame Strike, Phantasmal Killer, Stinking Cloud, Haste,
 *     Hypnotic Pattern — plus ENG-13 condition-on-failed-save + Blur disadvantage.
 *
 * Every definition is validated by `validateSpellDefinition` in a unit test, so
 * a malformed registry entry fails CI rather than at cast time, and every
 * authored spell is exercised by a deterministic golden cast snapshot
 * (`engine.spells.golden.test.ts`).
 */
import type { SpellDefinition } from "./spells";

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
  range: { type: "self", area: { shape: "sphere", size: 15 } },
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
    "Each creature in a 15-foot-radius aura makes a Wisdom saving throw, taking 3d8 radiant damage on a failed save, or half as much on a success (ongoing turns narrated).",
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
  range: { type: "feet", amount: 60, area: { shape: "sphere", size: 20 } },
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

/** Lightning Bolt — 100-ft line tracer as a 10-ft sphere at a point; Dex save half 8d6 lightning. */
const LIGHTNING_BOLT: SpellDefinition = {
  id: "lightning-bolt",
  name: "Lightning Bolt",
  level: 3,
  school: "evocation",
  classes: ["Sorcerer", "Wizard"],
  castingTime: { unit: "action", amount: 1 },
  range: { type: "feet", amount: 120, area: { shape: "sphere", size: 10 } },
  components: { verbal: true, somatic: true, material: "a bit of fur and a rod of amber, crystal, or glass" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "8d6", type: "lightning" }],
  upcastScaling: { perSlotDice: "1d6", appliesTo: "damage" },
  description:
    "A stroke of lightning forming a line 100 feet long and 5 feet wide (tracer: 10-ft sphere at a point). Each creature in the area makes a Dexterity save, taking 8d6 lightning on a failure or half on a success.",
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
  range: { type: "feet", amount: 60, area: { shape: "sphere", size: 10 } },
  components: { verbal: true, somatic: true, material: "pinch of sulfur" },
  duration: { unit: "instantaneous" },
  concentration: false,
  ritual: false,
  targeting: "area",
  saveAgainst: { ability: "dex", dc: "spellsave", onSuccess: "half_damage" },
  damage: [{ dice: "8d6", type: "fire" }],
  description:
    "A vertical column of divine flame roars down in a 10-foot-radius, 40-foot-high cylinder (tracer: 10-ft sphere). Each creature in the area makes a Dexterity save, taking 8d6 fire damage on a failure or half on a success (4d6 fire + 4d6 radiant combined as 8d6 fire at tracer depth).",
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
  ],
  description:
    "Choose a willing creature. Until the spell ends, its speed is doubled, it gains +2 AC, it has advantage on Dexterity saving throws, and it gains an additional action (tracer: +2 AC only).",
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

/** All authored spells, keyed by slug id. */
export const SPELL_REGISTRY: Record<string, SpellDefinition> = {
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
};

/** Look up an authored spell definition by slug id. */
export function getSpell(id: string): SpellDefinition | undefined {
  return SPELL_REGISTRY[id];
}
