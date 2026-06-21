import type { ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import type { EmitToolDefinition, JsonObjectSchema } from "./client";

export const EMIT_ENTITY_TOOL_NAME = "emit_entity";

/**
 * Build the single forced tool from a zod schema — the structured-output
 * contract (D2). The tool's `input_schema` is DERIVED from the same zod the
 * server later re-validates against, so there is one source of truth for the
 * shape and the model is constrained to it.
 */
export function buildEmitEntityTool(
  schema: ZodType,
  options?: { name?: string; description?: string },
): EmitToolDefinition {
  const json = zodToJsonSchema(schema, {
    $refStrategy: "none",
    target: "jsonSchema7",
  }) as Record<string, unknown>;

  // Anthropic requires a top-level object schema; force the discriminant so the
  // literal type is satisfied regardless of what the converter emitted.
  const inputSchema: JsonObjectSchema = {
    ...json,
    type: "object",
  };

  return {
    name: options?.name ?? EMIT_ENTITY_TOOL_NAME,
    description:
      options?.description ??
      "Emit the generated entity as structured data matching the schema.",
    inputSchema,
  };
}
