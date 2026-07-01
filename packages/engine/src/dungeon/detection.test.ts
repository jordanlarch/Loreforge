import { describe, expect, it } from "vitest";

import {
  detectionEventsInZone,
  isAutoUndetectable,
  isPassivelyDetected,
  passivePerception,
  passiveStealth,
  rosterForZoneEncounter,
} from "./detection";
import type { NormalizedDungeonZone } from "./types";
import type { ExecutionContext } from "../commands/context";
import type { WorldState } from "../projections/world-state";

const zone: NormalizedDungeonZone = {
  zoneId: "entry",
  name: "Entry",
  cells: [
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
  ],
  connections: [],
  alertZoneOnDetection: true,
  objects: [],
  traps: [],
  npcPlacements: [],
};

function ctxFor(world: WorldState): ExecutionContext {
  return {
    campaignId: "test",
    commandId: "cmd-1",
    timestamp: 1,
    actor: "char:hero",
    world,
  } as unknown as ExecutionContext;
}

describe("passive detection", () => {
  it("compares passive Perception vs passive Stealth", () => {
    const observer = {
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
      conditions: [],
    };
    const target = {
      abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      skillProficiencies: [] as string[],
      proficiencyBonus: 2,
      conditions: [],
    };
    expect(passivePerception(observer as never)).toBe(12);
    expect(passiveStealth(target as never)).toBe(12);
    expect(isPassivelyDetected(observer as never, target as never)).toBe(true);
  });

  it("skips auto-detection for invisible targets", () => {
    const observer = {
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 },
      conditions: [],
    };
    const target = {
      abilityScores: { str: 8, dex: 8, con: 10, int: 10, wis: 8, cha: 8 },
      conditions: [{ condition: "invisible" as const }],
      skillProficiencies: [] as string[],
      proficiencyBonus: 2,
    };
    expect(isAutoUndetectable(target as never)).toBe(true);
    expect(isPassivelyDetected(observer as never, target as never)).toBe(false);
  });
});

describe("detectionEventsInZone", () => {
  it("emits CreatureDetected and ZoneAlerted on hostile detection", () => {
    const sceneId = "scene:realm:dungeon:floor:0";
    const world = {
      entities: {
        "char:hero": {
          id: "char:hero",
          kind: "character",
          name: "Hero",
          abilityScores: { str: 14, dex: 14, con: 14, int: 10, wis: 14, cha: 10 },
          sceneId,
          position: { x: 1, y: 2 },
          alive: true,
          conditions: [],
          classes: [{ class: "Fighter", level: 1 }],
        },
        "npc:foe:0": {
          id: "npc:foe:0",
          kind: "monster",
          name: "Goblin",
          abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
          sceneId,
          position: { x: 3, y: 2 },
          alive: true,
          conditions: [],
        },
      },
      scenes: {
        [sceneId]: { id: sceneId, name: "Floor", map: { width: 8, height: 8, blockedCells: [] } },
      },
      dungeonProgress: {
        dungeonEntityId: "dungeon",
        thresholdOpened: true,
        currentFloorIndex: 0,
        visitedZoneIds: [],
        clearedZoneIds: [],
      },
    } as unknown as WorldState;

    const events = detectionEventsInZone(
      ctxFor(world),
      "dungeon",
      0,
      zone,
      sceneId,
    );

    expect(events.some((e) => e.type === "CreatureDetected")).toBe(true);
    expect(events.some((e) => e.type === "ZoneAlerted")).toBe(true);
  });
});

describe("rosterForZoneEncounter", () => {
  it("includes visible party and hostiles but excludes invisible until detected", () => {
    const sceneId = "scene:realm:dungeon:floor:0";
    const world = {
      entities: {
        "char:hero": {
          id: "char:hero",
          kind: "character",
          name: "Hero",
          abilityScores: { str: 14, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
          sceneId,
          position: { x: 1, y: 2 },
          alive: true,
          conditions: [],
          classes: [{ class: "Fighter", level: 1 }],
        },
        "npc:foe:0": {
          id: "npc:foe:0",
          kind: "monster",
          name: "Goblin",
          abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
          sceneId,
          position: { x: 2, y: 2 },
          alive: true,
          conditions: [],
        },
        "npc:foe:1": {
          id: "npc:foe:1",
          kind: "monster",
          name: "Hidden Goblin",
          abilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
          sceneId,
          position: { x: 3, y: 2 },
          alive: true,
          conditions: [{ condition: "invisible" }],
        },
      },
      scenes: {
        [sceneId]: { id: sceneId, name: "Floor", map: { width: 8, height: 8, blockedCells: [] } },
      },
    } as unknown as WorldState;

    const roster = rosterForZoneEncounter(world, zone, sceneId);
    expect(roster).toContain("char:hero");
    expect(roster).toContain("npc:foe:0");
    expect(roster).not.toContain("npc:foe:1");
  });
});
