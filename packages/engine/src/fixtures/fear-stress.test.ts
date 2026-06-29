import { describe, expect, it } from "vitest";

import {
  buildFearStressEnterCommands,
  DEMO_DUNGEON_FEAR_STRESS_SLUGS,
  resolveLocationFearStressSlugs,
} from "./fear-stress";

describe("fear-stress fixtures", () => {
  it("prefers toolboxFearStressSlugs from location metadata", () => {
    const slugs = resolveLocationFearStressSlugs(
      {
        entityId: "11111111-1111-4111-8111-111111111111",
        name: "Crypt",
        summary: "A dark crypt.",
        type: "dungeon",
      },
      { toolboxFearStressSlugs: ["srd-2024_abyss-portal"] },
    );
    expect(slugs).toEqual(["srd-2024_abyss-portal"]);
  });

  it("falls back to demo dungeon slug pair when metadata absent", () => {
    const slugs = resolveLocationFearStressSlugs({
      entityId: "11111111-1111-4111-8111-111111111111",
      name: "Crypt",
      summary: "A dark crypt.",
      type: "dungeon",
    });
    expect(slugs).toEqual([...DEMO_DUNGEON_FEAR_STRESS_SLUGS]);
  });

  it("builds bound apply commands for party on enter", () => {
    const commands = buildFearStressEnterCommands(
      "s:crypt",
      DEMO_DUNGEON_FEAR_STRESS_SLUGS,
      ["pc:hero"],
    );
    expect(commands).toEqual([
      {
        type: "apply_fear_stress",
        target: "pc:hero",
        fearStressSlug: "srd-2024_sarcophagus-apparition",
        boundSceneId: "s:crypt",
      },
    ]);
  });
});
