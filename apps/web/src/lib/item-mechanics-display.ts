import type { ItemDefinition } from "@app/engine";

export function formatItemCostLine(
  def: ItemDefinition,
): string | null {
  if (!def.cost) return null;
  const { amount, unit } = def.cost;
  const formatted =
    amount % 1 === 0 ? amount.toFixed(0) : String(amount);
  return `${formatted} ${unit}`;
}

export function formatItemWeightLine(
  def: ItemDefinition,
): string | null {
  if (!def.weight) return null;
  const { amount, unit } = def.weight;
  const formatted =
    amount % 1 === 0 ? amount.toFixed(0) : String(amount);
  return `${formatted} ${unit}`;
}

export function formatItemMechanicsSummary(def: ItemDefinition): string[] {
  const lines: string[] = [];
  if (def.weapon) {
    const w = def.weapon;
    const parts = [`${w.damage.dice} ${w.damage.type}`];
    if (w.category) parts.push(w.category);
    if (w.attackBonus) parts.push(`+${w.attackBonus} attack/damage`);
    if (w.finesse) parts.push("finesse");
    if (w.ranged) parts.push("ranged");
    if (w.rangeFt && w.rangeLongFt) {
      parts.push(`${w.rangeFt}/${w.rangeLongFt} ft`);
    } else if (w.rangeFt) {
      parts.push(`${w.rangeFt} ft`);
    }
    if (w.mastery) parts.push(`${w.mastery} mastery`);
    lines.push(`Weapon: ${parts.join(" · ")}`);
  }
  if (def.armor) {
    const a = def.armor;
    const parts = [`AC ${a.baseAc}`];
    if (a.dexBonusMax === null) parts.push("full DEX");
    else if (a.dexBonusMax != null) parts.push(`DEX max +${a.dexBonusMax}`);
    if (a.stealthDisadvantage) parts.push("stealth disadvantage");
    if (a.shield) parts.push("shield");
    lines.push(`Armor: ${parts.join(" · ")}`);
  }
  const cost = formatItemCostLine(def);
  const weight = formatItemWeightLine(def);
  if (cost) lines.push(`Cost: ${cost}`);
  if (weight) lines.push(`Weight: ${weight}`);
  def.equippedEffects?.forEach((effect) => {
    const mod = effect.modifier;
    if (mod.type === "ac_bonus") {
      lines.push(`${effect.name}: +${mod.amount} AC while equipped`);
    } else if (mod.type === "attack_roll_bonus") {
      lines.push(`${effect.name}: +${mod.amount} to attack rolls`);
    } else if (mod.type === "on_hit_damage") {
      lines.push(`${effect.name}: +${mod.dice} ${mod.damageType} on hit`);
    }
  });
  return lines;
}
