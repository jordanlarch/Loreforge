/**
 * Minimal weapon reach lookup for engine-side OA provoke detection (ENG-10).
 *
 * The full SRD weapon catalog lives in the web app's sheet-loadout helpers;
 * this slice carries only the reach overrides the engine needs when deciding
 * whether a mover left a reactor's threat range. Longest equipped reach wins.
 */
const MELEE_WEAPON_REACH_FT: Record<string, number> = {
  glaive: 10,
  halberd: 10,
  pike: 10,
  lance: 10,
};

function normalizeWeaponName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\+\d+/g, " ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Match a weapon name to its melee reach override, if any. */
export function meleeReachFromWeaponName(name: string): number | undefined {
  const norm = normalizeWeaponName(name);
  if (!norm) return undefined;
  if (MELEE_WEAPON_REACH_FT[norm]) return MELEE_WEAPON_REACH_FT[norm];
  for (const [key, reach] of Object.entries(MELEE_WEAPON_REACH_FT)) {
    if (norm.includes(key)) return reach;
  }
  return undefined;
}

/** Longest melee reach among equipped weapons (for OA provoke detection). */
export function meleeReachFromEquipment(
  equipment: readonly { name: string; equipped?: boolean; quantity?: number }[],
): number | undefined {
  let best: number | undefined;
  for (const item of equipment) {
    if (!item.equipped || (item.quantity ?? 0) <= 0) continue;
    const reach = meleeReachFromWeaponName(item.name);
    if (reach !== undefined && (best === undefined || reach > best)) best = reach;
  }
  return best;
}
