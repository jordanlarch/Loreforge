/**
 * Engine tRPC router — exposes the deterministic engine's Command API and read
 * models over typed RPC. This is the same Command surface the AI Orchestrator
 * will use for LLM tool calls (`docs/engine/architecture.md` §4): UI and AI go
 * through one gate with equal validation.
 *
 * `simulate` runs an ordered command batch through a fresh in-memory engine and
 * returns each result plus the final world state — a deterministic, validated
 * exercise of the Command API. Postgres-backed, per-campaign persistence
 * (engine_events) lands in P2 alongside campaigns + combat.
 */
import { z } from "zod";

import {
  Engine,
  buildFixtureCampaign,
  type Command,
  type CommandResult,
  type WorldState,
} from "@app/engine";

import { createTRPCRouter, protectedProcedure } from "../init";

const abilityScores = z.object({
  str: z.number().int(),
  dex: z.number().int(),
  con: z.number().int(),
  int: z.number().int(),
  wis: z.number().int(),
  cha: z.number().int(),
});

const gridPosition = z.object({ x: z.number(), y: z.number() });

const damageSource = z.union([
  z.object({ amount: z.number() }),
  z.object({ notation: z.string() }),
]);

const rollMode = z.enum(["normal", "advantage", "disadvantage"]);

const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_scene"),
    scene: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
    }),
  }),
  z.object({ type: z.literal("change_scene"), sceneId: z.string() }),
  z.object({
    type: z.literal("create_entity"),
    entity: z.object({
      id: z.string(),
      kind: z.enum(["character", "npc", "monster"]),
      name: z.string(),
      abilityScores,
      maxHp: z.number().int(),
      baseAc: z.number().int(),
      speed: z.number().int().optional(),
      classes: z
        .array(
          z.object({
            class: z.string(),
            level: z.number().int(),
            subclass: z.string().optional(),
          }),
        )
        .optional(),
      sceneId: z.string().optional(),
      position: gridPosition.optional(),
    }),
  }),
  z.object({
    type: z.literal("roll_dice"),
    notation: z.string(),
    mode: rollMode.optional(),
    scope: z.string().optional(),
  }),
  z.object({
    type: z.literal("apply_damage"),
    target: z.string(),
    damageType: z.string(),
    source: damageSource,
    scope: z.string().optional(),
  }),
  z.object({
    type: z.literal("apply_healing"),
    target: z.string(),
    source: damageSource,
    scope: z.string().optional(),
  }),
  z.object({
    type: z.literal("move_entity"),
    entity: z.string(),
    to: gridPosition,
  }),
]);

export const engineRouter = createTRPCRouter({
  /** Read-only fixture campaign world state, built via the real command path. */
  fixtureState: protectedProcedure.query((): WorldState => {
    return buildFixtureCampaign().state;
  }),

  /** Run an ordered command batch deterministically; return results + state. */
  simulate: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().default("sandbox"),
        commands: z.array(commandSchema).max(200),
      }),
    )
    .mutation(({ input }) => {
      const engine = new Engine({ now: () => 0 });
      const results: CommandResult[] = input.commands.map((command) =>
        engine.execute(input.campaignId, command as Command),
      );
      return {
        results,
        state: engine.getState(input.campaignId),
      };
    }),
});
