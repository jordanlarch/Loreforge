/**
 * Shared Open5e SRD rules ingest (rulesets → chapters + nested sections).
 *
 * @see packages/db/src/ingest/open5e-items.ts
 */
import { sql } from "drizzle-orm";

import type { Database } from "../client";
import { codexRuleChapters, codexRuleSections } from "../schema/codex";
import { OPEN5E_SRD_ITEMS_DOCUMENT_KEY } from "./open5e-items";

const DEFAULT_BASE_URL = "https://api.open5e.com/v2/rulesets/";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 20;

export interface Open5eRuleSection {
  key: string;
  name: string;
  desc?: string | null;
  [field: string]: unknown;
}

export interface Open5eRuleset {
  key: string;
  name: string;
  desc?: string | null;
  rules?: Open5eRuleSection[] | null;
  [field: string]: unknown;
}

interface Open5eListResponse {
  count: number;
  next: string | null;
  results: Open5eRuleset[];
}

export interface IngestRulesOptions {
  db: Database;
  documentKey?: string;
  pageSize?: number;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  logger?: (message: string) => void;
  signal?: AbortSignal;
  maxPages?: number;
  pruneOtherDocuments?: boolean;
}

export interface IngestRulesResult {
  fetchedChapters: number;
  upsertedChapters: number;
  upsertedSections: number;
  prunedChapters: number;
  prunedSections: number;
  pages: number;
  documentKey: string;
  durationMs: number;
}

export function open5eKeyToSlug(key: string): string {
  return key.replace(/\//g, "-");
}

export function rulesetToChapterRow(ruleset: Open5eRuleset, sortIndex: number) {
  return {
    slug: open5eKeyToSlug(ruleset.key),
    name: ruleset.name,
    description: ruleset.desc?.trim() || null,
    sortIndex,
    source: "open5e",
    raw: ruleset as Record<string, unknown>,
  };
}

export function ruleSectionToRow(
  section: Open5eRuleSection,
  chapterSlug: string,
  sortIndex: number,
) {
  return {
    slug: open5eKeyToSlug(section.key),
    name: section.name,
    description: section.desc?.trim() || null,
    chapterSlug,
    sortIndex,
    source: "open5e",
    raw: section as Record<string, unknown>,
  };
}

async function upsertRulesets(
  db: Database,
  rulesets: Open5eRuleset[],
  chapterOffset: number,
): Promise<{ chapters: number; sections: number }> {
  if (rulesets.length === 0) return { chapters: 0, sections: 0 };

  const chapterRows = rulesets.map((ruleset, i) =>
    rulesetToChapterRow(ruleset, chapterOffset + i),
  );
  await db
    .insert(codexRuleChapters)
    .values(chapterRows)
    .onConflictDoUpdate({
      target: codexRuleChapters.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        sortIndex: sql`excluded.sort_index`,
        source: sql`excluded.source`,
        raw: sql`excluded.raw`,
        ingestedAt: sql`now()`,
      },
    });

  const sectionRows = rulesets.flatMap((ruleset, chapterIndex) => {
    const chapterSlug = open5eKeyToSlug(ruleset.key);
    return (ruleset.rules ?? []).map((section, sectionIndex) =>
      ruleSectionToRow(section, chapterSlug, sectionIndex),
    );
  });

  if (sectionRows.length > 0) {
    await db
      .insert(codexRuleSections)
      .values(sectionRows)
      .onConflictDoUpdate({
        target: codexRuleSections.slug,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          chapterSlug: sql`excluded.chapter_slug`,
          sortIndex: sql`excluded.sort_index`,
          source: sql`excluded.source`,
          raw: sql`excluded.raw`,
          ingestedAt: sql`now()`,
        },
      });
  }

  return { chapters: chapterRows.length, sections: sectionRows.length };
}

