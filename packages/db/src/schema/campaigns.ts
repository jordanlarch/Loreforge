import {
  boolean,
  index,
  integer,
  jsonb,
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

/** Plot-hook lifecycle stages for the campaign Hooks Kanban (#59, Q7). */
type PlotHookStatus =
  | "suggested"
  | "open"
  | "active"
  | "resolved"
  | "abandoned";

/**
 * First-class, campaign-scoped plot hooks (#59, Q7). Hooks live embedded on
 * Realms entities until *accepted* into a campaign, at which point they become a
 * row here and move through the Kanban lifecycle. `sourceEntityId` records the
 * Realms entity a hook was accepted from (null for hooks authored directly in
 * the campaign). `ownerId` is denormalized for owner-scoped queries.
 */
export const plotHooks = pgTable(
  "plot_hooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull(),
    ownerId: uuid("owner_id").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    status: text("status").notNull().$type<PlotHookStatus>().default("suggested"),
    /** The Realms entity this hook was accepted from, if any. */
    sourceEntityId: uuid("source_entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("plot_hooks_campaign_idx").on(t.campaignId),
    index("plot_hooks_owner_idx").on(t.ownerId),
  ],
);

/** A resolved dice expression rendered as a structured chat widget (#57). */
export type ChatDiceRoll = {
  notation: string;
  rolls: number[];
  modifier: number;
  total: number;
};

/**
 * Durable live-play chat log (#96). Live narration rides the Yjs doc during a
 * session (server-authoritative, see `services/ws-server/src/chat.ts`); this
 * table makes it **persistent** so the conversation survives a room unload /
 * cold reload and can be re-hydrated on rejoin.
 *
 * Deliberately separate from `engine_events`: chat is non-deterministic (AI-GM
 * narration), so persisting it into the deterministic engine log would break
 * replay. `seq` is a per-campaign monotonic order assigned by the WS server (the
 * sole writer) so re-hydration preserves order without relying on timestamps.
 * `mentions` records the world-entity names the GM referenced (@Entity chips).
 */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull(),
    /** Per-campaign monotonic ordering, assigned by the authoritative writer. */
    seq: integer("seq").notNull(),
    /** gm | player | event | roll | ooc */
    kind: text("kind").notNull(),
    author: text("author").notNull(),
    /** Player input mode (speak/action/check/cast/attack/use_item), if any. */
    mode: text("mode"),
    text: text("text").notNull(),
    /** Structured dice result for `roll` entries. */
    dice: jsonb("dice").$type<ChatDiceRoll>(),
    /** World-entity names the GM referenced (@Entity chips, #96). */
    mentions: jsonb("mentions").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("chat_messages_campaign_seq_unique").on(t.campaignId, t.seq),
    index("chat_messages_campaign_idx").on(t.campaignId),
  ],
);
