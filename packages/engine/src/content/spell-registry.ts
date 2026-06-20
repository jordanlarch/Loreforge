/**
 * Authoritative in-engine spell registry (#40, E3).
 *
 * Hand-authored {@link SpellDefinition}s are the source of truth for *spell
 * resolution* — the engine never resolves from Codex DB prose. The Codex DB
 * stays the browsable reference and Smithy homebrew store; entries here are
 * linked to it by `id` (slug). The proof set grows slice by slice:
 *
 *   - Slice #40 (this): Magic Missile, Guiding Bolt
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
    "Flame-like radiance descends on a creature that you can see within range. The target makes a Dexterity saving throw, taking 1d8 radiant damage on a failed save. The target gains no benefit from cover for this save. The damage increases as you gain levels (cantrip scaling is handled in a later slice).",
};

/** All authored spells, keyed by slug id. */
export const SPELL_REGISTRY: Record<string, SpellDefinition> = {
  [MAGIC_MISSILE.id]: MAGIC_MISSILE,
  [GUIDING_BOLT.id]: GUIDING_BOLT,
  [FIREBALL.id]: FIREBALL,
  [BURNING_HANDS.id]: BURNING_HANDS,
  [SACRED_FLAME.id]: SACRED_FLAME,
};

/** Look up an authored spell definition by slug id. */
export function getSpell(id: string): SpellDefinition | undefined {
  return SPELL_REGISTRY[id];
}
