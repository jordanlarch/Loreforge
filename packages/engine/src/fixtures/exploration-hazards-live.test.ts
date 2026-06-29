import { describe, expect, it } from "vitest";

import { BURNING_SLUG } from "../content/srd-exploration-hazard-seeds";
import {
  buildExplorationBurningEnterCommands,
  DEMO_DUNGEON_EXPLORATION_HAZARD_SCENE_SLUGS,
  resolveLocationExplorationBurningSlugs,
  resolveLocationExplorationHazardSlugs,
} from "./exploration-hazards-live";

describe("exploration-hazards-live fixtures", () => {
  it("dungeon demo exposes a burning scene chip slug", () => {
    const slugs = resolveLocationExplorationHazardSlugs({
      entityId: "d:1",
      name: "Crypt",
      summary: "",
      type: "dungeon",
    });
    expect(slugs).toEqual([...DEMO_DUNGEON_EXPLORATION_HAZARD_SCENE_SLUGS]);
    expect(slugs[0]).toBe(BURNING_SLUG);
  });

  it("enter-time burning requires explicit metadata", () => {
    expect(resolveLocationExplorationBurningSlugs(undefined)).toEqual([]);
    expect(
      resolveLocationExplorationBurningSlugs({
        explorationBurningSlugs: [BURNING_SLUG],
      }),
    ).toEqual([BURNING_SLUG]);
  });

  it("buildExplorationBurningEnterCommands applies burning per party PC", () => {
    const commands = buildExplorationBurningEnterCommands(
      ["pc:a", "pc:b"],
      [BURNING_SLUG],
    );
    expect(commands).toHaveLength(2);
    expect(commands[0]).toEqual({
      type: "apply_burning",
      target: "pc:a",
      burningSlug: BURNING_SLUG,
    });
  });
});
