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

/** Default play tempo for a campaign (Q19c hybrid model). */
export type CampaignPlayMode = "async" | "live";

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
    /**
     * The authored encounter currently armed for Live Play (CAMP-8, #115). When
     * set, the live room seeds this encounter's foes instead of the default
     * goblin ambush. Null → default fixture. Set by `campaigns.runEncounter`.
     */
    activeEncounterId: uuid("active_encounter_id"),
    /* —— Settings (CAMP-10, #117) —— */
    /** GM persona / tone steering the AI-GM's narration voice. Free text. */
    gmPersona: text("gm_persona").notNull().default(""),
    /** Default play tempo (Q19c hybrid): "async" default or "live". */
    playMode: text("play_mode")
      .notNull()
      .$type<CampaignPlayMode>()
      .default("async"),
    /** Campaign-level art-style lock label (Q16). Free text / preset label. */
    artStyle: text("art_style").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("campaigns_owner_idx").on(t.ownerId)],
);

/** A foe entry on an authored encounter: a monster-catalog template × count. */
export type EncounterFoe = {
  /** `MonsterTemplate` slug from `@app/engine` (goblin/orc/wolf/…). */
  template: string;
  /** How many of this template to field (capped at the map's foe slots). */
  count: number;
  /** Optional display-name override; defaults to the template name. */
  name?: string;
};

/**
 * Authored combat encounters for a campaign (CAMP-8, #115). An encounter is a
 * named foe roster the DM builds in the Combat tab; "Run Now" arms it
 * (`campaigns.activeEncounterId`) and the live room seeds it onto the battle
 * map. Foes reference the engine monster catalog by template slug, so statlines
 * stay in one place. `sourceEntityId` optionally records the Realms entity (e.g.
 * a dungeon) an encounter was built from. `ownerId` is denormalized for
 * owner-scoped queries, matching the app-scoped, no-FK convention.
 */
export const encounters = pgTable(
  "encounters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull(),
    ownerId: uuid("owner_id").notNull(),
    name: text("name").notNull(),
    foes: jsonb("foes").$type<EncounterFoe[]>().notNull().default([]),
    /** The Realms entity this encounter was built from, if any. */
    sourceEntityId: uuid("source_entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("encounters_campaign_idx").on(t.campaignId),
    index("encounters_owner_idx").on(t.ownerId),
  ],
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

/**
 * Free-form campaign notes (#118, CAMP-9). A DM scratchpad scoped to a campaign:
 * each note has a title, a body, and a `shared` flag (DM-only vs visible to
 * players). `ownerId` is denormalized for owner-scoped queries, matching the
 * no-FK, app-scoped convention. `@Entity` autolink + convert-to-hook +
 * pin-to-memory are deferred follow-ups.
 */
export const campaignNotes = pgTable(
  "campaign_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull(),
    ownerId: uuid("owner_id").notNull(),
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    /** DM-only (false) vs shared with players (true). */
    shared: boolean("shared").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("campaign_notes_campaign_idx").on(t.campaignId),
    index("campaign_notes_owner_idx").on(t.ownerId),
  ],
);

/**
 * Play sessions with auto-generated recaps (#145, MEM-4; `docs/data-sources.md`
 * §6). A session is a closed span of a campaign's live chat: ending one records
 * the `[startSeq, endSeq)` range of `chat_messages` it covers and a condensed
 * `recap`. Unlike the transient rolling summary (MEM-3), a recap is a finalized,
 * embeddable document — it is embedded into `embeddings` as a `session_recap`
 * source so it grounds *future* sessions via RAG. Recap text is best-effort:
 * empty when AI generation is unconfigured. `ownerId` is denormalized for
 * owner-scoped queries, matching the no-FK, app-scoped convention.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull(),
    ownerId: uuid("owner_id").notNull(),
    /** Chat `seq` this session starts at (the previous session's `endSeq`). */
    startSeq: integer("start_seq").notNull().default(0),
    /** Chat length (exclusive end) when the session was ended. */
    endSeq: integer("end_seq").notNull(),
    /** Condensed recap of the session ("" when generation is unconfigured). */
    recap: text("recap").notNull().default(""),
    /** Resolved model id that produced the recap ("" when none). */
    model: text("model").notNull().default(""),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("sessions_campaign_idx").on(t.campaignId),
    index("sessions_owner_idx").on(t.ownerId),
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
