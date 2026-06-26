/** VTT-style column letters: 0 → A, 25 → Z, 26 → AA. */
export function columnLabel(col: number): string {
  let n = col;
  let label = "";
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

/** Tactical coordinate like `C4` (1-indexed row). */
export function formatTacticalCoordinate(cell: { x: number; y: number }): string {
  return `${columnLabel(cell.x)}${cell.y + 1}`;
}

/** Overworld cell coordinate like `(12, 8)`. */
export function formatOverworldCoordinate(col: number, row: number): string {
  return `(${col}, ${row})`;
}
