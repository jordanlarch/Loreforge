/**
 * DUN-2 — load/synthesize dungeon floors, position-derived zones, connection gating.
 */
import { parseDungeonRooms, zoneIdForRoomIndex, type ParsedDungeonRoom } from "./rooms";
import type {
  AuthoredDungeonFloor,
  AuthoredDungeonTrap,
  AuthoredDungeonZone,
  AuthoredDungeonZoneConnection,
  DungeonLayoutState,
  DungeonMapObject,
  DungeonNpcPlacement,
  DungeonZoneConnection,
  FloorTransition,
  GridCell,
  NormalizedDungeonFloor,
  NormalizedDungeonTrap,
  NormalizedDungeonZone,
  PatrolRoute,
  ZoneRect,
} from "./types";

export type { DungeonLayoutState, NormalizedDungeonFloor, NormalizedDungeonZone };

const STUB_ZONE_W = 4;
const STUB_ZONE_H = 4;
const STUB_GAP = 1;
const STUB_ORIGIN_X = 1;
const STUB_ORIGIN_Y = 2;
const STUB_MAP_HEIGHT = 12;

export function sameCell(a: GridCell, b: GridCell): boolean {
  return a.x === b.x && a.y === b.y;
}

export function cellKey(c: GridCell): string {
  return `${c.x},${c.y}`;
}

