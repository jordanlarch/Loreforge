/**
 * Map Codex/Smithy library rows onto character sheet JSON shapes (SMITH-5).
 */
import type {
  CharacterSpell,
  EquipmentItem,
  SpellLoadout,
} from "@/lib/character";
import { formatItemCategory } from "@/lib/codex-item-display";

type SmithyItemRow = {
  id: string;
  name: string;
  type: string;
  rarity: string;
  description: string;
  requiresAttunement: boolean;
};

type SmithySpellRow = {
  name: string;
  level: number;
  school: string;
  concentration?: boolean;
  ritual?: boolean;
};

type CodexSpellRow = {
  name: string;
  level: string | null;
  school: string | null;
  slug?: string;
  concentration?: boolean;
  ritual?: boolean;
};

export type CodexItemRow = {
  name: string;
  slug?: string;
  category?: string | null;
  weight?: string | null;
  cost?: string | null;
  description?: string | null;
  requiresAttunement?: boolean;
};

export function parseGpCost(cost: string | null | undefined): number {
  const value = parseFloat(cost ?? "");
  return Number.isNaN(value) ? 0 : value;
}

export function parseWeightLb(
  weight: string | null | undefined,
): number | undefined {
  const value = parseFloat(weight ?? "");
  return Number.isNaN(value) || value <= 0 ? undefined : value;
}

export function smithyItemToEquipment(item: SmithyItemRow): EquipmentItem {
  return {
    name: item.name,
    quantity: 1,
    equipped: false,
    smithyItemId: item.id,
    slot: item.type,
    rarity: item.rarity,
    attunement: item.requiresAttunement,
    description: item.description || undefined,
  };
}

export function smithySpellToCharacterSpell(spell: SmithySpellRow): CharacterSpell {
  return {
    name: spell.name,
    level: spell.level,
    prepared: false,
    source: `Smithy · ${spell.school}`,
    concentration: spell.concentration,
    ritual: spell.ritual,
  };
}

export function codexSpellToCharacterSpell(spell: CodexSpellRow): CharacterSpell {
  return {
    name: spell.name,
    level: Number(spell.level ?? 0) || 0,
    prepared: false,
    source: `Codex · ${spell.school ?? "unknown"}`,
    concentration: spell.concentration,
    ritual: spell.ritual,
    codexSlug: spell.slug,
  };
}

export function codexItemToEquipment(
  item: CodexItemRow,
  options?: { equipped?: boolean },
): EquipmentItem {
  return {
    name: item.name,
    quantity: 1,
    equipped: options?.equipped ?? false,
    slot: item.category ? formatItemCategory(item.category) : undefined,
    weight: parseWeightLb(item.weight),
    attunement: item.requiresAttunement,
    description: item.description?.trim() || undefined,
    codexSlug: item.slug,
  };
}

/** Add or mark prepared when applying a Smithy spell from browse (SMITH-3). */
export function mergePreparedSmithySpell(
  loadout: SpellLoadout,
  spell: SmithySpellRow,
): SpellLoadout {
  const incoming = { ...smithySpellToCharacterSpell(spell), prepared: true };
  const key = spellKey(incoming);
  const idx = loadout.spells.findIndex((s) => spellKey(s) === key);
  if (idx >= 0) {
    return {
      ...loadout,
      spells: loadout.spells.map((s, i) =>
        i === idx ? { ...s, prepared: true } : s,
      ),
    };
  }
  return { ...loadout, spells: [...loadout.spells, incoming] };
}

/** Add or mark equipped when applying a Smithy item from browse (SMITH-3). */
export function mergeEquippedSmithyItem(
  equipment: EquipmentItem[],
  item: SmithyItemRow,
): EquipmentItem[] {
  const incoming = { ...smithyItemToEquipment(item), equipped: true };
  const key = equipmentKey(incoming);
  const idx = equipment.findIndex((e) => equipmentKey(e) === key);
  if (idx >= 0) {
    return equipment.map((e, i) =>
      i === idx
        ? {
            ...e,
            equipped: true,
            smithyItemId: incoming.smithyItemId ?? e.smithyItemId,
          }
        : e,
    );
  }
  return [...equipment, incoming];
}

/** Add or mark prepared when applying a Codex spell from detail (CODEX-6). */
export function mergePreparedCodexSpell(
  loadout: SpellLoadout,
  spell: CodexSpellRow,
): SpellLoadout {
  const incoming = { ...codexSpellToCharacterSpell(spell), prepared: true };
  const key = spellKey(incoming);
  const idx = loadout.spells.findIndex((s) => spellKey(s) === key);
  if (idx >= 0) {
    return {
      ...loadout,
      spells: loadout.spells.map((s, i) =>
        i === idx ? { ...s, prepared: true } : s,
      ),
    };
  }
  return { ...loadout, spells: [...loadout.spells, incoming] };
}

/** Add or mark equipped when applying a Codex item from detail (CODEX-6). */
export function mergeEquippedCodexItem(
  equipment: EquipmentItem[],
  item: CodexItemRow,
): EquipmentItem[] {
  const incoming = codexItemToEquipment(item, { equipped: true });
  const key = equipmentKey(incoming);
  const idx = equipment.findIndex((e) => equipmentKey(e) === key);
  if (idx >= 0) {
    return equipment.map((e, i) =>
      i === idx
        ? {
            ...e,
            equipped: true,
            codexSlug: incoming.codexSlug ?? e.codexSlug,
          }
        : e,
    );
  }
  return [...equipment, incoming];
}

export function spellKey(spell: Pick<CharacterSpell, "name" | "level">): string {
  return `${spell.level}:${spell.name.trim().toLowerCase()}`;
}

export function equipmentKey(
  item: Pick<EquipmentItem, "name" | "smithyItemId" | "codexSlug">,
): string {
  if (item.smithyItemId) return `smithy:${item.smithyItemId}`;
  if (item.codexSlug) return `codex:${item.codexSlug}`;
  return `name:${item.name.trim().toLowerCase()}`;
}
