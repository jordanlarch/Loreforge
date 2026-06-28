/**
 * SRD 5.2 Gameplay Toolbox → Traps rules prose + sample trap seeds (DATA-1b v1).
 * Single authoring source for DB seed and engine reference until SRD-AUDIT-10 ingest.
 */
import type { TrapDefinition } from "@app/engine";
import { toolboxEntryId } from "@app/engine";

export const GAMEPLAY_TOOLBOX_CHAPTER_SLUG = "srd-2024_gameplay-toolbox";
export const TRAPS_RULES_SECTION_SLUG = "srd-2024_traps-rules";

export const TRAPS_RULES_PROSE = `Traps can be found almost anywhere. A trap can be either mechanical or magical. Mechanical traps include pits, arrow traps, falling blocks, water-filled rooms, whirling blades, and anything else that depends on a mechanism to operate. Magic traps are either magical device traps or spell traps. A trap usually triggers when a creature moves somewhere, touches something, or starts a chain reaction.

Detecting and Disabling a Trap. A character can use a Wisdom (Perception) check to detect a trap. A successful check reveals the trap's presence but not its exact location or effect. A character can use a Dexterity check using Thieves' Tools to disable a mechanical trap. Some traps can't be disabled with Thieves' Tools.

Trap Effects. When a trap is triggered, it produces an effect specified in the trap's stat block. Many traps require a saving throw to avoid or reduce the effect.`;

type TrapSeed = {
  slug: string;
  name: string;
  description: string;
  sortIndex: number;
  definition: TrapDefinition;
};

function trap(seed: Omit<TrapSeed, "definition"> & { definition: Omit<TrapDefinition, "kind" | "id"> & { id?: string } }): TrapSeed {
  return {
    ...seed,
    definition: {
      ...seed.definition,
      id: seed.definition.id ?? toolboxEntryId(seed.name),
      kind: "trap",
    },
  };
}

