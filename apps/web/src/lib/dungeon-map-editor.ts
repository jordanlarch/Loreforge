/**
 * DUN-8 — prep-only dungeon floor map editing helpers (Realms editor).
 */
import {
  emitDungeonFloorsFromRooms,
  loadDungeonFloors,
  parseDungeonRooms,
  type AuthoredDungeonFloor,
  type AuthoredDungeonTrap,
  type AuthoredDungeonZone,
  type DungeonMapObject,
  type DungeonNpcPlacement,
  type GridCell,
  type NormalizedDungeonFloor,
} from "@app/engine";

export type DungeonMapTool =
  | "select"
  | "wall"
  | "entrance"
  | "object"
  | "loot"
  | "trap"
  | "npc";

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

function updateZone(
  floor: AuthoredDungeonFloor,
  zoneId: string,
  patch: (zone: AuthoredDungeonZone) => AuthoredDungeonZone,
): AuthoredDungeonFloor {
  return {
    ...floor,
    zones: floor.zones.map((z) => (z.zoneId === zoneId ? patch(z) : z)),
  };
}

function newTrapId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

export function cellTrapAt(
  floor: AuthoredDungeonFloor,
  cell: GridCell,
): AuthoredDungeonTrap | undefined {
  const key = dungeonCellKey(cell);
  for (const zone of floor.zones) {
    const trap = (zone.traps ?? []).find(
      (t) => t.cell && dungeonCellKey(t.cell) === key,
    );
    if (trap) return trap;
  }
  return undefined;
}

export function addCellTrap(
  floor: AuthoredDungeonFloor,
  normalized: NormalizedDungeonFloor,
  cell: GridCell,
  pick: { codexSlug: string; label: string },
): AuthoredDungeonFloor {
  const zone = zoneAtCell(normalized, cell);
  if (!zone) return floor;
  const trap: AuthoredDungeonTrap = {
    trapId: newTrapId(`${zone.zoneId}-trap`),
    codexSlug: pick.codexSlug,
    label: pick.label,
    cell: { ...cell },
  };
  return updateZone(floor, zone.zoneId, (z) => ({
    ...z,
    traps: [...(z.traps ?? []).filter((t) => !t.cell || dungeonCellKey(t.cell) !== dungeonCellKey(cell)), trap],
  }));
}

export function removeCellTrap(
  floor: AuthoredDungeonFloor,
  normalized: NormalizedDungeonFloor,
  cell: GridCell,
): AuthoredDungeonFloor {
  const zone = zoneAtCell(normalized, cell);
  if (!zone) return floor;
  const key = dungeonCellKey(cell);
  return updateZone(floor, zone.zoneId, (z) => ({
    ...z,
    traps: (z.traps ?? []).filter((t) => !t.cell || dungeonCellKey(t.cell) !== key),
  }));
}

export function addConnectionTrap(
  floor: AuthoredDungeonFloor,
  zoneId: string,
  connectionId: string,
  pick: { codexSlug: string; label: string },
): AuthoredDungeonFloor {
  const trap: AuthoredDungeonTrap = {
    trapId: newTrapId(`${connectionId}-trap`),
    codexSlug: pick.codexSlug,
    label: pick.label,
  };
  return updateZone(floor, zoneId, (z) => ({
    ...z,
    connections: (z.connections ?? []).map((conn) =>
      conn.connectionId === connectionId
        ? {
            ...conn,
            traps: [...(conn.traps ?? []), trap],
          }
        : conn,
    ),
  }));
}

export function removeConnectionTrap(
  floor: AuthoredDungeonFloor,
  zoneId: string,
  trapId: string,
): AuthoredDungeonFloor {
  return updateZone(floor, zoneId, (z) => ({
    ...z,
    connections: (z.connections ?? []).map((conn) => ({
      ...conn,
      traps: (conn.traps ?? []).filter((t) => t.trapId !== trapId),
    })),
  }));
}

export function addZoneTrap(
  floor: AuthoredDungeonFloor,
  zoneId: string,
  pick: { codexSlug: string; label: string },
): AuthoredDungeonFloor {
  const trap: AuthoredDungeonTrap = {
    trapId: newTrapId(`${zoneId}-zone-trap`),
    codexSlug: pick.codexSlug,
    label: pick.label,
  };
  return updateZone(floor, zoneId, (z) => ({
    ...z,
    traps: [...(z.traps ?? []), trap],
  }));
}

