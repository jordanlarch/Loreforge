/**
 * Shared Open5e SRD creature ingest (monsters + beasts).
 *
 * Paginates `codex_monsters` from Open5e v2 `/creatures/`, scoped to the SRD
 * 5.1 document (`srd-2014`, ~325 creatures). Same pattern as spell ingest.
 *
 * @see packages/db/src/ingest/open5e-spells.ts
 * @see docs/data-sources.md §1
 */
import { sql } from "drizzle-orm";

import type { Database } from "../client";
import { codexMonsters } from "../schema/codex";
import { OPEN5E_SRD_DOCUMENT_KEY } from "./open5e-spells";

const DEFAULT_BASE_URL = "https://api.open5e.com/v2/creatures/";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_MAX_PAGES = 100;

export interface Open5eCreature {
  key: string;
  name: string;
  type?: { name?: string | null; key?: string | null } | null;
  size?: { name?: string | null; key?: string | null } | null;
  challenge_rating?: number | null;
  armor_class?: number | null;
  hit_points?: number | null;
  alignment?: string | null;
  [field: string]: unknown;
}

interface Open5eListResponse {
  count: number;
  next: string | null;
  results: Open5eCreature[];
}

export interface IngestCreaturesOptions {
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

export interface IngestCreaturesResult {
  fetched: number;
  upserted: number;
  pruned: number;
  pages: number;
  documentKey: string;
  durationMs: number;
}

/** Format Open5e numeric CR for display (1/8, 1/4, 1/2, …). */
export function formatChallengeRating(
  cr: number | null | undefined,
): string {
  if (cr == null || Number.isNaN(cr)) return "—";
  if (cr === 0.125) return "1/8";
  if (cr === 0.25) return "1/4";
  if (cr === 0.5) return "1/2";
  if (Number.isInteger(cr)) return String(cr);
  return String(cr);
}

export function creatureToRow(creature: Open5eCreature) {
  return {
    slug: creature.key.replace(/\//g, "-"),
    name: creature.name,
    creatureType: creature.type?.key ?? null,
    size: creature.size?.key ?? null,
    challengeRating: creature.challenge_rating ?? null,
    armorClass: creature.armor_class ?? null,
    hitPoints: creature.hit_points ?? null,
    alignment: creature.alignment ?? null,
    source: "open5e",
    raw: creature as Record<string, unknown>,
  };
}

async function upsertPage(
  db: Database,
  creatures: Open5eCreature[],
): Promise<number> {
  if (creatures.length === 0) return 0;
  await db
    .insert(codexMonsters)
    .values(creatures.map(creatureToRow))
    .onConflictDoUpdate({
      target: codexMonsters.slug,
      set: {
        name: sql`excluded.name`,
        creatureType: sql`excluded.creature_type`,
        size: sql`excluded.size`,
        challengeRating: sql`excluded.challenge_rating`,
        armorClass: sql`excluded.armor_class`,
        hitPoints: sql`excluded.hit_points`,
        alignment: sql`excluded.alignment`,
        source: sql`excluded.source`,
        raw: sql`excluded.raw`,
        ingestedAt: sql`now()`,
      },
    });
  return creatures.length;
}

export async function ingestOpen5eCreatures(
  options: IngestCreaturesOptions,
): Promise<IngestCreaturesResult> {
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
        `[ingest:open5e-creatures] Exceeded maxPages=${maxPages}; aborting`,
      );
    }

    logger(`[ingest:open5e-creatures] GET ${nextUrl}`);
    const res = await fetchImpl(nextUrl, {
      headers: {
        "User-Agent": "loreforge-ingest",
        Accept: "application/json",
      },
      signal,
    });
    if (!res.ok) {
      throw new Error(
        `[ingest:open5e-creatures] Open5e API ${res.status}: ${await res.text()}`,
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
      .delete(codexMonsters)
      .where(
        sql`${codexMonsters.source} = 'open5e'
          and (${codexMonsters.raw} #>> '{document,key}') is distinct from ${documentKey}`,
      )
      .returning({ slug: codexMonsters.slug });
    pruned = deleted.length;
    if (pruned > 0) {
      logger(
        `[ingest:open5e-creatures] Pruned ${pruned} non-'${documentKey}' row(s)`,
      );
    }
  }

  const durationMs = Date.now() - start;
  logger(
    `[ingest:open5e-creatures] Upserted ${upserted} creature(s) across ${pages} page(s) ` +
      `from document '${documentKey}' in ${durationMs}ms`,
  );

  return { fetched, upserted, pruned, pages, documentKey, durationMs };
}
