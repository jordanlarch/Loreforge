import type { LlmClient, LlmUsage, ToolCallRequest } from "./client";

export type FakeResponse = {
  /** The tool-call arguments the fake should return. */
  input: unknown;
  usage?: Partial<LlmUsage>;
  model?: string;
};

export type FakeLlmClient = LlmClient & {
  /** Every request the fake received, in order (for assertions). */
  readonly calls: ToolCallRequest[];
};

/**
 * In-memory {@link LlmClient} for tests — no network. Pass a single response
 * (reused for every call) or an array consumed in order, with the last entry
 * reused once exhausted (so a multi-attempt retry test can hand back a bad
 * payload then a good one).
 */
export function createFakeLlmClient(
  responses: FakeResponse | FakeResponse[],
): FakeLlmClient {
  const queue = Array.isArray(responses) ? [...responses] : [responses];
  if (queue.length === 0) {
    throw new Error("createFakeLlmClient requires at least one response.");
  }
  const calls: ToolCallRequest[] = [];

  return {
    calls,
    async callTool(req: ToolCallRequest) {
      calls.push(req);
      const next = queue.length > 1 ? queue.shift()! : queue[0]!;
      return {
        input: next.input,
        usage: {
          inputTokens: next.usage?.inputTokens ?? 10,
          outputTokens: next.usage?.outputTokens ?? 20,
        },
        model: next.model ?? "fake-model",
      };
    },
  };
}
