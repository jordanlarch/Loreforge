/**
 * @app/llm — provider-agnostic LLM generation layer.
 *
 * The structured-output contract for the Realms generator pipeline: a single
 * forced `emit_entity` tool whose schema is derived from the caller's zod, with
 * validate-and-retry. Server-only (the Anthropic client holds the API key).
 *
 * @see docs/00-consolidated-plan.md (Q12 deterministic boundary)
 * @see docs/data-sources.md §5
 */
export {
  DEFAULT_MODEL,
  LlmError,
  createAnthropicClient,
  type AnthropicClientOptions,
  type EmitToolDefinition,
  type JsonObjectSchema,
  type LlmClient,
  type LlmMessage,
  type LlmUsage,
  type ToolCallRequest,
  type ToolCallResult,
} from "./client";
export { EMIT_ENTITY_TOOL_NAME, buildEmitEntityTool } from "./tool";
export {
  LlmGenerationError,
  generateEntity,
  type GenerateEntityArgs,
  type GenerateEntityResult,
} from "./generate";
export {
  createFakeLlmClient,
  type FakeLlmClient,
  type FakeResponse,
} from "./testing";
export { estimateLlmCostUsd } from "./cost";
