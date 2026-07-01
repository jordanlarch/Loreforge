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
  type NormalizedDungeonZone,
} from "@app/engine";

export type ZoneRect = { x: number; y: number; w: number; h: number };

export type FloorTransition = {
  transitionId: string;
  toFloorIndex: number;
  fromCell: GridCell;
  toCell: GridCell;
};

export type DungeonMapTool =
  | "select"
  | "zone"
  | "wall"
  | "entrance"
  | "stair"
  | "object"
  | "loot"
  | "trap"
  | "npc"
  | "fog";

export type ZoneResizeHandle =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

const MIN_ZONE_W = 2;
const MIN_ZONE_H = 2;
const MIN_ZONE_ORIGIN = 0;

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

export function startingRevealedCellKeys(floor: AuthoredDungeonFloor): Set<string> {
  return new Set((floor.revealedCells ?? []).map(dungeonCellKey));
}

export function toggleStartingRevealedCell(
  floor: AuthoredDungeonFloor,
  normalized: NormalizedDungeonFloor,
  cell: GridCell,
): AuthoredDungeonFloor {
  const walkable = walkableCellKeys(normalized);
  const key = dungeonCellKey(cell);
  if (!walkable.has(key)) return floor;

  const next = startingRevealedCellKeys(floor);
  if (next.has(key)) next.delete(key);
  else next.add(key);

  const revealedCells = [...next].map((k) => {
    const [xs, ys] = k.split(",");
    return { x: Number(xs), y: Number(ys) };
  });
  return {
    ...floor,
    revealedCells: revealedCells.length > 0 ? revealedCells : undefined,
  };
}

export function clearStartingRevealedCells(
  floor: AuthoredDungeonFloor,
): AuthoredDungeonFloor {
  if (!floor.revealedCells?.length) return floor;
  const { revealedCells: _removed, ...rest } = floor;
  return rest;
}

