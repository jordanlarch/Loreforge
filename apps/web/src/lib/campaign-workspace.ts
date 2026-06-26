/**
 * Campaign workspace tab taxonomy (#55, CAMP-UX UX-2).
 *
 * Seven-tab prep shell from `docs/ui-flows/unified-campaign-ux.md`. Browser-safe
 * so the workspace shell and any future deep-link helpers share one definition.
 * Each tab has a URL `slug` (used by `/campaigns/[id]?tab=<slug>`) and a `label`.
 * Legacy slugs (`world`, `combat`, `sessions`, `hooks`) redirect via
 * {@link resolveCampaignTab}.
 */
export type CampaignTabSlug =
  | "overview"
  | "map"
  | "locations"
  | "party"
  | "quests"
  | "notes"
  | "settings";

export type CampaignTab = {
  slug: CampaignTabSlug;
  label: string;
};

export const CAMPAIGN_WORKSPACE_TABS: readonly CampaignTab[] = [
  { slug: "overview", label: "Overview" },
  { slug: "map", label: "Map" },
  { slug: "locations", label: "Locations" },
  { slug: "party", label: "Party" },
  { slug: "quests", label: "Quests" },
  { slug: "notes", label: "Notes" },
  { slug: "settings", label: "Settings" },
];

export const DEFAULT_CAMPAIGN_TAB: CampaignTabSlug = "overview";

/** Legacy prep tab slugs from the nine-tab shell (CAMP-UX UX-2 redirects). */
const LEGACY_TAB_REDIRECTS: Record<string, CampaignTabSlug> = {
  hooks: "quests",
  world: "locations",
  combat: "overview",
  sessions: "overview",
};

/** Resolve a raw `?tab=` value to a known slug, falling back to the default. */
export function resolveCampaignTab(raw: string | null | undefined): CampaignTabSlug {
  if (raw && raw in LEGACY_TAB_REDIRECTS) {
    return LEGACY_TAB_REDIRECTS[raw]!;
  }
  const match = CAMPAIGN_WORKSPACE_TABS.find((t) => t.slug === raw);
  return match ? match.slug : DEFAULT_CAMPAIGN_TAB;
}

/** A campaign membership row's grouping fields (Party tab, #61). */
export type RosterMember = { role: string; status: string };

export type PartitionedRoster<T extends RosterMember> = {
  /** Active player characters (role `pc`). */
  pcs: T[];
  /** Active non-PC party members (companions, NPC allies). */
  companions: T[];
  /** Benched members of any role. */
  bench: T[];
};

/**
 * Split a campaign roster into PCs, companions, and the bench (#61). Benched
 * members (status `bench`) are grouped together regardless of role; among active
 * members, `pc` is a player character and anything else is a companion. Pure so
 * the Party tab can rely on it and it's unit-testable.
 */
export function partitionRoster<T extends RosterMember>(
  members: readonly T[],
): PartitionedRoster<T> {
  const pcs: T[] = [];
  const companions: T[] = [];
  const bench: T[] = [];
  for (const member of members) {
    if (member.status === "bench") bench.push(member);
    else if (member.role === "pc") pcs.push(member);
    else companions.push(member);
  }
  return { pcs, companions, bench };
}
