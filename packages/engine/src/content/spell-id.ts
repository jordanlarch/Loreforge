/**
 * Slug helpers shared by the spell registry, cast validation (ENG-12), and
 * sheet → engine bridges.
 */

/** Map a display name ("Melf's Acid Arrow") to a registry slug (`melfs-acid-arrow`). */
export function spellNameToId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Whether a caster may cast this registry spell id (cantrip / prepared / always-prepared). */
export function isSpellPrepared(
  preparedSpellIds: readonly string[] | undefined,
  spellId: string,
): boolean {
  if (!preparedSpellIds) return true;
  return preparedSpellIds.includes(spellId);
}
