import { describe, expect, it } from "vitest";

import {
  applyTerritoryCells,
  buildLocatedInMap,
  cellInBounds,
  cellKey,
  filterCellsWithinRegion,
  ownerAtCell,
  parentRegionId,
  parseCellKey,
  seedOverworldLayout,
  toggleTerritoryCell,
  type OverworldEntity,
} from "./overworld-map";

const region: OverworldEntity = {
  id: "r1",
  membershipId: "m1",
  name: "North",
  type: "region",
  discovered: true,
  overworldMap: { territory: ["0,0", "1,0", "0,1", "1,1"] },
};

const settlement: OverworldEntity = {
  id: "s1",
  membershipId: "m2",
  name: "Town",
  type: "settlement",
  discovered: true,
  overworldMap: { territory: ["0,0"] },
};

describe("overworld map cells", () => {
  it("round-trips cell keys", () => {
    expect(parseCellKey(cellKey(3, 7))).toEqual({ col: 3, row: 7 });
    expect(parseCellKey("bad")).toBeNull();
  });

  it("checks bounds against grid config", () => {
    const grid = { width: 4, height: 3 };
    expect(cellInBounds(3, 2, grid)).toBe(true);
    expect(cellInBounds(4, 0, grid)).toBe(false);
  });
});

describe("territory helpers", () => {
  it("finds the owner of a painted cell", () => {
    expect(ownerAtCell([region, settlement], 0, 0)?.id).toBe("s1");
    expect(ownerAtCell([region, settlement], 1, 1)?.id).toBe("r1");
  });

  it("toggles territory membership", () => {
    const next = toggleTerritoryCell({ territory: ["0,0"] }, 1, 0, true);
    expect(next.territory).toEqual(["0,0", "1,0"]);
    const removed = toggleTerritoryCell(next, 0, 0, false);
    expect(removed.territory).toEqual(["1,0"]);
  });

  it("filters settlement cells to a parent region", () => {
    const parent = new Set(["0,0", "1,0", "0,1"]);
    expect(filterCellsWithinRegion(["0,0", "5,5"], parent)).toEqual(["0,0"]);
  });

  it("applies a unique territory set", () => {
    expect(applyTerritoryCells({}, ["1,1", "1,1", "2,2"]).territory).toEqual([
      "1,1",
      "2,2",
    ]);
  });
});

describe("parent region resolution", () => {
  it("walks located_in edges to a region", () => {
    const edges = [
      { fromId: "s1", toId: "r1", kind: "located_in" },
      { fromId: "b1", toId: "s1", kind: "located_in" },
    ];
    const locatedIn = buildLocatedInMap(edges);
    const regions = new Set(["r1"]);
    expect(parentRegionId("s1", regions, locatedIn)).toBe("r1");
    expect(parentRegionId("b1", regions, locatedIn)).toBe("r1");
  });
});

describe("seedOverworldLayout", () => {
  it("creates territories and pins for empty campaigns", () => {
    const entities: OverworldEntity[] = [
      {
        id: "r1",
        membershipId: "m1",
        name: "Marches",
        type: "region",
        discovered: false,
        overworldMap: {},
      },
      {
        id: "s1",
        membershipId: "m2",
        name: "Northshore",
        type: "settlement",
        discovered: false,
        overworldMap: {},
      },
      {
        id: "t1",
        membershipId: "m3",
        name: "Tavern",
        type: "tavern",
        discovered: false,
        overworldMap: {},
      },
    ];
    const parentMap = new Map([["s1", "r1"], ["t1", "s1"]]);
    const seeded = seedOverworldLayout(
      entities,
      { width: 24, height: 16 },
      parentMap,
    );
    expect(seeded.get("r1")?.territory?.length).toBeGreaterThan(0);
    expect(seeded.get("s1")?.territory?.length).toBeGreaterThan(0);
    expect(seeded.get("t1")?.pin).toBeDefined();
  });
});
