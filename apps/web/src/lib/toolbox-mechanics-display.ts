import type { CurseDefinition, GameplayToolboxEntryDefinition, PoisonDefinition, TrapDefinition, ToolboxCheck } from "@app/engine";

function formatCheck(label: string, check: ToolboxCheck): string {
  const parts = [`${label}: DC ${check.dc}`, check.ability.toUpperCase()];
  if (check.skill) parts.push(check.skill);
  if (check.tool) parts.push(check.tool);
  return parts.join(" · ");
}

export function formatTrapMechanicsSummary(def: TrapDefinition): string[] {
  const lines: string[] = [];
  lines.push(`Trigger: ${def.trigger}`);
  if (def.effect.save) {
    lines.push(
      `Save: DC ${def.effect.save.dc} ${def.effect.save.ability.toUpperCase()} (${def.effect.save.onSuccess} on success)`,
    );
  }
  def.effect.damage?.forEach((row) => {
    lines.push(`Damage: ${row.dice} ${row.type}`);
  });
  if (def.effect.conditions?.length) {
    lines.push(`Conditions: ${def.effect.conditions.join(", ")}`);
  }
  if (def.effect.effectProse) {
    lines.push(`Effect: ${def.effect.effectProse}`);
  }
  if (def.detect) lines.push(formatCheck("Detect", def.detect));
  if (def.disable) lines.push(formatCheck("Disable", def.disable));
  lines.push(`Reset: ${def.reset}${def.resetInterval ? ` (${def.resetInterval})` : ""}`);
  return lines;
}

export function formatPoisonMechanicsSummary(def: PoisonDefinition): string[] {
  const lines: string[] = [];
  lines.push(`Type: ${def.poisonType}`);
  if (def.save) {
    lines.push(
      `Save: DC ${def.save.dc} ${def.save.ability.toUpperCase()} (${def.save.onSuccess} on success)`,
    );
  }
  def.damage?.forEach((row) => {
    lines.push(`Damage: ${row.dice} ${row.type}`);
  });
  if (def.conditions?.length) {
    lines.push(`Conditions: ${def.conditions.join(", ")}`);
  }
  if (def.repeat) {
    lines.push(`Repeat: ${def.repeat}`);
  }
  return lines;
}

export function formatCurseMechanicsSummary(def: CurseDefinition): string[] {
  const lines: string[] = [];
  if (def.contagion) {
    lines.push(`Contagion: ${def.contagion}`);
  }
  if (def.save) {
    lines.push(
      `Save: DC ${def.save.dc} ${def.save.ability.toUpperCase()} (${def.save.onSuccess} on success)`,
    );
  }
  def.effects?.forEach((effect) => {
    lines.push(`Effect: ${effect}`);
  });
  if (def.recovery) {
    lines.push(`Recovery: ${def.recovery}`);
  }
  return lines;
}

export function formatToolboxDefinitionSummary(
  def: GameplayToolboxEntryDefinition,
): string[] {
  if (def.kind === "trap") return formatTrapMechanicsSummary(def);
  if (def.kind === "poison") return formatPoisonMechanicsSummary(def);
  if (def.kind === "curse") return formatCurseMechanicsSummary(def);
  return [];
}