export function expandRectToCells(rect: ZoneRect): GridCell[] {
  const cells: GridCell[] = [];
  for (let dy = 0; dy < rect.h; dy++) {
    for (let dx = 0; dx < rect.w; dx++) {
      cells.push({ x: rect.x + dx, y: rect.y + dy });
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

function inferCorridorCells(
  fromCells: GridCell[],
  toCells: GridCell[],
): GridCell[] {
  if (fromCells.length === 0 || toCells.length === 0) return [];
  const fx = Math.max(...fromCells.map((c) => c.x));
  const tx = Math.min(...toCells.map((c) => c.x));
  if (tx <= fx) return [];
  const ys = [...fromCells, ...toCells].map((c) => c.y);
  const yMid = Math.round((Math.min(...ys) + Math.max(...ys)) / 2);
  const corridor: GridCell[] = [];
  for (let x = fx + 1; x < tx; x++) {
    corridor.push({ x, y: yMid });
  }
  if (corridor.length === 0 && tx === fx + 1) {
    corridor.push({ x: fx + 1, y: yMid });
  }
  return corridor;
}

function normalizeConnection(raw: AuthoredDungeonZoneConnection): DungeonZoneConnection {
  const fromCells = dedupeCells(raw.fromCells ?? []);
  const toCells = dedupeCells(raw.toCells ?? []);
  const corridorCells =
    raw.corridorCells && raw.corridorCells.length > 0
      ? dedupeCells(raw.corridorCells)
      : inferCorridorCells(fromCells, toCells);
  return {
    connectionId: raw.connectionId,
    toZoneId: raw.toZoneId,
    fromCells,
    toCells,
    corridorCells,
    locked: raw.locked,
    requiresCleared: raw.requiresCleared,
  };
}

function normalizeAuthoredTrap(
  raw: AuthoredDungeonTrap,
  zoneId: string,
  scope: NormalizedDungeonTrap["scope"],
  connectionId?: string,
): NormalizedDungeonTrap | undefined {
  if (!raw?.trapId || !raw.codexSlug?.trim()) return undefined;
  return {
    trapId: raw.trapId,
    codexSlug: raw.codexSlug.trim(),
    label: raw.label?.trim() || undefined,
    scope,
    zoneId,
    cell: raw.cell ? { ...raw.cell } : undefined,
    connectionId,
  };
}

function normalizeZoneTraps(raw: AuthoredDungeonZone): NormalizedDungeonTrap[] {
  const traps: NormalizedDungeonTrap[] = [];
  const seen = new Set<string>();
  for (const t of raw.traps ?? []) {
    const scope: NormalizedDungeonTrap["scope"] = t.cell ? "cell" : "zone";
    const norm = normalizeAuthoredTrap(t, raw.zoneId, scope);
    if (norm && !seen.has(norm.trapId)) {
      seen.add(norm.trapId);
      traps.push(norm);
    }
  }
  for (const conn of raw.connections ?? []) {
    for (const t of conn.traps ?? []) {
      const norm = normalizeAuthoredTrap(
        t,
        raw.zoneId,
        "connection",
        conn.connectionId,
      );
      if (norm && !seen.has(norm.trapId)) {
        seen.add(norm.trapId);
        traps.push(norm);
      }
    }
  }
  return traps;
}

function normalizeNpcPlacements(
  raw: AuthoredDungeonZone["npcPlacements"],
): DungeonNpcPlacement[] {
  if (!raw?.length) return [];
  const seen = new Set<string>();
  const out: DungeonNpcPlacement[] = [];
  for (const row of raw) {
    if (!row?.npcEntityId || seen.has(row.npcEntityId)) continue;
    seen.add(row.npcEntityId);
    out.push({
      npcEntityId: row.npcEntityId,
      cell: row.cell ? { ...row.cell } : undefined,
      label: row.label?.trim() || undefined,
    });
  }
  return out;
}

function normalizeZone(raw: AuthoredDungeonZone): NormalizedDungeonZone {
  let cells: GridCell[] = [];
  if (raw.rect) {
    cells = expandRectToCells(raw.rect);
  } else if (raw.cells) {
    cells = dedupeCells(raw.cells);
  }
  const connections = (raw.connections ?? []).map(normalizeConnection);
  return {
    zoneId: raw.zoneId,
    name: raw.name,
    cells,
    roomIndex: raw.roomIndex,
    encounter: raw.encounter,
    alertZoneOnDetection: raw.alertZoneOnDetection,
    connections,
    objects: normalizeObjects(raw.objects),
    traps: normalizeZoneTraps(raw),
    npcPlacements: normalizeNpcPlacements(raw.npcPlacements),
  };
}

function normalizeObjects(raw: AuthoredDungeonZone["objects"]): DungeonMapObject[] {
  if (!raw || raw.length === 0) return [];
  const seen = new Set<string>();
  const out: DungeonMapObject[] = [];
  for (const obj of raw) {
    if (!obj?.objectId || seen.has(obj.objectId)) continue;
    seen.add(obj.objectId);
    out.push({
      objectId: obj.objectId,
      kind: obj.kind ?? "interactable",
      cell: { ...obj.cell },
      noise: obj.noise,
      questRef: obj.questRef,
      codexItemSlug: obj.codexItemSlug?.trim() || undefined,
      label: obj.label?.trim() || undefined,
    });
  }
  return out;
}

function walkableCellsForFloor(floor: {
  zones: NormalizedDungeonZone[];
}): Set<string> {
  const walkable = new Set<string>();
  for (const zone of floor.zones) {
    for (const c of zone.cells) walkable.add(cellKey(c));
    for (const conn of zone.connections) {
      for (const c of conn.fromCells) walkable.add(cellKey(c));
      for (const c of conn.toCells) walkable.add(cellKey(c));
      for (const c of conn.corridorCells) walkable.add(cellKey(c));
    }
  }
  return walkable;
}

function buildBlockedCells(
  width: number,
  height: number,
  walkable: Set<string>,
): GridCell[] {
  const blocked: GridCell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!walkable.has(cellKey({ x, y }))) blocked.push({ x, y });
    }
  }
  return blocked;
}

function normalizeFloor(raw: AuthoredDungeonFloor): NormalizedDungeonFloor {
  const zones = raw.zones.map(normalizeZone);
  const walkable = walkableCellsForFloor({ zones });
  let width = raw.map?.width ?? 0;
  let height = raw.map?.height ?? STUB_MAP_HEIGHT;
  for (const k of walkable) {
    const [xs, ys] = k.split(",");
    width = Math.max(width, Number(xs) + 2);
    height = Math.max(height, Number(ys) + 2);
  }
  if (width < 8) width = 8;
  const blockedCells =
    raw.map?.blockedCells !== undefined
      ? dedupeCells(raw.map.blockedCells)
      : buildBlockedCells(width, height, walkable);
  return {
    index: raw.index,
    name: raw.name,
    map: { width, height, blockedCells },
    entrance: raw.entrance,
    zones,
    transitions: raw.transitions ?? [],
    patrolRoutes: normalizePatrolRoutes(raw.patrolRoutes),
  };
}

