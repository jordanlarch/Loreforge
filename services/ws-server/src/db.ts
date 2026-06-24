/**
 * Postgres access for the WS server (#14, scope B).
 *
 * Scope B makes the WS server the *sole authoritative writer* for a live
 * campaign: it loads the campaign's event log from Postgres, applies commands,
 * and appends the resulting events. It reuses `@app/db` so the connection,
 * schema, and `PgEventStore` are identical to the web tRPC runtime (one event
 * store contract, one source of truth). Connection is env-driven (`DATABASE_URL`);
 * `getDb()` is lazy, so importing this module has no side effects.
 */
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";

import {
  getDb,
  PgEventStore,
  campaignCharacters,
  campaigns,
  characters,
  chatMessages,
  encounters,
  pinnedMemories,
  plotHooks,
  rollingSummaries,
  tutorialProgress,
  type EquipmentItem,
} from "@app/db";
import {
  expandEncounterFoes,
  monsterTemplate,
  totalLevel,
  xpForLevel,
  TUTORIAL_CHEST_LOOT,
  TUTORIAL_FIRST_SCENE_ID,
  TUTORIAL_OIL_NAME,
  type Ability,
  type EventStore,
  type FoeSpec,
  type PartyMember,
  type TutorialLootItem,
  tutorialSceneRequiresCompanion,
} from "@app/engine";

import type { ChatEntry, ChatEntryKind } from "./chat.js";

let store: EventStore | undefined;

/** The process-wide Postgres-backed event store (built on first use). */
export function getEventStore(): EventStore {
  if (!store) store = new PgEventStore(getDb());
  return store;
}

/**
 * The spellcasting ability for a character's classes (#98). Picks the ability of
 * the first recognized caster class; defaults to Charisma. A pragmatic map for
 * the live cast loop — full multiclass / subclass casting rules are deferred.
 */
const CLASS_CASTING_ABILITY: Record<string, Ability> = {
  wizard: "int",
  artificer: "int",
  cleric: "wis",
  druid: "wis",
  ranger: "wis",
  bard: "cha",
  sorcerer: "cha",
  warlock: "cha",
  paladin: "cha",
};

function castingAbilityFor(classes: { class: string }[]): Ability {
  for (const c of classes) {
    const ability = CLASS_CASTING_ABILITY[c.class.trim().toLowerCase()];
    if (ability) return ability;
  }
  return "cha";
}

/**
 * The active party roster for a campaign, as engine-ready {@link PartyMember}s
 * (#98). Joins `campaign_characters` (active PCs + companions) to `characters`
 * and maps each row onto the trimmed shape `create_entity` needs. A character
 * with any spells becomes a caster (slots seeded from its total level), so the
 * live cast loop is driven by the real sheet rather than the fixture. The entity
 * id is the character row uuid, so the client can rejoin the live combatant to
 * its sheet. Returns an empty array for a campaign with no roster (the caller
 * then falls back to the fixture).
 */
export async function getCampaignParty(
  campaignId: string,
): Promise<PartyMember[]> {
  const rows = await getDb()
    .select({
      id: characters.id,
      name: characters.name,
      abilityScores: characters.abilityScores,
      maxHp: characters.maxHp,
      baseAc: characters.baseAc,
      speed: characters.speed,
      classes: characters.classes,
      spells: characters.spells,
    })
    .from(campaignCharacters)
    .innerJoin(characters, eq(characters.id, campaignCharacters.characterId))
    .where(
      and(
        eq(campaignCharacters.campaignId, campaignId),
        eq(campaignCharacters.status, "active"),
        inArray(campaignCharacters.role, ["pc", "companion"]),
      ),
    )
    .orderBy(asc(campaignCharacters.joinedAt));

  return rows.map((row) => {
    const isCaster = (row.spells?.spells?.length ?? 0) > 0;
    return {
      id: row.id,
      name: row.name,
      abilityScores: row.abilityScores,
      maxHp: row.maxHp,
      baseAc: row.baseAc,
      speed: row.speed,
      classes: row.classes,
      ...(isCaster
        ? {
            spellcasting: {
              ability: castingAbilityFor(row.classes),
              casterLevel: totalLevel(row.classes),
            },
          }
        : {}),
    };
  });
}

/**
 * The authored encounter armed for a campaign's Live Play (CAMP-8, #115), as the
 * scene name + engine-ready {@link FoeSpec}s. Reads `campaigns.activeEncounterId`
 * → the `encounters` row → expands its template×count roster through the engine
 * monster catalog. Returns `undefined` when no encounter is armed (or it resolves
 * to no foes), so the room falls back to the default goblin ambush.
 */
