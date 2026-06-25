/**
 * Campaigns tRPC router — persistent, owner-scoped campaigns (issue #2).
 *
 * A campaign is the unit of play; its mechanical state is event-sourced in
 * `engine_events` and rebuilt by the deterministic engine. This router owns the
 * campaign entity (create / list / get); the `engine` router owns the
 * per-campaign command/state surface.
 */
import { and, asc, desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  campaignCharacters,
  campaignInvites,
  campaignNotes,
  campaignReputation,
  campaignWorldEntities,
  campaigns,
  characters,
  chatMessages,
  encounters,
  engineCommandLog,
  engineEvents,
  engineSeeds,
  engineSnapshots,
  getDb,
  plotHooks,
  realmEntities,
  realmRelationships,
  tutorialProgress,
} from "@app/db";
import { MONSTER_TEMPLATES } from "@app/engine";

import { edgesWithin } from "@/lib/campaign-world";
import {
  clearCampaignChatLog,
  resetCampaignLog,
} from "@/server/engine/runtime";
import {
  generateNewEntity,
  isConfigured as isGeneratorConfigured,
  logGeneration,
  persistChildren,
} from "@/server/realms/generator";
import { parseData } from "@/server/realms/schemas";

/** Max foe rows + total foes per authored encounter (map seat / sanity caps). */
const MAX_ENCOUNTER_FOE_ROWS = 8;
const MAX_ENCOUNTER_FOES = 8;

/** A single foe row: a known monster template × count, optional name override. */
const foeRowSchema = z.object({
  template: z
    .string()
    .refine((slug) => slug in MONSTER_TEMPLATES, "Unknown monster template."),
  count: z.number().int().min(1).max(MAX_ENCOUNTER_FOES),
  name: z.string().trim().max(60).optional(),
});

const mapPresetSchema = z.enum(["ambush", "arena", "corridor"]);

import { createTRPCRouter, protectedProcedure } from "../init";

/** Throw unless the campaign exists and belongs to the given user. */
export async function assertCampaignOwner(
  userId: string,
  campaignId: string,
): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, userId)))
    .limit(1);
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found." });
  }
}

/**
 * Forge one Realms entity (with its cascade children) from a concept and attach
 * the whole subtree to a campaign's World tab (#62 Quick Forge / Guided Setup).
 *
 * Reuses the same generator path the Realms surface uses: generate → validate →
 * insert parent → `persistChildren` (which also writes the linking edges). The
 * parent and every freshly-linked child are added to `campaign_world_entities`
 * as undiscovered (Q11). Returns the number of entities attached. Throws on
 * generation failure so the caller can log it; campaign creation itself is not
 * rolled back.
 */
async function forgeEntityIntoCampaign(
  db: ReturnType<typeof getDb>,
  ownerId: string,
  campaignId: string,
  type: "region" | "faction",
  concept: string,
): Promise<number> {
  const { data: envelope, usage, model } = await generateNewEntity({
    db,
    type,
    concept,
    ownerId,
  });
  const data = parseData(type, envelope.data);
  const [parent] = await db
    .insert(realmEntities)
    .values({
      ownerId,
      type,
      name: envelope.name,
      summary: envelope.summary,
      isStub: false,
      data,
    })
    .returning({ id: realmEntities.id });
  if (!parent) return 0;

  const childCount = envelope.children?.length
    ? await persistChildren(db, ownerId, parent.id, envelope.children)
    : 0;

  // Collect the children just linked under the parent so they join the world.
  const childRows = childCount
    ? await db
        .select({ id: realmRelationships.toId })
        .from(realmRelationships)
        .where(
          and(
            eq(realmRelationships.ownerId, ownerId),
            eq(realmRelationships.fromId, parent.id),
          ),
        )
    : [];

  const entityIds = [parent.id, ...childRows.map((r) => r.id)];
  await db
    .insert(campaignWorldEntities)
    .values(entityIds.map((entityId) => ({ campaignId, entityId, ownerId })))
    .onConflictDoNothing();

  await logGeneration(db, {
    ownerId,
    entityId: parent.id,
    entityType: type,
    mode: childCount > 0 ? "cascade" : "new",
    status: "success",
    model,
    usage,
  });
  return entityIds.length;
}