export async function ingestOpen5eRules(
  options: IngestRulesOptions,
): Promise<IngestRulesResult> {
  const {
    db,
    documentKey = OPEN5E_SRD_ITEMS_DOCUMENT_KEY,
    pageSize = DEFAULT_PAGE_SIZE,
    baseUrl = DEFAULT_BASE_URL,
    fetchImpl = fetch,
    logger = () => {},
    signal,
    maxPages = DEFAULT_MAX_PAGES,
    pruneOtherDocuments = true,
  } = options;

  const start = Date.now();
  const firstUrl = new URL(baseUrl);
  firstUrl.searchParams.set("format", "json");
  firstUrl.searchParams.set("limit", String(pageSize));
  if (documentKey) {
    firstUrl.searchParams.set("document__key", documentKey);
  }

  let nextUrl: string | null = firstUrl.toString();
  let fetchedChapters = 0;
  let upsertedChapters = 0;
  let upsertedSections = 0;
  let pages = 0;

  while (nextUrl) {
    if (pages >= maxPages) {
      throw new Error(`[ingest:open5e-rules] Exceeded maxPages=${maxPages}; aborting`);
    }

    logger(`[ingest:open5e-rules] GET ${nextUrl}`);
    const res = await fetchImpl(nextUrl, {
      headers: {
        "User-Agent": "loreforge-ingest",
        Accept: "application/json",
      },
      signal,
    });
    if (!res.ok) {
      throw new Error(
        `[ingest:open5e-rules] Open5e API ${res.status}: ${await res.text()}`,
      );
    }

    const data = (await res.json()) as Open5eListResponse;
    pages += 1;
    fetchedChapters += data.results.length;
    const { chapters, sections } = await upsertRulesets(
      db,
      data.results,
      upsertedChapters,
    );
    upsertedChapters += chapters;
    upsertedSections += sections;
    nextUrl = data.next;
  }

  let prunedChapters = 0;
  let prunedSections = 0;
  if (pruneOtherDocuments && documentKey && upsertedChapters > 0) {
    const deletedChapters = await db
      .delete(codexRuleChapters)
      .where(
        sql`${codexRuleChapters.source} = 'open5e'
          and (${codexRuleChapters.raw} #>> '{document,key}') is distinct from ${documentKey}`,
      )
      .returning({ slug: codexRuleChapters.slug });
    prunedChapters = deletedChapters.length;

    const keptChapters = await db
      .select({ slug: codexRuleChapters.slug })
      .from(codexRuleChapters)
      .where(
        sql`${codexRuleChapters.source} = 'open5e'
          and (${codexRuleChapters.raw} #>> '{document,key}') = ${documentKey}`,
      );
    const keptSlugs = keptChapters.map((row) => row.slug);

    if (keptSlugs.length === 0) {
      const deletedSections = await db
        .delete(codexRuleSections)
        .where(sql`${codexRuleSections.source} = 'open5e'`)
        .returning({ slug: codexRuleSections.slug });
      prunedSections = deletedSections.length;
    } else {
      const deletedSections = await db
        .delete(codexRuleSections)
        .where(
          sql`${codexRuleSections.source} = 'open5e'
            and ${codexRuleSections.chapterSlug} not in (${sql.join(
              keptSlugs.map((slug) => sql`${slug}`),
              sql`, `,
            )})`,
        )
        .returning({ slug: codexRuleSections.slug });
      prunedSections = deletedSections.length;
    }

    if (prunedChapters > 0 || prunedSections > 0) {
      logger(
        `[ingest:open5e-rules] Pruned ${prunedChapters} chapter(s), ${prunedSections} section(s) from other documents`,
      );
    }
  }

  const durationMs = Date.now() - start;
  logger(
    `[ingest:open5e-rules] Upserted ${upsertedChapters} chapter(s), ${upsertedSections} section(s) ` +
      `across ${pages} page(s) from document '${documentKey}' in ${durationMs}ms`,
  );

  return {
    fetchedChapters,
    upsertedChapters,
    upsertedSections,
    prunedChapters,
    prunedSections,
    pages,
    documentKey,
    durationMs,
  };
}