export async function getCampaignEncounter(
  campaignId: string,
): Promise<{ name: string; foes: FoeSpec[] } | undefined> {
  const db = getDb();
  const [campaign] = await db
    .select({ activeEncounterId: campaigns.activeEncounterId })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!campaign?.activeEncounterId) return undefined;

  const [encounter] = await db
    .select({ name: encounters.name, foes: encounters.foes })
    .from(encounters)
    .where(
      and(
        eq(encounters.id, campaign.activeEncounterId),
        eq(encounters.campaignId, campaignId),
      ),
    )
    .limit(1);
  if (!encounter) return undefined;

  const foes = expandEncounterFoes(encounter.foes ?? [], monsterTemplate);
  return foes.length > 0 ? { name: encounter.name, foes } : undefined;
}

/* ------------------------------------------------------------------------- *
 *  Live-play chat persistence (#96)
 * ------------------------------------------------------------------------- */

/**
 * Load a campaign's persisted chat in order (#96), so a re-loaded room
 * re-hydrates the conversation instead of starting blank. Maps the durable rows
 * back onto the {@link ChatEntry} the Yjs doc + client expect.
 */
export async function loadChatMessages(
  campaignId: string,
): Promise<ChatEntry[]> {
  const rows = await getDb()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.campaignId, campaignId))
    .orderBy(asc(chatMessages.seq));
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as ChatEntryKind,
    author: row.author,
    mode: row.mode ?? undefined,
    text: row.text,
    dice: row.dice ?? undefined,
    mentions: row.mentions ?? undefined,
    ts: row.createdAt.getTime(),
  }));
}

/**
 * Persist a batch of chat entries for a campaign (#96), assigning each a
 * per-campaign `seq` starting at `startSeq` (the doc's chat length before the
 * append, which equals the persisted count). Best-effort: a failure (including a
 * rare concurrent-seq collision) must never break the live channel, so it's
 * swallowed — the Yjs doc remains the in-session source of truth.
 */
export async function persistChatMessages(
  campaignId: string,
  entries: readonly ChatEntry[],
  startSeq: number,
): Promise<void> {
  if (entries.length === 0) return;
  try {
    await getDb()
      .insert(chatMessages)
      .values(
        entries.map((entry, i) => ({
          id: entry.id,
          campaignId,
          seq: startSeq + i,
          kind: entry.kind,
          author: entry.author,
          mode: entry.mode ?? null,
          text: entry.text,
          dice: entry.dice ?? null,
          mentions: entry.mentions ?? [],
        })),
      );
  } catch {
    // Chat persistence is best-effort; never break the live channel.
  }
}

/**
 * The owner (user id) of a campaign, or null when it doesn't exist (MEM-5).
 * Used to scope live-turn world-knowledge retrieval to the owner's Realms lore,
 * since Realms embeddings are owner-scoped (no campaign link yet).
 */
export async function getCampaignOwnerId(
  campaignId: string,
): Promise<string | null> {
  const [row] = await getDb()
    .select({ ownerId: campaigns.ownerId })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  return row?.ownerId ?? null;
}

/**
 * The campaign's pinned memories, most-recent first, capped at `limit` (MEM-8
 * always-inject, #159). Read directly from the table (not via embeddings) so
 * pins ground the GM even when the memory tier is unconfigured.
 */
export async function loadCampaignPins(
  campaignId: string,
  limit: number,
): Promise<string[]> {
  const rows = await getDb()
    .select({ content: pinnedMemories.content })
    .from(pinnedMemories)
    .where(eq(pinnedMemories.campaignId, campaignId))
    .orderBy(desc(pinnedMemories.createdAt))
    .limit(limit);
  return rows.map((r) => r.content);
}

/* ------------------------------------------------------------------------- *
 *  Rolling session summary (MEM-3, #143)
 * ------------------------------------------------------------------------- */

export type RollingSummary = { summary: string; coveredSeq: number };

/** The campaign's current rolling session summary, or null if none yet. */
export async function loadRollingSummary(
  campaignId: string,
): Promise<RollingSummary | null> {
  const [row] = await getDb()
    .select({
      summary: rollingSummaries.summary,
      coveredSeq: rollingSummaries.coveredSeq,
    })
    .from(rollingSummaries)
    .where(eq(rollingSummaries.campaignId, campaignId))
    .limit(1);
  return row ?? null;
}

