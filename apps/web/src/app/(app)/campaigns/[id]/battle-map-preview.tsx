"use client";

import type { EncounterMapDef } from "@app/engine";

const PARTY_MARK = "P";
const FOE_MARK = "F";
const WALL = "█";
const FLOOR = "·";

/** Party spawn cells (matches engine {@link PARTY_POSITIONS}). */
const PARTY_CELLS = [
  { x: 2, y: 2 },
  { x: 2, y: 4 },
  { x: 2, y: 6 },
  { x: 2, y: 8 },
];

/** Foe spawn cells (matches engine {@link FOE_POSITIONS}). */
const FOE_CELLS = [
  { x: 9, y: 3 },
  { x: 9, y: 6 },
  { x: 9, y: 1 },
  { x: 9, y: 8 },
  { x: 10, y: 4 },
  { x: 10, y: 7 },
  { x: 11, y: 2 },
  { x: 11, y: 5 },
];

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** Read-only mini-map for encounter authoring (CAMP-8 tracer). */
export function BattleMapPreview({ map }: { map: EncounterMapDef }) {
  const blocked = new Set(map.blockedCells.map((c) => cellKey(c.x, c.y)));
  const party = new Set(
    PARTY_CELLS.filter((c) => c.x < map.width && c.y < map.height).map((c) =>
      cellKey(c.x, c.y),
    ),
  );
  const foes = new Set(
    FOE_CELLS.filter((c) => c.x < map.width && c.y < map.height).map((c) =>
      cellKey(c.x, c.y),
    ),
  );

  const rows: string[][] = [];
  for (let y = 0; y < map.height; y += 1) {
    const row: string[] = [];
    for (let x = 0; x < map.width; x += 1) {
      const key = cellKey(x, y);
      if (blocked.has(key)) row.push(WALL);
      else if (party.has(key)) row.push(PARTY_MARK);
      else if (foes.has(key)) row.push(FOE_MARK);
      else row.push(FLOOR);
    }
    rows.push(row);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="inline-block overflow-x-auto rounded border border-lore-border bg-lore-bg p-2 font-mono text-[10px] leading-none text-lore-muted"
        aria-label={`Battle map preview: ${map.label}`}
      >
        {rows.map((row, y) => (
          <div key={y} className="whitespace-pre">
            {row.join("")}
          </div>
        ))}
      </div>
      <p className="text-xs text-lore-muted">
        {map.description} · {map.width}×{map.height} ·{" "}
        <span className="text-emerald-400/90">{PARTY_MARK}</span> party ·{" "}
        <span className="text-red-400/90">{FOE_MARK}</span> foes ·{" "}
        <span>{WALL}</span> blocked
      </p>
    </div>
  );
}
