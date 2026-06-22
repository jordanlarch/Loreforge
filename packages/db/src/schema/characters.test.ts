import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { campaigns } from "./campaigns";
import { campaignCharacters, characters } from "./characters";
import type { EquipmentItem, SpellLoadout } from "./characters";
import * as schema from "./index";

// Hand-create just the tables under test (mirrors migrations 0000 + 0008 +
// 0012). The full migration set can't run on PGlite because earlier migrations
// use the pgvector `vector` type, so — like pg-event-store.test.ts — we DDL
// locally.
const DDL = `
  CREATE TABLE campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    active_encounter_id uuid,
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
`;

const OWNER = "00000000-0000-4000-8000-0000000000a1";
const SCORES = { str: 16, dex: 12, con: 14, int: 10, wis: 13, cha: 8 };

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

describe("characters schema (#56 extension)", () => {
  it("round-trips xp, notes, portrait, equipment and spells JSONB", async () => {
    const equipment: EquipmentItem[] = [
      { name: "Longsword", quantity: 1, equipped: true, slot: "main-hand" },
      {
        name: "Potion of Healing",
        quantity: 3,
        equipped: false,
        rarity: "Common",
        weight: 0.5,
      },
    ];
    const spells: SpellLoadout = {
      spells: [
        { name: "Fire Bolt", level: 0, prepared: true },
        { name: "Shield", level: 1, prepared: true, source: "Wizard" },
      ],
      slots: { "1": { max: 4, used: 1 } },
    };

    const [row] = await db
      .insert(characters)
      .values({
        ownerId: OWNER,
        name: "Aria",
        abilityScores: SCORES,
        maxHp: 24,
        baseAc: 15,
        xp: 2700,
        notes: "Seeks the lost heirloom.",
        portraitUrl: "https://example.com/aria.png",
        equipment,
        spells,
      })
      .returning();

    expect(row).toBeTruthy();
    expect(row!.xp).toBe(2700);
    expect(row!.notes).toBe("Seeks the lost heirloom.");
    expect(row!.portraitUrl).toBe("https://example.com/aria.png");
    expect(row!.equipment).toEqual(equipment);
    expect(row!.spells).toEqual(spells);
  });

  it("applies the spells/equipment/xp defaults when omitted", async () => {
    const [row] = await db
      .insert(characters)
      .values({
        ownerId: OWNER,
        name: "Default Dan",
        abilityScores: SCORES,
        maxHp: 10,
        baseAc: 10,
      })
      .returning();

    expect(row!.xp).toBe(0);
    expect(row!.equipment).toEqual([]);
    expect(row!.spells).toEqual({ spells: [], slots: {} });
  });
});

describe("campaign_characters membership (#56)", () => {
  it("links a character to a campaign and is idempotent on the pair", async () => {
    const [campaign] = await db
      .insert(campaigns)
      .values({ ownerId: OWNER, name: "The Sunken Crown" })
      .returning();
    const [character] = await db
      .insert(characters)
      .values({
        ownerId: OWNER,
        name: "Bram",
        abilityScores: SCORES,
        maxHp: 12,
        baseAc: 13,
      })
      .returning();

    const values = {
      campaignId: campaign!.id,
      characterId: character!.id,
      ownerId: OWNER,
    };

    const first = await db
      .insert(campaignCharacters)
      .values(values)
      .onConflictDoNothing()
      .returning();
    expect(first).toHaveLength(1);
    expect(first[0]!.role).toBe("pc");
    expect(first[0]!.status).toBe("active");

    // Re-adding the same pair is a no-op (unique index on campaign+character).
    const second = await db
      .insert(campaignCharacters)
      .values(values)
      .onConflictDoNothing()
      .returning();
    expect(second).toHaveLength(0);

    const links = await db
      .select()
      .from(campaignCharacters)
      .where(
        and(
          eq(campaignCharacters.campaignId, campaign!.id),
          eq(campaignCharacters.characterId, character!.id),
        ),
      );
    expect(links).toHaveLength(1);
  });
});
