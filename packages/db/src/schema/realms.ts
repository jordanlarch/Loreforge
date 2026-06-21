import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * The eight Realms entity types (`docs/ui-flows/realms-library.md`). The
 * runtime constant + presentation labels live browser-safe in
 * `apps/web/src/lib/realms.ts`; this is the structural column type only, kept
 * local to the schema like the other tables' inline JSONB types.
 */
type RealmEntityType =
  | "region"
  | "settlement"
  | "building"
  | "tavern"
  | "shop"
  | "dungeon"
  | "faction"
  | "npc";

/** Directed relationship kinds for the edge table (linking UI lands in #5). */
type RealmRelationshipKind =
  | "located_in"
  | "member_of"
  | "owns"
  | "rules"
  | "allied_with"
  | "rival_of"
  | "related_to";

/**
 * Polymorphic Realms entities, owned by a Supabase auth user (#41).
 *
 * One table for all eight worldbuilding types: shared columns plus a typed
 * JSONB `data` payload holding the type-specific fields, validated per-type by
 * zod in the tRPC layer (the DB stays shape-agnostic). NPC is the first fully
 * realized type; the others land in slice #5. `isStub` marks a cascade-created
 * placeholder awaiting generator expansion.
 *
 * @see docs/ui-flows/realms-library.md
 */
export const realmEntities = pgTable(
  "realm_entities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(),
    type: text("type").notNull().$type<RealmEntityType>(),
    name: text("name").notNull(),
    /** One-line description shown on cards and the detail header. */
    summary: text("summary").notNull().default(""),
    /** A cascade-created placeholder awaiting generator expansion. */
    isStub: boolean("is_stub").notNull().default(false),
    /** Type-specific fields; shape validated per-type by zod on write. */
    data: jsonb("data").notNull().$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("realm_entities_owner_idx").on(t.ownerId),
    index("realm_entities_owner_type_idx").on(t.ownerId, t.type),
  ],
);

/**
 * Directed relationships between Realms entities (#41 scaffolding).
 *
 * Created now so the worldbuilding graph has a home, though the linking UI is
 * minimal in this slice and gets fleshed out in #5. Each edge is owner-scoped
 * and references two `realm_entities` by id.
 */
export const realmRelationships = pgTable(
  "realm_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(),
    fromId: uuid("from_id").notNull(),
    toId: uuid("to_id").notNull(),
    kind: text("kind").notNull().$type<RealmRelationshipKind>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("realm_relationships_owner_idx").on(t.ownerId),
    index("realm_relationships_from_idx").on(t.fromId),
    index("realm_relationships_to_idx").on(t.toId),
  ],
);

/** How a generation was invoked. */
type GenerationMode = "new" | "expand" | "cascade" | "regenerate";

/** Whether a generation produced a valid, persisted result. */
type GenerationStatus = "success" | "error";

/**
 * Lightweight audit of every AI generation run (Realms generator pipeline, D8).
 *
 * Not a quota gate — generator runs do not count against the free DM-chat
 * allowance (`docs/product-spec.md` §5.1). This exists for pre-alpha cost
 * observability and as a future metering lever, captured from day one so no
 * backfill is needed. `entityId` is null when a run fails before any row is
 * written (the pipeline is transactional: generate → validate → insert).
 */
export const generationEvents = pgTable(
  "generation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(),
    /** The entity produced/affected, if the run succeeded and persisted. */
    entityId: uuid("entity_id"),
    entityType: text("entity_type").notNull().$type<RealmEntityType>(),
    mode: text("mode").notNull().$type<GenerationMode>(),
    status: text("status").notNull().$type<GenerationStatus>(),
    /** Resolved model id the provider actually ran. */
    model: text("model").notNull().default(""),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    /** Estimated USD cost; nullable until a price table is wired. */
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
    /** First validation/transport error message when status = 'error'. */
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("generation_events_owner_idx").on(t.ownerId),
    index("generation_events_created_idx").on(t.createdAt),
  ],
);
