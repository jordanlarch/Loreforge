import { describe, expect, it, vi } from "vitest";

import { createFakeLlmClient } from "@app/llm";

import type { ChatEntry } from "./chat.js";
import {
  SUMMARY_EVERY,
  maybeUpdateRollingSummary,
  shouldRegenerateSummary,
  summarizeSession,
  type RollingSummaryDeps,
} from "./session-summary.js";

function chatOf(n: number): ChatEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i),
    kind: i % 2 === 0 ? "player" : "gm",
    author: i % 2 === 0 ? "Thorin" : "GM",
    text: `line ${i}`,
    ts: i,
  })) as ChatEntry[];
}

describe("shouldRegenerateSummary", () => {
  it("is true once the chat grows by SUMMARY_EVERY beyond the covered seq", () => {
    expect(shouldRegenerateSummary(0, SUMMARY_EVERY)).toBe(true);
    expect(shouldRegenerateSummary(0, SUMMARY_EVERY - 1)).toBe(false);
    expect(shouldRegenerateSummary(10, 10 + SUMMARY_EVERY)).toBe(true);
    expect(shouldRegenerateSummary(10, 12)).toBe(false);
  });
});

describe("summarizeSession", () => {
  it("returns the model's summary and includes prior summary + transcript", async () => {
    const client = createFakeLlmClient({
      input: { summary: "The party regroups at the shrine." },
    });
    const text = await summarizeSession(client, {
      priorSummary: "They fled the village.",
      lines: ["Thorin: I run", "GM: You escape the flames"],
    });
    expect(text).toBe("The party regroups at the shrine.");
    const prompt = client.calls[0]!.messages[0]!.content;
    expect(prompt).toContain("They fled the village.");
    expect(prompt).toContain("You escape the flames");
  });

  it("throws on empty summary output", async () => {
    const client = createFakeLlmClient({ input: { summary: "  " } });
    await expect(
      summarizeSession(client, { lines: ["Thorin: hi"] }),
    ).rejects.toThrow();
  });
});

describe("maybeUpdateRollingSummary", () => {
  function deps(over: Partial<RollingSummaryDeps> = {}): RollingSummaryDeps {
    return {
      load: async () => null,
      save: vi.fn(async () => {}),
      ...over,
    };
  }

  it("regenerates + saves when the cadence threshold is hit", async () => {
    const save = vi.fn(async () => {});
    const client = createFakeLlmClient({
      input: { summary: "A fresh recap of events." },
    });
    const chat = chatOf(SUMMARY_EVERY);
    await maybeUpdateRollingSummary({
      campaignId: "c1",
      client,
      chat,
      deps: deps({ save }),
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("c1", {
      summary: "A fresh recap of events.",
      coveredSeq: SUMMARY_EVERY,
    });
  });

  it("no-ops when below the cadence threshold", async () => {
    const save = vi.fn(async () => {});
    const client = createFakeLlmClient({ input: { summary: "unused" } });
    await maybeUpdateRollingSummary({
      campaignId: "c1",
      client,
      chat: chatOf(3),
      deps: deps({ load: async () => ({ summary: "old", coveredSeq: 0 }), save }),
    });
    expect(save).not.toHaveBeenCalled();
  });

  it("swallows summarizer failures (best-effort)", async () => {
    const save = vi.fn(async () => {});
    const client = createFakeLlmClient({ input: { summary: "  " } }); // empty → throws
    await expect(
      maybeUpdateRollingSummary({
        campaignId: "c1",
        client,
        chat: chatOf(SUMMARY_EVERY),
        deps: deps({ save }),
      }),
    ).resolves.toBeUndefined();
    expect(save).not.toHaveBeenCalled();
  });
});
