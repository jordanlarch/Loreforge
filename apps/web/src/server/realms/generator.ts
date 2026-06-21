/**
 * Realms generator orchestration core (Realms generator pipeline).
 *
 * Provider-agnostic, DB-aware glue between `@app/llm` and the Realms tables.
 * Reused by both the synchronous tRPC path (single entities — D3) and the
 * Trigger.dev cascade task (durable path). Keeps the deterministic boundary
 * (Q12): the model proposes structured `data` via the `emit_entity` tool, which
 * is validated against the same per-type zod the manual write path uses, and
 * re-validated through `parseData` before any insert.
 *
 * The LLM client is injectable so callers (and tests) can supply a fake; when
 * omitted, an Anthropic client is built from `ANTHROPIC_API_KEY` (env-gated).
 */
import { and, asc, eq, or } from "drizzle-orm";
import { z } from "zod";

import {
  codexClasses,
  codexSpecies,
  generationEvents,
  realmEntities,
  realmRelationships,
  type Database,
} from "@app/db";
import {
  createAnthropicClient,
  generateEntity,
  type GenerateEntityResult,
  type LlmClient,
  type LlmUsage,
} from "@app/llm";

import {
  REALM_ENTITY_TYPES,
  REALM_FIELDS,
  REALM_RELATIONSHIP_KINDS,
  REALM_TYPE_LABEL,
  REL_LABEL,
  REL_INVERSE_LABEL,
  emptyDataFor,
  isCascadeParent,
  type RealmEntityType,
} from "@/lib/realms";

import { dataSchemaFor, parseData } from "./schemas";

/* -------------------------------------------------------------------------- *
 *  Configuration / client
 * -------------------------------------------------------------------------- */

/** Whether AI generation is configured (ANTHROPIC_API_KEY present). */
export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export class GeneratorNotConfiguredError extends Error {
  constructor() {
    super("AI generation is not configured (ANTHROPIC_API_KEY missing).");
    this.name = "GeneratorNotConfiguredError";
  }
}

function resolveClient(injected?: LlmClient): LlmClient {
  if (injected) return injected;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new GeneratorNotConfiguredError();
  return createAnthropicClient({
    apiKey,
    defaultModel: process.env.ANTHROPIC_MODEL || undefined,
  });
}

/* -------------------------------------------------------------------------- *
 *  Schemas — the structured-output contract (D2)
 * -------------------------------------------------------------------------- */

const childStubSchema = z.object({
  type: z.enum(REALM_ENTITY_TYPES),
  name: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(500).default(""),
  relationshipKind: z.enum(REALM_RELATIONSHIP_KINDS).default("related_to"),
});

export type ChildStub = z.infer<typeof childStubSchema>;

export type GeneratedEnvelope = {
  name: string;
  summary: string;
  data: Record<string, unknown>;
  children?: ChildStub[];
};

/** Envelope schema (name + summary + type-specific data, optional children). */
function envelopeSchema(type: RealmEntityType, withChildren: boolean) {
  const base = z.object({
    name: z.string().trim().min(1).max(120),
    summary: z.string().trim().max(500).default(""),
    data: dataSchemaFor(type),
  });
  return withChildren
    ? base.extend({ children: z.array(childStubSchema).max(12).default([]) })
    : base;
}

/** Subset of a type's `data` schema for per-section regeneration (D7). */
function subsetDataSchema(type: RealmEntityType, fields?: string[]) {
  const full = dataSchemaFor(type);
  if (!fields || fields.length === 0) return full;
  const shape = full.shape;
  const picked: z.ZodRawShape = {};
  for (const field of fields) {
    const member = shape[field];
    if (member) picked[field] = member;
  }
  // If none of the requested fields exist, fall back to the full schema.
  return Object.keys(picked).length > 0 ? z.object(picked) : full;
}

/* -------------------------------------------------------------------------- *
 *  Grounding (D11)
 * -------------------------------------------------------------------------- */

export type Grounding = { species: string[]; classes: string[] };

/** Light, schema-driven grounding: SRD species/class names for NPCs. */
export async function loadGrounding(
  db: Database,
  type: RealmEntityType,
): Promise<Grounding> {
  if (type !== "npc") return { species: [], classes: [] };
  const [species, classes] = await Promise.all([
    db
      .select({ name: codexSpecies.name })
      .from(codexSpecies)
      .orderBy(asc(codexSpecies.name)),
    db
      .select({ name: codexClasses.name })
      .from(codexClasses)
      .orderBy(asc(codexClasses.name)),
  ]);
  return {
    species: species.map((s) => s.name),
    classes: classes.map((c) => c.name),
  };
}

