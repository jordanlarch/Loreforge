/**
 * SRD 5.2 Gameplay Toolbox → Poisons rules prose + DB seed wrapper (DATA-1b).
 * Poison definitions live in `@app/engine` (`srd-poison-seeds.ts`) for Live Play resolution.
 */
import { SRD_POISON_SEEDS, type SrdPoisonSeed } from "@app/engine";

export const POISONS_RULES_SECTION_SLUG = "srd-2024_poisons-rules";

export const POISONS_RULES_PROSE = `Given their insidious and deadly nature, poisons are a favorite tool among assassins and evil adventurers.

Poisons come in the following four types:

Contact. Contact poison can be smeared on an object and remains potent until it is touched or washed off. A creature that touches contact poison with exposed skin is subjected to its effects.

Ingested. A creature must swallow an entire dose of ingested poison to suffer its effects. The dose can be delivered in food or a liquid. You may decide that a partial dose has a reduced effect, such as allowing Advantage on the saving throw or dealing only half damage on a failed save.

Inhaled. These poisons are powders or gases that take effect when inhaled. Blowing the powder or releasing the gas subjects creatures in a 5-foot Cube to its effect. The resulting cloud dissipates immediately afterward. Holding one's breath is ineffective against inhaled poisons, as they affect nasal membranes, tear ducts, and other parts of the body.

Injury. Injury poison can be applied to weapons, ammunition, or similar objects and remains potent until delivered through a wound or washed off. A creature that takes Piercing or Slashing damage from an object coated with injury poison is subjected to its effects.

Purchasing Poison. At your discretion, poisons might be available for purchase in some locales. The prices in the sample poisons below are per dose.`;

export type PoisonSeed = SrdPoisonSeed & {
  name: string;
  description: string;
};

/** PDF sample poisons for Codex DB seed — definitions from engine registry. */
export const SRD_TOOLBOX_POISON_SEEDS: PoisonSeed[] = SRD_POISON_SEEDS.map((seed) => ({
  ...seed,
  name: seed.definition.name,
  description: seed.definition.description,
}));
