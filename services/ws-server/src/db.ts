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
} from "@app/db";
import {
  totalLevel,
  type Ability,
  type EventStore,
  type PartyMember,
} from "@app/engine";

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
