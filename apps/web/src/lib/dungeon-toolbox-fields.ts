import type { ToolboxTopic } from "@app/engine";

/** Realms dungeon `data` keys for Gameplay Toolbox group fields (DUN-11). */
export const DUNGEON_TOOLBOX_FIELD_KEYS = [
  "traps",
  "poisons",
  "cursesAndContagions",
  "environmentalEffects",
  "fearAndStress",
] as const;

export type DungeonToolboxFieldKey = (typeof DUNGEON_TOOLBOX_FIELD_KEYS)[number];

export const DUNGEON_TOOLBOX_FIELD_TOPICS: Record<DungeonToolboxFieldKey, ToolboxTopic> =
  {
    traps: "trap",
    poisons: "poison",
    cursesAndContagions: "curse",
    environmentalEffects: "environmental_effect",
    fearAndStress: "fear_stress",
  };

export function isDungeonToolboxFieldKey(key: string): key is DungeonToolboxFieldKey {
  return key in DUNGEON_TOOLBOX_FIELD_TOPICS;
}

/** Migrate legacy prose string lists to structured { label, codexSlug } rows. */
export function migrateDungeonToolboxLists(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...data };
  for (const key of DUNGEON_TOOLBOX_FIELD_KEYS) {
    const v = next[key];
    if (!Array.isArray(v) || v.length === 0) continue;
    if (typeof v[0] === "string") {
      next[key] = (v as string[]).map((s) => ({
        label: s.trim(),
        codexSlug: "",
      }));
    }
  }
  return next;
}
