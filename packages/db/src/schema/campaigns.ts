import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Campaigns — the top-level unit of play, owned by a Supabase auth user.
 *
 * A campaign's mechanical state is event-sourced: every accepted command
 * appends immutable rows to `engine_events` (keyed by `campaign_id`), and the
 * deterministic engine rebuilds `WorldState` from that log. The campaign id is
 * also the engine's per-campaign RNG seed, so replay is reproducible.
 */
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("campaigns_owner_idx").on(t.ownerId)],
);

/**
 * Campaign ↔ Realms-entity membership with per-campaign discovery state (#60,
 * Q11). A Realms entity is authored once and can appear in many campaigns; each
 * campaign tracks whether the party has *discovered* it. `discovered` flips
 * either manually (DM reveal) or via the auto-reveal seam when AI narration
 * references the entity. `ownerId` is denormalized for owner-scoped queries,
 * matching the no-FK, app-scoped convention used across the schema.
 */
export const campaignWorldEntities = pgTable(
  "campaign_world_entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull(),
    entityId: uuid("entity_id").notNull(),
    ownerId: uuid("owner_id").notNull(),
    /** Whether the party has discovered this entity in this campaign (Q11). */
    discovered: boolean("discovered").notNull().default(false),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("campaign_world_entities_unique_idx").on(
      t.campaignId,
      t.entityId,
    ),
    index("campaign_world_entities_campaign_idx").on(t.campaignId),
    index("campaign_world_entities_entity_idx").on(t.entityId),
    index("campaign_world_entities_owner_idx").on(t.ownerId),
  ],
);
