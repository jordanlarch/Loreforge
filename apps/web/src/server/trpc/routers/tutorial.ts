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
import { TUTORIAL_FIRST_SCENE_ID, TUTORIAL_HOOK } from "@app/engine";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  campaignCharacters,
  campaigns,
  characters,
  getDb,
  plotHooks,
  tutorialProgress,
  tutorialSeenFeatures,
} from "@app/db";

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

/** The pregenerated tutorial hero (`docs/onboarding/tutorial-adventure.md` §2.1). */
const TUTORIAL_MIRA: Omit<typeof characters.$inferInsert, "ownerId"> = {
  name: "Mira Thornwood",
  species: "Half-Elf",
  background: "Outlander",
  classes: [{ class: "Ranger", level: 3, subclass: "Hunter" }],
  abilityScores: { str: 12, dex: 16, con: 13, int: 10, wis: 15, cha: 11 },
  maxHp: 27,
  baseAc: 14,
  speed: 30,
  saveProficiencies: ["str", "dex"],
  skillProficiencies: ["Stealth", "Perception", "Survival", "Investigation"],
  xp: 900,
  notes: "Your guide through the Hollow. Pregenerated for the tutorial.",
  equipment: [
    { name: "Longbow", quantity: 1, equipped: true },
    { name: "Shortsword", quantity: 2, equipped: true },
    { name: "Leather Armor", quantity: 1, equipped: true },
    { name: "Potion of Healing", quantity: 2, equipped: false },
  ],
  spells: {
    spells: [
      { name: "Hunter's Mark", level: 1, prepared: true },
      { name: "Cure Wounds", level: 1, prepared: true },
    ],
    slots: { "1": { max: 3, used: 0 } },
  },
};

/** The companion NPC seeded for Scene 2 (`tutorial-adventure.md` §2.2). */
const TUTORIAL_BRENNAR: Omit<typeof characters.$inferInsert, "ownerId"> = {
  name: "Old Brennar",
  species: "Human",
  background: "Acolyte",
  classes: [{ class: "Cleric", level: 2, subclass: "Life" }],
  abilityScores: { str: 11, dex: 10, con: 12, int: 10, wis: 15, cha: 13 },
  maxHp: 17,
  baseAc: 13,
  speed: 30,
  saveProficiencies: ["wis", "cha"],
  skillProficiencies: ["Insight", "Medicine", "Religion"],
  xp: 450,
  notes:
    "Your companion through the Hollow — a grieving cleric who knew the lampkeeper. Pregenerated for the tutorial.",
  equipment: [
    { name: "Mace", quantity: 1, equipped: true },
    { name: "Chain Shirt", quantity: 1, equipped: true },
    { name: "Holy Symbol", quantity: 1, equipped: true },
    { name: "Potion of Healing", quantity: 1, equipped: false },
  ],
  spells: {
    spells: [
      { name: "Sacred Flame", level: 0, prepared: true },
      { name: "Cure Wounds", level: 1, prepared: true },
    ],
    slots: { "1": { max: 3, used: 0 } },
  },
};

const TUTORIAL_CAMPAIGN_NAME = "The Lantern's Last Flicker";

export const tutorialRouter = createTRPCRouter({
  /** The current user's tutorial run, or null if they haven't started. */
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
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
    const db = getDb();
    const ownerId = ctx.user.id;

    const [existing] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.ownerId, ownerId), eq(campaigns.isTutorial, true)))
      .limit(1);
    if (existing) {
      return { campaignId: existing.id };
    }

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

    const [mira] = await db
      .insert(characters)
      .values({ ...TUTORIAL_MIRA, ownerId })
      .returning({ id: characters.id });
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

    // Old Brennar is seeded now (D4) but parked as a "reserve" companion so he
    // doesn't load into Scene 1; accepting the hook in Scene 2 activates him.
    const [brennar] = await db
      .insert(characters)
      .values({ ...TUTORIAL_BRENNAR, ownerId })
      .returning({ id: characters.id });
    if (brennar) {
      await db
        .insert(campaignCharacters)
        .values({
          campaignId: campaign.id,
          characterId: brennar.id,
          ownerId,
          role: "companion",
          status: "reserve",
        })
        .onConflictDoNothing();
    }

    // The central plot hook, seeded as a "suggested" campaign hook; Scene 2's
    // offer flips it to "active" (it then surfaces in the Hooks tab).
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

    await db
      .insert(tutorialProgress)
      .values({
        ownerId,
        campaignId: campaign.id,
        currentSceneId: TUTORIAL_FIRST_SCENE_ID,
        status: "in_progress",
      })
      .onConflictDoNothing();

    return { campaignId: campaign.id };
  }),

  /**
   * Record that the user skipped the tutorial. The frictionless skip→starter
   * handoff (a seeded blank campaign) lands in a later slice; for now this just
   * marks an existing run skipped so the splash can route on.
   */
  skip: protectedProcedure.mutation(async ({ ctx }) => {
    const db = getDb();
    await db
      .update(tutorialProgress)
      .set({ status: "skipped", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(tutorialProgress.ownerId, ctx.user.id));
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
});
