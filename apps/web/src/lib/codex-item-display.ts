/** Display helpers for Open5e item rows in the Codex UI. */

export function formatItemCategory(category: string | null | undefined): string {
  if (!category) return "—";
  return category.replace(/-/g, " ");
}

export function formatItemCost(cost: string | null | undefined): string {
  if (!cost) return "—";
  const value = parseFloat(cost);
  if (Number.isNaN(value)) return cost;
  if (value === 0) return "—";
  return `${value % 1 === 0 ? value.toFixed(0) : value} gp`;
}

export function formatItemWeight(
  weight: string | null | undefined,
  unit: string | null | undefined,
): string {
  if (!weight) return "—";
  const value = parseFloat(weight);
  if (Number.isNaN(value) || value === 0) return "—";
  const suffix = unit ?? "lb";
  return `${value % 1 === 0 ? value.toFixed(0) : value} ${suffix}`;
}

type WeaponRaw = {
  damage_dice?: string | null;
  damage_type?: { name?: string | null } | null;
  is_simple?: boolean | null;
  is_martial?: boolean | null;
  properties?: { property?: { name?: string; desc?: string } | null; detail?: string | null }[] | null;
};

type ArmorRaw = {
  armor_class?: number | null;
  armor_type?: { name?: string | null } | null;
  strength_requirement?: number | null;
  stealth_disadvantage?: boolean | null;
};

export function weaponSummary(raw: Record<string, unknown>): string | null {
  const weapon = raw.weapon as WeaponRaw | null | undefined;
  if (!weapon) return null;
  const parts: string[] = [];
  if (weapon.damage_dice) {
    const type = weapon.damage_type?.name?.toLowerCase();
    parts.push(type ? `${weapon.damage_dice} ${type}` : weapon.damage_dice);
  }
  if (weapon.is_martial) parts.push("martial");
  else if (weapon.is_simple) parts.push("simple");
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function armorSummary(raw: Record<string, unknown>): string | null {
  const armor = raw.armor as ArmorRaw | null | undefined;
  if (!armor) return null;
  const parts: string[] = [];
  if (armor.armor_class != null) parts.push(`AC ${armor.armor_class}`);
  if (armor.armor_type?.name) parts.push(armor.armor_type.name);
  if (armor.strength_requirement) {
    parts.push(`Str ${armor.strength_requirement}`);
  }
  if (armor.stealth_disadvantage) parts.push("stealth disadvantage");
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function weaponProperties(raw: Record<string, unknown>): string[] {
  const weapon = raw.weapon as WeaponRaw | null | undefined;
  if (!weapon?.properties?.length) return [];
  return weapon.properties
    .map((entry) => {
      const name = entry.property?.name;
      if (!name) return null;
      const detail = entry.detail ? ` (${entry.detail})` : "";
      return `${name}${detail}`;
    })
    .filter((line): line is string => line != null);
}
