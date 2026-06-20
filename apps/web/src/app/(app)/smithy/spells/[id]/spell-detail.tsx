"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { SpellDefinition } from "@app/engine";

import { trpc } from "@/lib/trpc/client";

function levelLine(def: SpellDefinition): string {
  const lvl = def.level === 0 ? "Cantrip" : `Level ${def.level}`;
  return `${lvl} · ${def.school}`;
}

function castingLine(def: SpellDefinition): string {
  const { amount, unit } = def.castingTime;
  return `${amount} ${unit}${amount === 1 ? "" : "s"}`;
}

function rangeLine(def: SpellDefinition): string {
  const r = def.range;
  const base =
    r.type === "feet" || r.type === "miles"
      ? `${r.amount ?? 0} ${r.type}`
      : r.type;
  return r.area ? `${base} (${r.area.size}ft ${r.area.shape})` : base;
}

function componentsLine(def: SpellDefinition): string {
  const parts: string[] = [];
  if (def.components.verbal) parts.push("V");
  if (def.components.somatic) parts.push("S");
  if (def.components.material) parts.push(`M (${def.components.material})`);
  return parts.join(", ") || "—";
}

function durationLine(def: SpellDefinition): string {
  const d = def.duration;
  const base =
    d.amount && d.unit !== "instantaneous"
      ? `${d.amount} ${d.unit}${d.amount === 1 ? "" : "s"}`
      : d.unit.replace(/_/g, " ");
  return def.concentration ? `Concentration, up to ${base}` : base;
}

export function SpellDetail({ id }: { id: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const query = trpc.smithy.getSpell.useQuery({ id });

  const remove = trpc.smithy.deleteSpell.useMutation({
    onSuccess: async () => {
      await utils.smithy.listSpells.invalidate();
      router.push("/smithy");
    },
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-lore-muted">Loading…</div>
    );
  }

  const spell = query.data;
  if (!spell) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/smithy"
          className="text-sm text-lore-muted hover:text-lore-text"
        >
          ← The Smithy
        </Link>
        <div className="mt-6 rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
          Spell not found.
        </div>
      </div>
    );
  }

  const def = spell.definition;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/smithy"
        className="text-sm text-lore-muted hover:text-lore-text"
      >
        ← The Smithy
      </Link>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b border-lore-border pb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            {spell.name}
          </h1>
          <p className="mt-1 capitalize text-lore-muted">
            {levelLine(def)}
            {def.ritual && " · ritual"}
            {spell.source === "codex" && " · copied from Codex"}
          </p>
        </div>
        <button
          onClick={() => remove.mutate({ id })}
          disabled={remove.isPending}
          className="rounded border border-red-500/40 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
        >
          {remove.isPending ? "Deleting…" : "Delete"}
        </button>
      </header>

      <dl className="mt-8 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        <Stat label="Casting Time" value={castingLine(def)} />
        <Stat label="Range" value={rangeLine(def)} />
        <Stat label="Components" value={componentsLine(def)} />
        <Stat label="Duration" value={durationLine(def)} />
        <Stat label="Targeting" value={def.targeting} />
        {def.classes.length > 0 && (
          <Stat label="Classes" value={def.classes.join(", ")} />
        )}
      </dl>

      {(def.saveAgainst || def.attackAgainst || def.damage || def.healing) && (
        <section className="mt-8">
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
              <Mechanic
                key={i}
                label="Damage"
                value={`${d.dice} ${d.type}`}
              />
            ))}
            {def.healing && (
              <Mechanic label="Healing" value={def.healing.dice} />
            )}
            {def.upcastScaling && (
              <Mechanic
                label="At higher levels"
                value={`+${def.upcastScaling.perSlotDice} ${def.upcastScaling.appliesTo} per slot above ${def.level}`}
              />
            )}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
          Description
        </h2>
        {def.description ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {def.description}
          </p>
        ) : (
          <p className="text-sm text-lore-muted">No description yet.</p>
        )}
      </section>

      {remove.error && (
        <p className="mt-6 text-sm text-red-400">{remove.error.message}</p>
      )}
    </div>
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
