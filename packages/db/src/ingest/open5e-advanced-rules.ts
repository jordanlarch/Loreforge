/**
 * @deprecated SRD-AUDIT-10 — superseded by hand-seeded `codex_toolbox_entries`
 * (`srd-2024_*` slugs, mandatory Q3 definitions). Open5e keys use legacy
 * `srd_traps_*` / `srd_diseases_*` prefixes and prose-only rows — wrong IA for
 * Gameplay Toolbox. Nightly ingest removed; table retained for orphan rows only.
 * Manual CLI kept for one-off comparison: `npm run ingest:open5e-advanced-rules`.
 *
 * Open5e optional / advanced SRD rules (traps, poisons, diseases, madness,
 * environment) from the `/v2/rules/` corpus. Content spans legacy `srd` and
 * `srd-2024` documents — filtered by rule key prefix, not document key.
 */
import { inArray, notInArray, sql } from "drizzle-orm";

import type { Database } from "../client";
import { codexAdvancedRules } from "../schema/codex";
import { open5eKeyToSlug } from "./open5e-rules";

const DEFAULT_BASE_URL = "https://api.open5e.com/v2/rules/";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 20;

export const ADVANCED_RULE_TOPICS = [
  "traps",
  "poisons",
  "curses",
  "fear",
  "environment",
] as const;

export type AdvancedRuleTopic = (typeof ADVANCED_RULE_TOPICS)[number];

export interface Open5eRule {
  key: string;
  name: string;
  desc?: string | null;
  [field: string]: unknown;
}

interface Open5eListResponse {
  count: number;
  next: string | null;
  results: Open5eRule[];
}

export interface IngestAdvancedRulesOptions {
  db: Database;
  pageSize?: number;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  logger?: (message: string) => void;
  signal?: AbortSignal;
  maxPages?: number;
}

export interface IngestAdvancedRulesResult {
  fetched: number;
  matched: number;
  upserted: number;
  pruned: number;
  pages: number;
  durationMs: number;
}

const EXPLICIT_KEYS: Record<string, AdvancedRuleTopic> = {
  "srd-2024_exploration_hazards": "environment",
};

const KEY_PREFIXES: [string, AdvancedRuleTopic][] = [
  ["srd_traps_", "traps"],
  ["srd_poisons_", "poisons"],
  ["srd_diseases_", "curses"],
  ["srd_madness_", "fear"],
  ["srd_environment_", "environment"],
];

/** Map an Open5e rule key to a Codex Advanced topic, or null if out of scope. */
export function classifyAdvancedRuleKey(key: string): AdvancedRuleTopic | null {
  const explicit = EXPLICIT_KEYS[key];
  if (explicit) return explicit;
  for (const [prefix, topic] of KEY_PREFIXES) {
    if (key.startsWith(prefix)) return topic;
  }
  return null;
}

export function advancedRuleToRow(rule: Open5eRule, topic: AdvancedRuleTopic, sortIndex: number) {
  return {
    slug: open5eKeyToSlug(rule.key),
    name: rule.name,
    description: rule.desc?.trim() || null,
    topic,
    sortIndex,
    source: "open5e",
    raw: rule as Record<string, unknown>,
  };
}

async function upsertRules(
  db: Database,
  rules: { rule: Open5eRule; topic: AdvancedRuleTopic; sortIndex: number }[],
): Promise<number> {
  if (rules.length === 0) return 0;
  await db
    .insert(codexAdvancedRules)
    .values(rules.map(({ rule, topic, sortIndex }) => advancedRuleToRow(rule, topic, sortIndex)))
    .onConflictDoUpdate({
      target: codexAdvancedRules.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        topic: sql`excluded.topic`,
        sortIndex: sql`excluded.sort_index`,
        source: sql`excluded.source`,
        raw: sql`excluded.raw`,
        ingestedAt: sql`now()`,
      },
    });
  return rules.length;
}

export async function ingestOpen5eAdvancedRules(
  options: IngestAdvancedRulesOptions,
): Promise<IngestAdvancedRulesResult> {
  const {
    db,
    pageSize = DEFAULT_PAGE_SIZE,
    baseUrl = DEFAULT_BASE_URL,
    fetchImpl = fetch,
    logger = () => {},
    signal,
    maxPages = DEFAULT_MAX_PAGES,
  } = options;

  const start = Date.now();
  const firstUrl = new URL(baseUrl);
  firstUrl.searchParams.set("format", "json");
  firstUrl.searchParams.set("limit", String(pageSize));

  let nextUrl: string | null = firstUrl.toString();
  let fetched = 0;
  let matched = 0;
  let upserted = 0;
  let pages = 0;
  const matchedRules: { rule: Open5eRule; topic: AdvancedRuleTopic; sortIndex: number }[] = [];

  while (nextUrl) {
    if (pages >= maxPages) {
      throw new Error(
        `[ingest:open5e-advanced-rules] Exceeded maxPages=${maxPages}; aborting`,
      );
    }

    logger(`[ingest:open5e-advanced-rules] GET ${nextUrl}`);
    const res = await fetchImpl(nextUrl, {
      headers: {
        "User-Agent": "loreforge-ingest",
        Accept: "application/json",
      },
      signal,
    });
    if (!res.ok) {
      throw new Error(
        `[ingest:open5e-advanced-rules] Open5e API ${res.status}: ${await res.text()}`,
      );
    }

    const data = (await res.json()) as Open5eListResponse;
    pages += 1;
    fetched += data.results.length;

    for (const rule of data.results) {
      const topic = classifyAdvancedRuleKey(rule.key);
      if (!topic) continue;
      matchedRules.push({ rule, topic, sortIndex: matchedRules.length });
    }

    nextUrl = data.next;
  }

  matched = matchedRules.length;
  upserted = await upsertRules(db, matchedRules);

  let pruned = 0;
  if (upserted > 0) {
    const keptSlugs = matchedRules.map(({ rule }) => open5eKeyToSlug(rule.key));
    const deleted = await db
      .delete(codexAdvancedRules)
      .where(
        notInArray(codexAdvancedRules.slug, keptSlugs.length > 0 ? keptSlugs : [""]),
      )
      .returning({ slug: codexAdvancedRules.slug });
    pruned = deleted.length;
    if (pruned > 0) {
      logger(`[ingest:open5e-advanced-rules] Pruned ${pruned} stale row(s)`);
    }
  } else {
    const deleted = await db
      .delete(codexAdvancedRules)
      .where(inArray(codexAdvancedRules.source, ["open5e"]))
      .returning({ slug: codexAdvancedRules.slug });
    pruned = deleted.length;
  }

  const durationMs = Date.now() - start;
  logger(
    `[ingest:open5e-advanced-rules] Upserted ${upserted} advanced rule(s) ` +
      `(${matched} matched of ${fetched} fetched) across ${pages} page(s) in ${durationMs}ms`,
  );

  return { fetched, matched, upserted, pruned, pages, durationMs };
}
