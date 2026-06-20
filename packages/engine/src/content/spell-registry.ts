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
 * Every definition is validated by `validateSpellDefinition` in a unit test, so
 * a malformed registry entry fails CI rather than at cast time.
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
};

/** Look up an authored spell definition by slug id. */
export function getSpell(id: string): SpellDefinition | undefined {
  return SPELL_REGISTRY[id];
}
