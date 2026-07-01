/**
 * DUN-8 — prep-only dungeon floor map editing helpers (Realms editor).
 */
import {
  emitDungeonFloorsFromRooms,
  loadDungeonFloors,
  parseDungeonRooms,
  type AuthoredDungeonFloor,
  type AuthoredDungeonZone,
  type DungeonMapObject,
  type GridCell,
  type NormalizedDungeonFloor,
} from "@app/engine";

export type DungeonMapTool = "select" | "wall" | "entrance" | "object";

export function dungeonCellKey(cell: GridCell): string {
  return `${cell.x},${cell.y}`;
}

export function parseAuthoredFloors(
  data: Record<string, unknown>,
): AuthoredDungeonFloor[] {
  if (!Array.isArray(data.floors)) return [];
  return data.floors.filter(
    (f): f is AuthoredDungeonFloor =>
      !!f && typeof f === "object" && Array.isArray((f as AuthoredDungeonFloor).zones),
  );
}

export function emitFloorsFromEntityData(
  data: Record<string, unknown>,
): AuthoredDungeonFloor[] {
  const rooms = parseDungeonRooms(data);
  if (rooms.length === 0) return [];
  return emitDungeonFloorsFromRooms(rooms, data);
}

export function normalizeAuthoredFloors(
  floors: AuthoredDungeonFloor[],
): NormalizedDungeonFloor[] {
  if (floors.length === 0) return [];
  return loadDungeonFloors({ floors });
}

function mapBounds(floor: AuthoredDungeonFloor): { width: number; height: number } {
  let maxX = floor.map?.width ?? 8;
  let maxY = floor.map?.height ?? 12;
  for (const zone of floor.zones) {
    if (zone.rect) {
      maxX = Math.max(maxX, zone.rect.x + zone.rect.w + 1);
      maxY = Math.max(maxY, zone.rect.y + zone.rect.h + 1);
    }
    for (const cell of zone.cells ?? []) {
      maxX = Math.max(maxX, cell.x + 2);
      maxY = Math.max(maxY, cell.y + 2);
    }
  }
  for (const cell of floor.map?.blockedCells ?? []) {
    maxX = Math.max(maxX, cell.x + 2);
    maxY = Math.max(maxY, cell.y + 2);
  }
  if (floor.entrance) {
    maxX = Math.max(maxX, floor.entrance.x + 2);
    maxY = Math.max(maxY, floor.entrance.y + 2);
  }
  return { width: maxX, height: maxY };
}

function withMap(
  floor: AuthoredDungeonFloor,
  blockedCells: GridCell[],
): AuthoredDungeonFloor {
  const bounds = mapBounds({
    ...floor,
    map: { width: floor.map?.width ?? 8, height: floor.map?.height ?? 12, blockedCells },
  });
  return {
    ...floor,
    map: {
      width: bounds.width,
      height: bounds.height,
      blockedCells,
    },
  };
}

export function toggleBlockedCell(
  floor: AuthoredDungeonFloor,
  cell: GridCell,
): AuthoredDungeonFloor {
  const blocked = [...(floor.map?.blockedCells ?? [])];
  const key = dungeonCellKey(cell);
  const idx = blocked.findIndex((c) => dungeonCellKey(c) === key);
  if (idx >= 0) blocked.splice(idx, 1);
  else blocked.push({ ...cell });
  return withMap(floor, blocked);
}

export function setFloorEntrance(
  floor: AuthoredDungeonFloor,
  cell: GridCell,
): AuthoredDungeonFloor {
  return { ...floor, entrance: { ...cell } };
}

export function zoneAtCell(
  normalized: NormalizedDungeonFloor,
  cell: GridCell,
): NormalizedDungeonFloor["zones"][number] | undefined {
  const key = dungeonCellKey(cell);
  return normalized.zones.find((zone) =>
    zone.cells.some((c) => dungeonCellKey(c) === key),
  );
}

export function toggleZoneObject(
  floor: AuthoredDungeonFloor,
  normalized: NormalizedDungeonFloor,
  cell: GridCell,
): AuthoredDungeonFloor {
  const zone = zoneAtCell(normalized, cell);
  if (!zone) return floor;

  const zones = floor.zones.map((z): AuthoredDungeonZone => {
    if (z.zoneId !== zone.zoneId) return z;
    const objects = [...(z.objects ?? [])];
    const key = dungeonCellKey(cell);
    const idx = objects.findIndex((o) => dungeonCellKey(o.cell) === key);
    if (idx >= 0) {
      objects.splice(idx, 1);
    } else {
      const objectId = `${zone.zoneId}-obj-${cell.x}-${cell.y}`;
      objects.push({
        objectId,
        kind: "interactable",
        cell: { ...cell },
        noise: "quiet",
      } satisfies DungeonMapObject);
    }
    return { ...z, objects };
  });

  return { ...floor, zones };
}

export function toggleConnectionLocked(
  floor: AuthoredDungeonFloor,
  zoneId: string,
  connectionId: string,
): AuthoredDungeonFloor {
  const zones = floor.zones.map((zone) => {
    if (zone.zoneId !== zoneId || !zone.connections) return zone;
    return {
      ...zone,
      connections: zone.connections.map((conn) =>
        conn.connectionId === connectionId
          ? { ...conn, locked: !conn.locked }
          : conn,
      ),
    };
  });
  return { ...floor, zones };
}

export function walkableCellKeys(normalized: NormalizedDungeonFloor): Set<string> {
  const walkable = new Set<string>();
  for (const zone of normalized.zones) {
    for (const cell of zone.cells) walkable.add(dungeonCellKey(cell));
    for (const conn of zone.connections) {
      for (const cell of conn.fromCells) walkable.add(dungeonCellKey(cell));
      for (const cell of conn.toCells) walkable.add(dungeonCellKey(cell));
      for (const cell of conn.corridorCells) walkable.add(dungeonCellKey(cell));
    }
  }
  return walkable;
}

export function zoneColor(zoneId: string): string {
  let hash = 0;
  for (let i = 0; i < zoneId.length; i += 1) {
    hash = zoneId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsla(${hue}, 45%, 42%, 0.35)`;
}
