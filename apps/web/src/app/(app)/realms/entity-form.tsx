"use client";

import { useState } from "react";

import type { Ability } from "@app/engine";

import { trpc } from "@/lib/trpc/client";
import {
  REALM_FIELDS,
  REALM_TYPE_LABEL,
  emptyDataFor,
  type NpcData,
  type RealmEntityType,
  type RealmFieldDescriptor,
} from "@/lib/realms";

const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

const inputClass =
  "w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent";

type Initial = {
  name: string;
  summary: string;
  isStub: boolean;
  data: Record<string, unknown>;
};

/**
 * Unified create/edit form for every Realms type. Shared fields (name, summary,
 * stub) plus a type-specific body: NPC renders the mechanical block, the seven
 * descriptive types render from their `REALM_FIELDS` descriptors.
 */
export function EntityForm({
  mode,
  type,
  entityId,
  initial,
  onDone,
}: {
  mode: "create" | "edit";
  type: RealmEntityType;
  entityId?: string;
  initial?: Initial;
  onDone: () => void;
}) {
  const utils = trpc.useUtils();

  async function invalidate() {
    await Promise.all([
      utils.realms.list.invalidate(),
      utils.realms.counts.invalidate(),
      entityId ? utils.realms.get.invalidate({ id: entityId }) : Promise.resolve(),
    ]);
  }

  const create = trpc.realms.create.useMutation({
    onSuccess: async () => {
      await invalidate();
      onDone();
    },
  });
  const update = trpc.realms.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      onDone();
    },
  });

  const [name, setName] = useState(initial?.name ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [isStub, setIsStub] = useState(initial?.isStub ?? false);
  const [data, setData] = useState<Record<string, unknown>>(
    initial?.data ?? emptyDataFor(type),
  );

  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const base = {
      type,
      name: name.trim(),
      summary: summary.trim(),
      isStub,
      data,
    };
    if (mode === "edit" && entityId) {
      update.mutate({ id: entityId, ...base });
    } else {
      create.mutate(base);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-5 rounded-lg border border-lore-border bg-lore-surface p-6"
    >
      <Field label="Name">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Summary">
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          placeholder="A one-line description shown on cards and the header…"
          className={inputClass}
        />
      </Field>

      {type === "npc" ? (
        <NpcFields data={data as Partial<NpcData>} setData={setData} />
      ) : (
        <DescriptiveFields type={type} data={data} setData={setData} />
      )}

      <label className="flex items-center gap-2 text-sm text-lore-muted">
        <input
          type="checkbox"
          checked={isStub}
          onChange={(e) => setIsStub(e.target.checked)}
          className="accent-lore-accent"
        />
        Mark as stub (placeholder awaiting generator expansion)
      </label>

      {error && <p className="text-sm text-red-400">{error.message}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded border border-lore-border px-4 py-2 text-sm text-lore-muted transition-colors hover:text-lore-text"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
        >
          {pending
            ? "Saving…"
            : mode === "edit"
              ? "Save changes"
              : `Create ${REALM_TYPE_LABEL[type]}`}
        </button>
      </div>
    </form>
  );
}

function DescriptiveFields({
  type,
  data,
  setData,
}: {
  type: Exclude<RealmEntityType, "npc">;
  data: Record<string, unknown>;
  setData: (next: Record<string, unknown>) => void;
}) {
  const fields = REALM_FIELDS[type];
  function set(key: string, value: string | number) {
    setData({ ...data, [key]: value });
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => (
        <div
          key={field.key}
          className={field.kind === "textarea" ? "sm:col-span-2" : ""}
        >
          <DescriptiveField
            field={field}
            value={data[field.key]}
            onChange={(v) => set(field.key, v)}
          />
        </div>
      ))}
    </div>
  );
}