function normalizePatrolRoutes(raw: AuthoredDungeonFloor["patrolRoutes"]): PatrolRoute[] {
  if (!raw || raw.length === 0) return [];
  const seen = new Set<string>();
  const out: PatrolRoute[] = [];
  for (const route of raw) {
    if (!route?.patrolId || route.waypoints.length === 0 || seen.has(route.patrolId)) {
      continue;
    }
    seen.add(route.patrolId);
    out.push({
      patrolId: route.patrolId,
      creatureTemplateRef: route.creatureTemplateRef ?? "skeleton",
      waypoints: dedupeCells(route.waypoints),
      intervalMs: route.intervalMs,
    });
  }
  return out;
}

function slugifyRoomName(name: string, fallback: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || fallback;
}

/** Linear eastward stub chain per floor (Q47). */
export function synthesizeFloorsFromRooms(
  rooms: ParsedDungeonRoom[],
): NormalizedDungeonFloor[] {
  if (rooms.length === 0) return [];

  const byFloor = new Map<number, { room: ParsedDungeonRoom; globalIndex: number }[]>();
  rooms.forEach((room, globalIndex) => {
    const list = byFloor.get(room.floorIndex) ?? [];
    list.push({ room, globalIndex });
    byFloor.set(room.floorIndex, list);
  });

  const floors: NormalizedDungeonFloor[] = [];
  for (const floorIndex of [...byFloor.keys()].sort((a, b) => a - b)) {
    const entries = byFloor.get(floorIndex)!;
    const zones: NormalizedDungeonZone[] = [];

    entries.forEach(({ room, globalIndex }, localIndex) => {
      const x0 = STUB_ORIGIN_X + localIndex * (STUB_ZONE_W + STUB_GAP);
      const rect: ZoneRect = {
        x: x0,
        y: STUB_ORIGIN_Y,
        w: STUB_ZONE_W,
        h: STUB_ZONE_H,
      };
      const cells = expandRectToCells(rect);
      const zoneId = zoneIdForRoomIndex(globalIndex);
      const connections: DungeonZoneConnection[] = [];

      if (localIndex < entries.length - 1) {
        const nextGlobal = entries[localIndex + 1]!.globalIndex;
        const nextZoneId = zoneIdForRoomIndex(nextGlobal);
        const fromCells = [
          { x: x0 + STUB_ZONE_W - 1, y: STUB_ORIGIN_Y + 1 },
          { x: x0 + STUB_ZONE_W - 1, y: STUB_ORIGIN_Y + 2 },
        ];
        const nextX0 = STUB_ORIGIN_X + (localIndex + 1) * (STUB_ZONE_W + STUB_GAP);
        const toCells = [
          { x: nextX0, y: STUB_ORIGIN_Y + 1 },
          { x: nextX0, y: STUB_ORIGIN_Y + 2 },
        ];
        const corridorCells = [{ x: x0 + STUB_ZONE_W, y: STUB_ORIGIN_Y + 1 }];
        connections.push(
          normalizeConnection({
            connectionId: `${zoneId}-to-${nextZoneId}`,
            toZoneId: nextZoneId,
            fromCells,
            toCells,
            corridorCells,
          }),
        );
      }

      zones.push({
        zoneId,
        name: room.name,
        cells,
        roomIndex: globalIndex,
        encounter: room.encounter,
        connections,
        objects: [],
        traps: [],
        npcPlacements: [],
      });
    });

    const mapWidth =
      STUB_ORIGIN_X +
      entries.length * STUB_ZONE_W +
      Math.max(0, entries.length - 1) * STUB_GAP +
      2;
    const walkable = walkableCellsForFloor({ zones });
    const firstZone = zones[0]!;
    const entrance = firstZone.cells[0] ?? { x: STUB_ORIGIN_X, y: STUB_ORIGIN_Y + 1 };

    floors.push({
      index: floorIndex,
      name: floorIndex === 0 ? "Ground Level" : `Floor ${floorIndex + 1}`,
      map: {
        width: mapWidth,
        height: STUB_MAP_HEIGHT,
        blockedCells: buildBlockedCells(mapWidth, STUB_MAP_HEIGHT, walkable),
      },
      entrance,
      zones,
      transitions: [],
      patrolRoutes: [],
    });
  }

  return floors;
}

