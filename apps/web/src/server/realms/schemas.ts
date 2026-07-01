/**
 * Per-type `data` validation for Realms entities — the single source of truth
 * shared by the tRPC write paths (`realms.create`/`update`) and the AI
 * generator pipeline (`@app/llm` tool schemas are derived from these, then the
 * generated output is re-validated through `parseData` before insert — D2).
 *
 * NPC is mechanical (mirrors the character primitives); the other seven are
 * descriptive and derive their schema from the shared `REALM_FIELDS`
 * descriptors so the form, detail view, validator, and generator all agree.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { enrichEntityDataWithQuests, enrichDungeonEntityData } from "@app/engine";

import {
  REALM_FIELDS,
  type RealmEntityType,
  type RealmFieldDescriptor,
  type RealmSubFieldDescriptor,
} from "@/lib/realms";

export const ABILITY = z.enum(["str", "dex", "con", "int", "wis", "cha"]);

const abilityScores = z.object({
  str: z.number().int().min(1).max(30),
  dex: z.number().int().min(1).max(30),
  con: z.number().int().min(1).max(30),
  int: z.number().int().min(1).max(30),
  wis: z.number().int().min(1).max(30),
  cha: z.number().int().min(1).max(30),
});

const classLevel = z.object({
  class: z.string().trim().min(1).max(60),
  level: z.number().int().min(1).max(20),
  subclass: z.string().trim().max(60).optional(),
});

/** Per-type payload for an NPC, validated before it lands in `data`. */
export const npcData = z.object({
  species: z.string().trim().max(80).default(""),
  role: z.string().trim().max(80).default(""),
  alignment: z.string().trim().max(40).default(""),
  classes: z.array(classLevel).max(10).default([]),
  abilityScores,
  maxHp: z.number().int().min(1).max(1000),
  baseAc: z.number().int().min(1).max(40),
  speed: z.number().int().min(0).max(200).default(30),
  saveProficiencies: z.array(ABILITY).max(6).default([]),
  skillProficiencies: z.array(z.string().trim().max(40)).max(30).default([]),
});

/** zod for a single scalar field/sub-field (text/textarea/number/select). */
function scalarSchema(
  field: RealmFieldDescriptor | RealmSubFieldDescriptor,
): z.ZodTypeAny {
  if (field.kind === "number") {
    return z
      .number()
      .int()
      .min(field.min ?? 0)
      .max(field.max ?? 100_000_000)
      .default(field.min ?? 0);
  }
  if (field.kind === "select") {
    const options = (field.options ?? [""]) as [string, ...string[]];
    return z.enum(options).default(options[0]);
  }
  return z
    .string()
    .trim()
    .max(field.max ?? (field.kind === "textarea" ? 4000 : 200))
    .default("");
}

/** Derive a zod `data` schema from a descriptive type's field descriptors. */
function buildFieldsSchema(fields: readonly RealmFieldDescriptor[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    if (field.kind === "list") {
      shape[field.key] = z
        .array(z.string().trim().max(field.max ?? 500))
        .max(100)
        .default([]);
    } else if (field.kind === "group") {
      const itemShape: Record<string, z.ZodTypeAny> = {};
      for (const sub of field.fields ?? []) {
        itemShape[sub.key] = scalarSchema(sub);
      }
      shape[field.key] = z
        .array(z.object(itemShape))
        .max(100)
        .default([]);
    } else {
      shape[field.key] = scalarSchema(field);
    }
  }
  return z.object(shape).extend({
    /** Structured quest templates (Phase B); coexists with legacy `hooks` strings. */
    quests: z.array(z.record(z.string(), z.unknown())).max(50).optional(),
  });
}

function typeHasHooks(type: RealmEntityType): boolean {
  return type !== "npc" && REALM_FIELDS[type].some((f) => f.key === "hooks");
}

/** The `data` zod schema for a given type (NPC mechanical, others descriptive). */
export function dataSchemaFor(
  type: RealmEntityType,
): z.ZodObject<z.ZodRawShape> {
  if (type === "npc") return npcData;
  const base = buildFieldsSchema(REALM_FIELDS[type]);
  if (type === "dungeon") {
    return base.extend({
      /** Authored floor layout (DUN-7); emitted from rooms when absent. */
      floors: z.array(z.record(z.string(), z.unknown())).max(20).optional(),
    });
  }
  return base;
}

/**
 * Validate a raw `data` payload against its type's schema, returning the parsed
 * (defaulted) object or throwing BAD_REQUEST with the first issue. Keeps the
 * per-type validation precise without a brittle dynamic discriminated union.
 */
export function parseData(
  type: RealmEntityType,
  raw: unknown,
  entityId?: string,
): Record<string, unknown> {
  const result = dataSchemaFor(type).safeParse(raw ?? {});
  if (!result.success) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: result.error.issues[0]?.message ?? "Invalid entity data.",
    });
  }
  let data = result.data as Record<string, unknown>;
  if (typeHasHooks(type)) {
    data = enrichEntityDataWithQuests(data, entityId) as Record<string, unknown>;
  }
  if (type === "dungeon") {
    data = enrichDungeonEntityData(data);
  }
  return data;
}
