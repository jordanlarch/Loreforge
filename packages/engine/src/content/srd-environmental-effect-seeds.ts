/**
 * SRD 5.2 Gameplay Toolbox environmental effect definitions — engine runtime registry
 * (DATA-1b / GRILL-LIVE-ENV-EFFECT). DB Codex seeds should stay in sync.
 */
import {
  toolboxEntryId,
  type EnvironmentalEffectDefinition,
} from "./toolbox-definitions";

export type SrdEnvironmentalEffectSeed = {
  slug: string;
  sortIndex: number;
  definition: EnvironmentalEffectDefinition;
};

function environmentalEffect(
  slug: string,
  sortIndex: number,
  definition: Omit<EnvironmentalEffectDefinition, "kind" | "id"> & { id?: string },
): SrdEnvironmentalEffectSeed {
  return {
    slug,
    sortIndex,
    definition: {
      ...definition,
      id: definition.id ?? toolboxEntryId(definition.name),
      kind: "environmental_effect",
    },
  };
}

/** PDF environmental effects — hand-normalized to GRILL-ENV-EFFECT Q3 shape. */
export const SRD_ENVIRONMENTAL_EFFECT_SEEDS: readonly SrdEnvironmentalEffectSeed[] = [
  environmentalEffect("srd-2024_deep-water", 0, {
    name: "Deep Water",
    description: "Swimming through water more than 100 feet deep.",
    repeat:
      "After each hour of swimming, creatures without a Swim Speed: DC 10 Constitution save or +1 Exhaustion.",
  }),
  environmentalEffect("srd-2024_extreme-cold", 1, {
    name: "Extreme Cold",
    description: "Exposure at 0 °F or lower.",
    repeat:
      "End of each hour exposed: DC 10 Constitution save or +1 Exhaustion. Cold Resistance or Immunity auto-succeeds.",
  }),
  environmentalEffect("srd-2024_extreme-heat", 2, {
    name: "Extreme Heat",
    description: "Exposure at 100 °F or higher without drinkable water.",
    save: { ability: "con", dc: 5, onSuccess: "negates" },
    repeat:
      "End of each hour: Constitution save or +1 Exhaustion. DC 5 first hour, +1 per additional hour. Medium/Heavy armor = Disadvantage. Fire Resistance or Immunity auto-succeeds.",
  }),
  environmentalEffect("srd-2024_frigid-water", 3, {
    name: "Frigid Water",
    description: "Immersion in frigid water.",
    duration:
      "Safe immersion for minutes equal to Constitution score before ill effects.",
    repeat:
      "Each additional minute: DC 10 Constitution save or +1 Exhaustion. Cold Resistance/Immunity or cold-adapted creatures auto-succeed.",
  }),
  environmentalEffect("srd-2024_heavy-precipitation", 4, {
    name: "Heavy Precipitation",
    description: "Heavy rain or heavy snowfall.",
    area: "Area of heavy rain or heavy snowfall",
    repeat:
      "Disadvantage on Wisdom (Perception) checks. Heavy rain extinguishes open flames.",
  }),
  environmentalEffect("srd-2024_high-altitude", 5, {
    name: "High Altitude",
    description: "Travel at 10,000 feet or higher above sea level.",
    area: "10,000 feet or higher (acclimation possible up to 20,000 feet)",
    repeat:
      "Each hour traveling counts as 2 hours for Travel Pace. Acclimation after 30 days at elevation; no acclimation above 20,000 feet unless native.",
  }),
  environmentalEffect("srd-2024_slippery-ice", 6, {
    name: "Slippery Ice",
    description: "Difficult terrain made of slippery ice.",
    save: { ability: "dex", dc: 10, onSuccess: "negates" },
    conditions: ["prone"],
    repeat:
      "When moving onto slippery ice for the first time on a turn or starting a turn there.",
  }),
  environmentalEffect("srd-2024_strong-wind", 7, {
    name: "Strong Wind",
    description: "Powerful wind that hampers ranged attacks and flight.",
    repeat:
      "Disadvantage on ranged weapon attack rolls. Extinguishes open flames and disperses fog. Flying creatures must land at end of turn or fall. Desert sandstorm: Disadvantage on Wisdom (Perception) checks.",
  }),
  environmentalEffect("srd-2024_thin-ice", 8, {
    name: "Thin Ice",
    description: "Ice with limited weight tolerance.",
    area: "10-foot-square areas; weight tolerance 3d10 × 10 pounds per area",
    repeat:
      "When total weight exceeds tolerance, ice breaks and creatures fall into frigid water below (see Frigid Water).",
  }),
];

export const ENVIRONMENTAL_EFFECT_REGISTRY: Readonly<
  Record<string, EnvironmentalEffectDefinition>
> = Object.fromEntries(
  SRD_ENVIRONMENTAL_EFFECT_SEEDS.map((s) => [s.slug, s.definition]),
);

export function getEnvironmentalEffectDefinition(
  slug: string,
): EnvironmentalEffectDefinition | undefined {
  return ENVIRONMENTAL_EFFECT_REGISTRY[slug];
}
