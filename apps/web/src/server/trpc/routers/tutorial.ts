/**
 * Tutorial tRPC router — the onboarding micro-campaign lifecycle (TUT-1, M6).
 *
 * `start` idempotently seeds the per-user tutorial as **real owned DB rows** (D4):
 * a campaign flagged `is_tutorial`, the pregenerated hero Mira Thornwood, her
 * party membership, and a `tutorial_progress` resume pointer. The engine scene
 * state itself is seeded lazily by the server-side `TutorialRoom` on first join
 * (so mechanical state stays in the event log) — this router only owns the
 * persistent rows. `get` resolves the current run; `skip` records that the user
 * bailed (the frictionless skip→starter handoff lands in a later slice).
 */
import {
  TUTORIAL_ACHIEVEMENT_FIRST_LIGHT,
  TUTORIAL_ACHIEVEMENT_FIRST_STEPS,
  TUTORIAL_FIRST_SCENE_ID,
  TUTORIAL_HOOK,
} from "@app/engine";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  campaignCharacters,
  campaigns,
  characters,
  getDb,
  plotHooks,
  tutorialAchievements,
  tutorialProgress,
  tutorialSeenFeatures,
} from "@app/db";

import type { EquipmentItem } from "@/lib/character";
import { TUTORIAL_OIL_GRANT, withOilGrant } from "@/lib/tutorial-shop";
import {
  findOwnedCharacter,
  seedStarterCharacter,
  STARTER_BRENNAR,
  STARTER_MIRA,
} from "@/lib/tutorial-starter";
import { trackTutorialEvent } from "@/lib/observability/tutorial-telemetry";

import { createTRPCRouter, protectedProcedure } from "../init";

/** The current user's tutorial campaign id, or null if they haven't started. */
async function tutorialCampaignId(ownerId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.ownerId, ownerId), eq(campaigns.isTutorial, true)))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Clear a dangling `tutorial_progress.campaign_id` when the campaign row was
 * deleted (e.g. Settings danger zone). Nothing is permanently lost — `start` /
 * `replay` can re-seed the tutorial campaign.
 */
async function healOrphanedTutorialProgress(ownerId: string): Promise<void> {
  const db = getDb();
  const [progress] = await db
    .select({ campaignId: tutorialProgress.campaignId })
    .from(tutorialProgress)
    .where(eq(tutorialProgress.ownerId, ownerId))
    .limit(1);
  if (!progress?.campaignId) return;

  const [campaign] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.id, progress.campaignId))
    .limit(1);
  if (campaign) return;

  await db
    .update(tutorialProgress)
    .set({ campaignId: null, updatedAt: new Date() })
    .where(eq(tutorialProgress.ownerId, ownerId));
}

/** Create a fresh tutorial campaign + roster seed (D4). Returns the campaign id. */
async function createTutorialCampaign(ownerId: string): Promise<string> {
  const db = getDb();

  const [campaign] = await db
    .insert(campaigns)
    .values({
      ownerId,
      name: TUTORIAL_CAMPAIGN_NAME,
      description: "A 30-minute guided adventure to learn the ropes.",
      isTutorial: true,
    })
    .returning({ id: campaigns.id });
  if (!campaign) {
    throw new Error("Failed to create tutorial campaign.");
  }

  const [miraRow] = await (async () => {
    const reused = await findOwnedCharacter(ownerId, STARTER_MIRA.name);
    if (reused) {
      await db
        .update(characters)
        .set({
          notes: "Your guide through the Hollow. Pregenerated for the tutorial.",
          libraryVisibility: "campaign_only",
          updatedAt: new Date(),
        })
        .where(eq(characters.id, reused));
      return [{ id: reused }];
    }
    return db
      .insert(characters)
      .values({
        ...TUTORIAL_MIRA,
        ownerId,
        notes: "Your guide through the Hollow. Pregenerated for the tutorial.",
        libraryVisibility: "campaign_only",
      })
      .returning({ id: characters.id });
  })();
  const mira = miraRow;
  if (mira) {
    await db
      .insert(campaignCharacters)
      .values({
        campaignId: campaign.id,
        characterId: mira.id,
        ownerId,
        role: "pc",
        status: "active",
      })
      .onConflictDoNothing();
  }

  const brennarId =
    (await findOwnedCharacter(ownerId, STARTER_BRENNAR.name)) ??
    (
      await db
        .insert(characters)
        .values({
          ...TUTORIAL_BRENNAR,
          ownerId,
          libraryVisibility: "campaign_only",
        })
        .returning({ id: characters.id })
    )[0]?.id;
  if (brennarId) {
    await db
      .insert(campaignCharacters)
      .values({
        campaignId: campaign.id,
        characterId: brennarId,
        ownerId,
        role: "companion",
        status: "reserve",
      })
      .onConflictDoNothing();
  }

  await db
    .insert(plotHooks)
    .values({
      campaignId: campaign.id,
      ownerId,
      title: TUTORIAL_HOOK.title,
      summary: TUTORIAL_HOOK.summary,
      status: "suggested",
    })
    .onConflictDoNothing();

  return campaign.id;
}

