/**
 * DUN-7 — emit authored `data.floors[]` from generator `rooms[]` (tree-growing layout).
 */
import { loadDungeonFloors } from "./layout";
import { parseDungeonRooms, zoneIdForRoomIndex, type ParsedDungeonRoom } from "./rooms";
import { resolveWanderingMonsterTemplate } from "./encounter-ref";
import type {
  AuthoredDungeonFloor,
  AuthoredDungeonZone,
  GridCell,
  PatrolRoute,
  ZoneRect,
} from "./types";

const ZONE_W = 4;
const ZONE_H = 4;
const GAP = 1;
const MIN_ORIGIN = 1;

type PlacedZone = {
  zoneId: string;
  name: string;
  roomIndex: number;
  encounter: string;
  rect: ZoneRect;
  connections: NonNullable<AuthoredDungeonZone["connections"]>;
};

function slugifyRoomName(name: string, fallback: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || fallback;
}

function uniqueZoneId(name: string, fallback: string, used: Set<string>): string {
  let base = slugifyRoomName(name, fallback);
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}-${suffix++}`;
  }
  used.add(id);
  return id;
}

function rectsOverlap(a: ZoneRect, b: ZoneRect): boolean {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}

function canPlace(rect: ZoneRect, placed: PlacedZone[]): boolean {
  if (rect.x < MIN_ORIGIN || rect.y < MIN_ORIGIN) return false;
  return !placed.some((p) => rectsOverlap(rect, p.rect));
}

const PLACEMENT_OFFSETS: { dx: number; dy: number; edge: "east" | "south" | "west" | "north" }[] = [
  { dx: ZONE_W + GAP, dy: 0, edge: "east" },
  { dx: 0, dy: ZONE_H + GAP, edge: "south" },
  { dx: -(ZONE_W + GAP), dy: 0, edge: "west" },
  { dx: 0, dy: -(ZONE_H + GAP), edge: "north" },
];

function edgeCells(
  rect: ZoneRect,
  edge: "east" | "south" | "west" | "north",
): GridCell[] {
  switch (edge) {
    case "east":
      return [
        { x: rect.x + rect.w - 1, y: rect.y + 1 },
        { x: rect.x + rect.w - 1, y: rect.y + 2 },
      ];
    case "west":
      return [
        { x: rect.x, y: rect.y + 1 },
        { x: rect.x, y: rect.y + 2 },
      ];
    case "south":
      return [
        { x: rect.x + 1, y: rect.y + rect.h - 1 },
        { x: rect.x + 2, y: rect.y + rect.h - 1 },
      ];
    case "north":
      return [
        { x: rect.x + 1, y: rect.y },
        { x: rect.x + 2, y: rect.y },
      ];
  }
}

function corridorBetween(
  from: ZoneRect,
  to: ZoneRect,
  fromEdge: "east" | "south" | "west" | "north",
): GridCell[] {
  const midFrom = edgeCells(from, fromEdge)[0]!;
  const opposite: Record<typeof fromEdge, "east" | "south" | "west" | "north"> = {
    east: "west",
    west: "east",
    south: "north",
    north: "south",
  };
  const midTo = edgeCells(to, opposite[fromEdge])[0]!;
  const corridor: GridCell[] = [];
  if (fromEdge === "east" || fromEdge === "west") {
    const y = midFrom.y;
    const xStart = Math.min(midFrom.x, midTo.x);
    const xEnd = Math.max(midFrom.x, midTo.x);
    for (let x = xStart + 1; x < xEnd; x++) corridor.push({ x, y });
    if (corridor.length === 0) corridor.push({ x: midFrom.x + (fromEdge === "east" ? 1 : -1), y });
  } else {
    const x = midFrom.x;
    const yStart = Math.min(midFrom.y, midTo.y);
    const yEnd = Math.max(midFrom.y, midTo.y);
    for (let y = yStart + 1; y < yEnd; y++) corridor.push({ x, y });
    if (corridor.length === 0) corridor.push({ x, y: midFrom.y + (fromEdge === "south" ? 1 : -1) });
  }
  return corridor;
}

function makeConnection(
  from: PlacedZone,
  to: PlacedZone,
  fromEdge: "east" | "south" | "west" | "north",
): NonNullable<AuthoredDungeonZone["connections"]>[number] & {
  corridorCells?: GridCell[];
} {
  const toEdge: Record<typeof fromEdge, "east" | "south" | "west" | "north"> = {
    east: "west",
    west: "east",
    south: "north",
    north: "south",
  };
  return {
    connectionId: `${from.zoneId}-to-${to.zoneId}`,
    toZoneId: to.zoneId,
    fromCells: edgeCells(from.rect, fromEdge),
    toCells: edgeCells(to.rect, toEdge[fromEdge]),
    corridorCells: corridorBetween(from.rect, to.rect, fromEdge),
  };
}

function patrolRouteForZone(
  zone: PlacedZone,
  creatureTemplateRef: string,
  patrolId: string,
): PatrolRoute {
  const { x, y, w, h } = zone.rect;
  return {
    patrolId,
    creatureTemplateRef,
    waypoints: [
      { x: x + 1, y: y + 1 },
      { x: x + w - 2, y: y + 1 },
      { x: x + w - 2, y: y + h - 2 },
      { x: x + 1, y: y + h - 2 },
    ],
  };
}

function emitFloorFromRooms(
  floorRooms: { room: ParsedDungeonRoom; globalIndex: number }[],
  floorIndex: number,
  entityData?: unknown,
): AuthoredDungeonFloor {
  const usedIds = new Set<string>();
  const placed: PlacedZone[] = [];

  floorRooms.forEach(({ room, globalIndex }, localIndex) => {
    const fallback = localIndex === 0 ? "entry" : zoneIdForRoomIndex(globalIndex);
    const zoneId = uniqueZoneId(room.name, fallback, usedIds);

    if (localIndex === 0) {
      placed.push({
        zoneId,
        name: room.name,
        roomIndex: globalIndex,
        encounter: room.encounter,
        rect: { x: MIN_ORIGIN, y: 2, w: ZONE_W, h: ZONE_H },
        connections: [],
      });
      return;
    }

    let attached = false;
    for (let parentIdx = placed.length - 1; parentIdx >= 0 && !attached; parentIdx--) {
      const parent = placed[parentIdx]!;
      for (const offset of PLACEMENT_OFFSETS) {
        const rect: ZoneRect = {
          x: parent.rect.x + offset.dx,
          y: parent.rect.y + offset.dy,
          w: ZONE_W,
          h: ZONE_H,
        };
        if (!canPlace(rect, placed)) continue;
        const child: PlacedZone = {
          zoneId,
          name: room.name,
          roomIndex: globalIndex,
          encounter: room.encounter,
          rect,
          connections: [],
        };
        parent.connections.push(makeConnection(parent, child, offset.edge));
        placed.push(child);
        attached = true;
        break;
      }
    }

    if (!attached) {
      const prev = placed[placed.length - 1]!;
      const rect: ZoneRect = {
        x: prev.rect.x + ZONE_W + GAP,
        y: prev.rect.y,
        w: ZONE_W,
        h: ZONE_H,
      };
      const child: PlacedZone = {
        zoneId,
        name: room.name,
        roomIndex: globalIndex,
        encounter: room.encounter,
        rect,
        connections: [],
      };
      prev.connections.push(makeConnection(prev, child, "east"));
      placed.push(child);
    }
  });

  if (placed.length >= 3) {
    const entry = placed[0]!;
    const last = placed[placed.length - 1]!;
    const alreadyLinked = entry.connections.some((c) => c.toZoneId === last.zoneId);
    if (!alreadyLinked) {
      for (const offset of PLACEMENT_OFFSETS) {
        if (
          last.rect.x + offset.dx === entry.rect.x &&
          last.rect.y + offset.dy === entry.rect.y
        ) {
          last.connections.push(makeConnection(last, entry, offset.edge));
          break;
        }
      }
    }
  }

  const patrolRoutes: PatrolRoute[] = [];
  const wander = resolveWanderingMonsterTemplate(entityData);
  const patrolZone = placed.length > 1 ? placed[1] : placed[0];
  if (wander && patrolZone) {
    patrolRoutes.push(
      patrolRouteForZone(
        patrolZone,
        wander.template,
        `${patrolZone.zoneId}-patrol`,
      ),
    );
  }

  const entryRect = placed[0]!.rect;
  return {
    index: floorIndex,
    name: floorIndex === 0 ? "Ground Level" : `Floor ${floorIndex + 1}`,
    entrance: { x: entryRect.x, y: entryRect.y + 1 },
    zones: placed.map((p) => ({
      zoneId: p.zoneId,
      name: p.name,
      roomIndex: p.roomIndex,
      encounter: p.encounter,
      rect: p.rect,
      connections: p.connections,
    })),
    transitions: [],
    patrolRoutes,
  };
}

/** Build authored floors[] from parsed rooms (DUN-7 generator layout). */
export function emitDungeonFloorsFromRooms(
  rooms: ParsedDungeonRoom[],
  entityData?: unknown,
): AuthoredDungeonFloor[] {
  if (rooms.length === 0) return [];

  const byFloor = new Map<number, { room: ParsedDungeonRoom; globalIndex: number }[]>();
  rooms.forEach((room, globalIndex) => {
    const list = byFloor.get(room.floorIndex) ?? [];
    list.push({ room, globalIndex });
    byFloor.set(room.floorIndex, list);
  });

  const floors: AuthoredDungeonFloor[] = [];
  for (const floorIndex of [...byFloor.keys()].sort((a, b) => a - b)) {
    floors.push(
      emitFloorFromRooms(byFloor.get(floorIndex)!, floorIndex, entityData),
    );
  }
  return floors;
}

/** Attach `floors[]` to dungeon entity data when absent (GENR-5 / DUN-7). */
export function enrichDungeonEntityData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (Array.isArray(data.floors) && data.floors.length > 0) {
    return data;
  }
  const rooms = parseDungeonRooms(data);
  if (rooms.length === 0) return data;

  const floors = emitDungeonFloorsFromRooms(rooms, data);
  if (floors.length === 0) return data;

  loadDungeonFloors({ floors });
  return { ...data, floors };
}
