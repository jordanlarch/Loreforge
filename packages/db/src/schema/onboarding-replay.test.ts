import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { TUTORIAL_FIRST_SCENE_ID, TUTORIAL_SCENE_SPIRE_UPPER } from "@app/engine";

import { tutorialProgress, tutorialSeenFeatures } from "./onboarding";
import * as schema from "./index";

const DDL = `
  CREATE TABLE tutorial_progress (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL,
    campaign_id uuid,
    current_scene_id text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'in_progress',
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX tutorial_progress_owner_unique ON tutorial_progress (owner_id);
  CREATE TABLE tutorial_seen_features (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL,
    feature_id text NOT NULL,
    seen_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX tutorial_seen_features_owner_feature_unique
    ON tutorial_seen_features (owner_id, feature_id);
`;

const OWNER = "00000000-0000-4000-8000-000000000178";
const CAMPAIGN = "00000000-0000-4000-8000-000000000001";

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
  await client.exec("DELETE FROM tutorial_seen_features; DELETE FROM tutorial_progress;");
});

/** Mirrors `tutorial.replay`: reset progress to Scene 1, keep seen-features. */
async function replayTutorial(ownerId: string): Promise<void> {
  const now = new Date();
  await db
    .update(tutorialProgress)
    .set({
      currentSceneId: TUTORIAL_FIRST_SCENE_ID,
      status: "in_progress",
      completedAt: null,
      updatedAt: now,
    })
    .where(eq(tutorialProgress.ownerId, ownerId));
}

describe("tutorial replay reset semantics (#178)", () => {
  it("resets progress to Scene 1 without clearing seen coachmarks", async () => {
    await db.insert(tutorialProgress).values({
      ownerId: OWNER,
      campaignId: CAMPAIGN,
      currentSceneId: TUTORIAL_SCENE_SPIRE_UPPER,
      status: "completed",
      completedAt: new Date(),
    });
    await db.insert(tutorialSeenFeatures).values({
      ownerId: OWNER,
      featureId: "tut-scene2-hook",
    });

    await replayTutorial(OWNER);

    const [row] = await db
      .select()
      .from(tutorialProgress)
      .where(eq(tutorialProgress.ownerId, OWNER));
    expect(row?.currentSceneId).toBe(TUTORIAL_FIRST_SCENE_ID);
    expect(row?.status).toBe("in_progress");
    expect(row?.completedAt).toBeNull();

    const seen = await db
      .select({ featureId: tutorialSeenFeatures.featureId })
      .from(tutorialSeenFeatures)
      .where(eq(tutorialSeenFeatures.ownerId, OWNER));
    expect(seen).toHaveLength(1);
    expect(seen[0]?.featureId).toBe("tut-scene2-hook");
  });
});
