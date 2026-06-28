/**
 * SRD 5.2 Gameplay Toolbox → Traps rules prose + DB seed wrapper (DATA-1b v1).
 * Trap definitions live in `@app/engine` (`srd-trap-seeds.ts`) for Live Play resolution.
 */
import { SRD_TRAP_SEEDS, type SrdTrapSeed } from "@app/engine";

import { GAMEPLAY_TOOLBOX_CHAPTER_SLUG } from "./srd-toolbox-shared";

export { GAMEPLAY_TOOLBOX_CHAPTER_SLUG };
export const TRAPS_RULES_SECTION_SLUG = "srd-2024_traps-rules";

export const TRAPS_RULES_PROSE = `Traps can be found almost anywhere. A trap can be either mechanical or magical. Mechanical traps include pits, arrow traps, falling blocks, water-filled rooms, whirling blades, and anything else that depends on a mechanism to operate. Magic traps are either magical device traps or spell traps. A trap usually triggers when a creature moves somewhere, touches something, or starts a chain reaction.

Detecting and Disabling a Trap. A character can use a Wisdom (Perception) check to detect a trap. A successful check reveals the trap's presence but not its exact location or effect. A character can use a Dexterity check using Thieves' Tools to disable a mechanical trap. Some traps can't be disabled with Thieves' Tools.

Trap Effects. When a trap is triggered, it produces an effect specified in the trap's stat block. Many traps require a saving throw to avoid or reduce the effect.`;

export type TrapSeed = SrdTrapSeed & {
  name: string;
  description: string;
};

/** PDF sample traps for Codex DB seed — definitions from engine registry. */
export const SRD_TOOLBOX_TRAP_SEEDS: TrapSeed[] = SRD_TRAP_SEEDS.map((seed) => ({
  ...seed,
  name: seed.definition.name,
  description: seed.definition.description,
}));
