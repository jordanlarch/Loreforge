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
import { and, asc, eq, inArray } from "drizzle-orm";

import {
  getDb,
  PgEventStore,
  campaignCharacters,
  campaigns,
  characters,
  chatMessages,
  encounters,
  rollingSummaries,
} from "@app/db";
import {
  expandEncounterFoes,
  monsterTemplate,
  totalLevel,
  type Ability,
  type EventStore,
  type FoeSpec,
  type PartyMember,
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