export function removeZoneTrap(
  floor: AuthoredDungeonFloor,
  zoneId: string,
  trapId: string,
): AuthoredDungeonFloor {
  return updateZone(floor, zoneId, (z) => ({
    ...z,
    traps: (z.traps ?? []).filter((t) => t.trapId !== trapId),
  }));
}

export function lootObjectAt(
  floor: AuthoredDungeonFloor,
  cell: GridCell,
): DungeonMapObject | undefined {
  const key = dungeonCellKey(cell);
  for (const zone of floor.zones) {
    const obj = (zone.objects ?? []).find(
      (o) => o.kind === "loot" && dungeonCellKey(o.cell) === key,
    );
    if (obj) return obj;
  }
  return undefined;
}

export function placeLootObject(
  floor: AuthoredDungeonFloor,
  normalized: NormalizedDungeonFloor,
  cell: GridCell,
  pick: { codexSlug: string; label: string },
): AuthoredDungeonFloor {
  const zone = zoneAtCell(normalized, cell);
  if (!zone) return floor;
  const objectId = `${zone.zoneId}-loot-${cell.x}-${cell.y}`;
  const object: DungeonMapObject = {
    objectId,
    kind: "loot",
    cell: { ...cell },
    noise: "silent",
    codexItemSlug: pick.codexSlug,
    label: pick.label,
  };
  return updateZone(floor, zone.zoneId, (z) => {
    const objects = [...(z.objects ?? [])].filter(
      (o) => !(o.kind === "loot" && dungeonCellKey(o.cell) === dungeonCellKey(cell)),
    );
    objects.push(object);
    return { ...z, objects };
  });
}

export function removeLootObject(
  floor: AuthoredDungeonFloor,
  normalized: NormalizedDungeonFloor,
  cell: GridCell,
): AuthoredDungeonFloor {
  const zone = zoneAtCell(normalized, cell);
  if (!zone) return floor;
  const key = dungeonCellKey(cell);
  return updateZone(floor, zone.zoneId, (z) => ({
    ...z,
    objects: (z.objects ?? []).filter(
      (o) => !(o.kind === "loot" && dungeonCellKey(o.cell) === key),
    ),
  }));
}

export function npcAtCell(
  floor: AuthoredDungeonFloor,
  cell: GridCell,
): DungeonNpcPlacement | undefined {
  const key = dungeonCellKey(cell);
  for (const zone of floor.zones) {
    const npc = (zone.npcPlacements ?? []).find(
      (n) => n.cell && dungeonCellKey(n.cell) === key,
    );
    if (npc) return npc;
  }
  return undefined;
}

export function placeNpcOnCell(
  floor: AuthoredDungeonFloor,
  normalized: NormalizedDungeonFloor,
  cell: GridCell,
  pick: { npcEntityId: string; label: string },
): AuthoredDungeonFloor {
  const zone = zoneAtCell(normalized, cell);
  if (!zone) return floor;
  const key = dungeonCellKey(cell);
  const placement: DungeonNpcPlacement = {
    npcEntityId: pick.npcEntityId,
    label: pick.label,
    cell: { ...cell },
  };
  return updateZone(floor, zone.zoneId, (z) => ({
    ...z,
    npcPlacements: [
      ...(z.npcPlacements ?? []).filter(
        (n) => !n.cell || dungeonCellKey(n.cell) !== key,
      ),
      placement,
    ],
  }));
}

export function removeNpcAtCell(
  floor: AuthoredDungeonFloor,
  normalized: NormalizedDungeonFloor,
  cell: GridCell,
): AuthoredDungeonFloor {
  const zone = zoneAtCell(normalized, cell);
  if (!zone) return floor;
  const key = dungeonCellKey(cell);
  return updateZone(floor, zone.zoneId, (z) => ({
    ...z,
    npcPlacements: (z.npcPlacements ?? []).filter(
      (n) => !n.cell || dungeonCellKey(n.cell) !== key,
    ),
  }));
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
