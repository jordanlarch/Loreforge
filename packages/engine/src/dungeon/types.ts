/** DUN-2 — dungeon floor/zone layout (see docs/engine/dungeon-exploration.md §4). */

import type { GridPosition } from "../entities/types";

export type GridCell = GridPosition;

export type ObjectNoise = "silent" | "quiet" | "loud";

export type DungeonMapObject = {
  objectId: string;
  kind: string;
  cell: GridCell;
  noise?: ObjectNoise;
  questRef?: { templateId: string; stepId: string };
};

export type DungeonObjectState = {
  objectId: string;
  zoneId: string;
  takenByEntityId?: string;
};

export type ZoneRect = { x: number; y: number; w: number; h: number };

export type DungeonZoneConnection = {
  connectionId: string;
  toZoneId: string;
  fromCells: GridCell[];
  toCells: GridCell[];
  /** Walkable cells between zones (normalized on load). */
  corridorCells: GridCell[];
  locked?: boolean;
  requiresCleared?: string[];
};

export type NormalizedDungeonZone = {
  zoneId: string;
  name: string;
  cells: GridCell[];
  roomIndex?: number;
  /** Authored encounter text (from `data.rooms[]` until GENR-5 layout). */
  encounter?: string;
  alertZoneOnDetection?: boolean;
  connections: DungeonZoneConnection[];
  objects: DungeonMapObject[];
};

export type FloorTransition = {
  transitionId: string;
  toFloorIndex: number;
  fromCell: GridCell;
  toCell: GridCell;
};

export type NormalizedDungeonFloor = {
  index: number;
  name: string;
  map: { width: number; height: number; blockedCells: GridCell[] };
  entrance?: GridCell;
  zones: NormalizedDungeonZone[];
  transitions: FloorTransition[];
};

export type DungeonLayoutState = {
  floors: NormalizedDungeonFloor[];
  openedConnectionIds: string[];
};

/** Authored zone shape before normalization (§4). */
export type AuthoredDungeonZone = {
  zoneId: string;
  roomIndex?: number;
  name: string;
  cells?: GridCell[];
  rect?: ZoneRect;
  encounter?: string;
  alertZoneOnDetection?: boolean;
  connections?: Omit<DungeonZoneConnection, "corridorCells">[];
  objects?: DungeonMapObject[];
};

/** Authored floor shape before normalization (§4). */
export type AuthoredDungeonFloor = {
  index: number;
  name: string;
  map?: { width: number; height: number; blockedCells?: GridCell[] };
  entrance?: GridCell;
  zones: AuthoredDungeonZone[];
  transitions?: FloorTransition[];
};
