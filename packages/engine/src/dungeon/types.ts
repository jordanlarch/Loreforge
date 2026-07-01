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
  /** Codex item slug when kind is loot (DUN-12). */
  codexItemSlug?: string;
  /** Display label (item name or custom). */
  label?: string;
};

/** Authored trap on a zone cell, whole zone, or connection (DUN-12). */
export type AuthoredDungeonTrap = {
  trapId: string;
  codexSlug: string;
  label?: string;
  /** When set, trap is on this cell; when omitted on a zone trap, applies to whole zone. */
  cell?: GridCell;
};

export type NormalizedDungeonTrap = {
  trapId: string;
  codexSlug: string;
  label?: string;
  scope: "cell" | "connection" | "zone";
  zoneId: string;
  cell?: GridCell;
  connectionId?: string;
};

export type DungeonNpcPlacement = {
  npcEntityId: string;
  cell?: GridCell;
  label?: string;
};

export type DungeonObjectState = {
  objectId: string;
  zoneId: string;
  takenByEntityId?: string;
};

export type ZoneRect = { x: number; y: number; w: number; h: number };

export type AuthoredDungeonZoneConnection = {
  connectionId: string;
  toZoneId: string;
  fromCells: GridCell[];
  toCells: GridCell[];
  corridorCells?: GridCell[];
  locked?: boolean;
  requiresCleared?: string[];
  traps?: AuthoredDungeonTrap[];
};

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
  traps: NormalizedDungeonTrap[];
  npcPlacements: DungeonNpcPlacement[];
};

export type FloorTransition = {
  transitionId: string;
  toFloorIndex: number;
  fromCell: GridCell;
  toCell: GridCell;
};

export type PatrolRoute = {
  patrolId: string;
  creatureTemplateRef: string;
  waypoints: GridCell[];
  /** ms between waypoint steps (DUN-6 default applied when omitted). */
  intervalMs?: number;
};

export type NormalizedDungeonFloor = {
  index: number;
  name: string;
  map: { width: number; height: number; blockedCells: GridCell[] };
  entrance?: GridCell;
  zones: NormalizedDungeonZone[];
  transitions: FloorTransition[];
  patrolRoutes: PatrolRoute[];
  /** Cells revealed for all party on first dungeon threshold enter (DUN-16 prep). */
  revealedCells?: GridCell[];
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
  connections?: AuthoredDungeonZoneConnection[];
  objects?: DungeonMapObject[];
  traps?: AuthoredDungeonTrap[];
  npcPlacements?: DungeonNpcPlacement[];
};

/** Authored floor shape before normalization (§4). */
export type AuthoredDungeonFloor = {
  index: number;
  name: string;
  map?: { width: number; height: number; blockedCells?: GridCell[] };
  entrance?: GridCell;
  zones: AuthoredDungeonZone[];
  transitions?: FloorTransition[];
  patrolRoutes?: PatrolRoute[];
  /** Starting revealed cells authored in prep; seeded on first threshold enter (DUN-16). */
  revealedCells?: GridCell[];
};
