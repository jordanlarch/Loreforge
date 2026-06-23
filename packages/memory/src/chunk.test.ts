import { describe, expect, it } from "vitest";

import {
  buildCrossLinkEmbeddingInput,
  buildEntityEmbeddingInput,
  composeCrossLinkText,
  composeEntityChunkText,
  contentHash,
  type CrossLinkInput,
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

const baseLink: CrossLinkInput = {
  fromName: "Eldermoor",
  fromType: "settlement",
  kind: "located_in",
  toName: "The Mistlands",
  toType: "region",
};

describe("composeCrossLinkText", () => {
  it("renders a directed natural-language sentence", () => {
    expect(composeCrossLinkText(baseLink)).toBe(
      "Eldermoor (settlement) is located in The Mistlands (region).",
    );
  });

  it("maps each known relationship kind to a verb", () => {
    expect(composeCrossLinkText({ ...baseLink, kind: "owns" })).toContain(
      "owns",
    );
    expect(
      composeCrossLinkText({ ...baseLink, kind: "allied_with" }),
    ).toContain("is allied with");
  });

  it("falls back to a generic verb for an unknown kind", () => {
    expect(composeCrossLinkText({ ...baseLink, kind: "mystery" })).toContain(
      "is related to",
    );
  });
});

describe("buildCrossLinkEmbeddingInput", () => {
  it("returns a chunk + matching contentHash", () => {
    const input = buildCrossLinkEmbeddingInput(baseLink);
    expect(input).not.toBeNull();
    expect(input!.chunkText).toBe(composeCrossLinkText(baseLink));
    expect(input!.contentHash).toBe(contentHash(input!.chunkText));
  });

  it("skips when an endpoint name is blank (returns null)", () => {
    expect(buildCrossLinkEmbeddingInput({ ...baseLink, toName: "  " })).toBeNull();
  });
});
