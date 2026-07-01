/**
 * DUN-5 — per-PC dungeon cell fog, zone discovery, scout share (see docs/engine/dungeon-exploration.md).
 */
import type { DraftEvent, EventMeta } from "../events/types";
import type { EntityRef, GridPosition, SceneId } from "../entities/types";
import type { ExecutionContext } from "../commands/context";
import type { WorldState } from "../projections/world-state";
import {
  cellKey,
  floorByIndex,
  parseDungeonFloorSceneId,
  sameCell,
  zoneAtCell,
} from "./layout";
import type { GridCell, NormalizedDungeonZone } from "./types";

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

export function revealedCellKeysFor(
  world: WorldState,
  entityId: EntityRef,
  sceneId: SceneId,
): Set<string> {
  return new Set(world.dungeonFog?.[entityId]?.[sceneId] ?? []);
}

function partyCharactersOnScene(world: WorldState, sceneId: SceneId) {
  return Object.values(world.entities).filter(
    (e) =>
      e.kind === "character" &&
      !e.id.startsWith("npc:") &&
      e.sceneId === sceneId,
  );
}

function visionCellsAt(position: GridPosition): GridCell[] {
  const cells: GridCell[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      cells.push({ x: position.x + dx, y: position.y + dy });
    }
  }
  return cells;
}