/**
 * Upsert a campaign's rolling session summary (MEM-3). One row per campaign,
 * keyed by `campaignId`; `coveredSeq` records the chat length it covers so the
 * cadence only regenerates after enough new turns.
 */
export async function saveRollingSummary(
  campaignId: string,
  value: { summary: string; coveredSeq: number; model?: string },
): Promise<void> {
  const set = {
    summary: value.summary,
    coveredSeq: value.coveredSeq,
    model: value.model ?? "",
    updatedAt: new Date(),
  };
  await getDb()
    .insert(rollingSummaries)
    .values({ campaignId, ...set })
    .onConflictDoUpdate({ target: rollingSummaries.campaignId, set });
}

/* ------------------------------------------------------------------------- *
 *  Tutorial onboarding (TUT-1)
 * ------------------------------------------------------------------------- */

/**
 * True iff the campaign is the user's scripted onboarding tutorial (TUT-1).
 * Drives `roomFor` to run the {@link TutorialRoom} (scripted scene graph) rather
 * than the default encounter seed. Looked up once per room (then cached in the
 * room map), so the cost is paid only on first join.
 */
export async function isTutorialCampaign(campaignId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ isTutorial: campaigns.isTutorial })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  return Boolean(row?.isTutorial);
}

/**
 * Persist the user's current tutorial scene (scene-granularity resume, D6).
 * Best-effort and keyed by `campaignId` (one tutorial per user): a failure must
 * never break the live channel, so it is swallowed — the engine log remains the
 * authority on mechanical state.
 */
export async function setTutorialScene(
  campaignId: string,
  sceneId: string,
): Promise<void> {
  try {
    await getDb()
      .update(tutorialProgress)
      .set({ currentSceneId: sceneId, updatedAt: new Date() })
      .where(eq(tutorialProgress.campaignId, campaignId));
  } catch {
    // Progress tracking is best-effort; never break the live channel.
  }
}

/**
 * Claim scripted loot into the tutorial hero's inventory (D4) — Scene 4's chest
 * grant. Finds the campaign's `pc` character, appends any loot items not already
 * present (idempotent by name) to its real `equipment`, and returns the names
 * actually added. Server-authoritative: only called after the engine resolves
 * the chest check as a success. Best-effort write; a failure is swallowed so it
 * never breaks the live channel.
 */
export async function grantTutorialLoot(
  campaignId: string,
  loot: readonly TutorialLootItem[],
): Promise<string[]> {
  try {
    const db = getDb();
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
    if (!row) return [];

    const current = (row.equipment ?? []) as EquipmentItem[];
    const have = new Set(current.map((i) => i.name));
    const additions = loot.filter((i) => !have.has(i.name));
    if (additions.length === 0) return [];

    const next: EquipmentItem[] = [
      ...current,
      ...additions.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        equipped: false,
        ...(i.description ? { description: i.description } : {}),
      })),
    ];
    await db
      .update(characters)
      .set({ equipment: next, updatedAt: new Date() })
      .where(eq(characters.id, row.id));
    return additions.map((i) => i.name);
  } catch {
    return [];
  }
}

/**
 * The campaign hero's (`pc`) row + inventory, or null. Shared resolver for the
 * Scene 6 resolution writes (consume item, award XP), mirroring the join used by
 * {@link grantTutorialLoot}.
 */