/** Short human-readable descriptors of an entity's existing relationships. */
export async function loadParentContext(
  db: Database,
  ownerId: string,
  entityId: string,
): Promise<string[]> {
  const edges = await db
    .select()
    .from(realmRelationships)
    .where(
      and(
        eq(realmRelationships.ownerId, ownerId),
        or(
          eq(realmRelationships.fromId, entityId),
          eq(realmRelationships.toId, entityId),
        ),
      ),
    );
  if (edges.length === 0) return [];

  const otherIds = [
    ...new Set(
      edges.map((e) => (e.fromId === entityId ? e.toId : e.fromId)),
    ),
  ];
  const others = await db
    .select({
      id: realmEntities.id,
      name: realmEntities.name,
      type: realmEntities.type,
    })
    .from(realmEntities)
    .where(eq(realmEntities.ownerId, ownerId));
  const byId = new Map(others.map((o) => [o.id, o]));

  return edges.flatMap((edge) => {
    const outgoing = edge.fromId === entityId;
    const otherId = outgoing ? edge.toId : edge.fromId;
    const other = byId.get(otherId);
    if (!other || !otherIds.includes(otherId)) return [];
    const label = outgoing ? REL_LABEL[edge.kind] : REL_INVERSE_LABEL[edge.kind];
    return [`${label} ${other.name} (${REALM_TYPE_LABEL[other.type]})`];
  });
}

/* -------------------------------------------------------------------------- *
 *  Prompts
 * -------------------------------------------------------------------------- */

const SYSTEM_PROMPT = [
  "You are Loreforge's worldbuilding assistant for a Dungeons & Dragons 5E (SRD 5.2) app.",
  "You MUST respond by calling the emit_entity tool with data matching its schema exactly.",
  "The app's deterministic rules engine computes all derived values (ability modifiers, saving throws, proficiency bonus, AC math) — provide only the raw inputs the schema asks for and never pre-compute or narrate math.",
  "Prefer official SRD species, classes, and terminology. Keep names evocative and concise; summaries are a single vivid sentence.",
].join("\n");

