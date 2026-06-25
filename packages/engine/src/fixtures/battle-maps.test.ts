import { describe, expect, it } from "vitest";

import {
  ENCOUNTER_MAP_PRESETS,
  resolveEncounterMap,
} from "./battle-maps";
import { buildPartyBattleCommands } from "./battle";

describe("resolveEncounterMap", () => {
  it("defaults unknown presets to ambush", () => {
    expect(resolveEncounterMap(undefined).id).toBe("ambush");
    expect(resolveEncounterMap("nope").id).toBe("ambush");
  });

  it("returns arena with no blocked cells", () => {
    expect(resolveEncounterMap("arena").blockedCells).toEqual([]);
  });
});

describe("buildPartyBattleCommands map preset", () => {
  it("uses the authored map dimensions", () => {
    const commands = buildPartyBattleCommands([], {
      map: ENCOUNTER_MAP_PRESETS.arena,
    });
    const createScene = commands.find((c) => c.type === "create_scene");
    expect(createScene?.type).toBe("create_scene");
    if (createScene?.type !== "create_scene") return;
    expect(createScene.scene.map?.width).toBe(14);
    expect(createScene.scene.map?.height).toBe(14);
    expect(createScene.scene.map?.blockedCells).toEqual([]);
  });
});
