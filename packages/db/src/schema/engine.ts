import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/** Engine event envelope metadata persisted alongside type + payload. */
export type EngineEventMeta = {
  /** Server epoch ms when the producing command ran. */
  timestamp: number;
  /** Command that produced this event. */
  causedByCommandId: string;
  /** Who caused it (entity ref, "ai", or "system"). */
  actor?: string;
};

/** Immutable engine events — source of truth for campaign state. */
export const engineEvents = pgTable(
  "engine_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull(),
    sessionId: uuid("session_id"),
    sequence: bigint("sequence", { mode: "number" }).notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    meta: jsonb("meta").notNull().$type<EngineEventMeta>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("engine_events_campaign_seq_idx").on(t.campaignId, t.sequence),
    index("engine_events_campaign_idx").on(t.campaignId),
    // Per-campaign sequence is unique: the correctness backstop that makes
    // PgEventStore.append race-safe (a duplicate sequence insert fails rather
    // than silently corrupting the log).
    unique("engine_events_campaign_seq_unique").on(t.campaignId, t.sequence),
  ],
);

/** Periodic projection snapshots for fast hydration. */
export const engineSnapshots = pgTable(
  "engine_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull(),
    snapshotAtEventId: uuid("snapshot_at_event_id").notNull(),
    state: jsonb("state").notNull().$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("engine_snapshots_campaign_idx").on(t.campaignId)],
);

/** Commands submitted by UI or LLM; may produce zero or many events. */
export const engineCommandLog = pgTable(
  "engine_command_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull(),
    commandType: text("command_type").notNull(),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    accepted: boolean("accepted").notNull().default(false),
    rejectionReason: text("rejection_reason"),
    eventsProduced: jsonb("events_produced")
      .notNull()
      .$type<string[]>()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("engine_command_log_campaign_idx").on(t.campaignId)],
);

/** Deterministic RNG seeds per campaign scope. */
export const engineSeeds = pgTable(
  "engine_seeds",
  {
    campaignId: uuid("campaign_id").notNull(),
    scope: text("scope").notNull(),
    seed: text("seed").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.campaignId, t.scope] }),
    index("engine_seeds_campaign_scope_idx").on(t.campaignId, t.scope),
  ],
);
