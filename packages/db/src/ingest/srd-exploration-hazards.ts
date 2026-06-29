/**
 * SRD 5.2 Playing the Game → Exploration hazards + Rules Glossary prose (GRILL-EXPLORATION).
 */
import {
  EXPLORATION_HAZARDS_OVERVIEW_SLUG,
  type ExplorationHazardGlossarySlug,
} from "./srd-exploration-hazards-shared";

export {
  EXPLORATION_HAZARDS_OVERVIEW_SLUG,
  EXPLORATION_HAZARD_GLOSSARY_SLUGS,
  PLAYING_THE_GAME_CHAPTER_SLUG,
  RULES_GLOSSARY_CHAPTER_SLUG,
  isExplorationHazardGlossarySlug,
  isExplorationHazardsOverviewSlug,
} from "./srd-exploration-hazards-shared";

export const EXPLORATION_HAZARDS_OVERVIEW_PROSE = `While exploring, the party might encounter hazards—environmental or biological dangers that are not creatures and therefore require no initiative order. The SRD lists five common hazards: Burning, Dehydration, Falling, Malnutrition, and Suffocation.

See the Rules Glossary entries linked below for the full rules on each hazard. These are distinct from Gameplay Toolbox → Environmental Effects (terrain and weather modifiers such as Extreme Cold or Thin Ice).`;

export type ExplorationHazardGlossarySeed = {
  slug: ExplorationHazardGlossarySlug;
  name: string;
  description: string;
  sortIndex: number;
};

export const EXPLORATION_HAZARD_GLOSSARY_SEEDS: ExplorationHazardGlossarySeed[] =
  [
    {
      slug: "srd-2024_burning",
      name: "Burning",
      sortIndex: 0,
      description: `A burning creature takes 1d4 Fire damage at the start of each of its turns. As an action, a burning creature can extinguish the flames on itself, or a creature within 5 feet of it can use an action to extinguish the flames on the burning creature.

The flames might also be extinguished if the burning creature drops Prone and another creature uses an action to smother the flames with a cloak or similar object, or if the burning creature enters a body of water.`,
    },
    {
      slug: "srd-2024_dehydration",
      name: "Dehydration",
      sortIndex: 1,
      description: `A creature needs an amount of water per day based on its size, as shown in the Water Needs table in the SRD. A creature that drinks less than half the required water for a day gains 1 Exhaustion level at the day's end. A creature that drinks no water for a number of days equal to 1 + its Constitution modifier (minimum 1) gains 2 Exhaustion levels at the end of each such day.

If a creature has access to only half the water it needs, it counts as drinking half the required amount for that day.`,
    },
    {
      slug: "srd-2024_falling",
      name: "Falling",
      sortIndex: 2,
      description: `When a creature falls, it takes 1d6 Bludgeoning damage for every 10 feet it falls, to a maximum of 20d6. The creature lands Prone unless it avoids taking damage from the fall.`,
    },
    {
      slug: "srd-2024_malnutrition",
      name: "Malnutrition",
      sortIndex: 3,
      description: `A creature needs an amount of food per day based on its size, as shown in the Food Needs table in the SRD. A creature that eats less than half the required food for a day gains 1 Exhaustion level at the day's end. A creature that eats no food for a number of days equal to 1 + its Constitution modifier (minimum 1) gains 2 Exhaustion levels at the end of each such day.

If a creature has access to only half the food it needs, it counts as eating half the required amount for that day.`,
    },
    {
      slug: "srd-2024_suffocation",
      name: "Suffocation",
      sortIndex: 4,
      description: `A creature can hold its breath for a number of minutes equal to 1 + its Constitution modifier (minimum 30 seconds).

When a creature runs out of breath or is choking, it gains the Suffocating condition. A Suffocating creature can survive for a number of rounds equal to its Constitution modifier (minimum 1 round). At the start of each of those rounds, the creature drops to 0 Hit Points and is dying.

When the creature can breathe again, the Suffocating condition ends.`,
    },
  ];
