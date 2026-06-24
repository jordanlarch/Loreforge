import type { SpellDefinition } from "@app/engine";

export function levelLine(def: SpellDefinition): string {
  const lvl = def.level === 0 ? "Cantrip" : `Level ${def.level}`;
  return `${lvl} · ${def.school}`;
}

export function castingLine(def: SpellDefinition): string {
  const { amount, unit } = def.castingTime;
  return `${amount} ${unit}${amount === 1 ? "" : "s"}`;
}

export function rangeLine(def: SpellDefinition): string {
  const r = def.range;
  const base =
    r.type === "feet" || r.type === "miles"
      ? `${r.amount ?? 0} ${r.type}`
      : r.type;
  return r.area ? `${base} (${r.area.size}ft ${r.area.shape})` : base;
}

export function componentsLine(def: SpellDefinition): string {
  const parts: string[] = [];
  if (def.components.verbal) parts.push("V");
  if (def.components.somatic) parts.push("S");
  if (def.components.material) parts.push(`M (${def.components.material})`);
  return parts.join(", ") || "—";
}

export function durationLine(def: SpellDefinition): string {
  const d = def.duration;
  const base =
    d.amount && d.unit !== "instantaneous"
      ? `${d.amount} ${d.unit}${d.amount === 1 ? "" : "s"}`
      : d.unit.replace(/_/g, " ");
  return def.concentration ? `Concentration, up to ${base}` : base;
}

export function SpellDefinitionStats({ def }: { def: SpellDefinition }) {
  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      <Stat label="Casting Time" value={castingLine(def)} />
      <Stat label="Range" value={rangeLine(def)} />
      <Stat label="Components" value={componentsLine(def)} />
      <Stat label="Duration" value={durationLine(def)} />
      <Stat label="Targeting" value={def.targeting} />
      {def.classes.length > 0 && (
        <Stat label="Classes" value={def.classes.join(", ")} />
      )}
      {def.ritual && <Stat label="Ritual" value="Yes" />}
    </dl>
  );
}

export function SpellDefinitionMechanics({ def }: { def: SpellDefinition }) {
  const hasMechanics =
    def.saveAgainst ||
    def.attackAgainst ||
    def.damage?.length ||
    def.healing ||
    def.upcastScaling;

  if (!hasMechanics) return null;

  return (
    <section className="mt-6">
      <h2 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
        Mechanics
      </h2>
      <ul className="space-y-2 text-sm">
        {def.saveAgainst && (
          <Mechanic
            label="Save"
            value={`${def.saveAgainst.ability.toUpperCase()} vs ${
              def.saveAgainst.dc === "spellsave"
                ? "spell save DC"
                : def.saveAgainst.dc
            } — on success: ${def.saveAgainst.onSuccess.replace(/_/g, " ")}`}
          />
        )}
        {def.attackAgainst && (
          <Mechanic
            label="Attack"
            value={`${def.attackAgainst.type} spell attack`}
          />
        )}
        {def.damage?.map((d, i) => (
          <Mechanic key={i} label="Damage" value={`${d.dice} ${d.type}`} />
        ))}
        {def.healing && <Mechanic label="Healing" value={def.healing.dice} />}
        {def.upcastScaling && (
          <Mechanic
            label="At higher levels"
            value={`+${def.upcastScaling.perSlotDice} ${def.upcastScaling.appliesTo} per slot above ${def.level}`}
          />
        )}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-lore-border/50 py-1.5">
      <dt className="text-sm text-lore-muted">{label}</dt>
      <dd className="text-right text-sm capitalize">{value}</dd>
    </div>
  );
}

function Mechanic({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex gap-3 rounded border border-lore-border bg-lore-surface px-3 py-2">
      <span className="w-32 shrink-0 text-xs uppercase tracking-wide text-lore-muted">
        {label}
      </span>
      <span>{value}</span>
    </li>
  );
}