function dedupeCells(cells: GridCell[]): GridCell[] {
  const seen = new Set<string>();
  const out: GridCell[] = [];
  for (const c of cells) {
    const k = cellKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

function filterUnrevealed(
  world: WorldState,
  entityId: EntityRef,
  sceneId: SceneId,
  cells: GridCell[],
  batchRevealed: Set<string>,
): GridCell[] {
  const existing = revealedCellKeysFor(world, entityId, sceneId);
  return cells.filter((c) => {
    const k = cellKey(c);
    return !existing.has(k) && !batchRevealed.has(k);
  });
}

function appendFogAndDiscovery(
  ctx: ExecutionContext,
  entityId: EntityRef,
  sceneId: SceneId,
  cells: GridCell[],
  events: DraftEvent[],
  batchRevealed: Set<string>,
  batchDiscovered: Set<string>,
  zonesOverride?: NormalizedDungeonZone[],
): void {
  const fresh = filterUnrevealed(ctx.world, entityId, sceneId, cells, batchRevealed);
  if (fresh.length === 0) return;

  for (const c of fresh) {
    batchRevealed.add(cellKey(c));
  }

  events.push({
    type: "FogRevealed",
    ...meta(ctx, entityId),
    payload: {
      entity: entityId,
      sceneId,
      cells: fresh,
    },
  });

  const parsed = parseDungeonFloorSceneId(sceneId);
  if (!parsed) return;
  const layout = ctx.world.dungeonLayouts?.[parsed.dungeonEntityId];
  const floor = layout ? floorByIndex(layout, parsed.floorIndex) : undefined;
  const zones = zonesOverride ?? floor?.zones;
  if (!zones) return;

  const alreadyDiscovered = new Set([
    ...(ctx.world.dungeonProgress?.discoveredZoneIds ?? []),
    ...batchDiscovered,
  ]);

  for (const zone of zones) {
    if (alreadyDiscovered.has(zone.zoneId)) continue;
    const touched = fresh.some((c) => zone.cells.some((zc) => sameCell(zc, c)));
    if (!touched) continue;
    batchDiscovered.add(zone.zoneId);
    events.push({
      type: "ZoneDiscovered",
      ...meta(ctx, entityId),
      payload: {
        dungeonEntityId: parsed.dungeonEntityId,
        floorIndex: parsed.floorIndex,
        zoneId: zone.zoneId,
        zoneName: zone.name,
        discovererId: entityId,
      },
    });
  }
}

/** Reveal fog around a move destination; whole zone on zone cross. */
export function dungeonFogRevealEvents(
  ctx: ExecutionContext,
  entityId: EntityRef,
  from: GridPosition | undefined,
  to: GridPosition,
  sceneIdOverride?: SceneId,
): DraftEvent[] {
  const entity = ctx.world.entities[entityId];
  const sceneId = sceneIdOverride ?? entity?.sceneId;
  if (!sceneId) return [];
  const parsed = parseDungeonFloorSceneId(sceneId);
  if (!parsed) return [];

  const layout = ctx.world.dungeonLayouts?.[parsed.dungeonEntityId];
  const floor = layout ? floorByIndex(layout, parsed.floorIndex) : undefined;
  if (!floor) return [];

  const events: DraftEvent[] = [];
  const batchRevealed = new Set<string>();
  const batchDiscovered = new Set<string>();

  let cells = visionCellsAt(to);
  const fromZone = from ? zoneAtCell(floor, from) : undefined;
  const toZone = zoneAtCell(floor, to);
  if (toZone && (!fromZone || fromZone.zoneId !== toZone.zoneId)) {
    cells = dedupeCells([...cells, ...toZone.cells]);
  }

  appendFogAndDiscovery(
    ctx,
    entityId,
    sceneId,
    cells,
    events,
    batchRevealed,
    batchDiscovered,
  );
  return events;
}

/** Reveal all cells in a zone for one or more entities (threshold entry). */
export function dungeonFogRevealZoneEvents(
  ctx: ExecutionContext,
  entityIds: EntityRef[],
  sceneId: SceneId,
  dungeonEntityId: string,
  floorIndex: number,
  zoneId: string,
  zoneCells?: GridCell[],
  zonesOverride?: NormalizedDungeonZone[],
): DraftEvent[] {
  let cells = zoneCells;
  if (!cells) {
    const layout = ctx.world.dungeonLayouts?.[dungeonEntityId];
    const floor = layout ? floorByIndex(layout, floorIndex) : undefined;
    cells = floor?.zones.find((z) => z.zoneId === zoneId)?.cells;
  }
  if (!cells || cells.length === 0) return [];

  const events: DraftEvent[] = [];
  const batchRevealed = new Set<string>();
  const batchDiscovered = new Set<string>();

  for (const entityId of entityIds) {
    appendFogAndDiscovery(
      ctx,
      entityId,
      sceneId,
      cells,
      events,
      batchRevealed,
      batchDiscovered,
      zonesOverride,
    );
  }
  return events;
}

/** Seed prep-authored starting revealed cells for all party on threshold enter (DUN-16). */
export function dungeonFogSeedAuthoredEvents(
  ctx: ExecutionContext,
  entityIds: EntityRef[],
  sceneId: SceneId,
  cells: GridCell[],
  zonesOverride?: NormalizedDungeonZone[],
): DraftEvent[] {
  if (cells.length === 0) return [];

  const events: DraftEvent[] = [];
  const batchRevealed = new Set<string>();
  const batchDiscovered = new Set<string>();

  for (const entityId of entityIds) {
    appendFogAndDiscovery(
      ctx,
      entityId,
      sceneId,
      cells,
      events,
      batchRevealed,
      batchDiscovered,
      zonesOverride,
    );
  }
  return events;
}

export function shareScoutRevealEvents(
  ctx: ExecutionContext,
  scoutId: EntityRef,
): { events: DraftEvent[] } | { code: string; error: string } {
  const scout = ctx.world.entities[scoutId];
  if (!scout?.sceneId) {
    return { code: "ACTOR_NOT_FOUND", error: `Scout ${scoutId} is not on the map.` };
  }
  const parsed = parseDungeonFloorSceneId(scout.sceneId);
  if (!parsed) {
    return {
      code: "INVALID_PAYLOAD",
      error: "Scout must be on a dungeon floor to share a report.",
    };
  }

  const scoutFog = ctx.world.dungeonFog?.[scoutId]?.[scout.sceneId] ?? [];
  if (scoutFog.length === 0) {
    return {
      code: "INVALID_PAYLOAD",
      error: "The scout has not revealed any cells to share.",
    };
  }

  const cells: GridCell[] = scoutFog.map((k) => {
    const [xs, ys] = k.split(",");
    return { x: Number(xs), y: Number(ys) };
  });

  const recipients = partyCharactersOnScene(ctx.world, scout.sceneId).filter(
    (e) => e.id !== scoutId,
  );
  if (recipients.length === 0) {
    return {
      code: "INVALID_PAYLOAD",
      error: "No other party members are on this floor to receive the report.",
    };
  }

  const events: DraftEvent[] = [];
  const batchDiscovered = new Set<string>();
  const recipientIds: EntityRef[] = [];

  for (const recipient of recipients) {
    const batchRevealed = new Set<string>();
    const before = filterUnrevealed(
      ctx.world,
      recipient.id,
      scout.sceneId,
      cells,
      batchRevealed,
    );
    if (before.length === 0) continue;
    recipientIds.push(recipient.id);
    appendFogAndDiscovery(
      ctx,
      recipient.id,
      scout.sceneId,
      cells,
      events,
      batchRevealed,
      batchDiscovered,
    );
  }

  if (recipientIds.length === 0) {
    return {
      code: "INVALID_PAYLOAD",
      error: "Party members already have the scout's revealed area.",
    };
  }

  events.unshift({
    type: "ScoutRevealShared",
    ...meta(ctx, scoutId),
    payload: {
      scoutId,
      sceneId: scout.sceneId,
      recipientIds,
      cells: dedupeCells(cells),
    },
  });

  return { events };
}

export function revealAreaEvents(
  ctx: ExecutionContext,
  sceneId: SceneId,
  cells: GridCell[],
  forEntity?: EntityRef,
): { events: DraftEvent[] } | { code: string; error: string } {
  const parsed = parseDungeonFloorSceneId(sceneId);
  if (!parsed) {
    return {
      code: "INVALID_PAYLOAD",
      error: "reveal_area applies to dungeon floor scenes only.",
    };
  }
  if (cells.length === 0) {
    return { code: "INVALID_PAYLOAD", error: "No cells specified to reveal." };
  }

  const targets = forEntity
    ? ctx.world.entities[forEntity]
      ? [ctx.world.entities[forEntity]]
      : []
    : partyCharactersOnScene(ctx.world, sceneId);

  if (targets.length === 0) {
    return {
      code: "ACTOR_NOT_FOUND",
      error: forEntity
        ? `Entity ${forEntity} is not on scene ${sceneId}.`
        : "No party characters are on this scene.",
    };
  }

  const events: DraftEvent[] = [];
  const batchRevealed = new Set<string>();
  const batchDiscovered = new Set<string>();

  for (const target of targets) {
    appendFogAndDiscovery(
      ctx,
      target.id,
      sceneId,
      cells,
      events,
      batchRevealed,
      batchDiscovered,
    );
  }

  if (events.length === 0) {
    return {
      code: "INVALID_PAYLOAD",
      error: "Those cells are already revealed for the target(s).",
    };
  }

  return { events };
}
