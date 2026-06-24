/**
 * Shared Open5e SRD item ingest.
 *
 * Paginates `codex_items` from Open5e v2 `/items/`. Unlike spells and creatures
 * (5.1 / `srd-2014`), Open5e's item corpus is published under the 2024 SRD
 * document (`srd-2024`, ~440 rows).
 *
 * @see packages/db/src/ingest/open5e-spells.ts
 * @see docs/data-sources.md §1
 */
import { sql } from "drizzle-orm";

import type { Database } from "../client";
import { codexItems } from "../schema/codex";

/** Open5e v2 document key for the WotC 2024 System Reference Document items. */
export const OPEN5E_SRD_ITEMS_DOCUMENT_KEY = "srd-2024";

const DEFAULT_BASE_URL = "https://api.open5e.com/v2/items/";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 100;

export interface Open5eItem {
  key: string;
  name: string;
  desc?: string | null;
  category?: { name?: string | null; key?: string | null } | null;
  cost?: string | null;
  weight?: string | null;
  weight_unit?: string | null;
  [field: string]: unknown;
}

interface Open5eListResponse {
  count: number;
  next: string | null;
  results: Open5eItem[];
}

export interface IngestItemsOptions {
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

export interface IngestItemsResult {
  fetched: number;
  upserted: number;
  pruned: number;
  pages: number;
  documentKey: string;
  durationMs: number;
}

export function itemToRow(item: Open5eItem) {
  return {
    slug: item.key.replace(/\//g, "-"),
    name: item.name,
    category: item.category?.key ?? null,
    description: item.desc ?? null,
    cost: item.cost ?? null,
    weight: item.weight ?? null,
    weightUnit: item.weight_unit ?? null,
    source: "open5e",
    raw: item as Record<string, unknown>,
  };
}

async function upsertPage(db: Database, items: Open5eItem[]): Promise<number> {
  if (items.length === 0) return 0;
  await db
    .insert(codexItems)
    .values(items.map(itemToRow))
    .onConflictDoUpdate({
      target: codexItems.slug,
      set: {
        name: sql`excluded.name`,
        category: sql`excluded.category`,
        description: sql`excluded.description`,
        cost: sql`excluded.cost`,
        weight: sql`excluded.weight`,
        weightUnit: sql`excluded.weight_unit`,
        source: sql`excluded.source`,
        raw: sql`excluded.raw`,
        ingestedAt: sql`now()`,
      },
    });
  return items.length;
}

export async function ingestOpen5eItems(
  options: IngestItemsOptions,
): Promise<IngestItemsResult> {
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
        `[ingest:open5e-items] Exceeded maxPages=${maxPages}; aborting`,
      );
    }

    logger(`[ingest:open5e-items] GET ${nextUrl}`);
    const res = await fetchImpl(nextUrl, {
      headers: {
        "User-Agent": "loreforge-ingest",
        Accept: "application/json",
      },
      signal,
    });
    if (!res.ok) {
      throw new Error(
        `[ingest:open5e-items] Open5e API ${res.status}: ${await res.text()}`,
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
      .delete(codexItems)
      .where(
        sql`${codexItems.source} = 'open5e'
          and (${codexItems.raw} #>> '{document,key}') is distinct from ${documentKey}`,
      )
      .returning({ slug: codexItems.slug });
    pruned = deleted.length;
    if (pruned > 0) {
      logger(
        `[ingest:open5e-items] Pruned ${pruned} non-'${documentKey}' row(s)`,
      );
    }
  }

  const durationMs = Date.now() - start;
  logger(
    `[ingest:open5e-items] Upserted ${upserted} item(s) across ${pages} page(s) ` +
      `from document '${documentKey}' in ${durationMs}ms`,
  );

  return { fetched, upserted, pruned, pages, documentKey, durationMs };
}
