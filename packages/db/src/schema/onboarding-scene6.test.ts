import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { and, eq, ne } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { totalLevel, xpForLevel } from "@app/engine";

import { campaigns, plotHooks } from "./campaigns";
import {
  campaignCharacters,
  characters,
  type EquipmentItem,
} from "./characters";
import { pinnedMemories } from "./memory";
import * as schema from "./index";

// Hand-create just the tables the Scene 6 resolution touches (mirrors the
// relevant migrations). PGlite can't run the full migration set (pgvector), so —
// like the other onboarding tests — we DDL locally. `pinned_memories` is created
// without the pgvector embeddings table; we only exercise the editable pin row.
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
  CREATE TABLE pinned_memories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
`;

const OWNER = "00000000-0000-4000-8000-0000000000f6";
const SCORES = { str: 12, dex: 16, con: 13, int: 10, wis: 15, cha: 11 };
const OIL = "Oil of Brightness";
const XP_AWARD = 250;

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

/** Seed a tutorial campaign with Mira (`pc`), Brennar (`companion`), the central
 * hook (active), and Mira's starter equipment. Returns the campaign id. */
async function seedCampaign(equipment: EquipmentItem[]): Promise<string> {
  const [campaign] = await db
    .insert(campaigns)
    .values({ ownerId: OWNER, name: "The Lantern's Last Flicker", isTutorial: true })
    .returning();
  const [mira] = await db
    .insert(characters)
    .values({
      ownerId: OWNER,
      name: "Mira Thornwood",
      classes: [{ class: "Ranger", level: 3 }],
      abilityScores: SCORES,
      maxHp: 27,
      baseAc: 14,
      xp: 900,
      equipment,
    })
    .returning();
  const [brennar] = await db
    .insert(characters)
    .values({
      ownerId: OWNER,
      name: "Old Brennar",
      classes: [{ class: "Cleric", level: 2 }],
      abilityScores: SCORES,
      maxHp: 17,
      baseAc: 13,
      xp: 450,
    })
    .returning();
  await db.insert(campaignCharacters).values([
    {
      campaignId: campaign!.id,
      characterId: mira!.id,
      ownerId: OWNER,
      role: "pc",
      status: "active",
    },
    {
      campaignId: campaign!.id,
      characterId: brennar!.id,
      ownerId: OWNER,
      role: "companion",
      status: "active",
    },
  ]);
  await db.insert(plotHooks).values({
    campaignId: campaign!.id,
    ownerId: OWNER,
    title: "The Lantern's Last Flicker",
    status: "active",
  });
  return campaign!.id;
}

/** Consume one named item from the hero's inventory (mirrors consumeTutorialItem). */
async function consumeItem(campaignId: string, name: string): Promise<boolean> {
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
  const equipment = (row!.equipment ?? []) as EquipmentItem[];
  const idx = equipment.findIndex((i) => i.name === name);
  if (idx < 0) return false;
  const item = equipment[idx]!;
  const next =
    item.quantity > 1
      ? equipment.map((i, n) => (n === idx ? { ...i, quantity: i.quantity - 1 } : i))
      : equipment.filter((_, n) => n !== idx);
  await db.update(characters).set({ equipment: next }).where(eq(characters.id, row!.id));
  return true;
}

/** Flip the hook to resolved exactly once (mirrors resolveTutorialHook). */
async function resolveHook(campaignId: string): Promise<boolean> {
  const rows = await db
    .update(plotHooks)
    .set({ status: "resolved" })
    .where(and(eq(plotHooks.campaignId, campaignId), ne(plotHooks.status, "resolved")))
    .returning({ id: plotHooks.id });
  return rows.length > 0;
}

/** Award the finale XP, clamping the hero up to her next level (mirrors awardTutorialXp). */
async function awardXp(campaignId: string): Promise<boolean> {
  const rows = await db
    .select({
      id: characters.id,
      xp: characters.xp,
      classes: characters.classes,
      role: campaignCharacters.role,
    })
    .from(campaignCharacters)
    .innerJoin(characters, eq(characters.id, campaignCharacters.characterId))
    .where(eq(campaignCharacters.campaignId, campaignId));
  let leveledUp = false;
  for (const row of rows) {
    const base = row.xp + XP_AWARD;
    if (row.role === "pc") {
      const nextThreshold = xpForLevel(totalLevel(row.classes) + 1);
      const newXp = Math.max(base, nextThreshold);
      leveledUp = row.xp < nextThreshold && newXp >= nextThreshold;
      await db.update(characters).set({ xp: newXp }).where(eq(characters.id, row.id));
    } else {
      await db.update(characters).set({ xp: base }).where(eq(characters.id, row.id));
    }
  }
  return leveledUp;
}

async function heroXp(campaignId: string): Promise<number> {
  const [row] = await db
    .select({ xp: characters.xp })
    .from(campaignCharacters)
    .innerJoin(characters, eq(characters.id, campaignCharacters.characterId))
    .where(
      and(
        eq(campaignCharacters.campaignId, campaignId),
        eq(campaignCharacters.role, "pc"),
      ),
    )
    .limit(1);
  return row!.xp;
}

describe("tutorial Scene 6 — finale resolution (TUT-1, #175)", () => {
  it("consumes the Oil of Brightness on the best-outcome relight", async () => {
    const campaignId = await seedCampaign([
      { name: "Longbow", quantity: 1, equipped: true },
      { name: OIL, quantity: 1, equipped: false },
    ]);

    expect(await consumeItem(campaignId, OIL)).toBe(true);
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
    const after = (row!.equipment ?? []) as EquipmentItem[];
    expect(after.some((i) => i.name === OIL)).toBe(false);
    expect(after.some((i) => i.name === "Longbow")).toBe(true);
    // Consuming when absent is a safe no-op (e.g. the player skipped the shop).
    expect(await consumeItem(campaignId, OIL)).toBe(false);
  });

  it("resolves the central hook exactly once", async () => {
    const campaignId = await seedCampaign([]);

    expect(await resolveHook(campaignId)).toBe(true);
    const [hook] = await db
      .select({ status: plotHooks.status })
      .from(plotHooks)
      .where(eq(plotHooks.campaignId, campaignId))
      .limit(1);
    expect(hook?.status).toBe("resolved");
    // Idempotent: a second resolve reports no change (drives fire-once narration).
    expect(await resolveHook(campaignId)).toBe(false);
  });

  it("awards XP and makes the hero level-up-eligible (no wizard)", async () => {
    const campaignId = await seedCampaign([]);

    const leveledUp = await awardXp(campaignId);
    expect(leveledUp).toBe(true);
    // Mira (L3, 900 XP) is clamped up to the Level 4 threshold so the notice fires.
    expect(await heroXp(campaignId)).toBe(xpForLevel(4));
    // Re-awarding never demotes or double-counts beyond the flat award.
    expect(await awardXp(campaignId)).toBe(false);
  });

  it("persists a pinned memory that surfaces in the campaign Memory panel", async () => {
    const campaignId = await seedCampaign([]);

    await db.insert(pinnedMemories).values({
      campaignId,
      ownerId: OWNER,
      content: "Lily gave me her father's key.",
    });
    const pins = await db
      .select({ content: pinnedMemories.content })
      .from(pinnedMemories)
      .where(eq(pinnedMemories.campaignId, campaignId));
    expect(pins).toHaveLength(1);
    expect(pins[0]?.content).toBe("Lily gave me her father's key.");
  });
});
