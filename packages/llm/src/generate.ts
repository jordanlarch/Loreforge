import type { ZodType } from "zod";

import type { LlmClient, LlmMessage, LlmUsage } from "./client";
import { buildEmitEntityTool } from "./tool";

/** Raised when output still fails schema validation after all retries. */
export class LlmGenerationError extends Error {
  readonly attempts: number;
  constructor(message: string, attempts: number) {
    super(message);
    this.name = "LlmGenerationError";
    this.attempts = attempts;
  }
}

export type GenerateEntityArgs<T> = {
  client: LlmClient;
  /** The zod schema both constraining the tool and validating its output. */
  schema: ZodType<T>;
  system: string;
  prompt: string;
  toolName?: string;
  toolDescription?: string;
  model?: string;
  maxTokens?: number;
  /** Extra attempts after the first; each re-prompts with the zod error. */
  maxRetries?: number;
};

export type GenerateEntityResult<T> = {
  data: T;
  usage: LlmUsage;
  model: string;
  attempts: number;
};

/**
 * The provider-agnostic generation core (D2/D9). Forces a single `emit_entity`
 * tool call, validates the returned arguments against `schema`, and on failure
 * re-prompts with the validation error up to `maxRetries` more times. Never
 * touches the database — it returns a parsed candidate; the caller persists.
 *
 * Works identically for whole-entity and field-subset (per-section) generation
 * (D7): the caller simply passes a narrower `schema`.
 */
export async function generateEntity<T>(
  args: GenerateEntityArgs<T>,
): Promise<GenerateEntityResult<T>> {
  const tool = buildEmitEntityTool(args.schema, {
    name: args.toolName,
    description: args.toolDescription,
  });
  const maxRetries = args.maxRetries ?? 2;
  const messages: LlmMessage[] = [{ role: "user", content: args.prompt }];

  let lastError = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let model = args.model ?? "";

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const res = await args.client.callTool({
      system: args.system,
      messages,
      tool,
      model: args.model,
      maxTokens: args.maxTokens,
    });
    inputTokens += res.usage.inputTokens;
    outputTokens += res.usage.outputTokens;
    model = res.model;

    const parsed = args.schema.safeParse(res.input);
    if (parsed.success) {
      return {
        data: parsed.data,
        usage: { inputTokens, outputTokens },
        model,
        attempts: attempt,
      };
    }

    lastError = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");

    // Re-prompt with the failure so the model can self-correct.
    messages.push({
      role: "assistant",
      content: JSON.stringify(res.input),
    });
    messages.push({
      role: "user",
      content:
        `Your previous output failed validation: ${lastError}. ` +
        `Call the ${tool.name} tool again with corrected values that satisfy the schema exactly.`,
    });
  }

  throw new LlmGenerationError(
    `Generation failed schema validation after ${maxRetries + 1} attempt(s): ${lastError}`,
    maxRetries + 1,
  );
}
