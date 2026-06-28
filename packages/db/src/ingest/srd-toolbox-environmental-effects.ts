/**
 * SRD 5.2 Gameplay Toolbox → Environmental Effects rules prose + sample seeds (DATA-1b).
 */
import type { EnvironmentalEffectDefinition } from "@app/engine";
import { toolboxEntryId } from "@app/engine";

export const ENVIRONMENTAL_EFFECTS_RULES_SECTION_SLUG =
  "srd-2024_environmental-effects-rules";

export const ENVIRONMENTAL_EFFECTS_RULES_PROSE = `Environmental effects are natural or weather-related hazards that affect creatures exposed to them. Use the following SRD examples as-is or adapt saving throw DCs, durations, and areas to suit your campaign.

These effects are distinct from Playing the Game → Exploration hazards (see GRILL-EXPLORATION).`;

type EnvironmentalEffectSeed = {
  slug: string;
  name: string;
  description: string;
  sortIndex: number;
  definition: EnvironmentalEffectDefinition;
};

function environmentalEffect(
  seed: Omit<EnvironmentalEffectSeed, "definition"> & {
    definition: Omit<EnvironmentalEffectDefinition, "kind" | "id"> & {
      id?: string;
    };
  },
): EnvironmentalEffectSeed {
  return {
    ...seed,
    definition: {
      ...seed.definition,
      id: seed.definition.id ?? toolboxEntryId(seed.name),
      kind: "environmental_effect",
    },
  };
}

/** PDF environmental effects — hand-normalized to GRILL-ENV-EFFECT Q3 shape. */
export const SRD_TOOLBOX_ENVIRONMENTAL_EFFECT_SEEDS: EnvironmentalEffectSeed[] =
  [
    environmentalEffect({
      slug: "srd-2024_deep-water",
      name: "Deep Water",
      description: "Swimming through water more than 100 feet deep.",
      sortIndex: 0,
      definition: {
        name: "Deep Water",
        description: "Swimming through water more than 100 feet deep.",
        repeat:
          "After each hour of swimming, creatures without a Swim Speed: DC 10 Constitution save or +1 Exhaustion.",
      },
    }),
    environmentalEffect({
      slug: "srd-2024_extreme-cold",
      name: "Extreme Cold",
      description: "Exposure at 0 °F or lower.",
      sortIndex: 1,
      definition: {
        name: "Extreme Cold",
        description: "Exposure at 0 °F or lower.",
        repeat:
          "End of each hour exposed: DC 10 Constitution save or +1 Exhaustion. Cold Resistance or Immunity auto-succeeds.",
      },
    }),
    environmentalEffect({
      slug: "srd-2024_extreme-heat",
      name: "Extreme Heat",
      description: "Exposure at 100 °F or higher without drinkable water.",
      sortIndex: 2,
      definition: {
        name: "Extreme Heat",
        description: "Exposure at 100 °F or higher without drinkable water.",
        save: { ability: "con", dc: 5, onSuccess: "negates" },
        repeat:
          "End of each hour: Constitution save or +1 Exhaustion. DC 5 first hour, +1 per additional hour. Medium/Heavy armor = Disadvantage. Fire Resistance or Immunity auto-succeeds.",
      },
    }),
    environmentalEffect({
      slug: "srd-2024_frigid-water",
      name: "Frigid Water",
      description: "Immersion in frigid water.",
      sortIndex: 3,
      definition: {
        name: "Frigid Water",
        description: "Immersion in frigid water.",
        duration:
          "Safe immersion for minutes equal to Constitution score before ill effects.",
        repeat:
          "Each additional minute: DC 10 Constitution save or +1 Exhaustion. Cold Resistance/Immunity or cold-adapted creatures auto-succeed.",
      },
    }),
    environmentalEffect({
      slug: "srd-2024_heavy-precipitation",
      name: "Heavy Precipitation",
      description: "Heavy rain or heavy snowfall.",
      sortIndex: 4,
      definition: {
        name: "Heavy Precipitation",
        description: "Heavy rain or heavy snowfall.",
        area: "Area of heavy rain or heavy snowfall",
        conditions: ["lightly obscured"],
        repeat:
          "Disadvantage on Wisdom (Perception) checks. Heavy rain extinguishes open flames.",
      },
    }),
    environmentalEffect({
      slug: "srd-2024_high-altitude",
      name: "High Altitude",
      description: "Travel at 10,000 feet or higher above sea level.",
      sortIndex: 5,
      definition: {
        name: "High Altitude",
        description: "Travel at 10,000 feet or higher above sea level.",
        area: "10,000 feet or higher (acclimation possible up to 20,000 feet)",
        repeat:
          "Each hour traveling counts as 2 hours for Travel Pace. Acclimation after 30 days at elevation; no acclimation above 20,000 feet unless native.",
      },
    }),
    environmentalEffect({
      slug: "srd-2024_slippery-ice",
      name: "Slippery Ice",
      description: "Difficult terrain made of slippery ice.",
      sortIndex: 6,
      definition: {
        name: "Slippery Ice",
        description: "Difficult terrain made of slippery ice.",
        save: { ability: "dex", dc: 10, onSuccess: "negates" },
        conditions: ["difficult terrain", "prone"],
        repeat:
          "When moving onto slippery ice for the first time on a turn or starting a turn there.",
      },
    }),
    environmentalEffect({
      slug: "srd-2024_strong-wind",
      name: "Strong Wind",
      description: "Powerful wind that hampers ranged attacks and flight.",
      sortIndex: 7,
      definition: {
        name: "Strong Wind",
        description: "Powerful wind that hampers ranged attacks and flight.",
        repeat:
          "Disadvantage on ranged weapon attack rolls. Extinguishes open flames and disperses fog. Flying creatures must land at end of turn or fall. Desert sandstorm: Disadvantage on Wisdom (Perception) checks.",
      },
    }),
    environmentalEffect({
      slug: "srd-2024_thin-ice",
      name: "Thin Ice",
      description: "Ice with limited weight tolerance.",
      sortIndex: 8,
      definition: {
        name: "Thin Ice",
        description: "Ice with limited weight tolerance.",
        area: "10-foot-square areas; weight tolerance 3d10 × 10 pounds per area",
        repeat:
          "When total weight exceeds tolerance, ice breaks and creatures fall into frigid water below (see Frigid Water).",
      },
    }),
  ];
