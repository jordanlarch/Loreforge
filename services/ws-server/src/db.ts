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
import { and, asc, desc, eq, inArray, ne, or } from "drizzle-orm";

import {
  getDb,
  PgEventStore,
  campaignCharacters,
  campaignReputation,
  campaignWorldEntities,
  campaigns,
  characters,
  chatMessages,
  encounters,
  pinnedMemories,
  plotHooks,
  realmEntities,
  realmRelationships,
  rollingSummaries,
  tutorialProgress,
  type EquipmentItem,
} from "@app/db";
import {
  expandEncounterFoes,
  extractOpeningHookText,
  getSpell,
  locationHasQuestContent,
  meleeReachFromEquipment,
  monsterTemplate,
  resolveEncounterMap,
  spellNameToId,
  totalLevel,
  xpForLevel,
  levelForXp,
  parseQuestInstanceData,
  TUTORIAL_CHEST_LOOT,
  TUTORIAL_FIRST_SCENE_ID,
  TUTORIAL_OIL_NAME,
  type Ability,
  type AbilityScores,
  type CampaignStartingLocation,
  type EventStore,
  type ExplorableRealmType,
  entityIdFromSceneId,
  type FoeSpec,
  type LocationNpcSpec,
  type PartyMember,
  type QuestPrerequisiteContext,
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

/** ENG-12: cantrips + prepared registry ids from a character spell loadout. */
function preparedSpellIdsFromSheet(
  loadout:
    | {
        spells?: {
          name: string;
          level: number;
          prepared: boolean;
          alwaysPrepared?: boolean;
        }[];
      }
    | null
    | undefined,
): string[] | undefined {
  const list = loadout?.spells ?? [];
  if (list.length === 0) return undefined;
  const ids: string[] = [];
  for (const row of list) {
    if (row.level !== 0 && !row.prepared && !row.alwaysPrepared) continue;
    const id = spellNameToId(row.name);
    if (getSpell(id)) ids.push(id);
  }
  return ids.length > 0 ? ids : undefined;
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
      equipment: characters.equipment,
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
    const meleeReachFt = meleeReachFromEquipment(
      Array.isArray(row.equipment) ? row.equipment : [],
    );
    const preparedSpellIds = isCaster
      ? preparedSpellIdsFromSheet(row.spells)
      : undefined;
    return {
      id: row.id,
      name: row.name,
      abilityScores: row.abilityScores,
      maxHp: row.maxHp,
      baseAc: row.baseAc,
      speed: row.speed,
      classes: row.classes,
      ...(meleeReachFt !== undefined ? { meleeReachFt } : {}),
      ...(isCaster
        ? {
            spellcasting: {
              ability: castingAbilityFor(row.classes),
              casterLevel: totalLevel(row.classes),
              ...(preparedSpellIds ? { preparedSpellIds } : {}),
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
 * to no foes), so the room opens in exploration mode instead.
 */
export async function getCampaignEncounter(
  campaignId: string,
): Promise<
  { name: string; foes: FoeSpec[]; map: ReturnType<typeof resolveEncounterMap> } | undefined
> {
  const db = getDb();
  const [campaign] = await db
    .select({ activeEncounterId: campaigns.activeEncounterId })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!campaign?.activeEncounterId) return undefined;

  const [encounter] = await db
    .select({
      name: encounters.name,
      foes: encounters.foes,
      mapPreset: encounters.mapPreset,
    })
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
  if (foes.length === 0) return undefined;
  return {
    name: encounter.name,
    foes,
    map: resolveEncounterMap(encounter.mapPreset),
  };
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

/** Campaign world-tab members for auto-reveal matching (CAMP-4). */
export async function loadCampaignWorldEntities(
  campaignId: string,
  ownerId: string,
): Promise<
  { entityId: string; name: string; discovered: boolean }[]
> {
  return getDb()
    .select({
      entityId: campaignWorldEntities.entityId,
      name: realmEntities.name,
      discovered: campaignWorldEntities.discovered,
    })
    .from(campaignWorldEntities)
    .innerJoin(
      realmEntities,
      eq(realmEntities.id, campaignWorldEntities.entityId),
    )
    .where(
      and(
        eq(campaignWorldEntities.campaignId, campaignId),
        eq(campaignWorldEntities.ownerId, ownerId),
      ),
    );
}

const EXPLORABLE_REALM_TYPES: ExplorableRealmType[] = [
  "tavern",
  "settlement",
  "building",
  "shop",
  "region",
  "dungeon",
];

const STARTING_LOCATION_PRIORITY: Record<ExplorableRealmType, number> = {
  tavern: 0,
  settlement: 1,
  building: 2,
  shop: 3,
  region: 4,
  dungeon: 5,
};

function sortExplorableLocations<
  T extends {
    type: string;
    addedAt: Date;
    entityId: string;
    name: string;
    summary: string;
    data: unknown;
  },
>(rows: T[], parentDataByEntityId: ReadonlyMap<string, unknown>): CampaignStartingLocation[] {
  return [...rows]
    .sort((a, b) => {
      const pa = STARTING_LOCATION_PRIORITY[a.type as ExplorableRealmType] ?? 99;
      const pb = STARTING_LOCATION_PRIORITY[b.type as ExplorableRealmType] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.addedAt.getTime() - b.addedAt.getTime();
    })
    .map((row) => ({
      entityId: row.entityId,
      name: row.name,
      summary: row.summary,
      type: row.type as ExplorableRealmType,
      openingHook: extractOpeningHookText(row.data, {
        trigger: "on_session_start",
        locationEntityId: row.entityId,
        parentData: parentDataByEntityId.get(row.entityId),
      }),
    }));
}

/** Walk `located_in` ancestors until quest content is found (Phase A.1). */
async function loadQuestParentDataForEntity(
  ownerId: string,
  entityId: string,
): Promise<unknown | undefined> {
  let currentId = entityId;
  for (let depth = 0; depth < 5; depth += 1) {
    const [edge] = await getDb()
      .select({ parentId: realmRelationships.fromId })
      .from(realmRelationships)
      .where(
        and(
          eq(realmRelationships.ownerId, ownerId),
          eq(realmRelationships.kind, "located_in"),
          eq(realmRelationships.toId, currentId),
        ),
      )
      .limit(1);
    if (!edge) return undefined;

    const [parent] = await getDb()
      .select({ id: realmEntities.id, data: realmEntities.data })
      .from(realmEntities)
      .where(
        and(
          eq(realmEntities.id, edge.parentId),
          eq(realmEntities.ownerId, ownerId),
        ),
      )
      .limit(1);
    if (!parent) return undefined;
    if (locationHasQuestContent(parent.data)) return parent.data;
    currentId = parent.id;
  }
  return undefined;
}

async function loadQuestParentDataByEntityId(
  ownerId: string,
  entityIds: readonly string[],
): Promise<Map<string, unknown>> {
  const map = new Map<string, unknown>();
  await Promise.all(
    entityIds.map(async (entityId) => {
      const parentData = await loadQuestParentDataForEntity(ownerId, entityId);
      if (parentData !== undefined) map.set(entityId, parentData);
    }),
  );
  return map;
}

async function loadExplorableWorldRows(campaignId: string, ownerId: string) {
  return getDb()
    .select({
      entityId: campaignWorldEntities.entityId,
      addedAt: campaignWorldEntities.addedAt,
      name: realmEntities.name,
      summary: realmEntities.summary,
      type: realmEntities.type,
      data: realmEntities.data,
    })
    .from(campaignWorldEntities)
    .innerJoin(
      realmEntities,
      eq(realmEntities.id, campaignWorldEntities.entityId),
    )
    .where(
      and(
        eq(campaignWorldEntities.campaignId, campaignId),
        eq(campaignWorldEntities.ownerId, ownerId),
        inArray(realmEntities.type, EXPLORABLE_REALM_TYPES),
      ),
    );
}

/** All explorable World-tab locations for a campaign (Rung 4 Slice 2 travel). */
export async function getCampaignExplorableLocations(
  campaignId: string,
): Promise<CampaignStartingLocation[]> {
  const ownerId = await getCampaignOwnerId(campaignId);
  if (!ownerId) return [];
  const rows = await loadExplorableWorldRows(campaignId, ownerId);
  const parentData = await loadQuestParentDataByEntityId(
    ownerId,
    rows.map((r) => r.entityId),
  );
  return sortExplorableLocations(rows, parentData);
}

/** Resolve one World-tab entity to a travel destination, if explorable. */
export async function getCampaignLocationByEntityId(
  campaignId: string,
  entityId: string,
): Promise<CampaignStartingLocation | undefined> {
  const ownerId = await getCampaignOwnerId(campaignId);
  if (!ownerId) return undefined;

  const [row] = await getDb()
    .select({
      entityId: campaignWorldEntities.entityId,
      addedAt: campaignWorldEntities.addedAt,
      name: realmEntities.name,
      summary: realmEntities.summary,
      type: realmEntities.type,
      data: realmEntities.data,
    })
    .from(campaignWorldEntities)
    .innerJoin(
      realmEntities,
      eq(realmEntities.id, campaignWorldEntities.entityId),
    )
    .where(
      and(
        eq(campaignWorldEntities.campaignId, campaignId),
        eq(campaignWorldEntities.ownerId, ownerId),
        eq(campaignWorldEntities.entityId, entityId),
        inArray(realmEntities.type, EXPLORABLE_REALM_TYPES),
      ),
    )
    .limit(1);

  if (!row) return undefined;

  const parentDataByEntityId = await loadQuestParentDataByEntityId(ownerId, [
    row.entityId,
  ]);
  return {
    entityId: row.entityId,
    name: row.name,
    summary: row.summary,
    type: row.type as ExplorableRealmType,
    openingHook: extractOpeningHookText(row.data, {
      trigger: "on_enter_location",
      locationEntityId: row.entityId,
      parentData: parentDataByEntityId.get(row.entityId),
    }),
  };
}

const DEFAULT_NPC_STATS: AbilityScores = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

function npcSpecFromRow(row: {
  id: string;
  name: string;
  data: unknown;
}): LocationNpcSpec {
  const data = (row.data ?? {}) as Record<string, unknown>;
  const abilityScores =
    data.abilityScores && typeof data.abilityScores === "object"
      ? (data.abilityScores as AbilityScores)
      : DEFAULT_NPC_STATS;
  return {
    entityId: row.id,
    name: row.name,
    abilityScores,
    maxHp: typeof data.maxHp === "number" ? data.maxHp : 10,
    baseAc: typeof data.baseAc === "number" ? data.baseAc : 10,
    speed: typeof data.speed === "number" ? data.speed : 30,
  };
}

/** NPCs on the World tab related to a location entity (Rung 4 Slice 3). */
export async function getCampaignNpcsAtLocation(
  campaignId: string,
  locationEntityId: string,
): Promise<LocationNpcSpec[]> {
  const ownerId = await getCampaignOwnerId(campaignId);
  if (!ownerId) return [];

  const worldRows = await getDb()
    .select({ entityId: campaignWorldEntities.entityId })
    .from(campaignWorldEntities)
    .where(
      and(
        eq(campaignWorldEntities.campaignId, campaignId),
        eq(campaignWorldEntities.ownerId, ownerId),
      ),
    );
  const worldIds = new Set(worldRows.map((r) => r.entityId));
  if (worldIds.size === 0) return [];

  const rels = await getDb()
    .select({
      fromId: realmRelationships.fromId,
      toId: realmRelationships.toId,
    })
    .from(realmRelationships)
    .where(
      and(
        eq(realmRelationships.ownerId, ownerId),
        or(
          eq(realmRelationships.fromId, locationEntityId),
          eq(realmRelationships.toId, locationEntityId),
        ),
      ),
    );

  const npcIds = new Set<string>();
  for (const rel of rels) {
    const other = rel.fromId === locationEntityId ? rel.toId : rel.fromId;
    if (worldIds.has(other)) npcIds.add(other);
  }
  if (npcIds.size === 0) return [];

  const rows = await getDb()
    .select({
      id: realmEntities.id,
      name: realmEntities.name,
      type: realmEntities.type,
      data: realmEntities.data,
    })
    .from(realmEntities)
    .where(
      and(
        eq(realmEntities.ownerId, ownerId),
        inArray(realmEntities.id, [...npcIds]),
        eq(realmEntities.type, "npc"),
      ),
    )
    .orderBy(asc(realmEntities.name));

  return rows.map(npcSpecFromRow);
}

/** NPCs + entity data for entering a World-tab location (Rung 4 Slice 3). */
export async function getCampaignLocationEnterExtras(
  campaignId: string,
  locationEntityId: string,
): Promise<{
  npcs: LocationNpcSpec[];
  entityData?: Record<string, unknown>;
}> {
  const [npcs, entityData] = await Promise.all([
    getCampaignNpcsAtLocation(campaignId, locationEntityId),
    getCampaignLocationEntityData(campaignId, locationEntityId),
  ]);
  return { npcs, entityData };
}

/** Entity data for a World-tab location (dungeon foes, hooks). */
export async function getCampaignLocationEntityData(
  campaignId: string,
  entityId: string,
): Promise<Record<string, unknown> | undefined> {
  const ownerId = await getCampaignOwnerId(campaignId);
  if (!ownerId) return undefined;
  const [row] = await getDb()
    .select({ data: realmEntities.data })
    .from(campaignWorldEntities)
    .innerJoin(
      realmEntities,
      eq(realmEntities.id, campaignWorldEntities.entityId),
    )
    .where(
      and(
        eq(campaignWorldEntities.campaignId, campaignId),
        eq(campaignWorldEntities.ownerId, ownerId),
        eq(campaignWorldEntities.entityId, entityId),
      ),
    )
    .limit(1);
  return (row?.data as Record<string, unknown> | undefined) ?? undefined;
}

/**
 * The first explorable World-tab location for a campaign's Live Play bootstrap
 * (Rung 4). Prefers tavern → settlement → building → shop → region → dungeon;
 * among ties, earliest `addedAt` wins. Returns `undefined` when the campaign
 * has no qualifying world members (caller should use `DEFAULT_STARTING_LOCATION`).
 */
export async function getCampaignStartingLocation(
  campaignId: string,
): Promise<CampaignStartingLocation | undefined> {
  const ownerId = await getCampaignOwnerId(campaignId);
  if (!ownerId) return undefined;

  const [campaign] = await getDb()
    .select({ startingSceneId: campaigns.startingSceneId })
    .from(campaigns)
    .where(
      and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, ownerId)),
    )
    .limit(1);

  const authoredEntityId = entityIdFromSceneId(
    campaign?.startingSceneId ?? undefined,
  );
  if (authoredEntityId && authoredEntityId !== "generic") {
    const authored = await getCampaignLocationByEntityId(
      campaignId,
      authoredEntityId,
    );
    if (authored) return authored;
  }

  const locations = await getCampaignExplorableLocations(campaignId);
  return locations[0];
}

/**
 * Mark campaign world entities discovered (Q11 auto-reveal). Idempotent for
 * already-discovered rows; returns the number of rows updated.
 */
export async function revealCampaignWorldEntities(
  campaignId: string,
  ownerId: string,
  entityIds: readonly string[],
): Promise<number> {
  if (entityIds.length === 0) return 0;
  const rows = await getDb()
    .update(campaignWorldEntities)
    .set({ discovered: true })
    .where(
      and(
        eq(campaignWorldEntities.campaignId, campaignId),
        eq(campaignWorldEntities.ownerId, ownerId),
        inArray(campaignWorldEntities.entityId, [...entityIds]),
        eq(campaignWorldEntities.discovered, false),
      ),
    )
    .returning({ id: campaignWorldEntities.id });
  return rows.length;
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

/** Demo poison vials for GRILL-LIVE-POISON Q8 prod verify (idempotent by name). */
export const POISON_DEMO_VIALS = [
  { name: "Assassin's Blood (vial)", quantity: 1 },
  { name: "Pale Tincture (vial)", quantity: 1 },
  { name: "Serpent Venom (vial)", quantity: 1 },
] as const;

export async function grantPoisonDemoLoot(campaignId: string): Promise<string[]> {
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
    const additions = POISON_DEMO_VIALS.filter((i) => !have.has(i.name));
    if (additions.length === 0) return [];

    const next: EquipmentItem[] = [
      ...current,
      ...additions.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        equipped: false,
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

/** Demo curse items for GRILL-LIVE-CURSE Q8 prod verify (idempotent by name). */
export const CURSE_DEMO_ITEMS = [
  { name: "Sight Rot (vial)", quantity: 1 },
  { name: "Demonic Possession (scroll)", quantity: 1 },
] as const;

/** Demo fear/stress item for GRILL-LIVE-FEAR Q8 prod verify (idempotent by name). */
export const FEAR_DEMO_ITEMS = [
  { name: "Hallucinogenic Substance (vial)", quantity: 1 },
] as const;

export async function grantCurseDemoLoot(campaignId: string): Promise<string[]> {
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
    const additions = CURSE_DEMO_ITEMS.filter((i) => !have.has(i.name));
    if (additions.length === 0) return [];

    const next: EquipmentItem[] = [
      ...current,
      ...additions.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        equipped: false,
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

export async function grantFearDemoLoot(campaignId: string): Promise<string[]> {
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
    const additions = FEAR_DEMO_ITEMS.filter((i) => !have.has(i.name));
    if (additions.length === 0) return [];

    const next: EquipmentItem[] = [
      ...current,
      ...additions.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        equipped: false,
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

/**
 * Whether a user may join a campaign's live room (CAMP-14): owner or a seated
 * player with `campaign_characters.player_user_id` set via invite redemption.
 */
export async function canAccessCampaign(
  campaignId: string,
  userId: string,
): Promise<boolean> {
  if (await isCampaignOwner(campaignId, userId)) return true;
  const [seat] = await getDb()
    .select({ id: campaignCharacters.id })
    .from(campaignCharacters)
    .where(
      and(
        eq(campaignCharacters.campaignId, campaignId),
        eq(campaignCharacters.playerUserId, userId),
        eq(campaignCharacters.status, "active"),
      ),
    )
    .limit(1);
  return Boolean(seat);
}

/** Tutorial finale reputation grant (REP-1). Idempotent upsert. */
export async function awardTutorialReputation(campaignId: string): Promise<void> {
  const db = getDb();
  const [campaign] = await db
    .select({ ownerId: campaigns.ownerId })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);
  if (!campaign) return;
  const subjectKey = "settlement:last-light-hollow";
  const [existing] = await db
    .select({ id: campaignReputation.id })
    .from(campaignReputation)
    .where(
      and(
        eq(campaignReputation.campaignId, campaignId),
        eq(campaignReputation.subjectKey, subjectKey),
      ),
    )
    .limit(1);
  if (existing) return;
  await db.insert(campaignReputation).values({
    campaignId,
    ownerId: campaign.ownerId,
    subjectKey,
    subjectName: "Last Light Hollow",
    standing: "honored",
    note: "The village is in your debt after relighting the beacon.",
  });
}

/** Campaign quest instances for Live Play trigger evaluation (Phase B/C). */
export async function loadCampaignQuestInstances(campaignId: string) {
  return getDb()
    .select({
      id: plotHooks.id,
      status: plotHooks.status,
      title: plotHooks.title,
      data: plotHooks.data,
    })
    .from(plotHooks)
    .where(eq(plotHooks.campaignId, campaignId));
}

/** Hard-gate context for quest offers (Phase D). */
export async function loadQuestPrerequisiteContext(
  campaignId: string,
): Promise<QuestPrerequisiteContext> {
  const pcs = await getDb()
    .select({ xp: characters.xp })
    .from(campaignCharacters)
    .innerJoin(characters, eq(characters.id, campaignCharacters.characterId))
    .where(
      and(
        eq(campaignCharacters.campaignId, campaignId),
        eq(campaignCharacters.role, "pc"),
        eq(campaignCharacters.status, "active"),
      ),
    );

  let partyMaxLevel = 1;
  for (const pc of pcs) {
    partyMaxLevel = Math.max(partyMaxLevel, levelForXp(pc.xp));
  }

  const resolvedRows = await getDb()
    .select({
      sourceTemplateId: plotHooks.sourceTemplateId,
      data: plotHooks.data,
    })
    .from(plotHooks)
    .where(
      and(
        eq(plotHooks.campaignId, campaignId),
        eq(plotHooks.status, "resolved"),
      ),
    );

  const resolvedSourceTemplateIds = new Set<string>();
  const resolvedSnapshotTemplateIds = new Set<string>();
  for (const row of resolvedRows) {
    if (row.sourceTemplateId) {
      resolvedSourceTemplateIds.add(row.sourceTemplateId);
    }
    const snap = parseQuestInstanceData(row.data).templateSnapshot;
    if (snap?.id) resolvedSnapshotTemplateIds.add(snap.id);
  }

  return {
    partyMaxLevel,
    resolvedSourceTemplateIds,
    resolvedSnapshotTemplateIds,
  };
}

/** Update quest instance jsonb (briefing dedupe, step progress). */
export async function updatePlotHookData(
  hookId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await getDb()
    .update(plotHooks)
    .set({ data, updatedAt: new Date() })
    .where(eq(plotHooks.id, hookId));
}
