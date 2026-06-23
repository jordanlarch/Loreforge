import { createHash } from "node:crypto";

/**
 * The minimal Realms-entity shape the memory tier needs to embed. A structural
 * subset of `realm_entities` (`@app/db`) so this package doesn't couple to the
 * full row type or the tRPC zod schemas.
 */
export type EmbeddableRealmEntity = {
  id: string;
  ownerId: string;
  type: string;
  name: string;
  summary: string;
  data: Record<string, unknown>;
  isStub: boolean;
};

/** A composed, ready-to-embed chunk with its skip-if-unchanged hash. */
export type EmbeddingChunk = {
  chunkText: string;
  contentHash: string;
};

/** SHA-256 hex of `text` — gates skip-if-unchanged on re-embed. */
export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Render a single `data` value into stable embedding text (recursively). */
function renderValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map(renderValue)
      .filter((s) => s.length > 0)
      .join("; ");
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .map((k) => renderValue(obj[k]))
      .filter((s) => s.length > 0)
      .join("; ");
  }
  return "";
}

/** Flatten the polymorphic `data` payload into stable `key: value` lines. */
function flattenData(data: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const key of Object.keys(data).sort()) {
    const rendered = renderValue(data[key]);
    if (rendered.length > 0) lines.push(`${key}: ${rendered}`);
  }
  return lines.join("\n");
}

/**
 * Compose the single "card" chunk text for a Realms entity:
 * `name (type)` + summary + a stable, sorted flattening of the string-ish
 * fields in `data`. Deterministic: the same entity always produces the same
 * text (so its `contentHash` is stable across runs).
 */
export function composeEntityChunkText(entity: EmbeddableRealmEntity): string {
  const parts: string[] = [`${entity.name} (${entity.type})`];
  const summary = entity.summary.trim();
  if (summary.length > 0) parts.push(summary);
  const flat = flattenData(entity.data);
  if (flat.length > 0) parts.push(flat);
  return parts.join("\n");
}

/**
 * Build the embeddable chunk for a Realms entity, or `null` if it should be
 * skipped. Stubs (cascade placeholders awaiting expansion) have no meaningful
 * content and are skipped — they're embedded once expanded.
 */
export function buildEntityEmbeddingInput(
  entity: EmbeddableRealmEntity,
): EmbeddingChunk | null {
  if (entity.isStub) return null;
  const chunkText = composeEntityChunkText(entity);
  return { chunkText, contentHash: contentHash(chunkText) };
}