async function tutorialHeroRow(campaignId: string): Promise<{
  id: string;
  xp: number;
  classes: { class: string; level: number }[];
  equipment: EquipmentItem[];
} | null> {
  const [row] = await getDb()
    .select({
      id: characters.id,
      xp: characters.xp,
      classes: characters.classes,
      equipment: characters.equipment,
    })
    .from(campaignCharacters)
    .innerJoin(characters, eq(characters.id, campaignCharacters.characterId))
    .where(
      and(
        eq(campaignCharacters.campaignId, campaignId),
        eq(campaignCharacters.role, "pc"),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    xp: row.xp,
    classes: row.classes,
    equipment: (row.equipment ?? []) as EquipmentItem[],
  };
}

/* ------------------------------------------------------------------------- *
 *  Tutorial Scene 6 — resolution writes (TUT-1, #175)
 * ------------------------------------------------------------------------- */

/** Flat XP each party member earns for the Scene 6 finale (flavor; the hero is
 * always clamped up to her next-level threshold so the level-up notice fires). */
export const TUTORIAL_XP_AWARD = 250;

/** The campaign's plot-hook status (TUT-1), or null. Drives the relight
 * double-fire guard + the client's "lantern lit" state. */
export async function getTutorialHookStatus(
  campaignId: string,
): Promise<string | null> {
  const [row] = await getDb()
    .select({ status: plotHooks.status })
    .from(plotHooks)
    .where(eq(plotHooks.campaignId, campaignId))
    .limit(1);
  return row?.status ?? null;
}

/** True when the tutorial companion should be in the party (hook accepted+). */
export async function tutorialCompanionShouldBeActive(
  campaignId: string,
  sceneId?: string,
): Promise<boolean> {
  if (sceneId && tutorialSceneRequiresCompanion(sceneId)) return true;
  try {
    const hookStatus = await getTutorialHookStatus(campaignId);
    if (hookStatus === "active" || hookStatus === "resolved") return true;
    return (await getCampaignParty(campaignId)).length > 1;
  } catch {
    return false;
  }
}

/**
 * Resolve the tutorial's central plot hook (Scene 6, D4): flip its status to
 * "resolved" so it lands in the campaign Hooks tab as done. Returns whether it
 * actually changed (false if already resolved) — the caller uses this to make
 * the resolution beat fire exactly once. Best-effort.
 */
export async function resolveTutorialHook(campaignId: string): Promise<boolean> {
  try {
    const rows = await getDb()
      .update(plotHooks)
      .set({ status: "resolved", updatedAt: new Date() })
      .where(
        and(
          eq(plotHooks.campaignId, campaignId),
          ne(plotHooks.status, "resolved"),
        ),
      )
      .returning({ id: plotHooks.id });
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Consume one of a named item from the tutorial hero's real inventory (D4 — the
 * Scene 6 Oil-of-Brightness use). Decrements quantity (removing the row at 0).
 * Returns whether an item was actually consumed. Best-effort.
 */
export async function consumeTutorialItem(
  campaignId: string,
  itemName: string,
): Promise<boolean> {
  try {
    const hero = await tutorialHeroRow(campaignId);
    if (!hero) return false;
    const idx = hero.equipment.findIndex((i) => i.name === itemName);
    if (idx < 0) return false;
    const item = hero.equipment[idx]!;
    const next =
      item.quantity > 1
        ? hero.equipment.map((i, n) =>
            n === idx ? { ...i, quantity: i.quantity - 1 } : i,
          )
        : hero.equipment.filter((_, n) => n !== idx);
    await getDb()
      .update(characters)
      .set({ equipment: next, updatedAt: new Date() })
      .where(eq(characters.id, hero.id));
    return true;
  } catch {
    return false;
  }
}

/**
 * Award the Scene 6 finale XP (D4). Every party member (pc + companion) gains a
 * flat {@link TUTORIAL_XP_AWARD}; the hero is additionally clamped up to her
 * next-level threshold so she becomes level-up-eligible and the notice fires (no
 * wizard runs — the real Level-Up Wizard stays available on her sheet). Returns
 * whether the hero crossed into a new level (drives the notice). Best-effort.
 */
export async function awardTutorialXp(
  campaignId: string,
): Promise<{ leveledUp: boolean; awarded: number }> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: characters.id,
        xp: characters.xp,
        classes: characters.classes,
        role: campaignCharacters.role,
      })
      .from(campaignCharacters)
      .innerJoin(characters, eq(characters.id, campaignCharacters.characterId))
      .where(
        and(
          eq(campaignCharacters.campaignId, campaignId),
          inArray(campaignCharacters.role, ["pc", "companion"]),
        ),
      );

    let leveledUp = false;
    let awarded = TUTORIAL_XP_AWARD;
    for (const row of rows) {
      const base = row.xp + TUTORIAL_XP_AWARD;
      if (row.role === "pc") {
        const nextThreshold = xpForLevel(totalLevel(row.classes) + 1);
        const newXp = Math.max(base, nextThreshold);
        leveledUp = row.xp < nextThreshold && newXp >= nextThreshold;
        awarded = newXp - row.xp;
        await db
          .update(characters)
          .set({ xp: newXp, updatedAt: new Date() })
          .where(eq(characters.id, row.id));
      } else {
        await db
          .update(characters)
          .set({ xp: base, updatedAt: new Date() })
          .where(eq(characters.id, row.id));
      }
    }
    return { leveledUp, awarded };
  } catch {
    return { leveledUp: false, awarded: 0 };
  }
}

