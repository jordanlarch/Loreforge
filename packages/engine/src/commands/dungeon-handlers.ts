/**
 * DUN-1 — dungeon threshold entry + zone progress (see docs/engine/dungeon-exploration.md).
 * One scene per floor; player-driven movement (no auto-relocate on zone change).
 */
import type { DraftEvent, EventMeta } from "../events/types";
import type { WorldState } from "../projections/world-state";
import type { CampaignStartingLocation } from "../fixtures/exploration";
import type { ExecutionContext } from "./context";
import type {
  CommandResult,
  EnterDungeonCommand,
  MarkZoneClearedCommand,
} from "./types";
import { reject } from "./types";

const ENTRANCE_STARTS = [
  { x: 1, y: 3 },
  { x: 1, y: 4 },
  { x: 1, y: 5 },
  { x: 1, y: 6 },
] as const;

const DUNGEON_MAP = {
  width: 14,
  height: 12,
  blockedCells: [
    { x: 2, y: 2 },
    { x: 7, y: 2 },
    { x: 4, y: 5 },
    { x: 9, y: 2 },
    { x: 10, y: 6 },
  ],
};

function zoneIdForRoomIndex(roomIndex: number): string {
  return roomIndex === 0 ? "entry" : `zone-${roomIndex}`;
}

function sceneIdForDungeonFloor(
  dungeonEntityId: string,
  floorIndex: number,
): string {
  return `scene:realm:${dungeonEntityId}:floor:${floorIndex}`;
}

function floorSceneLabel(locationName: string, floorIndex: number): string {
  return floorIndex === 0
    ? `${locationName} — Ground Level`
    : `${locationName} — Floor ${floorIndex + 1}`;
}

function meta(
  ctx: ExecutionContext,
  actor?: string,
): Omit<EventMeta, "sequence"> {
  return {
    campaignId: ctx.campaignId,
    timestamp: ctx.timestamp,
    causedByCommandId: ctx.commandId,
    actor: actor ?? ctx.actor,
  };
}

function partyCharacters(ctx: ExecutionContext) {
  return Object.values(ctx.world.entities).filter(
    (e) => e.kind === "character" && !e.id.startsWith("npc:"),
  );
}

function enterDungeonEvents(
  ctx: ExecutionContext,
  cmd: EnterDungeonCommand,
): DraftEvent[] {
  const sceneId = sceneIdForDungeonFloor(cmd.dungeonEntityId, cmd.floorIndex);
  const map = DUNGEON_MAP;
  const events: DraftEvent[] = [];
  const progress = ctx.world.dungeonProgress;
  const firstThreshold =
    !progress?.thresholdOpened ||
    progress.dungeonEntityId !== cmd.dungeonEntityId;
  const sceneExists = Boolean(ctx.world.scenes[sceneId]);
  const sceneChanged = ctx.world.currentSceneId !== sceneId;

  if (!sceneExists) {
    events.push({
      type: "SceneCreated",
      ...meta(ctx),
      payload: {
        scene: {
          id: sceneId,
          name: floorSceneLabel(cmd.locationName, cmd.floorIndex),
          description: `${cmd.locationName} — ${floorSceneLabel(cmd.locationName, cmd.floorIndex)}`,
          sceneKind: "dungeon",
          map: {
            width: map.width,
            height: map.height,
            blockedCells: map.blockedCells,
          },
        },
      },
    });
  }

  if (sceneChanged) {
    events.push({
      type: "SceneChanged",
      ...meta(ctx),
      payload: { sceneId },
    });
  }

  if (firstThreshold) {
    partyCharacters(ctx).forEach((entity, i) => {
      events.push({
        type: "EntityRelocated",
        ...meta(ctx, entity.id),
        payload: {
          entity: entity.id,
          sceneId,
          position: ENTRANCE_STARTS[i] ?? ENTRANCE_STARTS[0]!,
        },
      });
    });

    events.push({
      type: "DungeonThresholdOpened",
      ...meta(ctx),
      payload: {
        dungeonEntityId: cmd.dungeonEntityId,
        floorIndex: cmd.floorIndex,
        entryZoneId: cmd.entryZoneId,
        locationName: cmd.locationName,
      },
    });
  }

  events.push({
    type: "ZoneVisited",
    ...meta(ctx),
    payload: {
      dungeonEntityId: cmd.dungeonEntityId,
      floorIndex: cmd.floorIndex,
      zoneId: cmd.entryZoneId,
      zoneName: cmd.zoneName,
    },
  });

  return events;
}

export function handleEnterDungeon(
  cmd: EnterDungeonCommand,
  ctx: ExecutionContext,
): CommandResult {
  return {
    accepted: true,
    events: enterDungeonEvents(ctx, cmd),
    summary: {
      dungeonEntityId: cmd.dungeonEntityId,
      floorIndex: cmd.floorIndex,
      entryZoneId: cmd.entryZoneId,
      zoneName: cmd.zoneName,
      firstThreshold:
        !ctx.world.dungeonProgress?.thresholdOpened ||
        ctx.world.dungeonProgress.dungeonEntityId !== cmd.dungeonEntityId,
    },
  };
}

export function handleMarkZoneCleared(
  cmd: MarkZoneClearedCommand,
  ctx: ExecutionContext,
): CommandResult {
  const progress = ctx.world.dungeonProgress;
  if (!progress || progress.dungeonEntityId !== cmd.dungeonEntityId) {
    return reject(
      "INVALID_PAYLOAD",
      "The party is not in this dungeon.",
    );
  }
  if (progress.clearedZoneIds.includes(cmd.zoneId)) {
    return {
      accepted: true,
      events: [],
      summary: { alreadyCleared: true },
    };
  }
  return {
    accepted: true,
    events: [
      {
        type: "ZoneCleared",
        ...meta(ctx),
        payload: {
          dungeonEntityId: cmd.dungeonEntityId,
          zoneId: cmd.zoneId,
          zoneName: cmd.zoneName,
        },
      },
    ],
    summary: { cleared: cmd.zoneId },
  };
}

/** After victorious dungeon combat, queue zone-cleared when an entry encounter applies. */
export function dungeonZoneClearCommand(
  state: WorldState,
  location: CampaignStartingLocation,
  entityData?: unknown,
): MarkZoneClearedCommand | undefined {
  if (location.type !== "dungeon") return undefined;
  const progress = state.dungeonProgress;
  if (!progress || progress.dungeonEntityId !== location.entityId) {
    return undefined;
  }
  const zoneId =
    progress.activeEncounterZoneId ?? zoneIdForRoomIndex(0);
  if (progress.clearedZoneIds.includes(zoneId)) return undefined;

  const rooms = (entityData && typeof entityData === "object"
    ? (entityData as Record<string, unknown>).rooms
    : undefined) as unknown;
  let zoneName = "Entry";
  if (Array.isArray(rooms) && rooms[0] && typeof rooms[0] === "object") {
    const name = (rooms[0] as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) zoneName = name.trim();
  }

  return {
    type: "mark_zone_cleared",
    dungeonEntityId: location.entityId,
    zoneId,
    zoneName,
  };
}

/** @deprecated Use {@link dungeonZoneClearCommand}. */
export const dungeonRoomClearCommand = dungeonZoneClearCommand;
