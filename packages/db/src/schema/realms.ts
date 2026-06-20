import {
  boolean,
  index,
  jsonb,
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
