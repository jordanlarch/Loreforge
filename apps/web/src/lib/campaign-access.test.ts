import { describe, expect, it } from "vitest";

import { resolvePcCharacterId } from "./campaign-access";

describe("resolvePcCharacterId", () => {
  const party = [
    { id: "owner-pc", role: "pc" },
    { id: "guest-pc", role: "pc" },
  ];

  it("returns seated character for players", () => {
    expect(resolvePcCharacterId("player", "guest-pc", party)).toBe("guest-pc");
  });

  it("falls back to first PC for owners", () => {
    expect(resolvePcCharacterId("owner", null, party)).toBe("owner-pc");
  });

  it("returns undefined when player has no seat binding", () => {
    expect(resolvePcCharacterId("player", null, party)).toBeUndefined();
  });
});
