/**
 * SRD 5.2 Gameplay Toolbox trap definitions — engine runtime registry (DATA-1b / PLAY-TOOLBOX).
 * DB Codex seeds import these; keep in sync with `packages/db/src/ingest/srd-toolbox-traps.ts` prose rows.
 */
import { toolboxEntryId, type TrapDefinition } from "./toolbox-definitions";

export type SrdTrapSeed = {
  slug: string;
  sortIndex: number;
  definition: TrapDefinition;
};

function trap(
  slug: string,
  sortIndex: number,
  definition: Omit<TrapDefinition, "kind" | "id"> & { id?: string },
): SrdTrapSeed {
  return {
    slug,
    sortIndex,
    definition: {
      ...definition,
      id: definition.id ?? toolboxEntryId(definition.name),
      kind: "trap",
    },
  };
}

/** PDF sample traps — hand-normalized to GRILL-TRAP Q3 `TrapDefinition` shape. */
export const SRD_TRAP_SEEDS: readonly SrdTrapSeed[] = [
  trap("srd-2024_poison-needle", 0, {
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
  }),
  trap("srd-2024_falling-net", 1, {
    name: "Falling Net",
    description: "A weighted net suspended above a trip wire.",
    trigger: "A creature crosses a trip wire.",
    effect: {
      save: { ability: "dex", dc: 10, onSuccess: "negates" },
      conditions: ["restrained"],
      effectProse:
        "A restrained creature can use an action to make a DC 10 Strength check, freeing itself or another creature within reach on a success.",
    },
    detect: { dc: 11, ability: "wis", skill: "Perception" },
    disable: { dc: 10, ability: "dex", tool: "Thieves' Tools" },
    reset: "once",
  }),
  trap("srd-2024_poison-darts", 2, {
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
  }),
  trap("srd-2024_hidden-pit", 3, {
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
  }),
  trap("srd-2024_rolling-sphere", 4, {
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
  }),
  trap("srd-2024_collapsing-roof", 5, {
    name: "Collapsing Roof",
    description: "Ceiling stones crash down when a plate is triggered.",
    trigger: "A creature crosses a pressure plate.",
    effect: {
      save: { ability: "dex", dc: 15, onSuccess: "half" },
      damage: [{ dice: "4d10", type: "bludgeoning" }],
      effectProse:
        "On a failed save the creature is buried and has the Restrained condition until freed.",
    },
    detect: { dc: 15, ability: "wis", skill: "Perception" },
    disable: { dc: 15, ability: "dex", tool: "Thieves' Tools" },
    reset: "once",
  }),
  trap("srd-2024_fire-casting-statue", 6, {
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
  }),
  trap("srd-2024_sleep-of-ages", 7, {
    name: "Sleep of Ages",
    description: "A magical trap on a sarcophagus.",
    trigger: "A creature opens the sarcophagus lid.",
    effect: {
      effectProse:
        "The triggering creature and each creature within 10 feet must succeed on a DC 15 Wisdom saving throw or fall unconscious for 1 hour. An unconscious creature awakens only if it takes damage or another creature uses an action to wake it.",
    },
    reset: "once",
  }),
];

export const TRAP_REGISTRY: Readonly<Record<string, TrapDefinition>> = Object.fromEntries(
  SRD_TRAP_SEEDS.map((s) => [s.slug, s.definition]),
);

export function getTrapDefinition(slug: string): TrapDefinition | undefined {
  return TRAP_REGISTRY[slug];
}
