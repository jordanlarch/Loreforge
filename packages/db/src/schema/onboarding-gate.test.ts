import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { characters } from "./characters";
import { tutorialProgress } from "./onboarding";
import * as schema from "./index";

const DDL = `
  CREATE TABLE characters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL,
    name text NOT NULL,
    species text NOT NULL DEFAULT '',
    background text NOT NULL DEFAULT '',
    classes jsonb NOT NULL DEFAULT '[]'::jsonb,
    ability_scores jsonb NOT NULL,
    max_hp integer NOT NULL,
    base_ac integer NOT NULL,
    speed integer NOT NULL DEFAULT 30,
    save_proficiencies jsonb NOT NULL DEFAULT '[]'::jsonb,
    skill_proficiencies jsonb NOT NULL DEFAULT '[]'::jsonb,
    xp integer NOT NULL DEFAULT 0,
    portrait_url text NOT NULL DEFAULT '',
    notes text NOT NULL DEFAULT '',
    equipment jsonb NOT NULL DEFAULT '[]'::jsonb,
    spells jsonb NOT NULL DEFAULT '{"spells":[],"slots":{}}'::jsonb,
    library_visibility text NOT NULL DEFAULT 'library',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
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
`;

const OWNER = "00000000-0000-4000-8000-000000000177";
const MIRA = {
  name: "Mira Thornwood",
  species: "Half-Elf",
  background: "Outlander",
  classes: [{ class: "Ranger", level: 3 }],
  abilityScores: { str: 12, dex: 16, con: 13, int: 10, wis: 15, cha: 11 },
  maxHp: 27,
  baseAc: 14,
};

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
  await client.exec("DELETE FROM tutorial_progress; DELETE FROM characters;");
});

/** Mirrors skip mutation: seed Mira + upsert skipped progress without a campaign. */
async function skipTutorial(ownerId: string): Promise<void> {
  const [existingChar] = await db
    .select({ id: characters.id })
    .from(characters)
    .where(and(eq(characters.ownerId, ownerId), eq(characters.name, MIRA.name)))
    .limit(1);
  if (!existingChar) {
    await db.insert(characters).values({ ...MIRA, ownerId });
  }

  const now = new Date();
  const [existingProgress] = await db
    .select({ id: tutorialProgress.id })
    .from(tutorialProgress)
    .where(eq(tutorialProgress.ownerId, ownerId))
    .limit(1);

  if (existingProgress) {
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
}

describe("tutorial launch gate skip handoff (#177)", () => {
  it("seeds Mira and records skipped progress without a campaign", async () => {
    await skipTutorial(OWNER);

    const chars = await db
      .select({ name: characters.name })
      .from(characters)
      .where(eq(characters.ownerId, OWNER));
    expect(chars).toHaveLength(1);
    expect(chars[0]?.name).toBe("Mira Thornwood");

    const [row] = await db
      .select()
      .from(tutorialProgress)
      .where(eq(tutorialProgress.ownerId, OWNER));
    expect(row?.status).toBe("skipped");
    expect(row?.campaignId).toBeNull();
  });

  it("does not duplicate Mira on a second skip", async () => {
    await skipTutorial(OWNER);
    await skipTutorial(OWNER);
    const chars = await db
      .select({ id: characters.id })
      .from(characters)
      .where(eq(characters.ownerId, OWNER));
    expect(chars).toHaveLength(1);
  });
});
