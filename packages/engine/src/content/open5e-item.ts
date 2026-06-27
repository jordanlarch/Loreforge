/**
 * Best-effort Open5e v2 raw item → {@link ItemDefinition} conversion for Codex
 * → Smithy copy (SMITH-7). Snapshot categories without weapon/armor blocks stay
 * metadata-only.
 */
import type { ItemType } from "./items";
import {
  buildItemDefinition,
  itemDefinitionId,
  type ItemArmorStats,
  type ItemDefinition,
  type ItemWeaponStats,
} from "./item-definitions";
import { DAMAGE_TYPES, type DamageType } from "./spells";

type Open5eWeaponRaw = {
  damage_dice?: string | null;
  damage_type?: { name?: string | null; key?: string | null } | null;
  properties?: {
    property?: { name?: string | null; type?: string | null } | null;
    detail?: string | null;
  }[] | null;
};

type Open5eArmorRaw = {
  armor_class?: number | null;
  armor_type?: { name?: string | null; key?: string | null } | null;
  strength_requirement?: number | null;
  stealth_disadvantage?: boolean | null;
};

function parseDamageType(raw: Open5eWeaponRaw): DamageType {
  const name =
    raw.damage_type?.key?.toLowerCase() ??
    raw.damage_type?.name?.toLowerCase() ??
    "";
  if ((DAMAGE_TYPES as readonly string[]).includes(name)) {
    return name as DamageType;
  }
  return "slashing";
}

function weaponPropertyNames(raw: Open5eWeaponRaw): string[] {
  return (raw.properties ?? [])
    .map((entry) => entry.property?.name?.toLowerCase() ?? "")
    .filter(Boolean);
}

function weaponFromOpen5e(raw: Record<string, unknown>): ItemWeaponStats | undefined {
  const weapon = raw.weapon as Open5eWeaponRaw | null | undefined;
  if (!weapon?.damage_dice) return undefined;

  const props = weaponPropertyNames(weapon);
  const ranged = props.some((p) => p.includes("range") || p === "ammunition");
  const finesse = props.some((p) => p === "finesse");
  const reach = props.some((p) => p === "reach");

  let rangeFt: number | undefined;
  if (ranged) {
    const rangeProp = (weapon.properties ?? []).find((entry) =>
      entry.property?.name?.toLowerCase().includes("range"),
    );
    const detail = rangeProp?.detail ?? "";
    const match = detail.match(/(\d+)\s*\/\s*(\d+)/);
    rangeFt = match ? parseInt(match[1]!, 10) : 80;
  } else if (reach) {
    rangeFt = 10;
  }

  return {
    damage: {
      dice: weapon.damage_dice,
      type: parseDamageType(weapon),
    },
    finesse: finesse || undefined,
    ranged: ranged || undefined,
    rangeFt,
  };
}

function armorFromOpen5e(raw: Record<string, unknown>): ItemArmorStats | undefined {
  const armor = raw.armor as Open5eArmorRaw | null | undefined;
  if (armor?.armor_class == null) return undefined;

  const typeKey = armor.armor_type?.key?.toLowerCase() ?? "";
  const typeName = armor.armor_type?.name?.toLowerCase() ?? "";
  const shield = typeKey === "shield" || typeName.includes("shield");

  let dexBonusMax: number | null | undefined;
  if (typeKey === "light") dexBonusMax = null;
  else if (typeKey === "medium") dexBonusMax = 2;
  else if (typeKey === "heavy") dexBonusMax = 0;

  return {
    baseAc: armor.armor_class,
    dexBonusMax,
    stealthDisadvantage: armor.stealth_disadvantage ?? undefined,
    shield: shield || undefined,
  };
}

function open5eCategoryToItemType(category: string | null | undefined): ItemType {
  const key = (category ?? "").toLowerCase();
  if (key === "weapon") return "Weapon";
  if (key === "armor") return "Armor";
  if (key === "potion") return "Potion";
  if (key === "tool") return "Tool";
  if (key === "wondrous-item" || key === "magic-item") return "Magic Item";
  return "Adventuring Gear";
}

export function open5eRawToItemDefinition(
  raw: Record<string, unknown>,
  meta: {
    slug: string;
    name: string;
    category?: string | null;
    description?: string | null;
    itemType?: ItemType;
  },
): ItemDefinition {
  const itemType = meta.itemType ?? open5eCategoryToItemType(meta.category);
  const weapon = weaponFromOpen5e(raw);
  const armor = armorFromOpen5e(raw);
  const description =
    meta.description?.trim() ||
    (typeof raw.desc === "string" ? raw.desc.trim() : "") ||
    "";

  return buildItemDefinition({
    id: itemDefinitionId(meta.slug || meta.name),
    name: meta.name,
    itemType,
    description,
    ...(weapon ? { weapon } : {}),
    ...(armor ? { armor } : {}),
  });
}
