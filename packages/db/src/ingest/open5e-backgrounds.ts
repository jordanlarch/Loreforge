/**
 * Shared Open5e SRD background ingest.
 *
 * @see packages/db/src/ingest/open5e-items.ts
 */
import { sql } from "drizzle-orm";

import type { Database } from "../client";
import { codexBackgrounds } from "../schema/codex";
import { OPEN5E_SRD_ITEMS_DOCUMENT_KEY } from "./open5e-items";

const DEFAULT_BASE_URL = "https://api.open5e.com/v2/backgrounds/";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 20;

export interface Open5eBackground {
  key: string;
  name: string;
  desc?: string | null;
  benefits?: { name?: string | null; desc?: string | null; type?: string | null }[] | null;
  [field: string]: unknown;
}

interface Open5eListResponse {
  count: number;
  next: string | null;
  results: Open5eBackground[];
}

export interface IngestBackgroundsOptions {
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

export interface IngestBackgroundsResult {
  fetched: number;
  upserted: number;
  pruned: number;
  pages: number;
  documentKey: string;
  durationMs: number;
}

export function backgroundToRow(background: Open5eBackground) {
  return {
    slug: background.key.replace(/\//g, "-"),
    name: background.name,
    description: background.desc?.trim() || null,
    source: "open5e",
    raw: background as Record<string, unknown>,
  };
}

async function upsertPage(
  db: Database,
  backgrounds: Open5eBackground[],
): Promise<number> {
  if (backgrounds.length === 0) return 0;
  await db
    .insert(codexBackgrounds)
    .values(backgrounds.map(backgroundToRow))
    .onConflictDoUpdate({
      target: codexBackgrounds.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        source: sql`excluded.source`,
        raw: sql`excluded.raw`,
        ingestedAt: sql`now()`,
      },
    });
  return backgrounds.length;
}

export async function ingestOpen5eBackgrounds(
  options: IngestBackgroundsOptions,
): Promise<IngestBackgroundsResult> {
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
  let fetched = 0;
  let upserted = 0;
  let pages = 0;

  while (nextUrl) {
    if (pages >= maxPages) {
      throw new Error(
        `[ingest:open5e-backgrounds] Exceeded maxPages=${maxPages}; aborting`,
      );
    }

    logger(`[ingest:open5e-backgrounds] GET ${nextUrl}`);
    const res = await fetchImpl(nextUrl, {
      headers: {
        "User-Agent": "loreforge-ingest",
        Accept: "application/json",
      },
      signal,
    });
    if (!res.ok) {
      throw new Error(
        `[ingest:open5e-backgrounds] Open5e API ${res.status}: ${await res.text()}`,
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
      .delete(codexBackgrounds)
      .where(
        sql`${codexBackgrounds.source} = 'open5e'
          and (${codexBackgrounds.raw} #>> '{document,key}') is distinct from ${documentKey}`,
      )
      .returning({ slug: codexBackgrounds.slug });
    pruned = deleted.length;
    if (pruned > 0) {
      logger(
        `[ingest:open5e-backgrounds] Pruned ${pruned} non-'${documentKey}' row(s)`,
      );
    }
  }

  const durationMs = Date.now() - start;
  logger(
    `[ingest:open5e-backgrounds] Upserted ${upserted} background(s) across ${pages} page(s) ` +
      `from document '${documentKey}' in ${durationMs}ms`,
  );

  return { fetched, upserted, pruned, pages, documentKey, durationMs };
}
