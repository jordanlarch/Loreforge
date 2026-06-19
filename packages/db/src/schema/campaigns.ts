import {
  index,
  pgTable,
  text,
  timestamp,
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
