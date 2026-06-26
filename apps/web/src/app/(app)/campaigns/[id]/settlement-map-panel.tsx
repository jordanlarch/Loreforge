"use client";

import {
  OVERWORLD_CELL_PX,
  cellKey,
  parseCellKey,
  territoryBounds,
  type OverworldEntity,
} from "@/lib/overworld-map";
import { REALM_TYPE_COLOR, type RealmEntityType } from "@/lib/realms";

type SettlementMapPanelProps = {
  settlement: OverworldEntity;
  poi: OverworldEntity;
  poisInSettlement: OverworldEntity[];
  onPlacePin: (col: number, row: number) => void;
};

/**
 * Local district grid for a settlement territory (CAMP-UX UX-4). Editing here
 * syncs the POI's overworld pin via {@link campaigns.setSettlementPin}.
 */
export function SettlementMapPanel({
  settlement,
  poi,
  poisInSettlement,
  onPlacePin,
}: SettlementMapPanelProps) {
  const territory = settlement.overworldMap.territory ?? [];
  const bounds = territoryBounds(territory);
  if (!bounds) {
    return (
      <p className="text-xs text-lore-muted">
        Paint {settlement.name} territory on the overworld map first.
      </p>
    );
  }

  const localPin = poi.overworldMap.settlementPin;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-lore-border bg-lore-surface p-3">
      <div>
        <h3 className="text-sm font-medium text-lore-text">
          {settlement.name} — district map
        </h3>
        <p className="text-xs text-lore-muted">
          Click a cell to place {poi.name}. Overworld pin syncs automatically.
        </p>
      </div>
      <svg
        width={bounds.width * OVERWORLD_CELL_PX + 2}
        height={bounds.height * OVERWORLD_CELL_PX + 2}
        className="cursor-crosshair rounded border border-lore-border bg-lore-bg"
      >
        {Array.from({ length: bounds.height }, (_, row) =>
          Array.from({ length: bounds.width }, (_, col) => {
            const worldKey = cellKey(bounds.minCol + col, bounds.minRow + row);
            const inTerritory = territory.includes(worldKey);
            return (
              <rect
                key={`${col},${row}`}
                x={col * OVERWORLD_CELL_PX + 1}
                y={row * OVERWORLD_CELL_PX + 1}
                width={OVERWORLD_CELL_PX - 2}
                height={OVERWORLD_CELL_PX - 2}
                fill={
                  inTerritory
                    ? "rgba(252, 211, 77, 0.25)"
                    : "rgba(255,255,255,0.03)"
                }
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={0.5}
                onClick={() => inTerritory && onPlacePin(col, row)}
              />
            );
          }),
        )}
        {poisInSettlement.map((entity) => {
          const pin = entity.overworldMap.settlementPin;
          if (!pin) return null;
          const type = entity.type as RealmEntityType;
          const cx = pin.col * OVERWORLD_CELL_PX + OVERWORLD_CELL_PX / 2;
          const cy = pin.row * OVERWORLD_CELL_PX + OVERWORLD_CELL_PX / 2;
          return (
            <g key={entity.id} transform={`translate(${cx} ${cy})`}>
              <circle
                r={7}
                fill={REALM_TYPE_COLOR[type]}
                stroke={entity.id === poi.id ? "#fff" : "rgba(0,0,0,0.4)"}
                strokeWidth={entity.id === poi.id ? 2 : 1}
              />
            </g>
          );
        })}
      </svg>
      {localPin ? (
        <p className="text-[11px] text-lore-muted">
          Local pin: ({localPin.col}, {localPin.row}) → overworld (
          {poi.overworldMap.pin?.col ?? "?"}, {poi.overworldMap.pin?.row ?? "?"})
        </p>
      ) : null}
    </div>
  );
}

/** Cells belonging to a settlement as sorted local keys (for tests / helpers). */
export function localTerritoryCells(territory: readonly string[]): string[] {
  const bounds = territoryBounds(territory);
  if (!bounds) return [];
  return territory
    .map((key) => {
      const cell = parseCellKey(key);
      if (!cell) return null;
      return cellKey(cell.col - bounds.minCol, cell.row - bounds.minRow);
    })
    .filter((k): k is string => k != null);
}
