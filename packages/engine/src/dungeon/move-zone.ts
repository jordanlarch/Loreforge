import type { DraftEvent, EventMeta } from "../events/types";
import type { EntityRef, GridPosition } from "../entities/types";
import type { ExecutionContext } from "../commands/context";
import type { WorldState } from "../projections/world-state";
import {
  floorByIndex,
  movementBlockedByConnection,
  parseDungeonFloorSceneId,
  sameCell,
  zoneAtCell,
} from "./layout";
import { reject, type CommandResult } from "../commands/types";

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

/** Reject move when a closed dungeon connection blocks the destination. */
export function dungeonMovePrecheck(
  ctx: ExecutionContext,
  entityId: EntityRef,
  from: GridPosition,
  to: GridPosition,
): CommandResult | null {
  const entity = ctx.world.entities[entityId];
  if (!entity?.sceneId) return null;
  const parsed = parseDungeonFloorSceneId(entity.sceneId);
  if (!parsed) return null;
  const layout = ctx.world.dungeonLayouts?.[parsed.dungeonEntityId];
  if (!layout) return null;
  const floor = floorByIndex(layout, parsed.floorIndex);
  if (!floor) return null;
  const cleared = ctx.world.dungeonProgress?.clearedZoneIds ?? [];
  const block = movementBlockedByConnection(floor, layout, cleared, from, to);
  if (!block.blocked) return null;
  return reject(
    "CELL_BLOCKED",
    `A closed passage blocks (${to.x},${to.y}). Use the connection first.`,
    block.hint,
  );
}

/** Emit ZoneVisited when a move crosses into a new zone. */
export function dungeonZoneVisitEvents(
  ctx: ExecutionContext,
  entityId: EntityRef,
  from: GridPosition | undefined,
  to: GridPosition,
): DraftEvent[] {
  const entity = ctx.world.entities[entityId];
  if (!entity?.sceneId || !from) return [];
  const parsed = parseDungeonFloorSceneId(entity.sceneId);
  if (!parsed) return [];
  const layout = ctx.world.dungeonLayouts?.[parsed.dungeonEntityId];
  if (!layout) return [];
  const floor = floorByIndex(layout, parsed.floorIndex);
  if (!floor) return [];
  const fromZone = zoneAtCell(floor, from);
  const toZone = zoneAtCell(floor, to);
  if (!toZone || (fromZone && fromZone.zoneId === toZone.zoneId)) return [];
  if (
    ctx.world.dungeonProgress?.visitedZoneIds.includes(toZone.zoneId) &&
    fromZone?.zoneId === toZone.zoneId
  ) {
    return [];
  }
  return [
    {
      type: "ZoneVisited",
      ...meta(ctx, entityId),
      payload: {
        dungeonEntityId: parsed.dungeonEntityId,
        floorIndex: parsed.floorIndex,
        zoneId: toZone.zoneId,
        zoneName: toZone.name,
      },
    },
  ];
}

export function dungeonContextForScene(
  world: WorldState,
  sceneId: string | undefined,
): { dungeonEntityId: string; floorIndex: number } | undefined {
  if (!sceneId) return undefined;
  return parseDungeonFloorSceneId(sceneId);
}

export function zoneAtPosition(
  world: WorldState,
  dungeonEntityId: string,
  floorIndex: number,
  cell: GridPosition,
) {
  const layout = world.dungeonLayouts?.[dungeonEntityId];
  if (!layout) return undefined;
  const floor = floorByIndex(layout, floorIndex);
  if (!floor) return undefined;
  return zoneAtCell(floor, cell);
}

export function cellsEqual(
  a: GridPosition | undefined,
  b: GridPosition,
): boolean {
  return a !== undefined && sameCell(a, b);
}