export function loadDungeonFloors(entityData: unknown): NormalizedDungeonFloor[] {
  if (!entityData || typeof entityData !== "object") return [];
  const data = entityData as Record<string, unknown>;

  if (Array.isArray(data.floors) && data.floors.length > 0) {
    const seen = new Set<string>();
    const floors: NormalizedDungeonFloor[] = [];
    for (const raw of data.floors) {
      if (!raw || typeof raw !== "object") continue;
      const floor = normalizeFloor(raw as AuthoredDungeonFloor);
      for (const zone of floor.zones) {
        if (seen.has(zone.zoneId)) {
          throw new Error(`Duplicate zoneId "${zone.zoneId}" in dungeon floors`);
        }
        seen.add(zone.zoneId);
      }
      floors.push(floor);
    }
    return floors.sort((a, b) => a.index - b.index);
  }

  const rooms = parseDungeonRooms(entityData);
  if (rooms.length > 0) {
    return synthesizeFloorsFromRooms(rooms);
  }

  const wanderers = data.wanderingMonsters;
  if (Array.isArray(wanderers) && wanderers.length > 0) {
    const label = String(wanderers[0] ?? "").trim();
    if (label) {
      return synthesizeFloorsFromRooms([
        { name: "Entry", encounter: label, floorIndex: 0 },
      ]);
    }
  }

  return [];
}

export function initialOpenedConnectionIds(
  floors: NormalizedDungeonFloor[],
): string[] {
  const ids: string[] = [];
  for (const floor of floors) {
    for (const zone of floor.zones) {
      for (const conn of zone.connections) {
        if (!conn.locked && !(conn.requiresCleared?.length ?? 0)) {
          ids.push(conn.connectionId);
        }
      }
    }
  }
  return ids;
}

export function buildLayoutState(
  floors: NormalizedDungeonFloor[],
): DungeonLayoutState {
  return {
    floors,
    openedConnectionIds: initialOpenedConnectionIds(floors),
  };
}

export function parseDungeonFloorSceneId(
  sceneId: string,
): { dungeonEntityId: string; floorIndex: number } | undefined {
  const prefix = "scene:realm:";
  if (!sceneId.startsWith(prefix)) return undefined;
  const rest = sceneId.slice(prefix.length);
  const marker = ":floor:";
  const idx = rest.lastIndexOf(marker);
  if (idx < 0) return undefined;
  const dungeonEntityId = rest.slice(0, idx);
  const floorIndex = parseInt(rest.slice(idx + marker.length), 10);
  if (!dungeonEntityId || Number.isNaN(floorIndex)) return undefined;
  return { dungeonEntityId, floorIndex };
}

export function sceneIdForDungeonFloor(
  dungeonEntityId: string,
  floorIndex: number,
): string {
  return `scene:realm:${dungeonEntityId}:floor:${floorIndex}`;
}

export function floorByIndex(
  layout: DungeonLayoutState,
  floorIndex: number,
): NormalizedDungeonFloor | undefined {
  return layout.floors.find((f) => f.index === floorIndex);
}

export function zoneAtCell(
  floor: NormalizedDungeonFloor,
  cell: GridCell,
): NormalizedDungeonZone | undefined {
  return floor.zones.find((z) => z.cells.some((c) => sameCell(c, cell)));
}

export function findConnectionOnFloor(
  floor: NormalizedDungeonFloor,
  connectionId: string,
): { zone: NormalizedDungeonZone; connection: DungeonZoneConnection } | undefined {
  for (const zone of floor.zones) {
    const connection = zone.connections.find((c) => c.connectionId === connectionId);
    if (connection) return { zone, connection };
  }
  return undefined;
}

