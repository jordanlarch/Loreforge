import { describe, expect, it } from "vitest";

import { hasMentions, linkifyMentions } from "./notes-mentions";

const ENTITIES = [
  { id: "e1", name: "Ravenwood" },
  { id: "e2", name: "Ravenwood Keep" },
  { id: "e3", name: "The Iron Gate Inn" },
  { id: "e4", name: "Captain Vane" },
];

describe("linkifyMentions", () => {
  it("returns [] for an empty body", () => {
    expect(linkifyMentions("", ENTITIES)).toEqual([]);
  });

  it("returns a single text segment when there are no entities", () => {
    expect(linkifyMentions("Hello @Ravenwood", [])).toEqual([
      { kind: "text", text: "Hello @Ravenwood" },
    ]);
  });

  it("links a single mention in the middle of text", () => {
    const segs = linkifyMentions("Meet at @Ravenwood tonight.", ENTITIES);
    expect(segs).toEqual([
      { kind: "text", text: "Meet at " },
      { kind: "mention", text: "@Ravenwood", entityId: "e1" },
      { kind: "text", text: " tonight." },
    ]);
  });

  it("matches multi-word names, longest first", () => {
    const segs = linkifyMentions("The party enters @Ravenwood Keep.", ENTITIES);
    expect(segs).toEqual([
      { kind: "text", text: "The party enters " },
      { kind: "mention", text: "@Ravenwood Keep", entityId: "e2" },
      { kind: "text", text: "." },
    ]);
  });

  it("is case-insensitive but preserves the note's casing", () => {
    const segs = linkifyMentions("see @captain vane", ENTITIES);
    expect(segs).toEqual([
      { kind: "text", text: "see " },
      { kind: "mention", text: "@captain vane", entityId: "e4" },
    ]);
  });

  it("respects a trailing word boundary (@Raven won't match Ravenna)", () => {
    const segs = linkifyMentions("@Ravenna sang", [
      { id: "r", name: "Raven" },
    ]);
    expect(segs).toEqual([{ kind: "text", text: "@Ravenna sang" }]);
  });

  it("leaves a bare @ with no known entity as text", () => {
    expect(linkifyMentions("email me @ noon", ENTITIES)).toEqual([
      { kind: "text", text: "email me @ noon" },
    ]);
  });

  it("handles multiple mentions", () => {
    const segs = linkifyMentions("@Captain Vane waits at @The Iron Gate Inn", ENTITIES);
    expect(segs).toEqual([
      { kind: "mention", text: "@Captain Vane", entityId: "e4" },
      { kind: "text", text: " waits at " },
      { kind: "mention", text: "@The Iron Gate Inn", entityId: "e3" },
    ]);
  });
});

describe("hasMentions", () => {
  it("is true when a mention is present", () => {
    expect(hasMentions(linkifyMentions("@Ravenwood", ENTITIES))).toBe(true);
  });
  it("is false for plain text", () => {
    expect(hasMentions(linkifyMentions("nothing here", ENTITIES))).toBe(false);
  });
});
