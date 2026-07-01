import { describe, expect, it } from "vitest";

import samples from "../fixtures/dungeon-floor-samples.json";
import { loadDungeonFloors } from "./layout";
import { sceneTrapsFromFloor } from "./trap-bridge";

describe("sceneTrapsFromFloor (DUN-12)", () => {
  it("maps cell and connection traps to scene instances", () => {
    const floor = loadDungeonFloors({
      floors: [
        {
          ...samples.minimalTwoZoneFloor.floors[0],
          zones: [
            {
              ...samples.minimalTwoZoneFloor.floors[0]!.zones[0],
              traps: [
                {
                  trapId: "entry-needle",
                  codexSlug: "srd-2024_poison-needle",
                  label: "Poison Needle",
                  cell: { x: 2, y: 3 },
                },
              ],
              connections: [
                {
                  ...samples.minimalTwoZoneFloor.floors[0]!.zones[0]!.connections![0],
                  traps: [
                    {
                      trapId: "door-net",
                      codexSlug: "srd-2024_falling-net",
                      label: "Falling Net",
                    },
                  ],
                },
              ],
            },
            samples.minimalTwoZoneFloor.floors[0]!.zones[1],
          ],
        },
      ],
    })[0]!;

    const traps = sceneTrapsFromFloor(floor);
    expect(traps).toHaveLength(2);
    expect(traps.find((t) => t.instanceId === "entry-needle")?.position).toEqual({
      x: 2,
      y: 3,
    });
    expect(traps.find((t) => t.instanceId === "door-net")?.trapSlug).toBe(
      "srd-2024_falling-net",
    );
  });

  it("skips zone-wide traps without a grid cell", () => {
    const floor = loadDungeonFloors({
      floors: [
        {
          ...samples.zoneWithChest.floors[0],
          zones: [
            {
              ...samples.zoneWithChest.floors[0]!.zones[0],
              traps: [
                {
                  trapId: "zone-gas",
                  codexSlug: "srd-2024_poison-darts",
                  label: "Poison Darts",
                },
              ],
            },
          ],
        },
      ],
    })[0]!;

    expect(sceneTrapsFromFloor(floor)).toHaveLength(0);
  });
});
