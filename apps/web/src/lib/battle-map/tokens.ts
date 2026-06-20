/**
 * Pure presentation mapping for battle-map tokens — border colors and labels.
 * Kept separate from the PixiJS renderer so it can be unit-tested without a
 * canvas. Colors are PixiJS-style 0xRRGGBB numbers.
 */
export type TokenKind = "character" | "npc" | "monster";

export const TOKEN_COLORS = {
  /** Player characters: gold. */
  character: 0xd9b25f,
  /** Hostile side / monsters: red. */
  hostile: 0xc0563f,
  /** Neutral NPCs: gray. */
  neutral: 0x8b95a8,
  /** Movement-radius highlight + active ring: green accent (matches theme). */
  accent: 0x3d9b6e,
  wall: 0x2a3140,
  grid: 0x222833,
  downed: 0x5a5f6b,
} as const;

/**
 * Token border color. PCs are gold; everyone else is colored by combat side
 * (hostile → red, otherwise neutral gray). Downed creatures wash out.
 */
export function tokenBorderColor(
  kind: TokenKind,
  opts: { alive: boolean; hostile: boolean },
): number {
  if (!opts.alive) return TOKEN_COLORS.downed;
  if (kind === "character") return TOKEN_COLORS.character;
  return opts.hostile ? TOKEN_COLORS.hostile : TOKEN_COLORS.neutral;
}

/** Up-to-two-character label drawn inside a token (initials). */
export function tokenInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** Fraction of max HP remaining, clamped to [0, 1]. */
export function hpFraction(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, current / max));
}
