import { describe, expect, it } from "vitest";

import { estimateLlmCostUsd } from "./cost.js";

describe("estimateLlmCostUsd", () => {
  it("estimates sonnet usage", () => {
    const usd = estimateLlmCostUsd("claude-sonnet-4-5", {
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    expect(usd).toBe(3);
  });

  it("returns null for zero usage", () => {
    expect(
      estimateLlmCostUsd("claude-sonnet-4-5", {
        inputTokens: 0,
        outputTokens: 0,
      }),
    ).toBeNull();
  });
});
