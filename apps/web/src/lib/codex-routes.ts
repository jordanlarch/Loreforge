import {
  parseCodexCategory,
  type CodexCategory,
} from "@/lib/codex-categories";

/** URL path segment for each live Codex category (CODEX-3). */
export const CODEX_CATEGORY_SEGMENT: Record<CodexCategory, string> = {
  Spells: "spells",
  Species: "species",
  Classes: "classes",
  Rules: "rules",
  Backgrounds: "backgrounds",
  Animals: "animals",
  Monsters: "monsters",
  Items: "items",
  Feats: "feats",
  Advanced: "advanced",
};

const SEGMENT_TO_CATEGORY = Object.fromEntries(
  Object.entries(CODEX_CATEGORY_SEGMENT).map(([cat, seg]) => [seg, cat]),
) as Record<string, CodexCategory>;

export function codexCategorySegment(category: CodexCategory): string {
  return CODEX_CATEGORY_SEGMENT[category];
}

export function parseCodexCategorySegment(
  segment: string | undefined | null,
): CodexCategory | null {
  if (!segment) return null;
  const normalized = segment.toLowerCase();
  return SEGMENT_TO_CATEGORY[normalized] ?? null;
}

function appendSearch(path: string, search?: string | null): string {
  if (!search?.trim()) return path;
  const params = new URLSearchParams({ search: search.trim() });
  return `${path}?${params.toString()}`;
}

/** List route: `/codex/spells`, optional `?search=`. */
export function codexCategoryPath(
  category: CodexCategory,
  search?: string | null,
): string {
  return appendSearch(`/codex/${codexCategorySegment(category)}`, search);
}

/** Detail route: `/codex/spells/fireball`. */
export function codexDetailPath(category: CodexCategory, slug: string): string {
  return `/codex/${codexCategorySegment(category)}/${encodeURIComponent(slug)}`;
}

/** Append an existing query string (preserves list filters when opening detail). */
export function codexPathWithQuery(
  path: string,
  queryString: string | null | undefined,
): string {
  const q = queryString?.trim();
  if (!q) return path;
  return `${path}?${q}`;
}

/** Bookmarkable deep link (path-based). */
export function codexDeepLink(category: CodexCategory, slug: string): string {
  return codexDetailPath(category, slug);
}

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Maps legacy `/codex?category=&slug=` (and `?search=`) to path routes.
 * Returns `/codex/spells` when no legacy params are present.
 */
export function legacyCodexSearchParamsToPath(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const category = parseCodexCategory(firstParam(searchParams.category));
  const slug = firstParam(searchParams.slug);
  const search = firstParam(searchParams.search);

  if (slug) {
    return codexDetailPath(category, slug);
  }

  if (firstParam(searchParams.category) || search) {
    return codexCategoryPath(category, search);
  }

  return codexCategoryPath("Spells");
}