export function zoneColor(zoneId: string): string {
  let hash = 0;
  for (let i = 0; i < zoneId.length; i += 1) {
    hash = zoneId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsla(${hue}, 45%, 42%, 0.35)`;
}

export function inferAuthoredZoneRect(
  zone: AuthoredDungeonZone,
  normalized?: NormalizedDungeonZone,
): ZoneRect | null {
  if (zone.rect) return { ...zone.rect };
  const cells = normalized?.cells ?? zone.cells;
  if (!cells?.length) return null;
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs) + 1,
    h: Math.max(...ys) - Math.min(...ys) + 1,
  };
}

export function clampZoneRect(rect: ZoneRect): ZoneRect {
  let { x, y, w, h } = rect;
  w = Math.max(MIN_ZONE_W, w);
  h = Math.max(MIN_ZONE_H, h);
  x = Math.max(MIN_ZONE_ORIGIN, x);
  y = Math.max(MIN_ZONE_ORIGIN, y);
  return { x, y, w, h };
}

export function applyZoneRectResize(
  start: ZoneRect,
  handle: ZoneResizeHandle,
  deltaX: number,
  deltaY: number,
): ZoneRect {
  let { x, y, w, h } = start;
  if (handle.includes("e")) w += deltaX;
  if (handle.includes("w")) {
    x += deltaX;
    w -= deltaX;
  }
  if (handle.includes("s")) h += deltaY;
  if (handle.includes("n")) {
    y += deltaY;
    h -= deltaY;
  }
  return clampZoneRect({ x, y, w, h });
}

export function setZoneRect(
  floor: AuthoredDungeonFloor,
  zoneId: string,
  rect: ZoneRect,
): AuthoredDungeonFloor {
  const nextRect = clampZoneRect(rect);
  const zones = floor.zones.map((zone): AuthoredDungeonZone => {
    if (zone.zoneId !== zoneId) return zone;
    const { cells: _cells, ...rest } = zone;
    return { ...rest, rect: nextRect };
  });
  const nextFloor: AuthoredDungeonFloor = { ...floor, zones };
  const bounds = mapBounds(nextFloor);
  return {
    ...nextFloor,
    map: {
      width: bounds.width,
      height: bounds.height,
      blockedCells: floor.map?.blockedCells ?? [],
    },
  };
}

function defaultLandingCell(floor: AuthoredDungeonFloor): GridCell {
  return floor.entrance ? { ...floor.entrance } : { x: 2, y: 3 };
}

export function addDungeonFloor(
  floors: AuthoredDungeonFloor[],
): AuthoredDungeonFloor[] {
  const nextIndex =
    floors.length === 0 ? 0 : Math.max(...floors.map((f) => f.index)) + 1;
  const newFloor: AuthoredDungeonFloor = {
    index: nextIndex,
    name: nextIndex === 0 ? "Ground Level" : `Floor ${nextIndex + 1}`,
    entrance: { x: 2, y: 3 },
    zones: [
      {
        zoneId: `floor-${nextIndex}-room`,
        name: "New Room",
        rect: { x: 1, y: 2, w: 4, h: 4 },
      },
    ],
    transitions: [],
  };
  return [...floors, newFloor];
}

export function addFloorTransition(
  floors: AuthoredDungeonFloor[],
  fromFloorIndex: number,
  toFloorIndex: number,
  fromCell?: GridCell,
): AuthoredDungeonFloor[] {
  const source = floors.find((f) => f.index === fromFloorIndex);
  const target = floors.find((f) => f.index === toFloorIndex);
  if (!source || !target || fromFloorIndex === toFloorIndex) return floors;

  const transitionId = `stairs-${fromFloorIndex}-to-${toFloorIndex}`;
  const sourceCell = fromCell ?? defaultLandingCell(source);
  const destCell = defaultLandingCell(target);
  const outbound: FloorTransition = {
    transitionId,
    toFloorIndex,
    fromCell: { ...sourceCell },
    toCell: { ...destCell },
  };
  const inbound: FloorTransition = {
    transitionId: `${transitionId}-return`,
    toFloorIndex: fromFloorIndex,
    fromCell: { ...destCell },
    toCell: { ...sourceCell },
  };

  return floors.map((floor) => {
    if (floor.index === fromFloorIndex) {
      const existing = (floor.transitions ?? []).filter(
        (t) => t.transitionId !== transitionId,
      );
      return { ...floor, transitions: [...existing, outbound] };
    }
    if (floor.index === toFloorIndex) {
      const existing = (floor.transitions ?? []).filter(
        (t) => t.transitionId !== inbound.transitionId,
      );
      return { ...floor, transitions: [...existing, inbound] };
    }
    return floor;
  });
}

export function removeFloorTransition(
  floors: AuthoredDungeonFloor[],
  fromFloorIndex: number,
  transitionId: string,
): AuthoredDungeonFloor[] {
  const source = floors.find((f) => f.index === fromFloorIndex);
  const transition = source?.transitions?.find((t) => t.transitionId === transitionId);
  if (!source || !transition) return floors;

  const returnId = `${transitionId}-return`;
  return floors.map((floor) => ({
    ...floor,
    transitions: (floor.transitions ?? []).filter(
      (t) => t.transitionId !== transitionId && t.transitionId !== returnId,
    ),
  }));
}

export function updateFloorTransitionCell(
  floors: AuthoredDungeonFloor[],
  fromFloorIndex: number,
  transitionId: string,
  endpoint: "from" | "to",
  cell: GridCell,
): AuthoredDungeonFloor[] {
  const source = floors.find((f) => f.index === fromFloorIndex);
  const transition = source?.transitions?.find((t) => t.transitionId === transitionId);
  if (!source || !transition) return floors;

  const returnId = `${transitionId}-return`;
  return floors.map((floor) => {
    if (floor.index === fromFloorIndex) {
      return {
        ...floor,
        transitions: (floor.transitions ?? []).map((t) =>
          t.transitionId === transitionId
            ? endpoint === "from"
              ? { ...t, fromCell: { ...cell } }
              : { ...t, toCell: { ...cell } }
            : t,
        ),
      };
    }
    if (floor.index === transition.toFloorIndex) {
      return {
        ...floor,
        transitions: (floor.transitions ?? []).map((t) =>
          t.transitionId === returnId
            ? endpoint === "from"
              ? { ...t, toCell: { ...cell } }
              : { ...t, fromCell: { ...cell } }
            : t,
        ),
      };
    }
    return floor;
  });
}

export function transitionCellsOnFloor(
  floor: AuthoredDungeonFloor,
): Map<string, { transitionId: string; direction: "out" | "in" }> {
  const cells = new Map<string, { transitionId: string; direction: "out" | "in" }>();
  for (const t of floor.transitions ?? []) {
    if (t.transitionId.endsWith("-return")) {
      cells.set(dungeonCellKey(t.fromCell), {
        transitionId: t.transitionId,
        direction: "in",
      });
    } else {
      cells.set(dungeonCellKey(t.fromCell), {
        transitionId: t.transitionId,
        direction: "out",
      });
    }
  }
  return cells;
}