export function findTransitionOnFloor(
  floor: NormalizedDungeonFloor,
  transitionId: string,
): FloorTransition | undefined {
  return floor.transitions.find((t) => t.transitionId === transitionId);
}

export function connectionRequirementsMet(
  conn: DungeonZoneConnection,
  clearedZoneIds: readonly string[],
): boolean {
  if (!conn.requiresCleared?.length) return true;
  return conn.requiresCleared.every((id) => clearedZoneIds.includes(id));
}

export function connectionIsOpen(
  conn: DungeonZoneConnection,
  layout: DungeonLayoutState,
  clearedZoneIds: readonly string[],
): boolean {
  if (layout.openedConnectionIds.includes(conn.connectionId)) return true;
  if (conn.locked) return false;
  if (!connectionRequirementsMet(conn, clearedZoneIds)) return false;
  return true;
}

function cellInList(cell: GridCell, list: GridCell[]): boolean {
  return list.some((c) => sameCell(c, cell));
}

/** True when a closed connection blocks stepping from → to. */
export function movementBlockedByConnection(
  floor: NormalizedDungeonFloor,
  layout: DungeonLayoutState,
  clearedZoneIds: readonly string[],
  from: GridCell,
  to: GridCell,
): { blocked: boolean; connectionId?: string; hint?: Record<string, unknown> } {
  for (const zone of floor.zones) {
    for (const conn of zone.connections) {
      if (connectionIsOpen(conn, layout, clearedZoneIds)) continue;
      const targetsCorridor =
        cellInList(to, conn.corridorCells) || cellInList(to, conn.toCells);
      const leavesThroughDoor =
        cellInList(from, conn.fromCells) ||
        zone.cells.some((c) => sameCell(c, from));
      if (targetsCorridor && (leavesThroughDoor || cellInList(from, conn.fromCells))) {
        const hint: Record<string, unknown> = { connectionId: conn.connectionId };
        if (conn.requiresCleared?.length) {
          hint.requiresCleared = conn.requiresCleared;
        }
        if (conn.locked) hint.locked = true;
        return { blocked: true, connectionId: conn.connectionId, hint };
      }
    }
  }
  return { blocked: false };
}

export function entityOnConnectionFromSide(
  cell: GridCell,
  conn: DungeonZoneConnection,
  zone: NormalizedDungeonZone,
): boolean {
  return (
    cellInList(cell, conn.fromCells) ||
    zone.cells.some((c) => sameCell(c, cell))
  );
}

/** Convert authored sample JSON (see dungeon-floor-samples.json) to layout state. */
export function layoutFromEntityData(entityData: unknown): DungeonLayoutState {
  return buildLayoutState(loadDungeonFloors(entityData));
}

/** Pick distinct cells inside a zone for spawning entities. */
export function cellsForEntitySpawn(
  zone: NormalizedDungeonZone,
  count: number,
): GridCell[] {
  if (zone.cells.length === 0) return [{ x: 1, y: 3 }];
  if (count <= 1) {
    return [zone.cells[Math.floor(zone.cells.length / 2)]!];
  }
  const step = Math.max(1, Math.floor(zone.cells.length / count));
  return Array.from({ length: count }, (_, i) => {
    const idx = Math.min(i * step, zone.cells.length - 1);
    return zone.cells[idx]!;
  });
}

export function findObjectInZone(
  zone: NormalizedDungeonZone,
  objectId: string,
): DungeonMapObject | undefined {
  return zone.objects.find((o) => o.objectId === objectId);
}

export function findObjectOnFloor(
  floor: NormalizedDungeonFloor,
  zoneId: string,
  objectId: string,
): { zone: NormalizedDungeonZone; object: DungeonMapObject } | undefined {
  const zone = floor.zones.find((z) => z.zoneId === zoneId);
  if (!zone) return undefined;
  const object = findObjectInZone(zone, objectId);
  if (!object) return undefined;
  return { zone, object };
}

export function cellsAdjacent(a: GridCell, b: GridCell): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

export function actorCanReachObject(
  actorCell: GridCell,
  objectCell: GridCell,
): boolean {
  return sameCell(actorCell, objectCell) || cellsAdjacent(actorCell, objectCell);
}
