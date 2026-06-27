/** Class names from Open5e spell `raw.classes[]` (CODEX-5 class-list filter). */
export function spellClassesFromRaw(
  raw: Record<string, unknown> | null | undefined,
): string[] {
  const classes = raw?.classes;
  if (!Array.isArray(classes)) return [];
  return classes
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const name = (entry as { name?: unknown }).name;
      return typeof name === "string" && name.trim() ? name.trim() : null;
    })
    .filter((name): name is string => name != null);
}

export function spellListsClass(raw: Record<string, unknown> | null | undefined, className: string): boolean {
  if (!className.trim()) return true;
  const needle = className.trim().toLowerCase();
  return spellClassesFromRaw(raw).some((c) => c.toLowerCase() === needle);
}
