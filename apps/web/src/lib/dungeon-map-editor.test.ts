import { describe, expect, it } from "vitest";

import samples from "../../../../packages/engine/src/fixtures/dungeon-floor-samples.json";

import type { AuthoredDungeonFloor } from "@app/engine";

import {
  addCellTrap,
  cellTrapAt,
  dungeonCellKey,
  emitFloorsFromEntityData,
  lootObjectAt,
  normalizeAuthoredFloors,
  npcAtCell,
  parseAuthoredFloors,
  placeLootObject,
  placeNpcOnCell,
  setFloorEntrance,
  toggleBlockedCell,
  toggleConnectionLocked,
  toggleZoneObject,
  walkableCellKeys,
  zoneAtCell,
} from "./dungeon-map-editor";

describe("dungeon-map-editor", () => {
  const sampleFloor = samples.minimalTwoZoneFloor.floors[0]!;

  it("parses authored floors from entity data", () => {
    const floors = parseAuthoredFloors({ floors: [sampleFloor] });
    expect(floors).toHaveLength(1);
    expect(floors[0]?.zones[0]?.zoneId).toBe("entry");
  });

  it("emits floors from rooms when absent", () => {
    const floors = emitFloorsFromEntityData({
      rooms: [
        { name: "Entry Hall", encounter: "goblins" },
        { name: "Ossuary", encounter: "skeletons" },
      ],
    });
    expect(floors[0]?.zones.map((z: { zoneId: string }) => z.zoneId)).toEqual([
      "entry-hall",
      "ossuary",
    ]);
  });

  it("toggles blocked cells and expands map bounds", () => {
    const next = toggleBlockedCell(sampleFloor, { x: 0, y: 0 });
    expect(next.map?.blockedCells?.some((c: { x: number; y: number }) => dungeonCellKey(c) === "0,0")).toBe(
      true,
    );
    expect((next.map?.width ?? 0) >= 8).toBe(true);
  });

  it("sets entrance cell", () => {
    const next = setFloorEntrance(sampleFloor, { x: 2, y: 2 });
    expect(next.entrance).toEqual({ x: 2, y: 2 });
  });

  it("adds and removes zone objects", () => {
    const [normalized] = normalizeAuthoredFloors([sampleFloor]);
    const cell = { x: 2, y: 3 };
    const withObj = toggleZoneObject(sampleFloor, normalized!, cell);
    const zone = withObj.zones[0]!;
    expect(zone.objects?.some((o: { cell: { x: number; y: number } }) => dungeonCellKey(o.cell) === dungeonCellKey(cell))).toBe(
      true,
    );
    const withoutObj = toggleZoneObject(withObj, normalized!, cell);
    expect(
      withoutObj.zones[0]?.objects?.some(
        (o: { cell: { x: number; y: number } }) => dungeonCellKey(o.cell) === dungeonCellKey(cell),
      ),
    ).toBe(false);
  });

  it("toggles connection locked flag", () => {
    const next = toggleConnectionLocked(sampleFloor, "entry", "entry-to-ossuary");
    expect(next.zones[0]?.connections?.[0]?.locked).toBe(false);
    const again = toggleConnectionLocked(next, "entry", "entry-to-ossuary");
    expect(again.zones[0]?.connections?.[0]?.locked).toBe(true);
  });

  it("finds zone at cell and walkable keys", () => {
    const [normalized] = normalizeAuthoredFloors([sampleFloor]);
    const zone = zoneAtCell(normalized!, { x: 2, y: 3 });
    expect(zone?.zoneId).toBe("entry");
    const walkable = walkableCellKeys(normalized!);
    expect(walkable.has("2,3")).toBe(true);
    expect(walkable.has("5,3")).toBe(true);
  });

  it("places loot, traps, and NPCs on cells (DUN-12)", () => {
    const [normalized] = normalizeAuthoredFloors([sampleFloor]);
    const cell = { x: 2, y: 3 };
    let floor: AuthoredDungeonFloor = sampleFloor;

    floor = placeLootObject(floor, normalized!, cell, {
      codexSlug: "srd-2024_longsword",
      label: "Longsword",
    });
    expect(lootObjectAt(floor, cell)?.codexItemSlug).toBe("srd-2024_longsword");

    floor = addCellTrap(floor, normalized!, cell, {
      codexSlug: "srd-2024_falling-net",
      label: "Falling Net",
    });
    expect(cellTrapAt(floor, cell)?.codexSlug).toContain("falling-net");

    floor = placeNpcOnCell(floor, normalized!, cell, {
      npcEntityId: "npc-1",
      label: "Warden",
    });
    expect(npcAtCell(floor, cell)?.npcEntityId).toBe("npc-1");
  });
});
