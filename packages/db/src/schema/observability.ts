import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Live-play / orchestrator surfaces that call an LLM (not Realms generation). */
export type LlmUsageSurface =
  | "narrate"
  | "check_route"
  | "monster_target"
  | "session_summary"
  | "enemy_turn"
  | "recap";

/**
 * Audit row for every LLM call during live play and related orchestration.
 * Realms generation continues to use `generation_events`; this table covers
 * the AI-GM loop so solo prod sessions have unified cost observability.
 */
export const llmUsageEvents = pgTable(
  "llm_usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(),
    campaignId: uuid("campaign_id"),
    surface: text("surface").notNull().$type<LlmUsageSurface>(),
    model: text("model").notNull().default(""),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
    status: text("status").notNull().default("success"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("llm_usage_events_owner_idx").on(t.ownerId),
    index("llm_usage_events_campaign_idx").on(t.campaignId),
    index("llm_usage_events_created_idx").on(t.createdAt),
  ],
);
