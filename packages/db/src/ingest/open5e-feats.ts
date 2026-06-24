/**
 * Shared Open5e SRD feat ingest.
 *
 * @see packages/db/src/ingest/open5e-items.ts
 */
import { sql } from "drizzle-orm";

import type { Database } from "../client";
import { codexFeats } from "../schema/codex";
import { OPEN5E_SRD_ITEMS_DOCUMENT_KEY } from "./open5e-items";

const DEFAULT_BASE_URL = "https://api.open5e.com/v2/feats/";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 20;

export interface Open5eFeat {
  key: string;
  name: string;
  desc?: string | null;
  prerequisite?: string | null;
  type?: string | null;
  benefits?: { desc?: string | null }[] | null;
  [field: string]: unknown;
}

interface Open5eListResponse {
  count: number;
  next: string | null;
  results: Open5eFeat[];
}

export interface IngestFeatsOptions {
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

export interface IngestFeatsResult {
  fetched: number;
  upserted: number;
  pruned: number;
  pages: number;
  documentKey: string;
  durationMs: number;
}

export function featToRow(feat: Open5eFeat) {
  return {
    slug: feat.key.replace(/\//g, "-"),
    name: feat.name,
    description: feat.desc?.trim() || null,
    prerequisite: feat.prerequisite?.trim() || null,
    featType: feat.type?.trim() || null,
    source: "open5e",
    raw: feat as Record<string, unknown>,
  };
}

async function upsertPage(db: Database, feats: Open5eFeat[]): Promise<number> {
  if (feats.length === 0) return 0;
  await db
    .insert(codexFeats)
    .values(feats.map(featToRow))
    .onConflictDoUpdate({
      target: codexFeats.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        prerequisite: sql`excluded.prerequisite`,
        featType: sql`excluded.feat_type`,
        source: sql`excluded.source`,
        raw: sql`excluded.raw`,
        ingestedAt: sql`now()`,
      },
    });
  return feats.length;
}

export async function ingestOpen5eFeats(
  options: IngestFeatsOptions,
): Promise<IngestFeatsResult> {
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
      throw new Error(`[ingest:open5e-feats] Exceeded maxPages=${maxPages}; aborting`);
    }

    logger(`[ingest:open5e-feats] GET ${nextUrl}`);
    const res = await fetchImpl(nextUrl, {
      headers: {
        "User-Agent": "loreforge-ingest",
        Accept: "application/json",
      },
      signal,
    });
    if (!res.ok) {
      throw new Error(
        `[ingest:open5e-feats] Open5e API ${res.status}: ${await res.text()}`,
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
      .delete(codexFeats)
      .where(
        sql`${codexFeats.source} = 'open5e'
          and (${codexFeats.raw} #>> '{document,key}') is distinct from ${documentKey}`,
      )
      .returning({ slug: codexFeats.slug });
    pruned = deleted.length;
    if (pruned > 0) {
      logger(`[ingest:open5e-feats] Pruned ${pruned} non-'${documentKey}' row(s)`);
    }
  }

  const durationMs = Date.now() - start;
  logger(
    `[ingest:open5e-feats] Upserted ${upserted} feat(s) across ${pages} page(s) ` +
      `from document '${documentKey}' in ${durationMs}ms`,
  );

  return { fetched, upserted, pruned, pages, documentKey, durationMs };
}
