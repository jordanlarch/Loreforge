import { describe, expect, it } from "vitest";

import { loadDungeonFloors } from "./layout";
import {
  emitDungeonFloorsFromRooms,
  enrichDungeonEntityData,
} from "./emit-layout";
import { parseDungeonRooms } from "./rooms";

describe("DUN-7 emit dungeon floors", () => {
  const sampleRooms = parseDungeonRooms({
    rooms: [
      { name: "Threshold of Tears", encounter: "2 goblins", floor: 0 },
      { name: "Bone Gallery", encounter: "skeleton patrol", floor: 0 },
      { name: "Deep Vault", encounter: "wraith", floor: 1 },
    ],
    wanderingMonsters: ["skeleton patrol"],
  });

  it("emits slug zone ids from room names", () => {
    const floors = emitDungeonFloorsFromRooms(sampleRooms, ["skeleton patrol"]);
    expect(floors).toHaveLength(2);
    const ground = floors[0]!;
    expect(ground.zones[0]?.zoneId).toBe("threshold-of-tears");
    expect(ground.zones[1]?.zoneId).toBe("bone-gallery");
    expect(floors[1]?.zones[0]?.zoneId).toBe("deep-vault");
  });

  it("uses tree-growing placement with connections (not a single line stub)", () => {
    const floors = emitDungeonFloorsFromRooms(sampleRooms);
    const ground = floors[0]!;
    expect(ground.zones.length).toBe(2);
    const entry = ground.zones[0]!;
    const gallery = ground.zones[1]!;
    expect(entry.connections?.some((c) => c.toZoneId === gallery.zoneId)).toBe(true);
    expect(
      gallery.rect!.x !== entry.rect!.x || gallery.rect!.y !== entry.rect!.y,
    ).toBe(true);
  });

  it("loads emitted floors through the layout loader", () => {
    const authored = emitDungeonFloorsFromRooms(sampleRooms, ["skeleton patrol"]);
    const normalized = loadDungeonFloors({ floors: authored });
    expect(normalized[0]?.zones.map((z) => z.zoneId)).toEqual([
      "threshold-of-tears",
      "bone-gallery",
    ]);
    expect(normalized[0]?.patrolRoutes[0]?.patrolId).toBe("bone-gallery-patrol");
  });

  it("enrichDungeonEntityData attaches floors when absent", () => {
    const enriched = enrichDungeonEntityData({
      rooms: [
        { name: "Entry Hall", encounter: "goblins" },
        { name: "Ossuary", encounter: "skeletons" },
      ],
    });
    expect(Array.isArray(enriched.floors)).toBe(true);
    expect((enriched.floors as unknown[]).length).toBe(1);
    expect(
      ((enriched.floors as { zones: { zoneId: string }[] }[])[0]?.zones ?? []).map(
        (z) => z.zoneId,
      ),
    ).toEqual(["entry-hall", "ossuary"]);
  });

  it("does not overwrite existing authored floors", () => {
    const existing = [{ index: 0, name: "Custom", zones: [{ zoneId: "custom", name: "X", rect: { x: 0, y: 0, w: 2, h: 2 } }] }];
    const enriched = enrichDungeonEntityData({
      floors: existing,
      rooms: [{ name: "Ignored", encounter: "goblins" }],
    });
    expect(enriched.floors).toEqual(existing);
  });
});
