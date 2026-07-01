/**
 * RUNG-4 — per-room dungeon exploration state (rooms-as-entities lite).
 */
import type { DraftEvent, EventMeta } from "../events/types";
import type { WorldState } from "../projections/world-state";
import type { CampaignStartingLocation } from "../fixtures/exploration";
import type { ExecutionContext } from "./context";
import type {
  AdvanceDungeonRoomCommand,
  CommandResult,
  EnterDungeonRoomCommand,
  MarkDungeonRoomClearedCommand,
} from "./types";
import { reject } from "./types";

const EXPLORATION_STARTS = [
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

function sceneIdForDungeonRoom(
  dungeonEntityId: string,
  roomIndex: number,
): string {
  return `scene:realm:${dungeonEntityId}:room:${roomIndex}`;
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

function enterDungeonRoomEvents(
  ctx: ExecutionContext,
  cmd: EnterDungeonRoomCommand,
): DraftEvent[] {
  const sceneId = sceneIdForDungeonRoom(cmd.dungeonEntityId, cmd.roomIndex);
  const map = DUNGEON_MAP;
  const events: DraftEvent[] = [];

  if (!ctx.world.scenes[sceneId]) {
    events.push({
      type: "SceneCreated",
      ...meta(ctx),
      payload: {
        scene: {
          id: sceneId,
          name: cmd.roomName,
          description: `${cmd.locationName} — ${cmd.roomName}`,
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

  events.push({
    type: "SceneChanged",
    ...meta(ctx),
    payload: { sceneId },
  });

  const partyEntities = Object.values(ctx.world.entities).filter(
    (e) => e.kind === "character" && !e.id.startsWith("npc:"),
  );
  partyEntities.forEach((entity, i) => {
    events.push({
      type: "EntityRelocated",
      ...meta(ctx, entity.id),
      payload: {
        entity: entity.id,
        sceneId,
        position: EXPLORATION_STARTS[i] ?? EXPLORATION_STARTS[0]!,
      },
    });
  });

  events.push({
    type: "DungeonRoomEntered",
    ...meta(ctx),
    payload: {
      dungeonEntityId: cmd.dungeonEntityId,
      roomIndex: cmd.roomIndex,
      roomName: cmd.roomName,
    },
  });

  return events;
}

export function handleEnterDungeonRoom(
  cmd: EnterDungeonRoomCommand,
  ctx: ExecutionContext,
): CommandResult {
  return {
    accepted: true,
    events: enterDungeonRoomEvents(ctx, cmd),
    summary: {
      dungeonEntityId: cmd.dungeonEntityId,
      roomIndex: cmd.roomIndex,
      roomName: cmd.roomName,
    },
  };
}

export function handleMarkDungeonRoomCleared(
  cmd: MarkDungeonRoomClearedCommand,
  ctx: ExecutionContext,
): CommandResult {
  const progress = ctx.world.dungeonProgress;
  if (
    !progress ||
    progress.dungeonEntityId !== cmd.dungeonEntityId ||
    progress.currentRoomIndex !== cmd.roomIndex
  ) {
    return reject(
      "INVALID_PAYLOAD",
      "No active dungeon room matches this clear event.",
    );
  }
  if (progress.clearedRooms.includes(cmd.roomIndex)) {
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
        type: "DungeonRoomCleared",
        ...meta(ctx),
        payload: {
          dungeonEntityId: cmd.dungeonEntityId,
          roomIndex: cmd.roomIndex,
          roomName: cmd.roomName,
        },
      },
    ],
    summary: { cleared: cmd.roomIndex },
  };
}

export function handleAdvanceDungeonRoom(
  cmd: AdvanceDungeonRoomCommand,
  ctx: ExecutionContext,
): CommandResult {
  if (ctx.world.encounter) {
    return reject(
      "ACTION_UNAVAILABLE",
      "Cannot change dungeon rooms during combat.",
    );
  }
  const progress = ctx.world.dungeonProgress;
  if (!progress || progress.dungeonEntityId !== cmd.dungeonEntityId) {
    return reject("INVALID_PAYLOAD", "The party is not in this dungeon.");
  }
  if (cmd.roomIndex !== progress.currentRoomIndex + 1) {
    return reject(
      "INVALID_PAYLOAD",
      "You can only advance to the next dungeon room in order.",
    );
  }
  if (!progress.clearedRooms.includes(progress.currentRoomIndex)) {
    return reject(
      "ACTION_UNAVAILABLE",
      "Clear the current room before advancing deeper.",
    );
  }
  return handleEnterDungeonRoom(
    {
      type: "enter_dungeon_room",
      dungeonEntityId: cmd.dungeonEntityId,
      roomIndex: cmd.roomIndex,
      roomName: cmd.roomName,
      locationName: cmd.locationName,
    },
    ctx,
  );
}

/** After a victorious dungeon combat, queue a room-cleared command when applicable. */
export function dungeonRoomClearCommand(
  state: WorldState,
  location: CampaignStartingLocation,
  entityData?: unknown,
): MarkDungeonRoomClearedCommand | undefined {
  if (location.type !== "dungeon") return undefined;
  const progress = state.dungeonProgress;
  if (!progress || progress.dungeonEntityId !== location.entityId) {
    return undefined;
  }
  const roomIndex = progress.currentRoomIndex;
  if (progress.clearedRooms.includes(roomIndex)) return undefined;
  const rooms = (entityData && typeof entityData === "object"
    ? (entityData as Record<string, unknown>).rooms
    : undefined) as unknown;
  let roomName = `Room ${roomIndex + 1}`;
  if (Array.isArray(rooms) && rooms[roomIndex] && typeof rooms[roomIndex] === "object") {
    const name = (rooms[roomIndex] as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) roomName = name.trim();
  }
  return {
    type: "mark_dungeon_room_cleared",
    dungeonEntityId: location.entityId,
    roomIndex,
    roomName,
  };
}
