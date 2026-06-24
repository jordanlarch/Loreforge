/** Display helpers for Open5e creature rows in the Codex UI. */

export function formatChallengeRating(
  cr: number | null | undefined,
): string {
  if (cr == null || Number.isNaN(cr)) return "—";
  if (cr === 0.125) return "1/8";
  if (cr === 0.25) return "1/4";
  if (cr === 0.5) return "1/2";
  if (Number.isInteger(cr)) return String(cr);
  return String(cr);
}

export function formatCreatureType(type: string | null | undefined): string {
  if (!type) return "—";
  return type.replace(/-/g, " ");
}

export function formatSize(size: string | null | undefined): string {
  if (!size) return "—";
  return size.charAt(0).toUpperCase() + size.slice(1);
}

type SpeedRecord = Record<string, unknown>;

/** Build a speed line from Open5e `speed` / `speed_all` objects. */
export function formatSpeedLine(raw: SpeedRecord): string {
  const speed = (raw.speed ?? raw.speed_all) as SpeedRecord | undefined;
  if (!speed || typeof speed !== "object") return "—";
  const unit = typeof speed.unit === "string" ? speed.unit : "ft";
  const parts: string[] = [];
  for (const mode of ["walk", "fly", "swim", "climb", "burrow"] as const) {
    const val = speed[mode];
    if (typeof val === "number" && val > 0) {
      const hover = mode === "fly" && speed.hover === true ? " (hover)" : "";
      parts.push(`${mode} ${val} ${unit}${hover}`);
    }
  }
  return parts.length > 0 ? parts.join(", ") : "—";
}

const ABILITY_KEYS = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const;

const ABILITY_ABBR: Record<(typeof ABILITY_KEYS)[number], string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

export function abilityScoreRows(raw: Record<string, unknown>): {
  abbr: string;
  score: number;
  mod: number;
}[] {
  const scores = raw.ability_scores as Record<string, number> | undefined;
  const mods = raw.modifiers as Record<string, number> | undefined;
  if (!scores) return [];
  return ABILITY_KEYS.map((key) => ({
    abbr: ABILITY_ABBR[key],
    score: scores[key] ?? 10,
    mod: mods?.[key] ?? 0,
  }));
}

type NamedDesc = { name?: string; desc?: string };

export function namedBlocks(raw: Record<string, unknown>, key: string): NamedDesc[] {
  const value = raw[key];
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is NamedDesc =>
      typeof item === "object" && item != null && "name" in item,
  );
}
