import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PINNED_MEMORY_SOURCE,
  REALM_ENTITY_SOURCE,
  SESSION_RECAP_SOURCE,
} from "@app/memory";
import type { RetrievedChunk } from "@app/memory";

import {
  isWorldKnowledgeConfigured,
  retrieveWorldKnowledge,
  type RetrieveParams,
  type WorldKnowledgeDeps,
} from "./world-knowledge.js";

const ORIGINAL_KEY = process.env.OPENAI_API_KEY;

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key";
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = ORIGINAL_KEY;
});

function chunk(
  sourceType: string,
  text: string,
  score: number,
  createdAt = new Date("2026-01-01T00:00:00Z"),
): RetrievedChunk {
  return { sourceType, sourceId: text, chunkIndex: 0, chunkText: text, score, createdAt };
}

/**
 * A deps stub that routes by requested sourceType so lore vs recap categories
 * can return distinct fixtures (mirrors the per-category retrieval).
 */
function deps(
  byType: Partial<Record<string, RetrievedChunk[]>>,
  over: Partial<WorldKnowledgeDeps> = {},
): WorldKnowledgeDeps {
  return {
    resolveOwnerId: async () => "owner-1",
    retrieve: async (params: RetrieveParams) =>
      byType[params.sourceTypes[0]!] ?? [],
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
  it("returns lore chunks unprefixed (back-compat, no recaps)", async () => {
    const result = await retrieveWorldKnowledge(
      { campaignId: "c1", queryText: "Tell me about Eldermoor" },
      deps({
        [REALM_ENTITY_SOURCE]: [
          chunk(REALM_ENTITY_SOURCE, "Eldermoor is a fog-bound marsh town.", 0.8),
        ],
      }),
    );
    expect(result).toEqual(["Eldermoor is a fog-bound marsh town."]);
  });

  it("merges lore + recaps and tags recap provenance", async () => {
    const result = await retrieveWorldKnowledge(
      { campaignId: "c1", queryText: "what happened" },
      deps({
        [REALM_ENTITY_SOURCE]: [chunk(REALM_ENTITY_SOURCE, "The Iron Keep guards the pass.", 0.6)],
        [SESSION_RECAP_SOURCE]: [chunk(SESSION_RECAP_SOURCE, "The party stormed the keep.", 0.7)],
      }),
    );
    expect(result).toContain("The Iron Keep guards the pass.");
    expect(result).toContain("From an earlier session: The party stormed the keep.");
    // Recap scored higher, so it ranks first.
    expect(result[0]).toBe("From an earlier session: The party stormed the keep.");
  });

  it("weights pinned memory above equally/less-similar lore and tags it", async () => {
    const result = await retrieveWorldKnowledge(
      { campaignId: "c1", queryText: "who is the innkeeper" },
      deps({
        [REALM_ENTITY_SOURCE]: [chunk(REALM_ENTITY_SOURCE, "The inn sits by the docks.", 0.7)],
        [PINNED_MEMORY_SOURCE]: [
          chunk(PINNED_MEMORY_SOURCE, "The innkeeper is secretly a doppelganger.", 0.6),
        ],
      }),
    );
    // Pinned 0.6 * 1.5 = 0.9 beats lore 0.7 * 1 = 0.7.
    expect(result[0]).toBe(
      "Pinned by the GM (important): The innkeeper is secretly a doppelganger.",
    );
    expect(result).toContain("The inn sits by the docks.");
  });

  it("requests pinned memory with a campaign scope", async () => {
    const scopes: Record<string, string | null | undefined> = {};
    await retrieveWorldKnowledge(
      { campaignId: "c1", queryText: "hello" },
      deps(
        { [PINNED_MEMORY_SOURCE]: [] },
        {
          retrieve: async (params) => {
            scopes[params.sourceTypes[0]!] = params.campaignId;
            return [];
          },
        },
      ),
    );
    expect(scopes[PINNED_MEMORY_SOURCE]).toBe("c1");
  });

  it("only requests recaps with a campaign scope; lore is owner-scoped", async () => {
    const scopes: Record<string, string | null | undefined> = {};
    await retrieveWorldKnowledge(
      { campaignId: "c1", queryText: "hello" },
      deps(
        { [REALM_ENTITY_SOURCE]: [], [SESSION_RECAP_SOURCE]: [] },
        {
          retrieve: async (params) => {
            scopes[params.sourceTypes[0]!] = params.campaignId;
            return [];
          },
        },
      ),
    );
    expect(scopes[REALM_ENTITY_SOURCE]).toBeUndefined();
    expect(scopes[SESSION_RECAP_SOURCE]).toBe("c1");
  });

  it("recency-boosts the more recent of two equally-similar recaps", async () => {
    const result = await retrieveWorldKnowledge(
      { campaignId: "c1", queryText: "recap" },
      deps({
        [SESSION_RECAP_SOURCE]: [
          chunk(SESSION_RECAP_SOURCE, "older", 0.5, new Date("2026-01-01T00:00:00Z")),
          chunk(SESSION_RECAP_SOURCE, "newer", 0.5, new Date("2026-02-01T00:00:00Z")),
        ],
      }),
    );
    expect(result[0]).toBe("From an earlier session: newer");
  });

  it("respects the total top-k across categories", async () => {
    const result = await retrieveWorldKnowledge(
      { campaignId: "c1", queryText: "hello", k: 2 },
      deps({
        [REALM_ENTITY_SOURCE]: [
          chunk(REALM_ENTITY_SOURCE, "lore-a", 0.9),
          chunk(REALM_ENTITY_SOURCE, "lore-b", 0.85),
        ],
        [SESSION_RECAP_SOURCE]: [chunk(SESSION_RECAP_SOURCE, "recap-a", 0.6)],
      }),
    );
    expect(result).toHaveLength(2);
    expect(result).toEqual(["lore-a", "lore-b"]);
  });

  it("no-ops when embeddings are unconfigured (no key)", async () => {
    delete process.env.OPENAI_API_KEY;
    let retrieved = false;
    const result = await retrieveWorldKnowledge(
      { campaignId: "c1", queryText: "anything" },
      deps(
        {},
        {
          retrieve: async () => {
            retrieved = true;
            return [];
          },
        },
      ),
    );
    expect(result).toEqual([]);
    expect(retrieved).toBe(false);
  });

  it("returns [] for a blank query without retrieving", async () => {
    let retrieved = false;
    const result = await retrieveWorldKnowledge(
      { campaignId: "c1", queryText: "   " },
      deps(
        {},
        {
          retrieve: async () => {
            retrieved = true;
            return [];
          },
        },
      ),
    );
    expect(result).toEqual([]);
    expect(retrieved).toBe(false);
  });

  it("returns [] when the campaign has no owner", async () => {
    const result = await retrieveWorldKnowledge(
      { campaignId: "c1", queryText: "hello" },
      deps({}, { resolveOwnerId: async () => null }),
    );
    expect(result).toEqual([]);
  });

  it("drops chunks below the similarity floor", async () => {
    const result = await retrieveWorldKnowledge(
      { campaignId: "c1", queryText: "hello" },
      deps({
        [REALM_ENTITY_SOURCE]: [
          chunk(REALM_ENTITY_SOURCE, "Strongly related lore.", 0.5),
          chunk(REALM_ENTITY_SOURCE, "Barely related noise.", 0.05),
        ],
      }),
    );
    expect(result).toEqual(["Strongly related lore."]);
  });

  it("swallows retrieval failures (best-effort)", async () => {
    const result = await retrieveWorldKnowledge(
      { campaignId: "c1", queryText: "hello" },
      deps(
        {},
        {
          retrieve: async () => {
            throw new Error("provider down");
          },
        },
      ),
    );
    expect(result).toEqual([]);
  });
});
