/**
 * Realms entity deletion helpers — shared by campaign delete (cascade world
 * cleanup) and any future explicit entity delete surface.
 */
import { and, eq, inArray, ne, or } from "drizzle-orm";

import type { Database } from "@app/db";
import {
  campaignWorldEntities,
  generationEvents,
  realmEntities,
  realmRelationships,
} from "@app/db";
import { deleteSourceEmbeddings, REALM_ENTITY_SOURCE } from "@app/memory";

import { deleteCrossLinkEmbeddingsBestEffort } from "@/server/memory/cross-link";

/**
 * Given entity ids attached to a campaign, return those not linked to any other
 * campaign's world (safe to delete when the campaign goes away).
 */
export function campaignExclusiveEntityIds(
  campaignEntityIds: readonly string[],
  entityIdsInOtherCampaigns: readonly string[],
): string[] {
  const shared = new Set(entityIdsInOtherCampaigns);
  return campaignEntityIds.filter((id) => !shared.has(id));
}

/** Resolve campaign-world entity ids that exist only on this campaign. */
export async function listCampaignExclusiveEntityIds(
  db: Database,
  ownerId: string,
  campaignId: string,
): Promise<string[]> {
  const worldRows = await db
    .select({ entityId: campaignWorldEntities.entityId })
    .from(campaignWorldEntities)
    .where(
      and(
        eq(campaignWorldEntities.campaignId, campaignId),
        eq(campaignWorldEntities.ownerId, ownerId),
      ),
    );
  const campaignEntityIds = worldRows.map((r) => r.entityId);
  if (campaignEntityIds.length === 0) return [];

  const sharedRows = await db
    .select({ entityId: campaignWorldEntities.entityId })
    .from(campaignWorldEntities)
    .where(
      and(
        inArray(campaignWorldEntities.entityId, campaignEntityIds),
        ne(campaignWorldEntities.campaignId, campaignId),
      ),
    );
  return campaignExclusiveEntityIds(
    campaignEntityIds,
    sharedRows.map((r) => r.entityId),
  );
}

/**
 * Delete owned Realms entities and their dependents (relationships, embeddings,
 * generation audit rows, world membership). No-ops on an empty id list.
 */
export async function deleteRealmEntitiesForOwner(
  db: Database,
  ownerId: string,
  entityIds: readonly string[],
): Promise<void> {
  if (entityIds.length === 0) return;

  const owned = await db
    .select({ id: realmEntities.id })
    .from(realmEntities)
    .where(
      and(eq(realmEntities.ownerId, ownerId), inArray(realmEntities.id, entityIds)),
    );
  const ids = owned.map((r) => r.id);
  if (ids.length === 0) return;

  const relRows = await db
    .select({ id: realmRelationships.id })
    .from(realmRelationships)
    .where(
      and(
        eq(realmRelationships.ownerId, ownerId),
        or(
          inArray(realmRelationships.fromId, ids),
          inArray(realmRelationships.toId, ids),
        ),
      ),
    );
  for (const rel of relRows) {
    await deleteCrossLinkEmbeddingsBestEffort(db, rel.id);
  }

  await db
    .delete(realmRelationships)
    .where(
      and(
        eq(realmRelationships.ownerId, ownerId),
        or(
          inArray(realmRelationships.fromId, ids),
          inArray(realmRelationships.toId, ids),
        ),
      ),
    );

  for (const id of ids) {
    try {
      await deleteSourceEmbeddings(db, REALM_ENTITY_SOURCE, id);
    } catch (error) {
      console.warn(
        `[memory] realm_entity embedding delete failed for ${id}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  await db
    .delete(generationEvents)
    .where(
      and(
        eq(generationEvents.ownerId, ownerId),
        inArray(generationEvents.entityId, ids),
      ),
    );

  await db
    .delete(campaignWorldEntities)
    .where(
      and(
        eq(campaignWorldEntities.ownerId, ownerId),
        inArray(campaignWorldEntities.entityId, ids),
      ),
    );

  await db
    .delete(realmEntities)
    .where(and(eq(realmEntities.ownerId, ownerId), inArray(realmEntities.id, ids)));
}
