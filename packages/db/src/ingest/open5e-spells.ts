/**
 * Shared Open5e SRD spell ingest.
 *
 * Paginates the full SRD spell list from the Open5e v2 API and upserts every
 * row into `codex_spells`. Called by both the manual CLI
 * (`npm run ingest:open5e`) and the nightly Trigger.dev task so the two never
 * drift. Connection lifecycle is owned by the caller — pass in a `Database`.
 *
 * Source filtering: Open5e v2 mixes many publishers (A5e, Kobold Press, …) into
 * its 1,900+ spell corpus. We scope to the SRD 5.1 document (`srd-2014`, ~319
 * spells) because the locked decision is "Open5e/5e-bits first, custom SRD 5.2
 * migrate post-GA" (`docs/data-sources.md` §1). Override `documentKey` to widen.
 *
 * @see docs/data-sources.md §1
 */
import { sql } from "drizzle-orm";

import type { Database } from "../client";
import { codexSpells } from "../schema/codex";

/** Open5e v2 document key for the WotC 5.1 System Reference Document. */
export const OPEN5E_SRD_DOCUMENT_KEY = "srd-2014";

const DEFAULT_BASE_URL = "https://api.open5e.com/v2/spells/";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 100;

/** Minimal shape we depend on; the full record is persisted to `raw`. */
export interface Open5eSpell {
  key: string;
  name: string;
  level?: number | null;
  school?: { name?: string | null } | null;
  [field: string]: unknown;
}

interface Open5eListResponse {
  count: number;
  next: string | null;
  results: Open5eSpell[];
}

export interface IngestSpellsOptions {
  /** Drizzle client; caller owns open/close. */
  db: Database;
  /** Open5e document to scope to. Defaults to SRD 5.1 (`srd-2014`). */
  documentKey?: string;
  /** Rows per page request. */
  pageSize?: number;
  /** Override the API base (tests). */
  baseUrl?: string;
  /** Injectable fetch (tests). */
  fetchImpl?: typeof fetch;
  /** Structured log sink. Defaults to no-op. */
  logger?: (message: string) => void;
  /** Abort signal for cancellation / timeouts. */
  signal?: AbortSignal;
  /** Safety cap on pagination to avoid runaway loops. */
  maxPages?: number;
  /**
   * After a successful ingest, delete `open5e`-sourced rows whose origin
   * document differs from `documentKey` (e.g. the old unfiltered spike pulled
   * A5e rows). Keeps the Codex purely SRD. Skipped if nothing was upserted, so
   * a failed fetch can never wipe the table. Defaults to `true`.
   */
  pruneOtherDocuments?: boolean;
}

export interface IngestSpellsResult {
  fetched: number;
  upserted: number;
  pruned: number;
  pages: number;
  documentKey: string;
  durationMs: number;
}

function toRow(spell: Open5eSpell) {
  return {
    slug: spell.key.replace(/\//g, "-"),
    name: spell.name,
    level: spell.level != null ? String(spell.level) : null,
    school: spell.school?.name ?? null,
    source: "open5e",
    raw: spell as Record<string, unknown>,
  };
}

async function upsertPage(db: Database, spells: Open5eSpell[]): Promise<number> {
  if (spells.length === 0) return 0;
  await db
    .insert(codexSpells)
    .values(spells.map(toRow))
    .onConflictDoUpdate({
      target: codexSpells.slug,
      set: {
        name: sql`excluded.name`,
        level: sql`excluded.level`,
        school: sql`excluded.school`,
        source: sql`excluded.source`,
        raw: sql`excluded.raw`,
        ingestedAt: sql`now()`,
      },
    });
  return spells.length;
}

/**
 * Ingest the full SRD spell list, following Open5e's `next` cursor until
 * exhausted. Idempotent: re-running upserts by `slug`.
 */
export async function ingestOpen5eSpells(
  options: IngestSpellsOptions,
): Promise<IngestSpellsResult> {
  const {
    db,
    documentKey = OPEN5E_SRD_DOCUMENT_KEY,
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
  let fetched = 0;
  let upserted = 0;
  let pages = 0;

  while (nextUrl) {
    if (pages >= maxPages) {
      throw new Error(
        `[ingest:open5e] Exceeded maxPages=${maxPages}; aborting to avoid a runaway loop`,
      );
    }

    logger(`[ingest:open5e] GET ${nextUrl}`);
    const res = await fetchImpl(nextUrl, {
      headers: {
        "User-Agent": "loreforge-ingest",
        Accept: "application/json",
      },
      signal,
    });
    if (!res.ok) {
      throw new Error(
        `[ingest:open5e] Open5e API ${res.status}: ${await res.text()}`,
      );
    }

    const data = (await res.json()) as Open5eListResponse;
    pages += 1;
    fetched += data.results.length;
    upserted += await upsertPage(db, data.results);
    nextUrl = data.next;
  }

  let pruned = 0;
  if (pruneOtherDocuments && documentKey && upserted > 0) {
    const deleted = await db
      .delete(codexSpells)
      .where(
        sql`${codexSpells.source} = 'open5e'
          and (${codexSpells.raw} #>> '{document,key}') is distinct from ${documentKey}`,
      )
      .returning({ slug: codexSpells.slug });
    pruned = deleted.length;
    if (pruned > 0) {
      logger(
        `[ingest:open5e] Pruned ${pruned} non-'${documentKey}' open5e row(s)`,
      );
    }
  }

  const durationMs = Date.now() - start;
  logger(
    `[ingest:open5e] Upserted ${upserted} spell(s) across ${pages} page(s) ` +
      `from document '${documentKey}' in ${durationMs}ms`,
  );

  return { fetched, upserted, pruned, pages, documentKey, durationMs };
}
