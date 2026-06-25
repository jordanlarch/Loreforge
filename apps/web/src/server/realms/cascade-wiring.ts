/**
 * Deterministic post-cascade relationship wiring (Rung 4 Slice 3).
 *
 * Region/faction generators attach NPC stubs to the parent, but Live Play
 * spawns tokens from edges on the *entered* location. When an NPC summary
 * names a tavern/building/settlement in the same cascade, link them here.
 */
import { and, eq, inArray, or } from "drizzle-orm";

import {
  realmEntities,
  realmRelationships,
  type Database,
} from "@app/db";

import { inheritQuestDataFromParent, locationHasQuestContent } from "@app/engine";

import type { RealmEntityType } from "@/lib/realms";

const LOCATION_TYPES = new Set<RealmEntityType>([
  "tavern",
  "shop",
  "building",
  "settlement",
  "dungeon",
]);

export type CascadeEntityRef = {
  id: string;
  name: string;
  summary: string;
  type: RealmEntityType;
};

/** Match an orphan NPC stub to a sibling location in the same cascade. */
export function matchNpcToCascadeLocation(
  npc: Pick<CascadeEntityRef, "name" | "summary">,
  locations: readonly CascadeEntityRef[],
): CascadeEntityRef | undefined {
  if (locations.length === 0) return undefined;
  const haystack = `${npc.name} ${npc.summary}`.toLowerCase();

  const byNameLength = [...locations].sort(
    (a, b) => b.name.length - a.name.length,
  );
  for (const loc of byNameLength) {
    const needle = loc.name.toLowerCase().trim();
    if (needle.length >= 4 && haystack.includes(needle)) return loc;
  }

  if (
    /\b(barkeep|innkeeper|bartender|tavernkeeper|publican)\b/i.test(npc.summary)
  ) {
    return (
      locations.find((l) => l.type === "tavern") ??
      locations.find((l) => l.type === "building")
    );
  }

  if (/\b(village elder|mayor|elder|matriarch)\b/i.test(npc.summary)) {
    return locations.find((l) => l.type === "settlement");
  }

  return undefined;
}

/**
 * Insert location↔NPC edges for cascade siblings that clearly belong together.
 * Idempotent — skips when an edge already exists between the pair.
 */
export async function wireCascadeNpcLocations(
  db: Database,
  ownerId: string,
  parentId: string,
): Promise<number> {
  const rels = await db
    .select({ toId: realmRelationships.toId })
    .from(realmRelationships)
    .where(
      and(
        eq(realmRelationships.ownerId, ownerId),
        eq(realmRelationships.fromId, parentId),
      ),
    );
  if (rels.length === 0) return 0;

  const childIds = rels.map((r) => r.toId);
  const allRows = await db
    .select({
      id: realmEntities.id,
      name: realmEntities.name,
      summary: realmEntities.summary,
      type: realmEntities.type,
    })
    .from(realmEntities)
    .where(
      and(eq(realmEntities.ownerId, ownerId), inArray(realmEntities.id, childIds)),
    );

  const npcs = allRows.filter(
    (r): r is CascadeEntityRef =>
      r.type === "npc" &&
      typeof r.name === "string" &&
      typeof r.summary === "string",
  );
  const locations = allRows.filter(
    (r): r is CascadeEntityRef =>
      LOCATION_TYPES.has(r.type as RealmEntityType) &&
      typeof r.name === "string" &&
      typeof r.summary === "string",
  );
  if (npcs.length === 0 || locations.length === 0) return 0;

  let created = 0;
  for (const npc of npcs) {
    const location = matchNpcToCascadeLocation(npc, locations);
    if (!location) continue;

    const [existing] = await db
      .select({ id: realmRelationships.id })
      .from(realmRelationships)
      .where(
        and(
          eq(realmRelationships.ownerId, ownerId),
          or(
            and(
              eq(realmRelationships.fromId, location.id),
              eq(realmRelationships.toId, npc.id),
            ),
            and(
              eq(realmRelationships.fromId, npc.id),
              eq(realmRelationships.toId, location.id),
            ),
          ),
        ),
      )
      .limit(1);
    if (existing) continue;

    await db.insert(realmRelationships).values({
      ownerId,
      fromId: location.id,
      toId: npc.id,
      kind: "related_to",
    });
    created += 1;
  }
  return created;
}

/**
 * Copy parent region quest templates onto cascade location stubs that have no
 * quests yet (Phase A.1 — session-start tease at the default tavern).
 */
export async function wireCascadeQuestInheritance(
  db: Database,
  ownerId: string,
  parentId: string,
): Promise<number> {
  const [parent] = await db
    .select({ data: realmEntities.data })
    .from(realmEntities)
    .where(
      and(eq(realmEntities.id, parentId), eq(realmEntities.ownerId, ownerId)),
    )
    .limit(1);
  if (!parent || !locationHasQuestContent(parent.data)) return 0;

  const rels = await db
    .select({ toId: realmRelationships.toId })
    .from(realmRelationships)
    .where(
      and(
        eq(realmRelationships.ownerId, ownerId),
        eq(realmRelationships.fromId, parentId),
      ),
    );
  if (rels.length === 0) return 0;

  const childIds = rels.map((r) => r.toId);
  const children = await db
    .select({
      id: realmEntities.id,
      type: realmEntities.type,
      data: realmEntities.data,
    })
    .from(realmEntities)
    .where(
      and(eq(realmEntities.ownerId, ownerId), inArray(realmEntities.id, childIds)),
    );

  let updated = 0;
  for (const child of children) {
    if (!LOCATION_TYPES.has(child.type as RealmEntityType)) continue;
    const existing =
      child.data && typeof child.data === "object"
        ? (child.data as Record<string, unknown>)
        : {};
    if (locationHasQuestContent(existing)) continue;
    const inherited = inheritQuestDataFromParent(
      parent.data,
      child.id,
      existing,
    );
    if (inherited === existing) continue;
    await db
      .update(realmEntities)
      .set({ data: inherited, updatedAt: new Date() })
      .where(
        and(eq(realmEntities.id, child.id), eq(realmEntities.ownerId, ownerId)),
      );
    updated += 1;
  }
  return updated;
}
