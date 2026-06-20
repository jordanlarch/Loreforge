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

/** All authored spells, keyed by slug id. */
export const SPELL_REGISTRY: Record<string, SpellDefinition> = {
  [MAGIC_MISSILE.id]: MAGIC_MISSILE,
  [GUIDING_BOLT.id]: GUIDING_BOLT,
};

/** Look up an authored spell definition by slug id. */
export function getSpell(id: string): SpellDefinition | undefined {
  return SPELL_REGISTRY[id];
}
