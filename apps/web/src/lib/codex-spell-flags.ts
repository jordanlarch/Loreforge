/** Parse Open5e yes/no string flags from Codex spell `raw` JSON. */
export function open5eRawFlag(
  raw: Record<string, unknown> | null | undefined,
  key: string,
): boolean {
  if (!raw) return false;
  const value = raw[key];
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  return ["yes", "true"].includes(value.toLowerCase());
}

export function codexSpellFlags(raw: Record<string, unknown> | null | undefined): {
  concentration: boolean;
  ritual: boolean;
} {
  return {
    concentration: open5eRawFlag(raw, "concentration"),
    ritual: open5eRawFlag(raw, "ritual"),
  };
}
