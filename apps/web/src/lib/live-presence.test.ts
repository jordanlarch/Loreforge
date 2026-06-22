import { describe, expect, it } from "vitest";

import type { WorldState } from "@app/engine";

import { joinedSincePrompt, resumeSummary } from "./live-presence";

describe("joinedSincePrompt", () => {
  it("prompts when the peer count rises into Live territory", () => {
    expect(joinedSincePrompt(1, 2)).toMatch(/1 other player connected/);
    expect(joinedSincePrompt(2, 4)).toMatch(/3 other players connected/);
  });

  it("is silent while solo or when no one new joined", () => {
    expect(joinedSincePrompt(1, 1)).toBeNull();
    expect(joinedSincePrompt(3, 2)).toBeNull();
    expect(joinedSincePrompt(0, 1)).toBeNull();
  });
});

describe("resumeSummary", () => {
  const base = {
    campaignId: "c1",
    lastSequence: 1,
    scenes: { s1: { id: "s1", name: "The Hearth", map: { width: 5, height: 5, blockedCells: [] } } },
    entities: {},
  } as unknown as WorldState;

  it("returns null with no state or no scene/encounter", () => {
    expect(resumeSummary(undefined)).toBeNull();
    expect(resumeSummary({ ...base, currentSceneId: undefined })).toBeNull();
  });

  it("summarizes the current scene out of combat", () => {
    const r = resumeSummary({ ...base, currentSceneId: "s1" });
    expect(r).toEqual({ sceneName: "The Hearth", round: undefined, inCombat: false });
  });

  it("reports the round when an encounter is active", () => {
    const r = resumeSummary({
      ...base,
      currentSceneId: "s1",
      encounter: { round: 3 },
    } as unknown as WorldState);
    expect(r?.inCombat).toBe(true);
    expect(r?.round).toBe(3);
  });
});
