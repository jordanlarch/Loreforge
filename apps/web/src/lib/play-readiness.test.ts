import { describe, expect, it } from "vitest";

import { derivePlayReadiness } from "./play-readiness";

describe("derivePlayReadiness", () => {
  it("blocks first play without start scene or PC", () => {
    const r = derivePlayReadiness({
      startingSceneId: null,
      activePcCount: 0,
      engineEventCount: 0,
    });
    expect(r.canFirstPlay).toBe(false);
    expect(r.canContinue).toBe(false);
    expect(r.blockers).toEqual(["starting_scene", "party"]);
  });

  it("allows first play when gates pass and log is empty", () => {
    const r = derivePlayReadiness({
      startingSceneId: "scene:realm:abc",
      activePcCount: 1,
      engineEventCount: 0,
      startingLocationName: "Mistmere",
    });
    expect(r.canFirstPlay).toBe(true);
    expect(r.canContinue).toBe(false);
    expect(r.blockers).toEqual([]);
    expect(r.startingEntityId).toBe("abc");
    expect(r.startingLocationName).toBe("Mistmere");
  });

  it("allows continue when engine state exists regardless of gates", () => {
    const r = derivePlayReadiness({
      startingSceneId: null,
      activePcCount: 0,
      engineEventCount: 12,
    });
    expect(r.canFirstPlay).toBe(false);
    expect(r.canContinue).toBe(true);
    expect(r.blockers).toEqual([]);
  });
});
