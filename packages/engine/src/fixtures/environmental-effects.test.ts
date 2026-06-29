import { describe, expect, it } from "vitest";

import {
  buildEnvironmentalEffectEnterCommands,
  DEMO_DUNGEON_ENVIRONMENTAL_EFFECT_SLUGS,
  resolveLocationEnvironmentalEffectSlugs,
} from "./environmental-effects";
import { sceneIdForRealmEntity } from "./exploration";

describe("environmental effect enter fixtures", () => {
  const dungeon = {
    entityId: "33333333-3333-4333-8333-333333333333",
    name: "Whisper Crypt",
    summary: "Damp stone.",
    type: "dungeon" as const,
  };

  it("uses dungeon demo slugs when metadata is absent (Q8)", () => {
    expect(resolveLocationEnvironmentalEffectSlugs(dungeon)).toEqual([
      ...DEMO_DUNGEON_ENVIRONMENTAL_EFFECT_SLUGS,
    ]);
  });

  it("prefers toolboxEnvironmentalEffectSlugs from location metadata", () => {
    expect(
      resolveLocationEnvironmentalEffectSlugs(dungeon, {
        toolboxEnvironmentalEffectSlugs: ["srd-2024_strong-wind"],
      }),
    ).toEqual(["srd-2024_strong-wind"]);
  });

  it("builds set_scene + apply commands for party PCs", () => {
    const sceneId = sceneIdForRealmEntity(dungeon.entityId);
    const commands = buildEnvironmentalEffectEnterCommands(
      sceneId,
      DEMO_DUNGEON_ENVIRONMENTAL_EFFECT_SLUGS,
      ["pc:1", "pc:2"],
    );
    expect(commands[0]).toEqual({
      type: "set_scene_environmental_effects",
      sceneId,
      slugs: [...DEMO_DUNGEON_ENVIRONMENTAL_EFFECT_SLUGS],
    });
    expect(commands).toHaveLength(5);
    expect(commands.filter((c) => c.type === "apply_environmental_effect")).toHaveLength(
      4,
    );
  });
});
