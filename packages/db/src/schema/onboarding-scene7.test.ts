import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  TUTORIAL_ACHIEVEMENT_FIRST_LIGHT,
  TUTORIAL_ACHIEVEMENT_FIRST_STEPS,
} from "@app/engine";

import { tutorialAchievements, tutorialProgress } from "./onboarding";
import * as schema from "./index";

// Hand-create just the onboarding tables Scene 7 touches (mirrors migrations
// 0019 + 0021). PGlite can't run the full migration set (pgvector), so — like
// the other onboarding tests — we DDL locally.
const DDL = `
  CREATE TABLE tutorial_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    current_scene_id text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'in_progress',
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX tutorial_progress_owner_unique ON tutorial_progress (owner_id);
  CREATE TABLE tutorial_achievements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL,
    achievement_id text NOT NULL,
    unlocked_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX tutorial_achievements_owner_achievement_unique
    ON tutorial_achievements (owner_id, achievement_id);
`;

const OWNER = "00000000-0000-4000-8000-0000000000a7";
const CAMPAIGN = "00000000-0000-4000-8000-0000000000b7";

let client: PGlite;
let db: PgliteDatabase<typeof schema>;

beforeAll(async () => {
  client = new PGlite();
  await client.exec(DDL);
  db = drizzle(client, { schema });
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await client.exec("DELETE FROM tutorial_achievements; DELETE FROM tutorial_progress;");
});

/** Unlock an achievement (mirrors the router helper — idempotent upsert). */
async function unlockAchievement(
  ownerId: string,
  achievementId: string,
): Promise<void> {
  await db
    .insert(tutorialAchievements)
    .values({ ownerId, achievementId })
    .onConflictDoNothing();
}

/** Complete the tutorial run (mirrors the `tutorial.complete` mutation). */
async function completeTutorial(ownerId: string): Promise<void> {
  const now = new Date();
  await db
    .update(tutorialProgress)
    .set({ status: "completed", completedAt: now, updatedAt: now })
    .where(eq(tutorialProgress.ownerId, ownerId));
  await unlockAchievement(ownerId, TUTORIAL_ACHIEVEMENT_FIRST_LIGHT);
}

async function unlockedIds(ownerId: string): Promise<string[]> {
  const rows = await db
    .select({ id: tutorialAchievements.achievementId })
    .from(tutorialAchievements)
    .where(eq(tutorialAchievements.ownerId, ownerId));
  return rows.map((r) => r.id).sort();
}

describe("tutorial Scene 7 — completion + achievements (TUT-1, #176)", () => {
  it("marks the run completed with a completed-at timestamp", async () => {
    await db
      .insert(tutorialProgress)
      .values({ ownerId: OWNER, campaignId: CAMPAIGN, status: "in_progress" });

    await completeTutorial(OWNER);

    const [row] = await db
      .select()
      .from(tutorialProgress)
      .where(eq(tutorialProgress.ownerId, OWNER));
    expect(row?.status).toBe("completed");
    expect(row?.completedAt).toBeInstanceOf(Date);
  });

  it("unlocks First Steps on hook accept and First Light on completion", async () => {
    await db
      .insert(tutorialProgress)
      .values({ ownerId: OWNER, campaignId: CAMPAIGN, status: "in_progress" });

    // Scene 2 trigger: accepting the hook unlocks First Steps.
    await unlockAchievement(OWNER, TUTORIAL_ACHIEVEMENT_FIRST_STEPS);
    expect(await unlockedIds(OWNER)).toEqual([TUTORIAL_ACHIEVEMENT_FIRST_STEPS]);

    // Scene 7 trigger: completing unlocks First Light; both now coexist.
    await completeTutorial(OWNER);
    expect(await unlockedIds(OWNER)).toEqual(
      [
        TUTORIAL_ACHIEVEMENT_FIRST_LIGHT,
        TUTORIAL_ACHIEVEMENT_FIRST_STEPS,
      ].sort(),
    );
  });

  it("makes achievement unlocks idempotent (no duplicate rows)", async () => {
    await unlockAchievement(OWNER, TUTORIAL_ACHIEVEMENT_FIRST_STEPS);
    await unlockAchievement(OWNER, TUTORIAL_ACHIEVEMENT_FIRST_STEPS);
    await unlockAchievement(OWNER, TUTORIAL_ACHIEVEMENT_FIRST_STEPS);
    expect(await unlockedIds(OWNER)).toEqual([
      TUTORIAL_ACHIEVEMENT_FIRST_STEPS,
    ]);
  });

  it("re-completing stays completed and never duplicates First Light", async () => {
    await db
      .insert(tutorialProgress)
      .values({ ownerId: OWNER, campaignId: CAMPAIGN, status: "in_progress" });

    await completeTutorial(OWNER);
    await completeTutorial(OWNER);

    const [row] = await db
      .select()
      .from(tutorialProgress)
      .where(eq(tutorialProgress.ownerId, OWNER));
    expect(row?.status).toBe("completed");
    expect(await unlockedIds(OWNER)).toEqual([
      TUTORIAL_ACHIEVEMENT_FIRST_LIGHT,
    ]);
  });
});
