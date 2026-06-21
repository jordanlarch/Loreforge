/**
 * Campaign workspace tab taxonomy (#55).
 *
 * The nine-tab shell from `docs/ui-flows/campaigns-workspace.md`. Browser-safe
 * so the workspace shell and any future deep-link helpers share one definition.
 * Each tab has a URL `slug` (used by `/campaigns/[id]?tab=<slug>`) and a `label`.
 * Overview is the default landing tab; non-Overview tabs are stubbed until their
 * own slices land (Party = #61, etc.).
 */
export type CampaignTabSlug =
  | "overview"
  | "party"
  | "world"
  | "hooks"
  | "sessions"
  | "map"
  | "combat"
  | "notes"
  | "settings";

export type CampaignTab = {
  slug: CampaignTabSlug;
  label: string;
};

export const CAMPAIGN_WORKSPACE_TABS: readonly CampaignTab[] = [
  { slug: "overview", label: "Overview" },
  { slug: "party", label: "Party" },
  { slug: "world", label: "World" },
  { slug: "hooks", label: "Hooks" },
  { slug: "sessions", label: "Sessions" },
  { slug: "map", label: "World Map" },
  { slug: "combat", label: "Combat" },
  { slug: "notes", label: "Notes" },
  { slug: "settings", label: "Settings" },
];

export const DEFAULT_CAMPAIGN_TAB: CampaignTabSlug = "overview";

/** Resolve a raw `?tab=` value to a known slug, falling back to the default. */
export function resolveCampaignTab(raw: string | null | undefined): CampaignTabSlug {
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
