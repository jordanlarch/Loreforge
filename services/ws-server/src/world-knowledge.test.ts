import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isWorldKnowledgeConfigured,
  retrieveWorldKnowledge,
  type WorldKnowledgeDeps,
} from "./world-knowledge.js";
import type { RetrievedChunk } from "@app/memory";

const ORIGINAL_KEY = process.env.OPENAI_API_KEY;

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key";
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = ORIGINAL_KEY;
});

function chunk(text: string, score: number): RetrievedChunk {
  return { sourceType: "realm_entity", sourceId: "x", chunkIndex: 0, chunkText: text, score };
}

function deps(over: Partial<WorldKnowledgeDeps> = {}): WorldKnowledgeDeps {
  return {
    resolveOwnerId: async () => "owner-1",
    retrieve: async () => [chunk("Eldermoor is a fog-bound marsh town.", 0.8)],
    ...over,
  };
}

describe("isWorldKnowledgeConfigured", () => {
  it("tracks the OPENAI_API_KEY presence", () => {
    expect(isWorldKnowledgeConfigured()).toBe(true);
    delete process.env.OPENAI_API_KEY;
    expect(isWorldKnowledgeConfigured()).toBe(false);
  });
});

describe("retrieveWorldKnowledge", () => {
  it("returns formatted chunk text for relevant owner lore", async () => {
    const result = await retrieveWorldKnowledge(
      { campaignId: "c1", queryText: "Tell me about Eldermoor" },
      deps(),
    );
    expect(result).toEqual(["Eldermoor is a fog-bound marsh town."]);
  });

  it("no-ops when embeddings are unconfigured (no key)", async () => {
    delete process.env.OPENAI_API_KEY;
    let retrieved = false;
    const result = await retrieveWorldKnowledge(
      { campaignId: "c1", queryText: "anything" },
      deps({
        retrieve: async () => {
          retrieved = true;
          return [];
        },
      }),
    );
    expect(result).toEqual([]);
    expect(retrieved).toBe(false); // gated out before any retrieval
  });

  it("returns [] for a blank query without retrieving", async () => {
    let retrieved = false;
    const result = await retrieveWorldKnowledge(
      { campaignId: "c1", queryText: "   " },
      deps({
        retrieve: async () => {
          retrieved = true;
          return [];
        },
      }),
    );
    expect(result).toEqual([]);
    expect(retrieved).toBe(false);
  });

  it("returns [] when the campaign has no owner", async () => {
    const result = await retrieveWorldKnowledge(
      { campaignId: "c1", queryText: "hello" },
      deps({ resolveOwnerId: async () => null }),
    );
    expect(result).toEqual([]);
  });

  it("drops chunks below the similarity floor", async () => {
    const result = await retrieveWorldKnowledge(
      { campaignId: "c1", queryText: "hello" },
      deps({
        retrieve: async () => [
          chunk("Strongly related lore.", 0.5),
          chunk("Barely related noise.", 0.05),
        ],
      }),
    );
    expect(result).toEqual(["Strongly related lore."]);
  });

  it("swallows retrieval failures (best-effort)", async () => {
    const result = await retrieveWorldKnowledge(
      { campaignId: "c1", queryText: "hello" },
      deps({
        retrieve: async () => {
          throw new Error("provider down");
        },
      }),
    );
    expect(result).toEqual([]);
  });
});
