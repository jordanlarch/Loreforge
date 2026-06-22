/**
 * Browser-safe character sheet types + pure helpers (#56 schema; CHAR-7 tabs).
 *
 * Mirrors the `equipment` / `spells` JSON shapes stored on the `characters` row
 * (`packages/db/src/schema/characters.ts`) and validated by the characters tRPC
 * router. Kept here (not imported from `@app/db`) so client components and unit
 * tests stay free of server/DB modules. Keep the three field contracts in sync.
 */

export type EquipmentItem = {
  name: string;
  quantity: number;
  equipped: boolean;
  slot?: string;
  smithyItemId?: string;
  weight?: number;
  rarity?: string;
  attunement?: boolean;
  description?: string;
};

export type CharacterSpell = {
  name: string;
  /** 0 = cantrip, 1–9 = spell level. */
  level: number;
  prepared: boolean;
  alwaysPrepared?: boolean;
  source?: string;
};

export type SpellLoadout = {
  spells: CharacterSpell[];
  slots: Record<string, { max: number; used: number }>;
};

/** Spell levels 1–9 (cantrips use no slot). */
export const SPELL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export function blankEquipmentItem(): EquipmentItem {
  return { name: "", quantity: 1, equipped: false };
}

export function blankSpell(level = 0): CharacterSpell {
  return { name: "", level, prepared: false };
}

/** Total carried weight (quantity × weight), ignoring items with no weight. */
export function totalWeight(items: readonly EquipmentItem[]): number {
  return items.reduce(
    (sum, item) => sum + (item.weight ?? 0) * (item.quantity ?? 0),
    0,
  );
}

/**
 * Group a spell list by level (0 = cantrips) for sectioned display, each
 * section sorted by name. Returns ascending level order.
 */
export function groupSpellsByLevel(
  spells: readonly CharacterSpell[],
): { level: number; spells: CharacterSpell[] }[] {
  const byLevel = new Map<number, CharacterSpell[]>();
  for (const spell of spells) {
    const bucket = byLevel.get(spell.level) ?? [];
    bucket.push(spell);
    byLevel.set(spell.level, bucket);
  }
  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, list]) => ({
      level,
      spells: [...list].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

/** Label a spell level for headings ("Cantrips", "1st", "2nd", …). */
export function spellLevelLabel(level: number): string {
  if (level === 0) return "Cantrips";
  const suffix =
    level === 1 ? "st" : level === 2 ? "nd" : level === 3 ? "rd" : "th";
  return `${level}${suffix} Level`;
}
