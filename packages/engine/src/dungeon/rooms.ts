/** Parse Realms dungeon `data.rooms[]` without fixture dependencies (DUN-2). */

export type ParsedDungeonRoom = {
  name: string;
  encounter: string;
  summary?: string;
  floorIndex: number;
};

function parseAuthoredFloorIndex(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.floor(raw));
  }
  if (typeof raw === "string") {
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed)) return Math.max(0, parsed);
  }
  return 0;
}

/** Parse authored dungeon rooms from Realms entity `data.rooms`. */
export function parseDungeonRooms(data: unknown): ParsedDungeonRoom[] {
  if (!data || typeof data !== "object") return [];
  const rooms = (data as Record<string, unknown>).rooms;
  if (!Array.isArray(rooms)) return [];
  const parsed: ParsedDungeonRoom[] = [];
  for (const room of rooms) {
    if (!room || typeof room !== "object") continue;
    const obj = room as {
      name?: unknown;
      encounter?: unknown;
      summary?: unknown;
      floor?: unknown;
      floorIndex?: unknown;
      depth?: unknown;
    };
    const encounter =
      typeof obj.encounter === "string" ? obj.encounter.trim() : "";
    if (!encounter) continue;
    const name =
      typeof obj.name === "string" && obj.name.trim()
        ? obj.name.trim()
        : `Room ${parsed.length + 1}`;
    const summary =
      typeof obj.summary === "string" ? obj.summary.trim() : undefined;
    const floorIndex = parseAuthoredFloorIndex(
      obj.floor ?? obj.floorIndex ?? obj.depth,
    );
    parsed.push({ name, encounter, summary, floorIndex });
  }
  return parsed;
}

/** Stable zone id from room list index until authored zone layout ships (DUN-2). */
export function zoneIdForRoomIndex(roomIndex: number): string {
  return roomIndex === 0 ? "entry" : `zone-${roomIndex}`;
}

export function dungeonRoomAt(
  data: unknown,
  roomIndex: number,
): ParsedDungeonRoom | undefined {
  return parseDungeonRooms(data)[roomIndex];
}

export function dungeonFloorIndexAt(
  data: unknown,
  roomIndex: number,
): number {
  return dungeonRoomAt(data, roomIndex)?.floorIndex ?? 0;
}
