import { describe, expect, it } from "vitest";

import { EMBEDDING_DIMENSIONS } from "@app/db";

import {
  FAKE_EMBEDDING_MODEL,
  createDeterministicEmbeddingClient,
  deterministicVector,
  resolveEmbeddingClient,
} from "./client";

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += (a[i] ?? 0) * (b[i] ?? 0);
  return dot;
}

describe("deterministicVector", () => {
  it("returns a unit-length 1536-dim vector", () => {
    const v = deterministicVector("a fearsome red dragon");
    expect(v).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(cosine(v, v)).toBeCloseTo(1, 6);
  });

  it("is identical for identical text", () => {
    expect(deterministicVector("hello world")).toEqual(
      deterministicVector("hello world"),
    );
  });

  it("scores shared-token text higher than unrelated text", () => {
    const query = deterministicVector("red dragon volcanic lair gold");
    const related = deterministicVector("a red dragon hoarding gold in a lair");
    const unrelated = deterministicVector("a cozy tavern serving ale and stew");
    expect(cosine(query, related)).toBeGreaterThan(cosine(query, unrelated));
  });

  it("never returns a zero vector for token-less text", () => {
    const v = deterministicVector("   ");
    expect(cosine(v, v)).toBeCloseTo(1, 6);
  });
});

describe("createDeterministicEmbeddingClient", () => {
  it("records calls and embeds each input text", async () => {
    const client = createDeterministicEmbeddingClient();
    const res = await client.embed(["one", "two"]);
    expect(res.model).toBe(FAKE_EMBEDDING_MODEL);
    expect(res.vectors).toHaveLength(2);
    expect(client.calls).toEqual([["one", "two"]]);
  });
});

describe("resolveEmbeddingClient", () => {
  it("falls back to the deterministic client when no api key is present", () => {
    const client = resolveEmbeddingClient({ apiKey: undefined });
    // No key passed and (in CI) none in env → the fake model.
    if (!process.env.OPENAI_API_KEY) {
      expect(client.model).toBe(FAKE_EMBEDDING_MODEL);
    }
  });

  it("uses the OpenAI client when an api key is provided", () => {
    const client = resolveEmbeddingClient({ apiKey: "sk-test", model: "m" });
    expect(client.model).toBe("m");
  });
});