function fieldGuidance(type: RealmEntityType): string {
  if (type === "npc") {
    return [
      "Provide these NPC fields:",
      "- species: an SRD species name",
      "- role: short occupation (e.g. Blacksmith, Captain of the Guard)",
      "- alignment: e.g. 'Neutral Good'",
      "- classes: array of { class, level } (level 1-20); empty for ordinary commoners",
      "- abilityScores: str/dex/con/int/wis/cha, each 1-30 (commoner ~10, heroic ~8-18)",
      "- maxHp (1-1000), baseAc (1-40), speed in feet (usually 30)",
      "- saveProficiencies: subset of [str, dex, con, int, wis, cha]",
      "- skillProficiencies: SRD skill names (e.g. Athletics, Insight)",
    ].join("\n");
  }
  const lines = REALM_FIELDS[type].map((f) => {
    if (f.kind === "select") {
      return `- ${f.key} (${f.label}): one of [${(f.options ?? []).join(", ")}]`;
    }
    if (f.kind === "number") {
      const bounds = [
        f.min != null ? `>= ${f.min}` : null,
        f.max != null ? `<= ${f.max}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      return `- ${f.key} (${f.label}): integer${bounds ? ` (${bounds})` : ""}`;
    }
    if (f.kind === "list") {
      return `- ${f.key} (${f.label}): array of short strings${f.placeholder ? ` — e.g. ${f.placeholder}` : ""}`;
    }
    if (f.kind === "group") {
      const subs = (f.fields ?? []).map((s) => s.key).join(", ");
      return `- ${f.key} (${f.label}): array of objects, each with { ${subs} }`;
    }
    return `- ${f.key} (${f.label})${f.placeholder ? ` — e.g. ${f.placeholder}` : ""}`;
  });
  return `Provide these ${REALM_TYPE_LABEL[type]} fields:\n${lines.join("\n")}`;
}

function groundingBlock(grounding: Grounding): string {
  const parts: string[] = [];
  if (grounding.species.length > 0) {
    parts.push(`Available SRD species: ${grounding.species.join(", ")}.`);
  }
  if (grounding.classes.length > 0) {
    parts.push(`Available SRD classes: ${grounding.classes.join(", ")}.`);
  }
  return parts.length > 0 ? `\n\n${parts.join("\n")}` : "";
}

/** Type-specific nudge for what the child stubs should be. */
const CHILD_HINTS: Partial<Record<RealmEntityType, string>> = {
  tavern:
    "For a Tavern these are NPCs (type 'npc'): the tavernkeeper plus 1-3 memorable regular patrons, each related to the tavern (relationshipKind 'related_to').",
  shop:
    "For a Shop these are NPCs (type 'npc'): the shopkeeper plus optionally 1-2 regular customers, suppliers, or apprentices, each related to the shop (relationshipKind 'related_to').",
  building:
    "For a Building these are NPCs (type 'npc'): the owner/caretaker plus 1-3 notable occupants, each related to the building (relationshipKind 'related_to').",
};

function childGuidance(type: RealmEntityType): string {
  const hint = CHILD_HINTS[type];
  return [
    "",
    `Also propose 2-5 child entities this ${REALM_TYPE_LABEL[type]} should contain as STUBS`,
    "(name + one-line summary + relationshipKind). Do NOT flesh them out — they are placeholders",
    "the user expands later. relationshipKind is from the parent's perspective",
    `(one of: ${REALM_RELATIONSHIP_KINDS.join(", ")}; e.g. a region 'located_in' a settlement means the settlement is in the region).`,
    hint ?? "",
  ]
    .filter(Boolean)
    .join("\n");
}

function kvLines(
  values: Record<string, string | number | undefined> | undefined,
): string[] {
  return values
    ? Object.entries(values)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `- ${k}: ${v}`)
    : [];
}

function buildNewPrompt(
  type: RealmEntityType,
  concept: string,
  hints: Record<string, string | number | undefined> | undefined,
  seed: Record<string, string | number> | undefined,
  grounding: Grounding,
  withChildren: boolean,
): string {
  const hintLines = kvLines(hints);
  const seedLines = kvLines(seed);
  return [
    `Create a new ${REALM_TYPE_LABEL[type]} for a fantasy world.`,
    `Concept: ${concept}`,
    hintLines.length > 0 ? `Hints:\n${hintLines.join("\n")}` : "",
    seedLines.length > 0
      ? `Use these exact field values where given (fill in the rest coherently):\n${seedLines.join("\n")}`
      : "",
    "",
    fieldGuidance(type),
    withChildren ? childGuidance(type) : "",
    groundingBlock(grounding),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildExpandPrompt(
  type: RealmEntityType,
  name: string,
  summary: string,
  parentContext: string[],
  grounding: Grounding,
): string {
  return [
    `Flesh out this existing ${REALM_TYPE_LABEL[type]} stub into a full entity.`,
    `Name: ${name}`,
    summary ? `Summary: ${summary}` : "",
    parentContext.length > 0 ? `Context: ${parentContext.join("; ")}.` : "",
    "Stay consistent with the name, summary, and context above.",
    "",
    fieldGuidance(type),
    groundingBlock(grounding),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildRegeneratePrompt(
  type: RealmEntityType,
  name: string,
  existingData: Record<string, unknown>,
  fields: string[] | undefined,
  grounding: Grounding,
): string {
  const scope =
    fields && fields.length > 0
      ? `Regenerate ONLY these fields: ${fields.join(", ")}. Keep everything else implied by the current values.`
      : "Produce a fresh take on the whole entity.";
  return [
    `Regenerate content for this ${REALM_TYPE_LABEL[type]} named "${name}".`,
    scope,
    `Current values (for coherence): ${JSON.stringify(existingData)}`,
    "Also provide an updated one-sentence summary.",
    "",
    fieldGuidance(type),
    groundingBlock(grounding),
  ]
    .filter(Boolean)
    .join("\n");
}

/* -------------------------------------------------------------------------- *
 *  Generation runs
 * -------------------------------------------------------------------------- */

export type GenerationOutput<T> = {
  data: T;
  usage: LlmUsage;
  model: string;
};

/** Generate a brand-new entity envelope (with child stubs if the type cascades). */
export async function generateNewEntity(args: {
  db: Database;
  type: RealmEntityType;
  concept: string;
  hints?: Record<string, string | number | undefined>;
  /** Preferred values for the type's own fields (from the Advanced Form). */
  seed?: Record<string, string | number>;
  client?: LlmClient;
}): Promise<GenerationOutput<GeneratedEnvelope>> {
  const client = resolveClient(args.client);
  const withChildren = isCascadeParent(args.type);
  const schema = envelopeSchema(args.type, withChildren);
  const grounding = await loadGrounding(args.db, args.type);
  const prompt = buildNewPrompt(
    args.type,
    args.concept,
    args.hints,
    args.seed,
    grounding,
    withChildren,
  );
  const result = (await generateEntity({
    client,
    schema,
    system: SYSTEM_PROMPT,
    prompt,
    toolName: `emit_${args.type}`,
    toolDescription: `Emit the generated ${REALM_TYPE_LABEL[args.type]}.`,
  })) as unknown as GenerateEntityResult<GeneratedEnvelope>;
  return { data: result.data, usage: result.usage, model: result.model };
}

/** Generate the `data` payload that expands a stub of the given type. */
export async function expandStubData(args: {
  db: Database;
  type: RealmEntityType;
  name: string;
  summary: string;
  parentContext: string[];
  client?: LlmClient;
}): Promise<GenerationOutput<Record<string, unknown>>> {
  const client = resolveClient(args.client);
  const grounding = await loadGrounding(args.db, args.type);
  const prompt = buildExpandPrompt(
    args.type,
    args.name,
    args.summary,
    args.parentContext,
    grounding,
  );
  const result = await generateEntity({
    client,
    schema: dataSchemaFor(args.type),
    system: SYSTEM_PROMPT,
    prompt,
    toolName: `emit_${args.type}`,
    toolDescription: `Emit the ${REALM_TYPE_LABEL[args.type]} details.`,
  });
  return {
    data: result.data as Record<string, unknown>,
    usage: result.usage,
    model: result.model,
  };
}

/** Generate a regeneration candidate (preview-only; the caller never persists). */
export async function regenerateEntityCandidate(args: {
  db: Database;
  type: RealmEntityType;
  name: string;
  existingData: Record<string, unknown>;
  fields?: string[];
  client?: LlmClient;
}): Promise<GenerationOutput<{ summary: string; data: Record<string, unknown> }>> {
  const client = resolveClient(args.client);
  const grounding = await loadGrounding(args.db, args.type);
  const schema = z.object({
    summary: z.string().trim().max(500).default(""),
    data: subsetDataSchema(args.type, args.fields),
  });
  const prompt = buildRegeneratePrompt(
    args.type,
    args.name,
    args.existingData,
    args.fields,
    grounding,
  );
  const result = await generateEntity({
    client,
    schema,
    system: SYSTEM_PROMPT,
    prompt,
    toolName: `emit_${args.type}`,
    toolDescription: `Emit regenerated ${REALM_TYPE_LABEL[args.type]} content.`,
  });
  return {
    data: {
      summary: result.data.summary ?? "",
      data: result.data.data as Record<string, unknown>,
    },
    usage: result.usage,
    model: result.model,
  };
}

/* -------------------------------------------------------------------------- *
 *  Persistence (deterministic — no LLM)
 * -------------------------------------------------------------------------- */

/**
 * Insert each emitted child as a STUB plus a typed relationship edge (D6). No
 * LLM call per child — stubs are cheap placeholders the user expands later.
 * Returns the number of children created.
 */
export async function persistChildren(
  db: Database,
  ownerId: string,
  parentId: string,
  children: ChildStub[],
): Promise<number> {
  let created = 0;
  for (const child of children) {
    const [row] = await db
      .insert(realmEntities)
      .values({
        ownerId,
        type: child.type,
        name: child.name,
        summary: child.summary,
        isStub: true,
        data: parseData(child.type, emptyDataFor(child.type)),
      })
      .returning({ id: realmEntities.id });
    if (!row) continue;
    created += 1;
    await db.insert(realmRelationships).values({
      ownerId,
      fromId: parentId,
      toId: row.id,
      kind: child.relationshipKind,
    });
  }
  return created;
}

export type GenerationMode = "new" | "expand" | "cascade" | "regenerate";

/** Record a generation run for cost observability (D8). Never throws. */
export async function logGeneration(
  db: Database,
  args: {
    ownerId: string;
    entityId: string | null;
    entityType: RealmEntityType;
    mode: GenerationMode;
    status: "success" | "error";
    model?: string;
    usage?: LlmUsage;
    errorMessage?: string;
  },
): Promise<void> {
  try {
    await db.insert(generationEvents).values({
      ownerId: args.ownerId,
      entityId: args.entityId,
      entityType: args.entityType,
      mode: args.mode,
      status: args.status,
      model: args.model ?? "",
      inputTokens: args.usage?.inputTokens ?? 0,
      outputTokens: args.usage?.outputTokens ?? 0,
      errorMessage: args.errorMessage ?? null,
    });
  } catch {
    // Audit logging must never break the user-facing request.
  }
}
