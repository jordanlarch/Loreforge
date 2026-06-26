import type {
  CampaignOverworldMapLayer,
  OverworldGridConfig,
} from "@app/db";
import type { RealmEntityType } from "@/lib/realms";

/** Pixel size of one overworld grid cell in the prep/play canvas. */
export const OVERWORLD_CELL_PX = 28;

export type OverworldTool = "pan" | "select" | "paint-region" | "paint-settlement" | "pin" | "erase";

export type OverworldEntity = {
  id: string;
  membershipId: string;
  name: string;
  type: RealmEntityType;
  discovered: boolean;
  overworldMap: CampaignOverworldMapLayer;
};

export type OverworldCell = { col: number; row: number };

export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function parseCellKey(key: string): OverworldCell | null {
  const [colRaw, rowRaw] = key.split(",");
  const col = Number(colRaw);
  const row = Number(rowRaw);
  if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || row < 0) {
    return null;
  }
  return { col, row };
}

export function isTerritoryType(type: RealmEntityType): boolean {
  return type === "region" || type === "settlement";
}

export function isPinType(type: RealmEntityType): boolean {
  return (
    type === "building" ||
    type === "tavern" ||
    type === "shop" ||
    type === "dungeon" ||
    type === "npc" ||
    type === "faction"
  );
}

export function toolForEntityType(type: RealmEntityType): OverworldTool | null {
  if (type === "region") return "paint-region";
  if (type === "settlement") return "paint-settlement";
  if (isPinType(type)) return "pin";
  return null;
}

export function cellInBounds(
  col: number,
  row: number,
  grid: OverworldGridConfig,
): boolean {
  return col >= 0 && row >= 0 && col < grid.width && row < grid.height;
}

/** Which entity owns a cell (territory paint), if any. Later entries win ties. */
export function ownerAtCell(
  entities: readonly OverworldEntity[],
  col: number,
  row: number,
): OverworldEntity | undefined {
  const key = cellKey(col, row);
  for (let i = entities.length - 1; i >= 0; i--) {
    const entity = entities[i]!;
    if (entity.overworldMap.territory?.includes(key)) return entity;
  }
  return undefined;
}

export function territoryCells(entity: OverworldEntity): Set<string> {
  return new Set(entity.overworldMap.territory ?? []);
}

export function applyTerritoryCells(
  layer: CampaignOverworldMapLayer,
  cells: Iterable<string>,
): CampaignOverworldMapLayer {
  return { ...layer, territory: [...new Set(cells)] };
}

export function toggleTerritoryCell(
  layer: CampaignOverworldMapLayer,
  col: number,
  row: number,
  add: boolean,
): CampaignOverworldMapLayer {
  const key = cellKey(col, row);
  const next = new Set(layer.territory ?? []);
  if (add) next.add(key);
  else next.delete(key);
  return applyTerritoryCells(layer, next);
}

/** Settlement cells must stay inside a parent region's territory. */
export function filterCellsWithinRegion(
  cells: Iterable<string>,
  regionTerritory: ReadonlySet<string>,
): string[] {
  return [...cells].filter((key) => regionTerritory.has(key));
}

export function pinAtCell(
  entities: readonly OverworldEntity[],
  col: number,
  row: number,
): OverworldEntity | undefined {
  return entities.find(
    (e) =>
      e.overworldMap.pin?.col === col &&
      e.overworldMap.pin?.row === row,
  );
}

/** Resolve parent region id for a settlement via `located_in` edges. */
export function parentRegionId(
  entityId: string,
  regionIds: ReadonlySet<string>,
  locatedIn: ReadonlyMap<string, string>,
): string | undefined {
  let current = locatedIn.get(entityId);
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if (regionIds.has(current)) return current;
    current = locatedIn.get(current);
  }
  return undefined;
}

export function buildLocatedInMap(
  edges: readonly { fromId: string; toId: string; kind: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const edge of edges) {
    if (edge.kind === "located_in") {
      map.set(edge.fromId, edge.toId);
    }
  }
  return map;
}

/**
 * Deterministic starter layout when a campaign has linked entities but no painted
 * territories yet (UX-3 migration path from the old pin-board canvas).
 */
