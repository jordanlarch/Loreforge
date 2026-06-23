import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { campaigns, plotHooks } from "./campaigns";
import { campaignCharacters, characters } from "./characters";
import * as schema from "./index";

// Hand-create just the tables under test (mirrors migrations 0000 + 0008 + 0012
// + 0019). The full set can't run on PGlite (earlier migrations use pgvector),
// so — like characters.test.ts — we DDL locally.
const DDL = `
  CREATE TABLE campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    active_encounter_id uuid,
    gm_persona text NOT NULL DEFAULT '',
    play_mode text NOT NULL DEFAULT 'async',
    art_style text NOT NULL DEFAULT '',
    is_tutorial boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
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
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE campaign_characters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL,
    character_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    role text NOT NULL DEFAULT 'pc',
    status text NOT NULL DEFAULT 'active',
    joined_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX campaign_characters_unique_idx
    ON campaign_characters (campaign_id, character_id);
  CREATE TABLE plot_hooks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    title text NOT NULL,
    summary text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'suggested',
    source_entity_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
`;

const OWNER = "00000000-0000-4000-8000-0000000000c1";
const SCORES = { str: 11, dex: 10, con: 12, int: 10, wis: 15, cha: 13 };

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

/** A seeded tutorial campaign for the owner. */
async function seedTutorial(): Promise<string> {
  const [campaign] = await db
    .insert(campaigns)
    .values({ ownerId: OWNER, name: "The Lantern's Last Flicker", isTutorial: true })
    .returning();
  return campaign!.id;
}

describe("tutorial Scene 2 — plot hook acceptance (TUT-1, #171)", () => {
  it("seeds the hook suggested and flips it to active on accept", async () => {
    const campaignId = await seedTutorial();
    await db.insert(plotHooks).values({
      campaignId,
      ownerId: OWNER,
      title: "The Lantern's Last Flicker",
      summary: "Find Marlowe and relight the lantern.",
      status: "suggested",
    });

    const before = await db
      .select({ status: plotHooks.status })
      .from(plotHooks)
      .where(eq(plotHooks.campaignId, campaignId));
    expect(before[0]!.status).toBe("suggested");

    const updated = await db
      .update(plotHooks)
      .set({ status: "active" })
      .where(
        and(eq(plotHooks.campaignId, campaignId), eq(plotHooks.ownerId, OWNER)),
      )
      .returning();
    expect(updated[0]!.status).toBe("active");

    // Re-accepting stays active (idempotent).
    const again = await db
      .update(plotHooks)
      .set({ status: "active" })
      .where(eq(plotHooks.campaignId, campaignId))
      .returning();
    expect(again[0]!.status).toBe("active");
  });
});

describe("tutorial Scene 2 — companion party membership (TUT-1, #171)", () => {
  it("activates the reserve companion on join", async () => {
    const campaignId = await seedTutorial();
    const [brennar] = await db
      .insert(characters)
      .values({
        ownerId: OWNER,
        name: "Old Brennar",
        abilityScores: SCORES,
        maxHp: 17,
        baseAc: 13,
      })
      .returning();

    await db.insert(campaignCharacters).values({
      campaignId,
      characterId: brennar!.id,
      ownerId: OWNER,
      role: "companion",
      status: "reserve",
    });

    // Before joining, Brennar is parked and not an active party member.
    const reserve = await db
      .select({ status: campaignCharacters.status })
      .from(campaignCharacters)
      .where(
        and(
          eq(campaignCharacters.campaignId, campaignId),
          eq(campaignCharacters.role, "companion"),
        ),
      );
    expect(reserve[0]!.status).toBe("reserve");

    await db
      .update(campaignCharacters)
      .set({ status: "active" })
      .where(
        and(
          eq(campaignCharacters.campaignId, campaignId),
          eq(campaignCharacters.ownerId, OWNER),
          eq(campaignCharacters.role, "companion"),
        ),
      );

    const active = await db
      .select({ status: campaignCharacters.status })
      .from(campaignCharacters)
      .where(eq(campaignCharacters.campaignId, campaignId));
    expect(active).toHaveLength(1);
    expect(active[0]!.status).toBe("active");
  });
});
