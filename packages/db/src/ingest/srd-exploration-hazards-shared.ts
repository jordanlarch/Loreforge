/** SRD 5.2 Playing the Game + Rules Glossary chapter slugs (GRILL-EXPLORATION). */
export const PLAYING_THE_GAME_CHAPTER_SLUG = "srd-2024_playing-the-game";
export const RULES_GLOSSARY_CHAPTER_SLUG = "srd-2024_rules-glossary";

export const EXPLORATION_HAZARDS_OVERVIEW_SLUG =
  "srd-2024_exploration-hazards";

export const EXPLORATION_HAZARD_GLOSSARY_SLUGS = [
  "srd-2024_burning",
  "srd-2024_dehydration",
  "srd-2024_falling",
  "srd-2024_malnutrition",
  "srd-2024_suffocation",
] as const;

export type ExplorationHazardGlossarySlug =
  (typeof EXPLORATION_HAZARD_GLOSSARY_SLUGS)[number];

export function isExplorationHazardGlossarySlug(
  slug: string,
): slug is ExplorationHazardGlossarySlug {
  return (EXPLORATION_HAZARD_GLOSSARY_SLUGS as readonly string[]).includes(
    slug,
  );
}

export function isExplorationHazardsOverviewSlug(slug: string): boolean {
  return slug === EXPLORATION_HAZARDS_OVERVIEW_SLUG;
}
