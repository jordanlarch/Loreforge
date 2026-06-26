/**
 * Map Codex/Smithy library rows onto character sheet JSON shapes (SMITH-5).
 */
import type { EquipmentItem, CharacterSpell } from "@/lib/character";

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

export function spellKey(spell: Pick<CharacterSpell, "name" | "level">): string {
  return `${spell.level}:${spell.name.trim().toLowerCase()}`;
}

export function equipmentKey(item: Pick<EquipmentItem, "name" | "smithyItemId">): string {
  if (item.smithyItemId) return `smithy:${item.smithyItemId}`;
  return `name:${item.name.trim().toLowerCase()}`;
}
