"use client";

import Link from "next/link";
import { useState } from "react";

import type { Ability } from "@app/engine";

import { trpc } from "@/lib/trpc/client";
import {
  REALM_ENTITY_TYPES,
  REALM_TYPE_LABEL,
  REALM_TYPE_LABEL_PLURAL,
  emptyNpcData,
  type NpcData,
  type RealmEntityType,
} from "@/lib/realms";

const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

type ViewMode = "grid" | "list";

export function RealmsBrowser() {
  const [typeFilter, setTypeFilter] = useState<RealmEntityType | undefined>();
  const [view, setView] = useState<ViewMode>("grid");
  const [creating, setCreating] = useState(false);

  const counts = trpc.realms.counts.useQuery();
  const list = trpc.realms.list.useQuery(
    typeFilter ? { type: typeFilter } : undefined,
  );

  const canCreateHere = typeFilter === undefined || typeFilter === "npc";

  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <aside className="space-y-1.5">
        <div className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
          Type
        </div>
        <TypeChip
          active={typeFilter === undefined}
          onClick={() => setTypeFilter(undefined)}
          count={counts.data?.all}
        >
          All
        </TypeChip>
        {REALM_ENTITY_TYPES.map((t) => (
          <TypeChip
            key={t}
            active={typeFilter === t}
            onClick={() => setTypeFilter(t)}
            count={counts.data?.byType[t]}
          >
            {REALM_TYPE_LABEL_PLURAL[t]}
          </TypeChip>
        ))}
      </aside>

      <section>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-lore-muted">
            {list.isLoading
              ? "Loading…"
              : `${list.data?.length ?? 0} ${
                  typeFilter
                    ? REALM_TYPE_LABEL_PLURAL[typeFilter].toLowerCase()
                    : "entit" + (list.data?.length === 1 ? "y" : "ies")
                }`}
          </span>

          <div className="flex items-center gap-3">
            <ViewToggle view={view} onChange={setView} />
            {canCreateHere ? (
              <button
                onClick={() => setCreating((c) => !c)}
                className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
              >
                {creating ? "Cancel" : "+ New NPC"}
              </button>
            ) : (
              <button
                disabled
                title="Forms for this type arrive in a later slice. NPCs are the first realized type."
                className="cursor-not-allowed rounded border border-lore-border px-3 py-1.5 text-sm text-lore-muted opacity-60"
              >
                + New {typeFilter ? REALM_TYPE_LABEL[typeFilter] : ""}
              </button>
            )}
          </div>
        </div>

        {creating && canCreateHere && (
          <NpcForm onCreated={() => setCreating(false)} />
        )}

        {!list.isLoading && (list.data?.length ?? 0) === 0 && !creating ? (
          <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
            No entities here yet. Forge your first NPC to begin populating your
            world.
          </div>
        ) : view === "grid" ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(list.data ?? []).map((e) => (
              <li key={e.id}>
                <EntityCard entity={e} />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-lore-border rounded-lg border border-lore-border">
            {(list.data ?? []).map((e) => (
              <li key={e.id}>
                <EntityRow entity={e} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type EntityListItem = {
  id: string;
  type: RealmEntityType;
  name: string;
  summary: string;
  isStub: boolean;
};

function EntityCard({ entity }: { entity: EntityListItem }) {
  return (
    <Link
      href={`/realms/${entity.id}`}
      className={`flex h-full flex-col gap-2 rounded-lg border bg-lore-surface p-5 transition-colors hover:border-lore-accent ${
        entity.isStub
          ? "border-dashed border-lore-border"
          : "border-lore-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-display text-lg leading-tight">
          {entity.name}
        </span>
        {entity.isStub && <StubBadge />}
      </div>
      <span className="text-xs uppercase tracking-wide text-lore-muted">
        {REALM_TYPE_LABEL[entity.type]}
      </span>
      {entity.summary && (
        <span className="line-clamp-3 text-sm text-lore-muted">
          {entity.summary}
        </span>
      )}
    </Link>
  );
}

function EntityRow({ entity }: { entity: EntityListItem }) {
  return (
    <Link
      href={`/realms/${entity.id}`}
      className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-lore-surface"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-base">{entity.name}</span>
          {entity.isStub && <StubBadge />}
        </div>
        {entity.summary && (
          <span className="block truncate text-sm text-lore-muted">
            {entity.summary}
          </span>
        )}
      </div>
      <span className="shrink-0 text-xs uppercase tracking-wide text-lore-muted">
        {REALM_TYPE_LABEL[entity.type]}
      </span>
    </Link>
  );
}

function StubBadge() {
  return (
    <span
      title="A placeholder awaiting generator expansion."
      className="shrink-0 rounded bg-lore-bg px-2 py-0.5 text-xs text-lore-muted"
    >
      Stub
    </span>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-lore-border p-1">
      {(["grid", "list"] as ViewMode[]).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded px-3 py-1 text-sm capitalize transition-colors ${
            view === v
              ? "bg-lore-accent-dim text-lore-text"
              : "text-lore-muted hover:text-lore-text"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

const inputClass =
  "w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent";

function NpcForm({ onCreated }: { onCreated: () => void }) {
  const utils = trpc.useUtils();
  const create = trpc.realms.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.realms.list.invalidate(),
        utils.realms.counts.invalidate(),
      ]);
      onCreated();
    },
  });

  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [isStub, setIsStub] = useState(false);
  const [npc, setNpc] = useState<NpcData>(emptyNpcData());
  const [className, setClassName] = useState("");
  const [classLevel, setClassLevel] = useState(1);
  const [skillsText, setSkillsText] = useState("");

  function setScore(ability: Ability, value: number) {
    setNpc((prev) => ({
      ...prev,
      abilityScores: { ...prev.abilityScores, [ability]: value },
    }));
  }

  function toggleSave(ability: Ability) {
    setNpc((prev) => ({
      ...prev,
      saveProficiencies: prev.saveProficiencies.includes(ability)
        ? prev.saveProficiencies.filter((a) => a !== ability)
        : [...prev.saveProficiencies, ability],
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const classes = className.trim()
      ? [{ class: className.trim(), level: classLevel }]
      : [];
    const skillProficiencies = skillsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    create.mutate({
      type: "npc",
      name: name.trim(),
      summary: summary.trim(),
      isStub,
      data: { ...npc, classes, skillProficiencies },
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mb-8 space-y-5 rounded-lg border border-lore-border bg-lore-surface p-6"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Species">
          <input
            value={npc.species}
            onChange={(e) => setNpc({ ...npc, species: e.target.value })}
            placeholder="Human, Dwarf…"
            className={inputClass}
          />
        </Field>
        <Field label="Role">
          <input
            value={npc.role}
            onChange={(e) => setNpc({ ...npc, role: e.target.value })}
            placeholder="Blacksmith, Innkeeper…"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Summary">
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
          placeholder="A grizzled smith with a soft spot for strays…"
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Class (optional)">
          <input
            value={className}
            onChange={(e) => setClassName(e.target.value)}
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
              setClassLevel(Number.parseInt(e.target.value, 10) || 1)
            }
            className={inputClass}
          />
        </Field>
        <Field label="Alignment">
          <input
            value={npc.alignment}
            onChange={(e) => setNpc({ ...npc, alignment: e.target.value })}
            placeholder="Neutral Good"
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
                value={npc.abilityScores[ability]}
                onChange={(e) =>
                  setScore(ability, Number.parseInt(e.target.value, 10) || 0)
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
            value={npc.maxHp}
            onChange={(e) =>
              setNpc({
                ...npc,
                maxHp: Number.parseInt(e.target.value, 10) || 1,
              })
            }
            className={inputClass}
          />
        </Field>
        <Field label="AC">
          <input
            type="number"
            min={1}
            max={40}
            value={npc.baseAc}
            onChange={(e) =>
              setNpc({
                ...npc,
                baseAc: Number.parseInt(e.target.value, 10) || 10,
              })
            }
            className={inputClass}
          />
        </Field>
        <Field label="Speed (ft)">
          <input
            type="number"
            min={0}
            max={200}
            value={npc.speed}
            onChange={(e) =>
              setNpc({
                ...npc,
                speed: Number.parseInt(e.target.value, 10) || 0,
              })
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
                npc.saveProficiencies.includes(ability)
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
          onChange={(e) => setSkillsText(e.target.value)}
          placeholder="Athletics, Intimidation, Insight"
          className={inputClass}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-lore-muted">
        <input
          type="checkbox"
          checked={isStub}
          onChange={(e) => setIsStub(e.target.checked)}
          className="accent-lore-accent"
        />
        Mark as stub (placeholder awaiting generator expansion)
      </label>

      {create.error && (
        <p className="text-sm text-red-400">{create.error.message}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
        >
          {create.isPending ? "Creating…" : "Create NPC"}
        </button>
      </div>
    </form>
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

function TypeChip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded border px-3 py-1.5 text-left text-sm transition-colors ${
        active
          ? "border-lore-accent bg-lore-accent-dim text-lore-text"
          : "border-lore-border text-lore-muted hover:text-lore-text"
      }`}
    >
      <span>{children}</span>
      {count !== undefined && (
        <span className="ml-2 tabular-nums text-xs text-lore-muted">
          {count}
        </span>
      )}
    </button>
  );
}
