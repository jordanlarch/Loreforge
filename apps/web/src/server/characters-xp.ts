/**
 * Shared XP grant helpers for characters (quests, combat awards, GM adjust).
 */
import { eq, sql, and } from "drizzle-orm";

import { campaignCharacters, characters, getDb, type Database } from "@app/db";

/** Add XP to one owned character; returns the new total. */
export async function grantCharacterXp(
  db: Database,
  ownerId: string,
  characterId: string,
  amount: number,
): Promise<number> {
  const [row] = await db
    .select({ id: characters.id, xp: characters.xp })
    .from(characters)
    .where(and(eq(characters.id, characterId), eq(characters.ownerId, ownerId)))
    .limit(1);
  if (!row) {
    throw new Error("Character not found.");
  }
  const next = row.xp + amount;
  await db
    .update(characters)
    .set({ xp: next, updatedAt: new Date() })
    .where(eq(characters.id, characterId));
  return next;
}

/** Split encounter XP evenly among active campaign PCs (5E default). */
export async function grantCampaignPartyXp(
  db: Database,
  ownerId: string,
  campaignId: string,
  totalXp: number,
  opts?: { split?: boolean },
): Promise<{ perCharacter: number; recipientCount: number }> {
  const pcs = await db
    .select({ id: characters.id })
    .from(campaignCharacters)
    .innerJoin(characters, eq(campaignCharacters.characterId, characters.id))
    .where(
      and(
        eq(campaignCharacters.campaignId, campaignId),
        eq(campaignCharacters.ownerId, ownerId),
        eq(campaignCharacters.role, "pc"),
        eq(campaignCharacters.status, "active"),
      ),
    );

  if (pcs.length === 0) {
    throw new Error("No active PCs in this campaign to award XP.");
  }

  const split = opts?.split !== false;
  const perCharacter = split
    ? Math.max(1, Math.floor(totalXp / pcs.length))
    : totalXp;

  for (const pc of pcs) {
    await db
      .update(characters)
      .set({
        xp: sql`${characters.xp} + ${perCharacter}`,
        updatedAt: new Date(),
      })
      .where(eq(characters.id, pc.id));
  }

  return { perCharacter, recipientCount: pcs.length };
}