/** PDF sample traps — hand-normalized to GRILL-TRAP Q3 `TrapDefinition` shape. */
export const SRD_TOOLBOX_TRAP_SEEDS: TrapSeed[] = [
  trap({
    slug: "srd-2024_poison-needle",
    name: "Poison Needle",
    description: "A hidden needle concealed in a lock.",
    sortIndex: 0,
    definition: {
      name: "Poison Needle",
      description: "A hidden needle concealed in a lock.",
      trigger:
        "A creature touches the trap while handling the lock or opening the attached container.",
      effect: {
        save: { ability: "con", dc: 15, onSuccess: "negates" },
        damage: [{ dice: "1d8", type: "poison" }],
        conditions: ["poisoned"],
      },
      detect: { dc: 15, ability: "wis", skill: "Perception" },
      disable: { dc: 15, ability: "dex", tool: "Thieves' Tools" },
      reset: "once",
    },
  }),
  trap({
    slug: "srd-2024_falling-net",
    name: "Falling Net",
    description: "A weighted net suspended above a trip wire.",
    sortIndex: 1,
    definition: {
      name: "Falling Net",
      description: "A weighted net suspended above a trip wire.",
      trigger: "A creature crosses a trip wire.",
      effect: {
        save: { ability: "dex", dc: 10, onSuccess: "negates" },
        conditions: ["restrained"],
        effectProse: "A restrained creature can use an action to make a DC 10 Strength check, freeing itself or another creature within reach on a success.",
      },
      detect: { dc: 11, ability: "wis", skill: "Perception" },
      disable: { dc: 10, ability: "dex", tool: "Thieves' Tools" },
      reset: "once",
    },
  }),
  trap({
    slug: "srd-2024_poison-darts",
    name: "Poison Darts",
    description: "Tiny blowgun tubes hidden in surrounding walls.",
    sortIndex: 2,
    definition: {
      name: "Poison Darts",
      description: "Tiny blowgun tubes hidden in surrounding walls.",
      trigger: "A creature enters the trapped area.",
      effect: {
        save: { ability: "dex", dc: 13, onSuccess: "half" },
        damage: [{ dice: "2d10", type: "poison" }],
      },
      detect: { dc: 15, ability: "wis", skill: "Perception" },
      disable: { dc: 15, ability: "dex", tool: "Thieves' Tools" },
      reset: "once",
    },
  }),
  trap({
    slug: "srd-2024_hidden-pit",
    name: "Hidden Pit",
    description: "A covered pit opens underfoot.",
    sortIndex: 3,
    definition: {
      name: "Hidden Pit",
      description: "A covered pit opens underfoot.",
      trigger: "A creature steps on the pit cover.",
      effect: {
        save: { ability: "dex", dc: 15, onSuccess: "negates" },
        damage: [{ dice: "1d6", type: "bludgeoning" }],
        conditions: ["prone"],
        effectProse: "On a failed save the creature falls 10 feet into the pit.",
      },
      detect: { dc: 15, ability: "wis", skill: "Perception" },
      reset: "once",
    },
  }),
  trap({
    slug: "srd-2024_rolling-sphere",
    name: "Rolling Sphere",
    description: "A stone sphere rolls through trapped corridors.",
    sortIndex: 4,
    definition: {
      name: "Rolling Sphere",
      description: "A stone sphere rolls through trapped corridors.",
      trigger: "A creature steps on a pressure plate.",
      effect: {
        save: { ability: "dex", dc: 15, onSuccess: "half" },
        damage: [{ dice: "10d10", type: "bludgeoning" }],
      },
      detect: { dc: 15, ability: "wis", skill: "Perception" },
      disable: { dc: 15, ability: "dex", tool: "Thieves' Tools" },
      reset: "manual",
    },
  }),
  trap({
    slug: "srd-2024_collapsing-roof",
    name: "Collapsing Roof",
    description: "Ceiling stones crash down when a plate is triggered.",
    sortIndex: 5,
    definition: {
      name: "Collapsing Roof",
      description: "Ceiling stones crash down when a plate is triggered.",
      trigger: "A creature crosses a pressure plate.",
      effect: {
        save: { ability: "dex", dc: 15, onSuccess: "half" },
        damage: [{ dice: "4d10", type: "bludgeoning" }],
        effectProse: "On a failed save the creature is buried and has the Restrained condition until freed.",
      },
      detect: { dc: 15, ability: "wis", skill: "Perception" },
      disable: { dc: 15, ability: "dex", tool: "Thieves' Tools" },
      reset: "once",
    },
  }),
  trap({
    slug: "srd-2024_fire-casting-statue",
    name: "Fire-Casting Statue",
    description: "A statue vents gouts of flame.",
    sortIndex: 6,
    definition: {
      name: "Fire-Casting Statue",
      description: "A statue vents gouts of flame.",
      trigger: "A creature enters the area in front of the statue.",
      effect: {
        save: { ability: "dex", dc: 15, onSuccess: "half" },
        damage: [{ dice: "4d10", type: "fire" }],
      },
      detect: { dc: 15, ability: "wis", skill: "Perception" },
      disable: { dc: 15, ability: "dex", tool: "Thieves' Tools" },
      reset: "once",
    },
  }),
  trap({
    slug: "srd-2024_sleep-of-ages",
    name: "Sleep of Ages",
    description: "A magical trap on a sarcophagus.",
    sortIndex: 7,
    definition: {
      name: "Sleep of Ages",
      description: "A magical trap on a sarcophagus.",
      trigger: "A creature opens the sarcophagus lid.",
      effect: {
        effectProse:
          "The triggering creature and each creature within 10 feet must succeed on a DC 15 Wisdom saving throw or fall unconscious for 1 hour. An unconscious creature awakens only if it takes damage or another creature uses an action to wake it.",
      },
      reset: "once",
    },
  }),
];
