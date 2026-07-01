/**
 * Weapon proficiency categories (SRD-FID-16). Keys align with sheet-loadout
 * {@link matchWeapon} normalization.
 */
export const SIMPLE_WEAPON_KEYS = new Set([
  "club",
  "dagger",
  "handaxe",
  "javelin",
  "light hammer",
  "mace",
  "quarterstaff",
  "sickle",
  "spear",
  "crossbow light",
  "light crossbow",
  "dart",
  "shortbow",
  "sling",
]);

export const MARTIAL_WEAPON_KEYS = new Set([
  "battleaxe",
  "flail",
  "glaive",
  "greataxe",
  "greatsword",
  "halberd",
  "lance",
  "longsword",
  "maul",
  "morningstar",
  "pike",
  "rapier",
  "scimitar",
  "shortsword",
  "trident",
  "war pick",
  "warhammer",
  "whip",
  "crossbow hand",
  "hand crossbow",
  "crossbow heavy",
  "heavy crossbow",
  "longbow",
  "net",
]);

/** Normalize proficiency labels for case/apostrophe-insensitive matching. */
export function normalizeProficiencyLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function listIncludesLabel(
  list: readonly string[],
  label: string,
): boolean {
  const norm = normalizeProficiencyLabel(label);
  if (!norm) return false;
  return list.some((entry) => {
    const entryNorm = normalizeProficiencyLabel(entry);
    return (
      entryNorm === norm ||
      norm.includes(entryNorm) ||
      entryNorm.includes(norm)
    );
  });
}

export function weaponProficiencyCategory(
  weaponKey: string,
): "simple" | "martial" | undefined {
  const norm = normalizeProficiencyLabel(weaponKey);
  if (!norm) return undefined;
  if (SIMPLE_WEAPON_KEYS.has(norm)) return "simple";
  if (MARTIAL_WEAPON_KEYS.has(norm)) return "martial";
  for (const key of SIMPLE_WEAPON_KEYS) {
    if (norm.includes(key) || key.includes(norm)) return "simple";
  }
  for (const key of MARTIAL_WEAPON_KEYS) {
    if (norm.includes(key) || key.includes(norm)) return "martial";
  }
  return undefined;
}

/** Whether a proficiency list grants use of a weapon (by name or category). */
export function isProficientWithWeapon(
  proficiencies: readonly string[],
  weaponKey: string,
): boolean {
  if (listIncludesLabel(proficiencies, weaponKey)) return true;
  const category = weaponProficiencyCategory(weaponKey);
  if (!category) return false;
  if (category === "simple") {
    return (
      listIncludesLabel(proficiencies, "simple weapons") ||
      listIncludesLabel(proficiencies, "simple")
    );
  }
  return (
    listIncludesLabel(proficiencies, "martial weapons") ||
    listIncludesLabel(proficiencies, "martial")
  );
}