export const campaignsRouter = createTRPCRouter({
  /** Campaigns owned by the current user, newest first. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(campaigns)
      .where(eq(campaigns.ownerId, ctx.user.id))
      .orderBy(desc(campaigns.createdAt));
  }),

  /** Single owned campaign, or null if missing / not owned. */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(campaigns)
        .where(
          and(eq(campaigns.id, input.id), eq(campaigns.ownerId, ctx.user.id)),
        )
        .limit(1);
      return row ?? null;
    }),

  /** Create a campaign owned by the current user. */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(2000).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .insert(campaigns)
        .values({ ...input, ownerId: ctx.user.id })
        .returning();
      return row;
    }),

  /** Whether AI world-forging is available (drives the creation-modal UI). */
  forgeStatus: protectedProcedure.query(() => ({
    configured: isGeneratorConfigured(),
  })),

  /**
   * Create a campaign and (optionally) forge its starting world (#62 Quick
   * Forge + Guided Setup). The campaign is always created; each provided concept
   * triggers a Realms cascade attached to the World tab. Generation runs after
   * creation and never rolls it back — a forge failure still lands the user in a
   * (possibly empty) workspace, with `generated`/`forgeError` reporting back.
   */
  forge: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(2000).default(""),
        regionConcept: z.string().trim().min(1).max(2000).optional(),
        factionConcept: z.string().trim().min(1).max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [campaign] = await db
        .insert(campaigns)
        .values({
          name: input.name,
          description: input.description,
          ownerId: ctx.user.id,
        })
        .returning();
      if (!campaign) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create the campaign.",
        });
      }

      const concepts: { type: "region" | "faction"; concept: string }[] = [];
      if (input.regionConcept)
        concepts.push({ type: "region", concept: input.regionConcept });
      if (input.factionConcept)
        concepts.push({ type: "faction", concept: input.factionConcept });

      if (concepts.length === 0 || !isGeneratorConfigured()) {
        return {
          id: campaign.id,
          entityCount: 0,
          generated: false,
          forgeError: concepts.length > 0 ? "not-configured" : null,
        };
      }

      let entityCount = 0;
      try {
        for (const { type, concept } of concepts) {
          entityCount += await forgeEntityIntoCampaign(
            db,
            ctx.user.id,
            campaign.id,
            type,
            concept,
          );
        }
      } catch (err) {
        await logGeneration(db, {
          ownerId: ctx.user.id,
          entityId: null,
          entityType: "region",
          mode: "cascade",
          status: "error",
          errorMessage: err instanceof Error ? err.message : String(err),
        });
        return {
          id: campaign.id,
          entityCount,
          generated: entityCount > 0,
          forgeError: "generation-failed" as const,
        };
      }

      return {
        id: campaign.id,
        entityCount,
        generated: entityCount > 0,
        forgeError: null,
      };
    }),

  /**
   * Patch an owned campaign's editable fields (Overview inline edit #55, Settings
   * tab #117). Covers name/description plus the campaign-level settings:
   * GM persona, default play mode (Q19c), and art-style lock (Q16).
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(2000).optional(),
        gmPersona: z.string().trim().max(2000).optional(),
        playMode: z.enum(["async", "live"]).optional(),
        artStyle: z.string().trim().max(120).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...patch } = input;
      const [row] = await db
        .update(campaigns)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(campaigns.id, id), eq(campaigns.ownerId, ctx.user.id)))
        .returning();
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found.",
        });
      }
      return row;
    }),

  /**
   * Delete an owned campaign and its campaign-scoped data (Settings danger zone,
   * #117). No FKs in the schema, so dependents are removed explicitly: the
   * engine log/snapshots/command-log/seeds, durable chat, encounters, plot
   * hooks, notes, and the world/party *membership* rows. The user's characters and
   * Realms entities are authored independently and are deliberately left intact —
   * only their links to this campaign go.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.id);
      const db = getDb();
      const cid = input.id;
      const owner = ctx.user.id;
      // Engine tables are keyed by campaign only (no ownerId); safe now that
      // ownership is verified above.
      await db.delete(engineEvents).where(eq(engineEvents.campaignId, cid));
      await db.delete(engineSnapshots).where(eq(engineSnapshots.campaignId, cid));
      await db
        .delete(engineCommandLog)
        .where(eq(engineCommandLog.campaignId, cid));
      await db.delete(engineSeeds).where(eq(engineSeeds.campaignId, cid));
      await db.delete(chatMessages).where(eq(chatMessages.campaignId, cid));
      await db
        .delete(encounters)
        .where(and(eq(encounters.campaignId, cid), eq(encounters.ownerId, owner)));
      await db
        .delete(plotHooks)
        .where(and(eq(plotHooks.campaignId, cid), eq(plotHooks.ownerId, owner)));
      await db
        .delete(campaignNotes)
        .where(
          and(
            eq(campaignNotes.campaignId, cid),
            eq(campaignNotes.ownerId, owner),
          ),
        );
      await db
        .delete(campaignWorldEntities)
        .where(
          and(
            eq(campaignWorldEntities.campaignId, cid),
            eq(campaignWorldEntities.ownerId, owner),
          ),
        );
      await db
        .delete(campaignCharacters)
        .where(
          and(
            eq(campaignCharacters.campaignId, cid),
            eq(campaignCharacters.ownerId, owner),
          ),
        );
      await db
        .update(tutorialProgress)
        .set({ campaignId: null, updatedAt: new Date() })
        .where(eq(tutorialProgress.campaignId, cid));
      await db
        .delete(campaigns)
        .where(and(eq(campaigns.id, cid), eq(campaigns.ownerId, owner)));
      return { ok: true };
    }),

  /**
   * The party roster for an owned campaign (#55 Overview widget, #61 Party tab):
   * membership rows joined with each character's core sheet inputs so the client
   * can derive the card stats through `@app/engine` (no math in the app layer).
   */
  party: protectedProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      return db
        .select({
          membershipId: campaignCharacters.id,
          role: campaignCharacters.role,
          status: campaignCharacters.status,
          joinedAt: campaignCharacters.joinedAt,
          id: characters.id,
          name: characters.name,
          species: characters.species,
          background: characters.background,
          classes: characters.classes,
          abilityScores: characters.abilityScores,
          maxHp: characters.maxHp,
          baseAc: characters.baseAc,
          speed: characters.speed,
          saveProficiencies: characters.saveProficiencies,
          skillProficiencies: characters.skillProficiencies,
          portraitUrl: characters.portraitUrl,
          libraryVisibility: characters.libraryVisibility,
        })
        .from(campaignCharacters)
        .innerJoin(
          characters,
          eq(characters.id, campaignCharacters.characterId),
        )
        .where(
          and(
            eq(campaignCharacters.campaignId, input.campaignId),
            eq(campaignCharacters.ownerId, ctx.user.id),
          ),
        )
        .orderBy(asc(campaignCharacters.joinedAt));
    }),

  /**
   * Per-character combat loadouts for the live encounter (#98). Returns the
   * `equipment` + `spells` of the campaign's active PCs/companions keyed by
   * character id — the same ids the WS server seeds as live combatants — so the
   * play surface can drive the HUD + action bar from real weapons and spells
   * instead of a generic Strike + curated cast list. Owner-scoped.
   */
  partyLoadout: protectedProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      return db
        .select({
          id: characters.id,
          equipment: characters.equipment,
          spells: characters.spells,
        })
        .from(campaignCharacters)
        .innerJoin(
          characters,
          eq(characters.id, campaignCharacters.characterId),
        )
        .where(
          and(
            eq(campaignCharacters.campaignId, input.campaignId),
            eq(campaignCharacters.ownerId, ctx.user.id),
          ),
        );
    }),

  /* ----------------------------------------------------------------------- *
   *  World tab — campaign-scoped Realms entities + discovery (#60, Q11)
   * ----------------------------------------------------------------------- */

  /** The Realms entities added to a campaign, with per-campaign discovery. */
  world: protectedProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      return db
        .select({
          membershipId: campaignWorldEntities.id,
          discovered: campaignWorldEntities.discovered,
          addedAt: campaignWorldEntities.addedAt,
          id: realmEntities.id,
          name: realmEntities.name,
          type: realmEntities.type,
          summary: realmEntities.summary,
          isStub: realmEntities.isStub,
        })
        .from(campaignWorldEntities)
        .innerJoin(
          realmEntities,
          eq(realmEntities.id, campaignWorldEntities.entityId),
        )
        .where(
          and(
            eq(campaignWorldEntities.campaignId, input.campaignId),
            eq(campaignWorldEntities.ownerId, ctx.user.id),
          ),
        )
        .orderBy(asc(realmEntities.name));
    }),

  /**
   * The campaign's world as a node-link graph: the added entities plus only the
   * relationships *within* that set (filtered through the shared `edgesWithin`).
   */
  worldGraph: protectedProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      const nodes = await db
        .select({
          id: realmEntities.id,
          name: realmEntities.name,
          type: realmEntities.type,
          isStub: realmEntities.isStub,
          discovered: campaignWorldEntities.discovered,
        })
        .from(campaignWorldEntities)
        .innerJoin(
          realmEntities,
          eq(realmEntities.id, campaignWorldEntities.entityId),
        )
        .where(
          and(
            eq(campaignWorldEntities.campaignId, input.campaignId),
            eq(campaignWorldEntities.ownerId, ctx.user.id),
          ),
        );
      const allEdges = await db
        .select({
          id: realmRelationships.id,
          fromId: realmRelationships.fromId,
          toId: realmRelationships.toId,
          kind: realmRelationships.kind,
        })
        .from(realmRelationships)
        .where(eq(realmRelationships.ownerId, ctx.user.id));
      const edges = edgesWithin(allEdges, new Set(nodes.map((n) => n.id)));
      return { nodes, edges };
    }),

  /** Add an owned Realms entity to an owned campaign (idempotent on the pair). */
  addWorldEntity: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        entityId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      const [entity] = await db
        .select({ id: realmEntities.id })
        .from(realmEntities)
        .where(
          and(
            eq(realmEntities.id, input.entityId),
            eq(realmEntities.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      if (!entity) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entity not found." });
      }
      const [row] = await db
        .insert(campaignWorldEntities)
        .values({
          campaignId: input.campaignId,
          entityId: input.entityId,
          ownerId: ctx.user.id,
        })
        .onConflictDoNothing()
        .returning();
      return row ?? null;
    }),

  /** Remove a Realms entity from a campaign (owner-scoped, idempotent). */
  removeWorldEntity: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        entityId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .delete(campaignWorldEntities)
        .where(
          and(
            eq(campaignWorldEntities.campaignId, input.campaignId),
            eq(campaignWorldEntities.entityId, input.entityId),
            eq(campaignWorldEntities.ownerId, ctx.user.id),
          ),
        );
      return { ok: true };
    }),

  /** Set a campaign world entity's discovered state (manual DM reveal/hide). */
  setWorldEntityDiscovered: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        entityId: z.string().uuid(),
        discovered: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .update(campaignWorldEntities)
        .set({ discovered: input.discovered })
        .where(
          and(
            eq(campaignWorldEntities.campaignId, input.campaignId),
            eq(campaignWorldEntities.entityId, input.entityId),
            eq(campaignWorldEntities.ownerId, ctx.user.id),
          ),
        )
        .returning();
      return row ?? null;
    }),

  /**
   * Auto-reveal seam (#60): mark an entity discovered when AI narration
   * references it during play. Idempotent and safe to call repeatedly; the live
   * narration pipeline will invoke this once it lands. Kept as a first-class
   * mutation now so the contract is stable.
   */
  revealWorldEntity: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        entityId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db
        .update(campaignWorldEntities)
        .set({ discovered: true })
        .where(
          and(
            eq(campaignWorldEntities.campaignId, input.campaignId),
            eq(campaignWorldEntities.entityId, input.entityId),
            eq(campaignWorldEntities.ownerId, ctx.user.id),
          ),
        )
        .returning();
      return row ?? null;
    }),

  /* ----------------------------------------------------------------------- *
   *  Combat tab — authored encounters + Run Now → Live (#115, CAMP-8)
   * ----------------------------------------------------------------------- */

  /** The authored encounters for a campaign, with the armed one flagged. */
  encounters: protectedProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      const [campaign] = await db
        .select({ activeEncounterId: campaigns.activeEncounterId })
        .from(campaigns)
        .where(eq(campaigns.id, input.campaignId))
        .limit(1);
      const rows = await db
        .select()
        .from(encounters)
        .where(
          and(
            eq(encounters.campaignId, input.campaignId),
            eq(encounters.ownerId, ctx.user.id),
          ),
        )
        .orderBy(desc(encounters.createdAt));
      return rows.map((row) => ({
        ...row,
        active: row.id === campaign?.activeEncounterId,
      }));
    }),

  /** Create an authored encounter (name + foe roster) for a campaign. */
  createEncounter: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        foes: z.array(foeRowSchema).min(1).max(MAX_ENCOUNTER_FOE_ROWS),
        mapPreset: mapPresetSchema.default("ambush"),
        sourceEntityId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      const [row] = await db
        .insert(encounters)
        .values({
          campaignId: input.campaignId,
          ownerId: ctx.user.id,
          name: input.name,
          foes: input.foes,
          mapPreset: input.mapPreset,
          sourceEntityId: input.sourceEntityId ?? null,
        })
        .returning();
      return row;
    }),

  /** Delete an authored encounter; clears the armed pointer if it was active. */
  deleteEncounter: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        encounterId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      await db
        .delete(encounters)
        .where(
          and(
            eq(encounters.id, input.encounterId),
            eq(encounters.campaignId, input.campaignId),
            eq(encounters.ownerId, ctx.user.id),
          ),
        );
      await db
        .update(campaigns)
        .set({ activeEncounterId: null })
        .where(
          and(
            eq(campaigns.id, input.campaignId),
            eq(campaigns.ownerId, ctx.user.id),
            eq(campaigns.activeEncounterId, input.encounterId),
          ),
        );
      return { ok: true };
    }),

  /**
   * Arm an authored encounter for Live Play (Run Now): point the campaign at it
   * and wipe the engine log so the live room re-seeds with these foes on its
   * next load. Destructive — discards the current fight's state, which is the
   * intent of starting a new encounter.
   */
  runEncounter: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        encounterId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const db = getDb();
      const [encounter] = await db
        .select({ id: encounters.id })
        .from(encounters)
        .where(
          and(
            eq(encounters.id, input.encounterId),
            eq(encounters.campaignId, input.campaignId),
            eq(encounters.ownerId, ctx.user.id),
          ),
        )
        .limit(1);
      if (!encounter) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Encounter not found.",
        });
      }
      await db
        .update(campaigns)
        .set({ activeEncounterId: input.encounterId, updatedAt: new Date() })
        .where(
          and(
            eq(campaigns.id, input.campaignId),
            eq(campaigns.ownerId, ctx.user.id),
          ),
        );
      await resetCampaignLog(input.campaignId);
      await clearCampaignChatLog(input.campaignId);
      return { ok: true };
    }),

  /** Mint a shareable invite link for a player seat (CAMP-14). */
  createInvite: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().uuid(),
        characterId: z.string().uuid().optional(),
        label: z.string().trim().min(1).max(40).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      const token = randomBytes(18).toString("base64url");
      const db = getDb();
      const [row] = await db
        .insert(campaignInvites)
        .values({
          campaignId: input.campaignId,
          ownerId: ctx.user.id,
          token,
          characterId: input.characterId ?? null,
          label: input.label ?? "Player",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
        .returning({ token: campaignInvites.token });
      return { token: row!.token };
    }),

  /** List active invite links for a campaign (owner). */
  listInvites: protectedProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      return getDb()
        .select({
          id: campaignInvites.id,
          token: campaignInvites.token,
          label: campaignInvites.label,
          characterId: campaignInvites.characterId,
          redeemedByUserId: campaignInvites.redeemedByUserId,
          redeemedAt: campaignInvites.redeemedAt,
          expiresAt: campaignInvites.expiresAt,
          createdAt: campaignInvites.createdAt,
        })
        .from(campaignInvites)
        .where(eq(campaignInvites.campaignId, input.campaignId))
        .orderBy(desc(campaignInvites.createdAt));
    }),

  /** Revoke an unredeemed invite (owner). */
  revokeInvite: protectedProcedure
    .input(z.object({ campaignId: z.string().uuid(), inviteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      await getDb()
        .delete(campaignInvites)
        .where(
          and(
            eq(campaignInvites.id, input.inviteId),
            eq(campaignInvites.campaignId, input.campaignId),
            eq(campaignInvites.ownerId, ctx.user.id),
          ),
        );
      return { ok: true };
    }),

  /** Preview an invite (any logged-in user). */
  getInvite: protectedProcedure
    .input(z.object({ token: z.string().min(8) }))
    .query(async ({ input }) => {
      const [invite] = await getDb()
        .select({
          token: campaignInvites.token,
          campaignId: campaignInvites.campaignId,
          label: campaignInvites.label,
          characterId: campaignInvites.characterId,
          redeemedByUserId: campaignInvites.redeemedByUserId,
          expiresAt: campaignInvites.expiresAt,
        })
        .from(campaignInvites)
        .where(eq(campaignInvites.token, input.token))
        .limit(1);
      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found." });
      }
      const [campaign] = await getDb()
        .select({ name: campaigns.name })
        .from(campaigns)
        .where(eq(campaigns.id, invite.campaignId))
        .limit(1);
      return { ...invite, campaignName: campaign?.name ?? "Campaign" };
    }),

  /** Redeem an invite and bind the caller to a party seat (CAMP-14). */
  redeemInvite: protectedProcedure
    .input(z.object({ token: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [invite] = await db
        .select()
        .from(campaignInvites)
        .where(eq(campaignInvites.token, input.token))
        .limit(1);
      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found." });
      }
      if (invite.redeemedByUserId) {
        throw new TRPCError({ code: "CONFLICT", message: "Invite already used." });
      }
      if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite expired." });
      }
      if (invite.characterId) {
        await db
          .update(campaignCharacters)
          .set({ playerUserId: ctx.user.id })
          .where(
            and(
              eq(campaignCharacters.campaignId, invite.campaignId),
              eq(campaignCharacters.characterId, invite.characterId),
            ),
          );
      }
      await db
        .update(campaignInvites)
        .set({
          redeemedByUserId: ctx.user.id,
          redeemedAt: new Date(),
        })
        .where(eq(campaignInvites.id, invite.id));
      return { campaignId: invite.campaignId };
    }),

  /** List reputation standings for a campaign (REP-1). */
  reputation: protectedProcedure
    .input(z.object({ campaignId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertCampaignOwner(ctx.user.id, input.campaignId);
      return getDb()
        .select({
          subjectKey: campaignReputation.subjectKey,
          subjectName: campaignReputation.subjectName,
          standing: campaignReputation.standing,
          note: campaignReputation.note,
          updatedAt: campaignReputation.updatedAt,
        })
        .from(campaignReputation)
        .where(eq(campaignReputation.campaignId, input.campaignId))
        .orderBy(asc(campaignReputation.subjectName));
    }),
});
