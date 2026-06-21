import { describe, expect, it } from "vitest";
import { z } from "zod";

import { LlmGenerationError, generateEntity } from "./generate";
import { createFakeLlmClient } from "./testing";

const schema = z.object({
  name: z.string().min(1),
  level: z.number().int().min(1).max(20),
});

describe("generateEntity", () => {
  it("returns parsed data on the first valid attempt", async () => {
    const client = createFakeLlmClient({
      input: { name: "Grok", level: 3 },
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    const result = await generateEntity({
      client,
      schema,
      system: "sys",
      prompt: "make an npc",
    });

    expect(result.data).toEqual({ name: "Grok", level: 3 });
    expect(result.attempts).toBe(1);
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
    expect(client.calls).toHaveLength(1);
  });

  it("re-prompts with the validation error and recovers, accumulating usage", async () => {
    const client = createFakeLlmClient([
      { input: { name: "Grok", level: 99 }, usage: { inputTokens: 100, outputTokens: 50 } },
      { input: { name: "Grok", level: 5 }, usage: { inputTokens: 40, outputTokens: 20 } },
    ]);

    const result = await generateEntity({
      client,
      schema,
      system: "sys",
      prompt: "make an npc",
    });

    expect(result.data).toEqual({ name: "Grok", level: 5 });
    expect(result.attempts).toBe(2);
    // Usage is summed across attempts.
    expect(result.usage).toEqual({ inputTokens: 140, outputTokens: 70 });
    // The retry message carries the zod error back to the model.
    expect(client.calls).toHaveLength(2);
    const retry = client.calls[1]!;
    expect(retry.messages.at(-1)?.content).toContain("failed validation");
    expect(retry.messages.at(-1)?.content).toContain("level");
  });

  it("throws LlmGenerationError after exhausting retries", async () => {
    const client = createFakeLlmClient({ input: { name: "", level: 0 } });

    await expect(
      generateEntity({
        client,
        schema,
        system: "sys",
        prompt: "make an npc",
        maxRetries: 1,
      }),
    ).rejects.toBeInstanceOf(LlmGenerationError);

    // first attempt + 1 retry = 2 calls
    expect(client.calls).toHaveLength(2);
  });

  it("supports field-subset (per-section) generation via a narrower schema", async () => {
    const subset = schema.pick({ level: true });
    const client = createFakeLlmClient({ input: { level: 7 } });

    const result = await generateEntity({
      client,
      schema: subset,
      system: "sys",
      prompt: "reroll the level",
    });

    expect(result.data).toEqual({ level: 7 });
  });
});