export function seedOverworldLayout(
  entities: readonly OverworldEntity[],
  grid: OverworldGridConfig,
  parentRegionBySettlement: ReadonlyMap<string, string>,
): Map<string, CampaignOverworldMapLayer> {
  const result = new Map<string, CampaignOverworldMapLayer>();
  const regions = entities.filter((e) => e.type === "region");
  const settlements = entities.filter((e) => e.type === "settlement");
  const pins = entities.filter((e) => isPinType(e.type));

  const regionCols = Math.max(1, Math.ceil(Math.sqrt(regions.length)));
  const regionW = Math.max(4, Math.floor(grid.width / (regionCols * 2)));
  const regionH = Math.max(3, Math.floor(grid.height / (Math.ceil(regions.length / regionCols) * 2)));

  regions.forEach((region, i) => {
    const rx = (i % regionCols) * (regionW + 2) + 1;
    const ry = Math.floor(i / regionCols) * (regionH + 2) + 1;
    const cells: string[] = [];
    for (let c = rx; c < rx + regionW && c < grid.width; c++) {
      for (let r = ry; r < ry + regionH && r < grid.height; r++) {
        cells.push(cellKey(c, r));
      }
    }
    result.set(region.id, { territory: cells });
  });

  settlements.forEach((settlement, i) => {
    const parentId = parentRegionBySettlement.get(settlement.id);
    const parentLayer = parentId ? result.get(parentId) : undefined;
    const parentCells = parentLayer?.territory ?? [];
    if (parentCells.length === 0) return;
    const sw = 3;
    const sh = 2;
    const anchor = parentCells[i % parentCells.length]!;
    const parsed = parseCellKey(anchor);
    if (!parsed) return;
    const cells: string[] = [];
    for (let dc = 0; dc < sw; dc++) {
      for (let dr = 0; dr < sh; dr++) {
        const col = parsed.col + dc;
        const row = parsed.row + dr;
        if (cellInBounds(col, row, grid)) {
          cells.push(cellKey(col, row));
        }
      }
    }
    const parentSet = new Set(parentCells);
    result.set(settlement.id, {
      territory: filterCellsWithinRegion(cells, parentSet),
    });
  });

  pins.forEach((poi, i) => {
    let col = 2 + (i % 8) * 3;
    let row = 2 + Math.floor(i / 8) * 3;
    const parentId = parentRegionBySettlement.get(poi.id);
    if (parentId) {
      const parentLayer = result.get(parentId);
      const parentCells = parentLayer?.territory ?? [];
      const anchor = parentCells[i % Math.max(1, parentCells.length)];
      if (anchor) {
        const parsed = parseCellKey(anchor);
        if (parsed) {
          col = parsed.col + 1;
          row = parsed.row + 1;
        }
      }
    }
    if (cellInBounds(col, row, grid)) {
      result.set(poi.id, { pin: { col, row } });
    }
  });

  return result;
}

export function hasAnyOverworldGeometry(
  entities: readonly OverworldEntity[],
): boolean {
  return entities.some(
    (e) =>
      (e.overworldMap.territory?.length ?? 0) > 0 ||
      e.overworldMap.pin != null,
  );
}

export type TerritoryBounds = {
  minCol: number;
  minRow: number;
  width: number;
  height: number;
};

/** Bounding box of a territory cell set (for settlement local pin coords). */
export function territoryBounds(cells: readonly string[]): TerritoryBounds | null {
  if (cells.length === 0) return null;
  let minCol = Infinity;
  let minRow = Infinity;
  let maxCol = -Infinity;
  let maxRow = -Infinity;
  for (const key of cells) {
    const cell = parseCellKey(key);
    if (!cell) continue;
    minCol = Math.min(minCol, cell.col);
    minRow = Math.min(minRow, cell.row);
    maxCol = Math.max(maxCol, cell.col);
    maxRow = Math.max(maxRow, cell.row);
  }
  if (!Number.isFinite(minCol)) return null;
  return {
    minCol,
    minRow,
    width: maxCol - minCol + 1,
    height: maxRow - minRow + 1,
  };
}

export function overworldToSettlementPin(
  pin: { col: number; row: number },
  bounds: TerritoryBounds,
): { col: number; row: number } {
  return { col: pin.col - bounds.minCol, row: pin.row - bounds.minRow };
}

export function settlementToOverworldPin(
  local: { col: number; row: number },
  bounds: TerritoryBounds,
): { col: number; row: number } {
  return { col: bounds.minCol + local.col, row: bounds.minRow + local.row };
}

/** Keep settlementPin in sync when the overworld pin moves inside a settlement. */
export function syncSettlementPinFromOverworld(
  layer: CampaignOverworldMapLayer,
  settlementTerritory: readonly string[],
): CampaignOverworldMapLayer {
  if (!layer.pin || settlementTerritory.length === 0) {
    const next = { ...layer };
    delete next.settlementPin;
    return next;
  }
  const bounds = territoryBounds(settlementTerritory);
  if (!bounds) return layer;
  const key = cellKey(layer.pin.col, layer.pin.row);
  if (!settlementTerritory.includes(key)) {
    const next = { ...layer };
    delete next.settlementPin;
    return next;
  }
  return {
    ...layer,
    settlementPin: overworldToSettlementPin(layer.pin, bounds),
  };
}

/** Keep overworld pin in sync when editing on the settlement district map. */
export function syncOverworldPinFromSettlement(
  layer: CampaignOverworldMapLayer,
  settlementTerritory: readonly string[],
): CampaignOverworldMapLayer {
  if (!layer.settlementPin || settlementTerritory.length === 0) return layer;
  const bounds = territoryBounds(settlementTerritory);
  if (!bounds) return layer;
  const localCol = layer.settlementPin.col;
  const localRow = layer.settlementPin.row;
  if (localCol < 0 || localRow < 0 || localCol >= bounds.width || localRow >= bounds.height) {
    return layer;
  }
  return {
    ...layer,
    pin: settlementToOverworldPin(layer.settlementPin, bounds),
  };
}

export function parentSettlementId(
  entityId: string,
  settlementIds: ReadonlySet<string>,
  locatedIn: ReadonlyMap<string, string>,
): string | undefined {
  let current: string | undefined = entityId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if (settlementIds.has(current)) return current;
    current = locatedIn.get(current);
  }
  return undefined;
}

export function stubSupportsEncounters(type: RealmEntityType): boolean {
  return type === "region" || type === "settlement" || type === "dungeon";
}

export function mergeSeededLayers(
  entities: readonly OverworldEntity[],
  seeded: ReadonlyMap<string, CampaignOverworldMapLayer>,
): OverworldEntity[] {
  return entities.map((entity) => {
    const hasGeometry =
      (entity.overworldMap.territory?.length ?? 0) > 0 ||
      entity.overworldMap.pin != null;
    if (hasGeometry) return entity;
    const seed = seeded.get(entity.id);
    if (!seed) return entity;
    return { ...entity, overworldMap: seed };
  });
}
