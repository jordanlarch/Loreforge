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
import { TUTORIAL_FIRST_SCENE_ID } from "@app/engine";
import { and, eq } from "drizzle-orm";

import {
  campaignCharacters,
  campaigns,
  characters,
  getDb,
  tutorialProgress,
} from "@app/db";

import { createTRPCRouter, protectedProcedure } from "../init";

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
});
