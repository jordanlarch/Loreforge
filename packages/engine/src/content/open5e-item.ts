/**
 * Best-effort Open5e v2 raw item → {@link ItemDefinition} conversion for Codex
 * → Smithy copy (SMITH-7 / ITEM-DEF-v2). Snapshot categories without
 * weapon/armor blocks stay metadata-only.
 */
import type { ItemType } from "./items";
import {
  buildItemDefinition,
  itemDefinitionId,
  type ItemArmorStats,
  type ItemCost,
  type ItemDefinition,
  type ItemPropertyDefinition,
  type ItemWeaponStats,
  type ItemWeight,
} from "./item-definitions";
import { masteryFromOpen5eItemRaw } from "./weapon-mastery-open5e";
import { DAMAGE_TYPES, type DamageType } from "./spells";

type Open5eWeaponRaw = {
  damage_dice?: string | null;
  damage_type?: { name?: string | null; key?: string | null } | null;
  is_simple?: boolean | null;
  is_martial?: boolean | null;
  properties?: {
    property?: {
      name?: string | null;
      type?: string | null;
      desc?: string | null;
      key?: string | null;
    } | null;
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

function propertyKey(name: string, key?: string | null): string {
  if (key?.trim()) return key.trim().toLowerCase();
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function propertyDetailsFromOpen5e(
  weapon: Open5eWeaponRaw,
): ItemPropertyDefinition[] {
  const out: ItemPropertyDefinition[] = [];
  for (const entry of weapon.properties ?? []) {
    const prop = entry.property;
    const name = prop?.name?.trim();
    if (!name) continue;
    const type = prop?.type?.trim() || null;
    out.push({
      key: propertyKey(name, prop?.key),
      name,
      ...(prop?.desc?.trim() ? { description: prop.desc.trim() } : {}),
      detail: entry.detail?.trim() || null,
      ...(type === "Mastery" ? { mastery: true } : {}),
    });
  }
  return out;
}

function parseCost(
  cost: string | null | undefined,
): ItemCost | undefined {
  if (!cost?.trim()) return undefined;
  const value = parseFloat(cost);
  if (Number.isNaN(value) || value <= 0) return undefined;
  return { amount: value, unit: "gp" };
}

function parseWeight(
  weight: string | null | undefined,
  unit: string | null | undefined,
): ItemWeight | undefined {
  if (!weight?.trim()) return undefined;
  const value = parseFloat(weight);
  if (Number.isNaN(value) || value <= 0) return undefined;
  const normalized = (unit ?? "lb").toLowerCase();
  return {
    amount: value,
    unit: normalized === "kg" ? "kg" : "lb",
  };
}

function weaponFromOpen5e(raw: Record<string, unknown>): ItemWeaponStats | undefined {
  const weapon = raw.weapon as Open5eWeaponRaw | null | undefined;
  if (!weapon?.damage_dice) return undefined;

  const props = weaponPropertyNames(weapon);
  const ranged = props.some((p) => p.includes("range") || p === "ammunition");
  const finesse = props.some((p) => p === "finesse");
  const reach = props.some((p) => p === "reach");

  let rangeFt: number | undefined;
  let rangeLongFt: number | undefined;
  if (ranged) {
    const rangeProp = (weapon.properties ?? []).find((entry) =>
      entry.property?.name?.toLowerCase().includes("range"),
    );
    const detail = rangeProp?.detail ?? "";
    const match = detail.match(/(\d+)\s*\/\s*(\d+)/);
    if (match) {
      rangeFt = parseInt(match[1]!, 10);
      rangeLongFt = parseInt(match[2]!, 10);
    } else {
      rangeFt = 80;
    }
  } else if (reach) {
    rangeFt = 10;
  }

  const mastery = masteryFromOpen5eItemRaw(raw);

  return {
    damage: {
      dice: weapon.damage_dice,
      type: parseDamageType(weapon),
    },
    finesse: finesse || undefined,
    ranged: ranged || undefined,
    rangeFt,
    rangeLongFt,
    category: weapon.is_martial
      ? "martial"
      : weapon.is_simple
        ? "simple"
        : undefined,
    mastery: mastery?.property,
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
    cost?: string | null;
    weight?: string | null;
    weightUnit?: string | null;
  },
): ItemDefinition {
  const itemType = meta.itemType ?? open5eCategoryToItemType(meta.category);
  const weapon = weaponFromOpen5e(raw);
  const armor = armorFromOpen5e(raw);
  const description =
    meta.description?.trim() ||
    (typeof raw.desc === "string" ? raw.desc.trim() : "") ||
    "";
  const weaponRaw = raw.weapon as Open5eWeaponRaw | null | undefined;
  const propertyDetails = weaponRaw
    ? propertyDetailsFromOpen5e(weaponRaw)
    : undefined;

  return buildItemDefinition({
    id: itemDefinitionId(meta.slug || meta.name),
    name: meta.name,
    itemType,
    description,
    ...(weapon ? { weapon } : {}),
    ...(armor ? { armor } : {}),
    cost: parseCost(meta.cost),
    weight: parseWeight(meta.weight, meta.weightUnit),
    ...(propertyDetails?.length ? { propertyDetails } : {}),
  });
}
