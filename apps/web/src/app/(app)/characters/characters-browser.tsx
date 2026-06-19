"use client";

import Link from "next/link";
import { useState } from "react";

import { ABILITIES, buildCharacterSheet, type Ability } from "@app/engine";

import { trpc } from "@/lib/trpc/client";

const ABILITY_LABELS: Record<Ability, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

export function CharactersBrowser() {
  const [creating, setCreating] = useState(false);
  const list = trpc.characters.list.useQuery();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <span className="text-sm text-lore-muted">
          {list.isLoading
            ? "Loading…"
            : `${list.data?.length ?? 0} character${
                list.data?.length === 1 ? "" : "s"
              }`}
        </span>
        <button
          onClick={() => setCreating((c) => !c)}
          className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
        >
          {creating ? "Cancel" : "New character"}
        </button>
      </div>

      {creating && (
        <CreateCharacterForm onCreated={() => setCreating(false)} />
      )}

      {!list.isLoading && (list.data?.length ?? 0) === 0 && !creating ? (
        <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
          No characters yet. Create your first one to get started.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(list.data ?? []).map((character) => {
            const sheet = buildCharacterSheet(character);
            return (
              <li key={character.id}>
                <Link
                  href={`/characters/${character.id}`}
                  className="flex h-full flex-col gap-3 rounded-lg border border-lore-border bg-lore-surface p-5 transition-colors hover:border-lore-accent"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display text-xl">{sheet.name}</span>
                    <span className="rounded bg-lore-bg px-2 py-0.5 text-xs text-lore-accent">
                      Lvl {sheet.level}
                    </span>
                  </div>
                  <span className="text-sm text-lore-muted">
                    {[sheet.species, sheet.classLine]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <div className="mt-auto flex gap-4 text-sm text-lore-muted">
                    <span>AC {sheet.ac}</span>
                    <span>
                      HP {sheet.hp.current}/{sheet.hp.max}
                    </span>
                    <span>Speed {sheet.speed}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const DEFAULT_SCORES: Record<Ability, number> = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

function CreateCharacterForm({ onCreated }: { onCreated: () => void }) {
  const utils = trpc.useUtils();
  const create = trpc.characters.create.useMutation({
    onSuccess: async () => {
      await utils.characters.list.invalidate();
      onCreated();
    },
  });

  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [background, setBackground] = useState("");
  const [className, setClassName] = useState("");
  const [subclass, setSubclass] = useState("");
  const [level, setLevel] = useState(1);
  const [scores, setScores] = useState<Record<Ability, number>>(DEFAULT_SCORES);
  const [maxHp, setMaxHp] = useState(10);
  const [baseAc, setBaseAc] = useState(10);
  const [speed, setSpeed] = useState(30);
  const [saves, setSaves] = useState<Ability[]>([]);
  const [skillsText, setSkillsText] = useState("");

  function toggleSave(ability: Ability) {
    setSaves((prev) =>
      prev.includes(ability)
        ? prev.filter((a) => a !== ability)
        : [...prev, ability],
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      name: name.trim(),
      species: species.trim(),
      background: background.trim(),
      classes: [
        {
          class: className.trim() || "Adventurer",
          level,
          subclass: subclass.trim() || undefined,
        },
      ],
      abilityScores: scores,
      maxHp,
      baseAc,
      speed,
      saveProficiencies: saves,
      skillProficiencies: skillsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  const inputClass =
    "w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent";

  return (
    <form
      onSubmit={submit}
      className="mb-8 space-y-5 rounded-lg border border-lore-border bg-lore-surface p-6"
    >
      <p className="text-xs text-lore-muted">
        Minimal create form — the full Creation Wizard arrives later.
      </p>

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
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Background">
          <input
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Class">
          <input
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Subclass">
          <input
            value={subclass}
            onChange={(e) => setSubclass(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Level">
          <input
            type="number"
            min={1}
            max={20}
            value={level}
            onChange={(e) => setLevel(clamp(e.target.value, 1, 20, 1))}
            className={inputClass}
          />
        </Field>
      </div>

      <div>
        <div className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
          Ability Scores
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {ABILITIES.map((ability) => (
            <Field key={ability} label={ABILITY_LABELS[ability]}>
              <input
                type="number"
                min={1}
                max={30}
                value={scores[ability]}
                onChange={(e) =>
                  setScores((prev) => ({
                    ...prev,
                    [ability]: clamp(e.target.value, 1, 30, 10),
                  }))
                }
                className={inputClass}
              />
            </Field>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Max HP">
          <input
            type="number"
            min={1}
            max={1000}
            value={maxHp}
            onChange={(e) => setMaxHp(clamp(e.target.value, 1, 1000, 10))}
            className={inputClass}
          />
        </Field>
        <Field label="Base AC">
          <input
            type="number"
            min={1}
            max={40}
            value={baseAc}
            onChange={(e) => setBaseAc(clamp(e.target.value, 1, 40, 10))}
            className={inputClass}
          />
        </Field>
        <Field label="Speed (ft)">
          <input
            type="number"
            min={0}
            max={200}
            value={speed}
            onChange={(e) => setSpeed(clamp(e.target.value, 0, 200, 30))}
            className={inputClass}
          />
        </Field>
      </div>

      <div>
        <div className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
          Saving Throw Proficiencies
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ABILITIES.map((ability) => (
            <button
              key={ability}
              type="button"
              onClick={() => toggleSave(ability)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                saves.includes(ability)
                  ? "border-lore-accent bg-lore-accent-dim text-lore-text"
                  : "border-lore-border text-lore-muted hover:text-lore-text"
              }`}
            >
              {ABILITY_LABELS[ability]}
            </button>
          ))}
        </div>
      </div>

      <Field label="Skill Proficiencies (comma-separated)">
        <input
          value={skillsText}
          onChange={(e) => setSkillsText(e.target.value)}
          placeholder="Athletics, Perception, Stealth"
          className={inputClass}
        />
      </Field>

      {create.error && (
        <p className="text-sm text-red-400">{create.error.message}</p>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
        >
          {create.isPending ? "Creating…" : "Create character"}
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

function clamp(value: string, min: number, max: number, fallback: number) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
