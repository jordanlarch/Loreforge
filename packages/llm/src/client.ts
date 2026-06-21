import Anthropic from "@anthropic-ai/sdk";

/**
 * Default model snapshot (see `docs/data-sources.md` §5 — the operational
 * registry lives here in code, not in the doc). Override per-call via
 * `ToolCallRequest.model` or per-client via `createAnthropicClient`.
 */
export const DEFAULT_MODEL = "claude-sonnet-4-5" as const;

/** A JSON-Schema object describing a tool's input shape. */
export type JsonObjectSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

/** A single forced tool the model must call to return structured output. */
export type EmitToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonObjectSchema;
};

export type LlmMessage = { role: "user" | "assistant"; content: string };

export type ToolCallRequest = {
  system: string;
  messages: LlmMessage[];
  tool: EmitToolDefinition;
  model?: string;
  maxTokens?: number;
};

export type LlmUsage = { inputTokens: number; outputTokens: number };

export type ToolCallResult = {
  /** Raw arguments object from the forced tool call (not yet validated). */
  input: unknown;
  usage: LlmUsage;
  model: string;
};

/**
 * Provider-agnostic seam. The orchestrator depends only on this interface, so
 * tests inject a fake (see `createFakeLlmClient`) and a future OpenAI fallback
 * drops in without touching `generateEntity` or any caller.
 */
export interface LlmClient {
  callTool(req: ToolCallRequest): Promise<ToolCallResult>;
}

/** Raised for transport / protocol failures (not schema-validation failures). */
export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}

export type AnthropicClientOptions = {
  apiKey: string;
  defaultModel?: string;
  defaultMaxTokens?: number;
};

/** The Anthropic-backed {@link LlmClient}. Server-only (holds the API key). */
export function createAnthropicClient(
  options: AnthropicClientOptions,
): LlmClient {
  const anthropic = new Anthropic({ apiKey: options.apiKey });
  const defaultModel = options.defaultModel ?? DEFAULT_MODEL;
  const defaultMaxTokens = options.defaultMaxTokens ?? 4096;

  return {
    async callTool(req: ToolCallRequest): Promise<ToolCallResult> {
      const model = req.model ?? defaultModel;
      const res = await anthropic.messages.create({
        model,
        max_tokens: req.maxTokens ?? defaultMaxTokens,
        system: req.system,
        tools: [
          {
            name: req.tool.name,
            description: req.tool.description,
            input_schema: req.tool.inputSchema as Anthropic.Tool.InputSchema,
          },
        ],
        tool_choice: { type: "tool", name: req.tool.name },
        messages: req.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const toolUse = res.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );
      if (!toolUse) {
        throw new LlmError("Model returned no tool call.");
      }

      return {
        input: toolUse.input,
        usage: {
          inputTokens: res.usage.input_tokens,
          outputTokens: res.usage.output_tokens,
        },
        model,
      };
    },
  };
}
