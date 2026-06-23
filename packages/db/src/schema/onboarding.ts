import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Lifecycle of a user's run through the onboarding tutorial (TUT-1). */
export type TutorialStatus = "in_progress" | "completed" | "skipped";

/**
 * Per-user tutorial progress — the resume pointer for "Lantern's Last Flicker"
 * (TUT-1, M6; `docs/onboarding/tutorial-adventure.md`).
 *
 * One row per user (a singleton, enforced by the unique `owner_id` index): it
 * records the seeded tutorial campaign, the current scene the user is on, and
 * whether they are mid-run / finished / skipped. Mechanical state lives in the
 * event-sourced engine log keyed by `campaign_id` (so it replays exactly); this
 * row only tracks *where in the script* the user is, at scene granularity (D6),
 * so a cold reload resumes on the right scene. Owner-scoped, no FK, app-scoped —
 * matching the rest of the schema. The fire-once seen-features table (D5) and
 * achievements arrive in later slices.
 */
export const tutorialProgress = pgTable(
  "tutorial_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(),
    /** The seeded tutorial campaign this run plays through. */
    campaignId: uuid("campaign_id").notNull(),
    /** Engine scene id the user is currently on (scene-granularity resume, D6). */
    currentSceneId: text("current_scene_id").notNull().default(""),
    /** in_progress | completed | skipped */
    status: text("status")
      .notNull()
      .$type<TutorialStatus>()
      .default("in_progress"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Set when the run reaches graduation (or is skipped); null while in play. */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("tutorial_progress_owner_unique").on(t.ownerId),
    index("tutorial_progress_campaign_idx").on(t.campaignId),
  ],
);

/**
 * Fire-once-per-user coachmark/tooltip ledger (TUT-1, D5).
 *
 * Each row records that a user has dismissed a given first-time tooltip
 * (`feature_id`), so it never fires again. Deliberately *not* tutorial-scoped:
 * this is shared onboarding infra reused by global app tooltips later, keyed by
 * a stable string feature id rather than a campaign/scene. Owner-scoped, no FK,
 * app-scoped — matching the rest of the schema. The unique `(owner, feature)`
 * pair makes the "mark seen" write an idempotent upsert.
 */
export const tutorialSeenFeatures = pgTable(
  "tutorial_seen_features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(),
    /** Stable id of the tooltip/coachmark (e.g. "tut-scene1-chat"). */
    featureId: text("feature_id").notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tutorial_seen_features_owner_feature_unique").on(
      t.ownerId,
      t.featureId,
    ),
    index("tutorial_seen_features_owner_idx").on(t.ownerId),
  ],
);

/**
 * Per-user tutorial achievement ledger (TUT-1, #176, §10).
 *
 * Records the two warm "I did this" moments the tutorial unlocks — **First
 * Steps** (accepting the first plot hook in Scene 2) and **First Light**
 * (completing the tutorial in Scene 7). Both show in the graduation modal. This
 * is deliberately *not* a general achievement system (out of v1 scope, D8): a
 * minimal owner-scoped table keyed by a stable string `achievement_id`, with the
 * unique `(owner, achievement)` pair making the "unlock" write an idempotent
 * upsert. Owner-scoped, no FK, app-scoped — matching the rest of the schema.
 */
export const tutorialAchievements = pgTable(
  "tutorial_achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull(),
    /** Stable id of the achievement (e.g. "first-steps", "first-light"). */
    achievementId: text("achievement_id").notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("tutorial_achievements_owner_achievement_unique").on(
      t.ownerId,
      t.achievementId,
    ),
    index("tutorial_achievements_owner_idx").on(t.ownerId),
  ],
);