/** Return the user's tutorial campaign id, creating one if it was deleted. */
async function ensureTutorialCampaign(ownerId: string): Promise<string> {
  const existing = await tutorialCampaignId(ownerId);
  if (existing) return existing;
  return createTutorialCampaign(ownerId);
}

/** Resolve the tutorial hero (Mira, the `pc`) row + her current inventory. */
async function tutorialHero(
  ownerId: string,
): Promise<{ id: string; equipment: EquipmentItem[] } | null> {
  const campaignId = await tutorialCampaignId(ownerId);
  if (!campaignId) return null;
  const [row] = await getDb()
    .select({ id: characters.id, equipment: characters.equipment })
    .from(campaignCharacters)
    .innerJoin(characters, eq(campaignCharacters.characterId, characters.id))
    .where(
      and(
        eq(campaignCharacters.campaignId, campaignId),
        eq(campaignCharacters.role, "pc"),
      ),
    )
    .limit(1);
  if (!row) return null;
  return { id: row.id, equipment: (row.equipment ?? []) as EquipmentItem[] };
}

/**
 * Unlock a tutorial achievement for a user (TUT-1, #176). Idempotent: the unique
 * `(owner, achievement)` index makes a repeat unlock a no-op, so the Scene 2
 * hook-accept and the Scene 7 completion can each fire it freely.
 */
async function unlockAchievement(
  ownerId: string,
  achievementId: string,
): Promise<void> {
  await getDb()
    .insert(tutorialAchievements)
    .values({ ownerId, achievementId })
    .onConflictDoNothing();
}

/** The pregenerated tutorial hero (`docs/onboarding/tutorial-adventure.md` §2.1). */
const TUTORIAL_MIRA = STARTER_MIRA;

/** The companion NPC seeded for Scene 2 (`tutorial-adventure.md` §2.2). */
const TUTORIAL_BRENNAR = STARTER_BRENNAR;

const TUTORIAL_CAMPAIGN_NAME = "The Lantern's Last Flicker";

