import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { campaigns } from "./campaigns";
import {
  campaignCharacters,
  characters,
  type EquipmentItem,
} from "./characters";
import * as schema from "./index";

// Hand-create just the tables under test (mirrors migrations 0000 + 0008 + 0019).
// The full set can't run on PGlite (earlier migrations use pgvector), so — like
// characters.test.ts — we DDL locally.
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
    overworld_grid jsonb NOT NULL DEFAULT '{"width":32,"height":20}'::jsonb,
    starting_scene_id text,
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
    library_visibility text NOT NULL DEFAULT 'library',
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
    player_user_id uuid,
    joined_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX campaign_characters_unique_idx
    ON campaign_characters (campaign_id, character_id);
`;

const OWNER = "00000000-0000-4000-8000-0000000000d1";
const SCORES = { str: 12, dex: 16, con: 13, int: 10, wis: 15, cha: 11 };
const OIL: EquipmentItem = {
  name: "Oil of Brightness",
  quantity: 1,
  equipped: false,
  description: "Lamp oil that burns ten times as bright.",
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

/** Seed a tutorial campaign + Mira (the `pc`) with starter equipment. */
async function seedHero(equipment: EquipmentItem[]): Promise<{
  campaignId: string;
  characterId: string;
}> {
  const [campaign] = await db
    .insert(campaigns)
    .values({ ownerId: OWNER, name: "The Lantern's Last Flicker", isTutorial: true })
    .returning();
  const [mira] = await db
    .insert(characters)
    .values({
      ownerId: OWNER,
      name: "Mira Thornwood",
      abilityScores: SCORES,
      maxHp: 27,
      baseAc: 14,
      equipment,
    })
    .returning();
  await db.insert(campaignCharacters).values({
    campaignId: campaign!.id,
    characterId: mira!.id,
    ownerId: OWNER,
    role: "pc",
    status: "active",
  });
  return { campaignId: campaign!.id, characterId: mira!.id };
}

/** The pc's live inventory, resolved the way the router does (campaign → pc). */
async function readInventory(campaignId: string): Promise<EquipmentItem[]> {
  const [row] = await db
    .select({ equipment: characters.equipment })
    .from(campaignCharacters)
    .innerJoin(characters, eq(campaignCharacters.characterId, characters.id))
    .where(
      and(
        eq(campaignCharacters.campaignId, campaignId),
        eq(campaignCharacters.role, "pc"),
      ),
    )
    .limit(1);
  return (row?.equipment ?? []) as EquipmentItem[];
}

describe("tutorial Scene 3 — scripted item grant (TUT-1, #172)", () => {
  it("appends the oil to Mira's real equipment and the inventory query returns it", async () => {
    const starter: EquipmentItem[] = [
      { name: "Longbow", quantity: 1, equipped: true },
    ];
    const { campaignId, characterId } = await seedHero(starter);

    // Pre-grant: the pc's inventory has only her starter gear.
    const before = await readInventory(campaignId);
    expect(before).toHaveLength(1);
    expect(before.some((i) => i.name === OIL.name)).toBe(false);

    // Toric's scripted gift: append the oil exactly once.
    await db
      .update(characters)
      .set({ equipment: [...before, OIL] })
      .where(eq(characters.id, characterId));

    const after = await readInventory(campaignId);
    expect(after).toHaveLength(2);
    const oil = after.find((i) => i.name === OIL.name);
    expect(oil?.equipped).toBe(false);
    expect(oil?.description).toMatch(/bright/i);
  });

  it("is idempotent — re-granting never duplicates the oil", async () => {
    const { campaignId, characterId } = await seedHero([OIL]);

    const current = await readInventory(campaignId);
    const next = current.some((i) => i.name === OIL.name)
      ? current
      : [...current, OIL];
    await db
      .update(characters)
      .set({ equipment: next })
      .where(eq(characters.id, characterId));

    const after = await readInventory(campaignId);
    expect(after.filter((i) => i.name === OIL.name)).toHaveLength(1);
  });
});