/* ------------------------------------------------------------------------- *
 *  Tutorial reset (TUT-1, #bug3) — restore the campaign to its seeded baseline
 * ------------------------------------------------------------------------- */

/** Mira Thornwood's seeded XP (Ranger 3) — keep in sync with the tutorial tRPC
 * router's `TUTORIAL_MIRA.xp`. Reset restores the hero to this. */
const TUTORIAL_PC_BASELINE_XP = 900;
/** Old Brennar's seeded XP (Cleric 2) — keep in sync with `TUTORIAL_BRENNAR.xp`. */
const TUTORIAL_COMPANION_BASELINE_XP = 450;

/**
 * Wipe a campaign's persisted conversation (chat rows + rolling summary + pins),
 * so a tutorial "Reset" truly clears the chat window instead of re-hydrating the
 * old transcript on reload (#bug3). Best-effort; never throws into the channel.
 */
export async function clearCampaignChat(campaignId: string): Promise<void> {
  try {
    const db = getDb();
    await db.delete(chatMessages).where(eq(chatMessages.campaignId, campaignId));
    await db
      .delete(rollingSummaries)
      .where(eq(rollingSummaries.campaignId, campaignId));
    await db
      .delete(pinnedMemories)
      .where(eq(pinnedMemories.campaignId, campaignId));
  } catch {
    // Reset cleanup is best-effort; the engine log truncation is the authority.
  }
}

/**
 * Restore the tutorial campaign's DB-side state to its seeded baseline (#bug3):
 * the plot hook back to "suggested", the companion back to "reserve", the resume
 * pointer to the first scene, and the hero's sheet de-progressed (granted items
 * stripped, XP reset). Mirrors the inverse of the Scene 2–6 writes so a replay
 * starts clean. Best-effort — a failure must never break the live channel.
 */
export async function resetTutorialState(campaignId: string): Promise<void> {
  try {
    const db = getDb();

    await db
      .update(plotHooks)
      .set({ status: "suggested", updatedAt: new Date() })
      .where(eq(plotHooks.campaignId, campaignId));

    await db
      .update(campaignCharacters)
      .set({ status: "reserve" })
      .where(
        and(
          eq(campaignCharacters.campaignId, campaignId),
          eq(campaignCharacters.role, "companion"),
        ),
      );

    await db
      .update(tutorialProgress)
      .set({
        currentSceneId: TUTORIAL_FIRST_SCENE_ID,
        status: "in_progress",
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(tutorialProgress.campaignId, campaignId));

    // De-progress the roster: strip tutorial-granted items + reset XP by role.
    const granted = new Set<string>([
      TUTORIAL_OIL_NAME,
      ...TUTORIAL_CHEST_LOOT.map((i) => i.name),
    ]);
    const roster = await db
      .select({
        id: characters.id,
        equipment: characters.equipment,
        role: campaignCharacters.role,
      })
      .from(campaignCharacters)
      .innerJoin(characters, eq(characters.id, campaignCharacters.characterId))
      .where(
        and(
          eq(campaignCharacters.campaignId, campaignId),
          inArray(campaignCharacters.role, ["pc", "companion"]),
        ),
      );

    for (const row of roster) {
      const equipment = ((row.equipment ?? []) as EquipmentItem[]).filter(
        (i) => !granted.has(i.name),
      );
      const xp =
        row.role === "pc"
          ? TUTORIAL_PC_BASELINE_XP
          : TUTORIAL_COMPANION_BASELINE_XP;
      await db
        .update(characters)
        .set({ equipment, xp, updatedAt: new Date() })
        .where(eq(characters.id, row.id));
    }
  } catch {
    // Best-effort reset; the engine event-log truncation is the authority.
  }
}

/** Flip the tutorial companion roster row to active (best-effort, WS-side sync). */
export async function activateTutorialCompanion(
  campaignId: string,
): Promise<void> {
  try {
    await getDb()
      .update(campaignCharacters)
      .set({ status: "active" })
      .where(
        and(
          eq(campaignCharacters.campaignId, campaignId),
          eq(campaignCharacters.role, "companion"),
        ),
      );
  } catch {
    // DB sync is best-effort; the engine entity is authoritative for live play.
  }
}

/** True iff the campaign exists and is owned by the given user. */
export async function isCampaignOwner(
  campaignId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, userId)))
    .limit(1);
  return Boolean(row);
}
