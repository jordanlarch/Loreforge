import type { ItemDefinition } from "@app/engine";

export function formatItemMechanicsSummary(def: ItemDefinition): string[] {
  const lines: string[] = [];
  if (def.weapon) {
    const w = def.weapon;
    const parts = [`${w.damage.dice} ${w.damage.type}`];
    if (w.attackBonus) parts.push(`+${w.attackBonus} attack/damage`);
    if (w.finesse) parts.push("finesse");
    if (w.ranged) parts.push("ranged");
    if (w.rangeFt) parts.push(`${w.rangeFt} ft`);
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
