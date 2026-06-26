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

const OWNER = "00000000-0000-4000-8000-0000000000e1";
const SCORES = { str: 12, dex: 16, con: 13, int: 10, wis: 15, cha: 11 };
const LOOT: EquipmentItem[] = [
  { name: "Scroll of Cure Wounds", quantity: 1, equipped: false },
  { name: "Gold Pieces", quantity: 12, equipped: false },
];

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
async function seedHero(equipment: EquipmentItem[]): Promise<string> {
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
  return campaign!.id;
}

/** The chest grant, the way the ws-server resolves it (campaign → pc → append). */
async function grantLoot(campaignId: string): Promise<string[]> {
  const [row] = await db
    .select({ id: characters.id, equipment: characters.equipment })
    .from(campaignCharacters)
    .innerJoin(characters, eq(characters.id, campaignCharacters.characterId))
    .where(
      and(
        eq(campaignCharacters.campaignId, campaignId),
        eq(campaignCharacters.role, "pc"),
      ),
    )
    .limit(1);
  const current = (row!.equipment ?? []) as EquipmentItem[];
  const have = new Set(current.map((i) => i.name));
  const additions = LOOT.filter((i) => !have.has(i.name));
  if (additions.length > 0) {
    await db
      .update(characters)
      .set({ equipment: [...current, ...additions] })
      .where(eq(characters.id, row!.id));
  }
  return additions.map((i) => i.name);
}

async function readInventory(campaignId: string): Promise<EquipmentItem[]> {
  const [row] = await db
    .select({ equipment: characters.equipment })
    .from(campaignCharacters)
    .innerJoin(characters, eq(characters.id, campaignCharacters.characterId))
    .where(
      and(
        eq(campaignCharacters.campaignId, campaignId),
        eq(campaignCharacters.role, "pc"),
      ),
    )
    .limit(1);
  return (row?.equipment ?? []) as EquipmentItem[];
}

describe("tutorial Scene 4 — scripted chest loot (TUT-1, #173)", () => {
  it("claims the chest loot into Mira's real equipment on success", async () => {
    const campaignId = await seedHero([
      { name: "Longbow", quantity: 1, equipped: true },
    ]);

    const granted = await grantLoot(campaignId);
    expect(granted).toEqual(["Scroll of Cure Wounds", "Gold Pieces"]);

    const after = await readInventory(campaignId);
    expect(after).toHaveLength(3);
    expect(after.some((i) => i.name === "Scroll of Cure Wounds")).toBe(true);
    expect(after.find((i) => i.name === "Gold Pieces")?.quantity).toBe(12);
  });

  it("is idempotent — re-granting never duplicates loot", async () => {
    const campaignId = await seedHero([]);
    await grantLoot(campaignId);
    const secondPass = await grantLoot(campaignId);

    expect(secondPass).toEqual([]); // nothing new to add
    const after = await readInventory(campaignId);
    expect(after.filter((i) => i.name === "Scroll of Cure Wounds")).toHaveLength(
      1,
    );
  });
});
