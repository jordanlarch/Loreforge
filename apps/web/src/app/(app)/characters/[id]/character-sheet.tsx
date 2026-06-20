"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { buildCharacterSheet, type Ability } from "@app/engine";

import { trpc } from "@/lib/trpc/client";

import { LevelUpDialog } from "./level-up-dialog";

const ABILITY_LABELS: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function CharacterSheetView({ id }: { id: string }) {
  const utils = trpc.useUtils();
  const query = trpc.characters.get.useQuery({ id });
  const [levelingUp, setLevelingUp] = useState(false);

  const update = trpc.characters.update.useMutation({
    async onMutate(vars) {
      // Optimistically patch the cached row so the engine re-derives instantly.
      await utils.characters.get.cancel({ id });
      const previous = utils.characters.get.getData({ id });
      utils.characters.get.setData({ id }, (old) =>
        old ? { ...old, ...vars } : old,
      );
      return { previous };
    },
    onError(_err, _vars, context) {
      if (context?.previous !== undefined) {
        utils.characters.get.setData({ id }, context.previous);
      }
    },
    async onSettled() {
      await Promise.all([
        utils.characters.get.invalidate({ id }),
        utils.characters.list.invalidate(),
      ]);
    },
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-lore-muted">
        Loading…
      </div>
    );
  }

  const character = query.data;
  if (!character) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link
          href="/characters"
          className="text-sm text-lore-muted hover:text-lore-text"
        >
          ← Characters
        </Link>
        <div className="mt-6 rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
          Character not found.
        </div>
      </div>
    );
  }

  const sheet = buildCharacterSheet(character);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/characters"
        className="text-sm text-lore-muted hover:text-lore-text"
      >
        ← Characters
      </Link>

      {update.error && (
        <p
          role="alert"
          className="mt-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          {update.error.message}
        </p>
      )}

      <header className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b border-lore-border pb-6">
        <div>
          <EditableText
            value={character.name}
            onCommit={(name) => update.mutate({ id, name })}
            className="font-display text-4xl font-semibold tracking-tight"
            ariaLabel="Character name"
          />
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-lore-muted">
            <EditableText
              value={character.species}
              placeholder="Species"
              onCommit={(species) => update.mutate({ id, species })}
              ariaLabel="Species"
            />
            <span aria-hidden>·</span>
            <span>{sheet.classLine}</span>
            <span aria-hidden>·</span>
            <EditableText
              value={character.background}
              placeholder="Background"
              onCommit={(background) => update.mutate({ id, background })}
              ariaLabel="Background"
            />
          </p>
          <button
            type="button"
            onClick={() => setLevelingUp(true)}
            className="mt-3 rounded-lg border border-lore-accent bg-lore-accent-dim px-4 py-1.5 text-sm font-medium text-lore-text transition-colors hover:border-lore-accent"
          >
            Level Up
          </button>
        </div>
        <div className="flex gap-3 text-center">
          <EditableStat
            label="AC"
            value={character.baseAc}
            onCommit={(baseAc) => update.mutate({ id, baseAc })}
          />
          <EditableStat
            label="HP"
            value={character.maxHp}
            onCommit={(maxHp) => update.mutate({ id, maxHp })}
          />
          <EditableStat
            label="Speed"
            value={character.speed}
            suffix=" ft"
            onCommit={(speed) => update.mutate({ id, speed })}
          />
          <Stat label="Init" value={signed(sheet.initiative)} />
          <Stat label="Prof" value={signed(sheet.proficiencyBonus)} />
        </div>
      </header>

      <section className="mt-8">
        <h2 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
          Ability Scores
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {(Object.keys(ABILITY_LABELS) as Ability[]).map((ability) => (
            <div
              key={ability}
              className="rounded-lg border border-lore-border bg-lore-surface p-4 text-center"
            >
              <div className="text-xs uppercase tracking-wide text-lore-muted">
                {ability}
              </div>
              <div className="mt-1 font-display text-3xl">
                {signed(sheet.abilityModifiers[ability])}
              </div>
              <div className="mt-1 flex justify-center text-sm text-lore-muted">
                <EditableNumber
                  value={character.abilityScores[ability]}
                  ariaLabel={`${ABILITY_LABELS[ability]} score`}
                  onCommit={(score) =>
                    update.mutate({
                      id,
                      abilityScores: {
                        ...character.abilityScores,
                        [ability]: score,
                      },
                    })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
            Saving Throws
          </h2>
          <ul className="space-y-1.5">
            {sheet.savingThrows.map((save) => (
              <li
                key={save.ability}
                className="flex items-center justify-between rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      save.proficient ? "bg-lore-accent" : "bg-lore-border"
                    }`}
                    aria-hidden
                  />
                  {ABILITY_LABELS[save.ability]}
                </span>
                <span className="font-mono">{signed(save.modifier)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
            Skill Proficiencies
          </h2>
          {sheet.skillProficiencies.length === 0 ? (
            <p className="text-sm text-lore-muted">None.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {sheet.skillProficiencies.map((skill) => (
                <li
                  key={skill}
                  className="rounded-full border border-lore-border bg-lore-surface px-3 py-1 text-sm"
                >
                  {skill}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-10 text-xs text-lore-muted">
        Click any score, HP, AC, name, or detail to edit. Derived values are
        recomputed by <code className="text-lore-text">@app/engine</code>.
      </p>

      {levelingUp && (
        <LevelUpDialog
          character={character}
          onClose={() => setLevelingUp(false)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-[60px] rounded-lg border border-lore-border bg-lore-surface px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-lore-muted">
        {label}
      </div>
      <div className="mt-0.5 font-display text-lg">{value}</div>
    </div>
  );
}

function EditableStat({
  label,
  value,
  suffix = "",
  onCommit,
}: {
  label: string;
  value: number;
  suffix?: string;
  onCommit: (value: number) => void;
}) {
  return (
    <div className="min-w-[60px] rounded-lg border border-lore-border bg-lore-surface px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-lore-muted">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline justify-center font-display text-lg">
        <EditableNumber
          value={value}
          ariaLabel={label}
          onCommit={onCommit}
        />
        {suffix && <span className="text-sm text-lore-muted">{suffix}</span>}
      </div>
    </div>
  );
}

const EDIT_INPUT_CLASS =
  "rounded border border-lore-accent bg-lore-bg px-1 py-0.5 outline-none focus:border-lore-accent";

function EditableText({
  value,
  onCommit,
  className = "",
  placeholder,
  ariaLabel,
}: {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function start() {
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next !== value) onCommit(next);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className={`${EDIT_INPUT_CLASS} ${className}`}
        size={Math.max(draft.length, placeholder?.length ?? 4)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      aria-label={ariaLabel ? `Edit ${ariaLabel}` : undefined}
      className={`-mx-1 rounded px-1 text-left hover:bg-lore-surface ${className} ${
        value ? "" : "italic text-lore-muted"
      }`}
    >
      {value || placeholder || "—"}
    </button>
  );
}

function EditableNumber({
  value,
  onCommit,
  ariaLabel,
}: {
  value: number;
  onCommit: (value: number) => void;
  ariaLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function start() {
    setDraft(String(value));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const next = Number.parseInt(draft, 10);
    // NaN means an empty / non-numeric draft — treat as a cancel, not an edit.
    // Out-of-range integers are sent through so the server gate rejects them
    // with feedback (rather than silently clamping).
    if (!Number.isNaN(next) && next !== value) onCommit(next);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={draft}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className={`${EDIT_INPUT_CLASS} w-16 text-center`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      aria-label={ariaLabel ? `Edit ${ariaLabel}` : undefined}
      className="-mx-1 rounded px-1 tabular-nums hover:bg-lore-bg"
    >
      {value}
    </button>
  );
}