function DescriptiveField({
  field,
  value,
  onChange,
}: {
  field: RealmFieldDescriptor;
  value: unknown;
  onChange: (value: string | number) => void;
}) {
  return (
    <Field label={field.label}>
      {field.kind === "select" ? (
        <select
          value={String(value ?? field.options?.[0] ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : field.kind === "number" ? (
        <input
          type="number"
          min={field.min}
          max={field.max}
          value={Number(value ?? 0)}
          onChange={(e) => onChange(Number.parseInt(e.target.value, 10) || 0)}
          className={inputClass}
        />
      ) : field.kind === "textarea" ? (
        <textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={field.placeholder}
          className={inputClass}
        />
      ) : (
        <input
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}
    </Field>
  );
}

function NpcFields({
  data,
  setData,
}: {
  data: Partial<NpcData>;
  setData: (next: Record<string, unknown>) => void;
}) {
  const npc = data;
  const [className, setClassName] = useState(npc.classes?.[0]?.class ?? "");
  const [classLevel, setClassLevel] = useState(npc.classes?.[0]?.level ?? 1);
  const [skillsText, setSkillsText] = useState(
    (npc.skillProficiencies ?? []).join(", "),
  );

  function patch(next: Partial<NpcData>) {
    setData({ ...(npc as Record<string, unknown>), ...next });
  }

  function syncClass(name: string, level: number) {
    setClassName(name);
    setClassLevel(level);
    patch({ classes: name.trim() ? [{ class: name.trim(), level }] : [] });
  }

  function syncSkills(text: string) {
    setSkillsText(text);
    patch({
      skillProficiencies: text
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  function toggleSave(ability: Ability) {
    const current = npc.saveProficiencies ?? [];
    patch({
      saveProficiencies: current.includes(ability)
        ? current.filter((a) => a !== ability)
        : [...current, ability],
    });
  }

  const scores = npc.abilityScores ?? {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Species">
          <input
            value={npc.species ?? ""}
            onChange={(e) => patch({ species: e.target.value })}
            placeholder="Human, Dwarf…"
            className={inputClass}
          />
        </Field>
        <Field label="Role">
          <input
            value={npc.role ?? ""}
            onChange={(e) => patch({ role: e.target.value })}
            placeholder="Blacksmith, Innkeeper…"
            className={inputClass}
          />
        </Field>
        <Field label="Alignment">
          <input
            value={npc.alignment ?? ""}
            onChange={(e) => patch({ alignment: e.target.value })}
            placeholder="Neutral Good"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Class (optional)">
          <input
            value={className}
            onChange={(e) => syncClass(e.target.value, classLevel)}
            placeholder="Fighter"
            className={inputClass}
          />
        </Field>
        <Field label="Class level">
          <input
            type="number"
            min={1}
            max={20}
            value={classLevel}
            onChange={(e) =>
              syncClass(className, Number.parseInt(e.target.value, 10) || 1)
            }
            className={inputClass}
          />
        </Field>
      </div>

      <div>
        <span className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
          Ability Scores
        </span>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {ABILITIES.map((ability) => (
            <label key={ability} className="block text-center">
              <span className="mb-1 block text-xs uppercase text-lore-muted">
                {ability}
              </span>
              <input
                type="number"
                min={1}
                max={30}
                value={scores[ability]}
                onChange={(e) =>
                  patch({
                    abilityScores: {
                      ...scores,
                      [ability]: Number.parseInt(e.target.value, 10) || 0,
                    },
                  })
                }
                className={`${inputClass} text-center`}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Max HP">
          <input
            type="number"
            min={1}
            max={1000}
            value={npc.maxHp ?? 10}
            onChange={(e) =>
              patch({ maxHp: Number.parseInt(e.target.value, 10) || 1 })
            }
            className={inputClass}
          />
        </Field>
        <Field label="AC">
          <input
            type="number"
            min={1}
            max={40}
            value={npc.baseAc ?? 10}
            onChange={(e) =>
              patch({ baseAc: Number.parseInt(e.target.value, 10) || 10 })
            }
            className={inputClass}
          />
        </Field>
        <Field label="Speed (ft)">
          <input
            type="number"
            min={0}
            max={200}
            value={npc.speed ?? 30}
            onChange={(e) =>
              patch({ speed: Number.parseInt(e.target.value, 10) || 0 })
            }
            className={inputClass}
          />
        </Field>
      </div>

      <div>
        <span className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
          Saving Throw Proficiencies
        </span>
        <div className="flex flex-wrap gap-2">
          {ABILITIES.map((ability) => (
            <button
              key={ability}
              type="button"
              onClick={() => toggleSave(ability)}
              className={`rounded border px-3 py-1 text-sm uppercase transition-colors ${
                (npc.saveProficiencies ?? []).includes(ability)
                  ? "border-lore-accent bg-lore-accent-dim text-lore-text"
                  : "border-lore-border text-lore-muted hover:text-lore-text"
              }`}
            >
              {ability}
            </button>
          ))}
        </div>
      </div>

      <Field label="Skill Proficiencies (comma-separated)">
        <input
          value={skillsText}
          onChange={(e) => syncSkills(e.target.value)}
          placeholder="Athletics, Intimidation, Insight"
          className={inputClass}
        />
      </Field>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
