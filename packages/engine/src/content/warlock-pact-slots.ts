/**
 * Warlock Pact Magic slot progression (SRD 5.2.1) — separate from pooled multiclass slots.
 */

export type PactMagicPool = {
  /** Number of pact slots. */
  max: number;
  used: number;
  /** All pact slots are cast at this spell level. */
  slotLevel: number;
};

function pactRow(warlockLevel: number): { slots: number; level: number } {
  const l = Math.max(1, Math.min(20, Math.floor(warlockLevel)));
  if (l === 1) return { slots: 1, level: 1 };
  if (l === 2) return { slots: 2, level: 1 };
  if (l <= 4) return { slots: 2, level: 2 };
  if (l <= 6) return { slots: 2, level: 3 };
  if (l <= 8) return { slots: 2, level: 4 };
  if (l <= 10) return { slots: 2, level: 5 };
  if (l <= 16) return { slots: 2, level: 5 };
  return { slots: 4, level: 5 };
}

/** Warlock pact magic for a single Warlock class entry. */
export function warlockPactMagic(warlockLevel: number): PactMagicPool | null {
  if (warlockLevel < 1) return null;
  const row = pactRow(warlockLevel);
  if (row.slots <= 0) return null;
  return { max: row.slots, used: 0, slotLevel: row.level };
}

export function warlockLevelFromClasses(
  classes: { class: string; level: number }[],
): number {
  return classes.find((c) => c.class === "Warlock")?.level ?? 0;
}
