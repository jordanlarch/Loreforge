import { describe, expect, it } from "vitest";

import samples from "../fixtures/dungeon-floor-samples.json";
import { parseDungeonRooms } from "./rooms";
import {
  buildLayoutState,
  connectionIsOpen,
  loadDungeonFloors,
  movementBlockedByConnection,
  sameCell,
  synthesizeFloorsFromRooms,
  zoneAtCell,
} from "./layout";

describe("loadDungeonFloors", () => {
  it("synthesizes a linear eastward chain from data.rooms", () => {
    const floors = loadDungeonFloors({
      rooms: [
        { name: "Entry Hall", encounter: "goblins", floor: 0 },
        { name: "Bone Gallery", encounter: "skeletons", floor: 0 },
        { name: "Deep Vault", encounter: "wraith", floor: 1 },
      ],
    });
    expect(floors).toHaveLength(2);
    expect(floors[0]?.zones.map((z) => z.zoneId)).toEqual(["entry", "zone-1"]);
    expect(floors[1]?.zones.map((z) => z.zoneId)).toEqual(["zone-2"]);
    expect(floors[0]?.zones[0]?.connections[0]?.toZoneId).toBe("zone-1");
  });

  it("synthesizes a stub entry zone from wanderingMonsters when rooms are absent", () => {
    const floors = loadDungeonFloors({
      wanderingMonsters: ["3 goblin scouts"],
    });
    expect(floors).toHaveLength(1);
    expect(floors[0]?.zones[0]?.zoneId).toBe("entry");
    expect(floors[0]?.zones[0]?.encounter).toBe("3 goblin scouts");
  });

  it("loads authored floors[] and normalizes rect zones", () => {
    const floors = loadDungeonFloors(samples.minimalTwoZoneFloor);
    expect(floors).toHaveLength(1);
    expect(floors[0]?.zones.map((z) => z.zoneId)).toEqual(["entry", "ossuary"]);
    const entry = floors[0]?.zones[0];
    expect(entry?.cells.length).toBe(16);
  });

  it("rejects duplicate zone ids in authored floors", () => {
    expect(() =>
      loadDungeonFloors({
        floors: [
          {
            index: 0,
            name: "Bad",
            zones: [
              { zoneId: "dup", name: "A", rect: { x: 0, y: 0, w: 2, h: 2 } },
              { zoneId: "dup", name: "B", rect: { x: 3, y: 0, w: 2, h: 2 } },
            ],
          },
        ],
      }),
    ).toThrow(/Duplicate zoneId/);
  });
});

describe("connection gating", () => {
  it("blocks movement through a locked connection until opened", () => {
    const layout = buildLayoutState(loadDungeonFloors(samples.minimalTwoZoneFloor));
    const floor = layout.floors[0]!;
    const conn = floor.zones[0]!.connections[0]!;
    const from = conn.fromCells[0]!;
    const to = conn.corridorCells[0]!;
    expect(
      movementBlockedByConnection(floor, layout, [], from, to).blocked,
    ).toBe(true);
    const opened = {
      ...layout,
      openedConnectionIds: [...layout.openedConnectionIds, conn.connectionId],
    };
    expect(
      movementBlockedByConnection(floor, opened, [], from, to).blocked,
    ).toBe(false);
    expect(connectionIsOpen(conn, layout, [])).toBe(false);
    expect(connectionIsOpen(conn, opened, [])).toBe(true);
  });
});

describe("zoneAtCell", () => {
  it("derives zone from cell position", () => {
    const rooms = parseDungeonRooms({
      rooms: [{ name: "Entry", encounter: "rats" }],
    });
    const floor = synthesizeFloorsFromRooms(rooms)[0]!;
    const cell = floor.entrance!;
    const zone = zoneAtCell(floor, cell);
    expect(zone?.zoneId).toBe("entry");
    expect(sameCell(zone!.cells[0]!, cell)).toBe(true);
  });
});