export const tutorialRouter = createTRPCRouter({
  /** The current user's tutorial run, or null if they haven't started. */
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    await healOrphanedTutorialProgress(ctx.user.id);
    const [row] = await db
      .select()
      .from(tutorialProgress)
      .where(eq(tutorialProgress.ownerId, ctx.user.id))
      .limit(1);
    return row ?? null;
  }),

  /**
   * Begin (or resume) the tutorial. Idempotent: if a tutorial campaign already
   * exists for the user it is reused, so repeated "Play" clicks never duplicate
   * the seed. Returns the campaign id to mount the play surface against.
   */
  start: protectedProcedure.mutation(async ({ ctx }) => {
    const ownerId = ctx.user.id;
    await healOrphanedTutorialProgress(ownerId);

    const existing = await tutorialCampaignId(ownerId);
    if (existing) {
      trackTutorialEvent({ name: "tutorial_continue" });
      return { campaignId: existing };
    }

    const campaignId = await createTutorialCampaign(ownerId);

    await getDb()
      .insert(tutorialProgress)
      .values({
        ownerId,
        campaignId,
        currentSceneId: TUTORIAL_FIRST_SCENE_ID,
        status: "in_progress",
        completedAt: null,
      })
      .onConflictDoUpdate({
        target: tutorialProgress.ownerId,
        set: {
          campaignId,
          currentSceneId: TUTORIAL_FIRST_SCENE_ID,
          status: "in_progress",
          completedAt: null,
          updatedAt: new Date(),
        },
      });

    trackTutorialEvent({ name: "tutorial_start" });
    return { campaignId };
  }),

  /**
   * Replay from the beginning (TUT-1, #178, D6): reset the resume pointer to Scene 1
   * and mark the run in-progress. Does **not** clear `tutorial_seen_features` — coachmarks
   * stay dismissed. The client must send `{ t: "reset" }` over the live channel to
   * truncate the engine log + re-seed DB-side state.
   */
  replay: protectedProcedure.mutation(async ({ ctx }) => {
    const ownerId = ctx.user.id;
    await healOrphanedTutorialProgress(ownerId);
    const campaignId = await ensureTutorialCampaign(ownerId);

    const now = new Date();
    await getDb()
      .insert(tutorialProgress)
      .values({
        ownerId,
        campaignId,
        currentSceneId: TUTORIAL_FIRST_SCENE_ID,
        status: "in_progress",
        completedAt: null,
      })
      .onConflictDoUpdate({
        target: tutorialProgress.ownerId,
        set: {
          campaignId,
          currentSceneId: TUTORIAL_FIRST_SCENE_ID,
          status: "in_progress",
          completedAt: null,
          updatedAt: now,
        },
      });

    trackTutorialEvent({ name: "tutorial_replay" });
    return { campaignId, resetEngine: true as const };
  }),

  /**
   * Skip the tutorial (TUT-1, #177): frictionless bail from the splash. Seeds Mira
   * as a standalone owned character, marks the run skipped (inserting a row when
   * the user never started), and clears the launch gate. Idempotent.
   */
  skip: protectedProcedure.mutation(async ({ ctx }) => {
    const db = getDb();
    const ownerId = ctx.user.id;
    const now = new Date();

    await seedStarterCharacter(ownerId);

    const [existing] = await db
      .select({ id: tutorialProgress.id })
      .from(tutorialProgress)
      .where(eq(tutorialProgress.ownerId, ownerId))
      .limit(1);

    if (existing) {
      await db
        .update(tutorialProgress)
        .set({ status: "skipped", completedAt: now, updatedAt: now })
        .where(eq(tutorialProgress.ownerId, ownerId));
    } else {
      await db.insert(tutorialProgress).values({
        ownerId,
        campaignId: null,
        currentSceneId: "",
        status: "skipped",
        completedAt: now,
      });
    }

    trackTutorialEvent({ name: "tutorial_skip" });
    return { ok: true };
  }),

  /* --------------------------------------------------------------------- *
   *  Scene 2 — plot hook + companion (TUT-1, #171, D4)
   * --------------------------------------------------------------------- */

  /** Hook status + whether the companion has joined — drives the Scene 2 UI. */
  world: protectedProcedure.query(async ({ ctx }) => {
    const campaignId = await tutorialCampaignId(ctx.user.id);
    if (!campaignId) return { hookStatus: null, companionJoined: false };
    const db = getDb();
    const [hook] = await db
      .select({ status: plotHooks.status })
      .from(plotHooks)
      .where(
        and(
          eq(plotHooks.campaignId, campaignId),
          eq(plotHooks.ownerId, ctx.user.id),
        ),
      )
      .limit(1);
    const [companion] = await db
      .select({ status: campaignCharacters.status })
      .from(campaignCharacters)
      .where(
        and(
          eq(campaignCharacters.campaignId, campaignId),
          eq(campaignCharacters.role, "companion"),
        ),
      )
      .limit(1);
    return {
      hookStatus: hook?.status ?? null,
      companionJoined: companion?.status === "active",
    };
  }),

  /**
   * Accept the central plot hook: flip the seeded hook to "active" so it surfaces
   * in the campaign Hooks tab (Q7 lifecycle). Idempotent — re-accepting is a
   * no-op beyond touching `updatedAt`.
   */
  acceptHook: protectedProcedure.mutation(async ({ ctx }) => {
    const campaignId = await tutorialCampaignId(ctx.user.id);
    if (!campaignId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No tutorial in progress.",
      });
    }
    const [row] = await getDb()
      .update(plotHooks)
      .set({ status: "active", updatedAt: new Date() })
      .where(
        and(
          eq(plotHooks.campaignId, campaignId),
          eq(plotHooks.ownerId, ctx.user.id),
        ),
      )
      .returning();
    // First Steps (TUT-1, §10): accepting the first hook unlocks the bronze badge.
    await unlockAchievement(ctx.user.id, TUTORIAL_ACHIEVEMENT_FIRST_STEPS);
    return row ?? null;
  }),

  /**
   * Activate Old Brennar's party membership (the DB half of "companion joins",
   * D4; the engine entity is created by the `TutorialRoom`). Idempotent: flips
   * the seeded "reserve" companion row to "active".
   */
  companionJoin: protectedProcedure.mutation(async ({ ctx }) => {
    const campaignId = await tutorialCampaignId(ctx.user.id);
    if (!campaignId) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No tutorial in progress.",
      });
    }
    await getDb()
      .update(campaignCharacters)
      .set({ status: "active" })
      .where(
        and(
          eq(campaignCharacters.campaignId, campaignId),
          eq(campaignCharacters.ownerId, ctx.user.id),
          eq(campaignCharacters.role, "companion"),
        ),
      );
    return { ok: true };
  }),

  /* --------------------------------------------------------------------- *
   *  Scene 3 — shop + inventory + scripted item grant (TUT-1, #172, D4)
   * --------------------------------------------------------------------- */

  /** Mira's live inventory (real `equipment` rows) for the HUD drawer. */
  inventory: protectedProcedure.query(async ({ ctx }) => {
    const hero = await tutorialHero(ctx.user.id);
    return { items: hero?.equipment ?? [] };
  }),

  /**
   * Toric's scripted gift (D4): append the Oil of Brightness to Mira's real
   * `equipment` exactly once — no currency math, no purchase friction. Skipping
   * the shop simply never calls this; both paths funnel forward. Idempotent.
   */
  grantOil: protectedProcedure.mutation(async ({ ctx }) => {
    const hero = await tutorialHero(ctx.user.id);
    if (!hero) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No tutorial in progress.",
      });
    }
    const next = withOilGrant(hero.equipment);
    await getDb()
      .update(characters)
      .set({ equipment: next, updatedAt: new Date() })
      .where(eq(characters.id, hero.id));
    return { items: next, granted: TUTORIAL_OIL_GRANT.name };
  }),

  /* --------------------------------------------------------------------- *
   *  Fire-once coachmarks / first-time tooltips (TUT-1, D5)
   * --------------------------------------------------------------------- */

  /** Ids of every coachmark the current user has already dismissed. */
  seenFeatures: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select({ featureId: tutorialSeenFeatures.featureId })
      .from(tutorialSeenFeatures)
      .where(eq(tutorialSeenFeatures.ownerId, ctx.user.id));
    return rows.map((r) => r.featureId);
  }),

  /**
   * Mark a coachmark seen for the current user (idempotent). Each tooltip fires
   * once ever; the unique `(owner, feature)` index makes a repeat a no-op.
   */
  markSeen: protectedProcedure
    .input(z.object({ featureId: z.string().trim().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .insert(tutorialSeenFeatures)
        .values({ ownerId: ctx.user.id, featureId: input.featureId })
        .onConflictDoNothing();
      return { ok: true };
    }),

  /* --------------------------------------------------------------------- *
   *  Scene 7 — wrap & handoff: completion + achievements (TUT-1, #176, D8)
   * --------------------------------------------------------------------- */

  /** The achievement ids the current user has unlocked (drives the modal badges). */
  achievements: protectedProcedure.query(async ({ ctx }) => {
    const rows = await getDb()
      .select({ achievementId: tutorialAchievements.achievementId })
      .from(tutorialAchievements)
      .where(eq(tutorialAchievements.ownerId, ctx.user.id));
    return rows.map((r) => r.achievementId);
  }),

  /**
   * Graduate the tutorial (Scene 7): mark the run completed and unlock the
   * **First Light** achievement. Idempotent — re-completing only touches
   * timestamps, and the achievement unlock is upsert-safe — so the graduation
   * modal can re-open on a reload (D7, graduation always). Returns the full
   * unlocked-achievement set so the client can render the badges immediately.
   */
  complete: protectedProcedure.mutation(async ({ ctx }) => {
    const db = getDb();
    const now = new Date();
    await db
      .update(tutorialProgress)
      .set({ status: "completed", completedAt: now, updatedAt: now })
      .where(eq(tutorialProgress.ownerId, ctx.user.id));
    await unlockAchievement(ctx.user.id, TUTORIAL_ACHIEVEMENT_FIRST_LIGHT);
    trackTutorialEvent({ name: "tutorial_complete" });
    const rows = await db
      .select({ achievementId: tutorialAchievements.achievementId })
      .from(tutorialAchievements)
      .where(eq(tutorialAchievements.ownerId, ctx.user.id));
    return { ok: true, achievements: rows.map((r) => r.achievementId) };
  }),
});
