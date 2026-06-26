"use client";

import { FEET_PER_CELL } from "@app/engine";

import { CELL_SIZE } from "@/lib/battle-map/geometry";
import { columnLabel } from "@/lib/grid-coordinates";

/**
 * Column/row axis labels + scale badge for tactical maps (5 ft squares).
 * Always visible; the Grid layer toggle only controls grid lines on the canvas.
 */
export function TacticalGridOverlay({
  cols,
  rows,
  cellSize = CELL_SIZE,
}: {
  cols: number;
  rows: number;
  cellSize?: number;
}) {
  const labelBand = 18;
  const width = cols * cellSize;
  const height = rows * cellSize;

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        width: width + labelBand,
        height: height + labelBand,
        marginTop: -labelBand,
        marginLeft: -labelBand,
      }}
      aria-hidden
    >
      {Array.from({ length: cols }, (_, col) => (
        <span
          key={`col-${col}`}
          className="absolute text-[10px] font-medium text-lore-muted"
          style={{
            left: labelBand + col * cellSize + cellSize / 2,
            top: 0,
            transform: "translateX(-50%)",
          }}
        >
          {columnLabel(col)}
        </span>
      ))}
      {Array.from({ length: rows }, (_, row) => (
        <span
          key={`row-${row}`}
          className="absolute text-[10px] font-medium text-lore-muted"
          style={{
            left: 0,
            top: labelBand + row * cellSize + cellSize / 2,
            transform: "translateY(-50%)",
          }}
        >
          {row + 1}
        </span>
      ))}
      <span
        className="absolute rounded bg-lore-bg/90 px-1.5 py-0.5 text-[10px] text-lore-muted"
        style={{ left: labelBand + 4, bottom: 4 }}
      >
        {FEET_PER_CELL} ft / square
      </span>
    </div>
  );
}
