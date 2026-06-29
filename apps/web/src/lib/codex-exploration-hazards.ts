/** Client-safe slugs for GRILL-EXPLORATION (keep in sync with @app/db). */
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

export function isExplorationHazardsContextSlug(slug: string | null): boolean {
  if (!slug) return false;
  return (
    slug === EXPLORATION_HAZARDS_OVERVIEW_SLUG ||
    isExplorationHazardGlossarySlug(slug)
  );
}

export function codexExplorationHazardsPath(): string {
  return `/codex/rules/${EXPLORATION_HAZARDS_OVERVIEW_SLUG}`;
}
