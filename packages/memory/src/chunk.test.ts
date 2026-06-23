import { describe, expect, it } from "vitest";

import {
  buildEntityEmbeddingInput,
  composeEntityChunkText,
  contentHash,
  type EmbeddableRealmEntity,
} from "./chunk";

const baseEntity: EmbeddableRealmEntity = {
  id: "e1",
  ownerId: "o1",
  type: "npc",
  name: "Gandor",
  summary: "An old wizard",
  data: { role: "Archmage", goals: ["seek the lost tome", "guard the gate"] },
  isStub: false,
};

describe("composeEntityChunkText", () => {
  it("composes name (type) + summary + flattened sorted data", () => {
    const text = composeEntityChunkText(baseEntity);
    expect(text).toBe(
      [
        "Gandor (npc)",
        "An old wizard",
        "goals: seek the lost tome; guard the gate",
        "role: Archmage",
      ].join("\n"),
    );
  });

  it("is stable regardless of data key insertion order", () => {
    const a = composeEntityChunkText(baseEntity);
    const b = composeEntityChunkText({
      ...baseEntity,
      data: { goals: ["seek the lost tome", "guard the gate"], role: "Archmage" },
    });
    expect(a).toBe(b);
  });

  it("omits empty summary and empty data", () => {
    const text = composeEntityChunkText({
      ...baseEntity,
      summary: "   ",
      data: {},
    });
    expect(text).toBe("Gandor (npc)");
  });

  it("renders nested objects and skips empty values", () => {
    const text = composeEntityChunkText({
      ...baseEntity,
      summary: "",
      data: { location: { city: "Waterdeep", note: "" }, level: 12, hidden: null },
    });
    expect(text).toBe(["Gandor (npc)", "level: 12", "location: Waterdeep"].join("\n"));
  });
});

describe("contentHash", () => {
  it("is deterministic and differs for different text", () => {
    expect(contentHash("abc")).toBe(contentHash("abc"));
    expect(contentHash("abc")).not.toBe(contentHash("abd"));
  });
});

describe("buildEntityEmbeddingInput", () => {
  it("returns a chunk + matching contentHash for a real entity", () => {
    const input = buildEntityEmbeddingInput(baseEntity);
    expect(input).not.toBeNull();
    expect(input!.chunkText).toBe(composeEntityChunkText(baseEntity));
    expect(input!.contentHash).toBe(contentHash(input!.chunkText));
  });

  it("skips stubs (returns null)", () => {
    expect(buildEntityEmbeddingInput({ ...baseEntity, isStub: true })).toBeNull();
  });
});
