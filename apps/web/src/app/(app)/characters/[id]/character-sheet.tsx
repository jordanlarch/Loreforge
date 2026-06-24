"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  buildCharacterSheet,
  MAX_CHARACTER_LEVEL,
  xpProgress,
  type Ability,
} from "@app/engine";

import { trpc } from "@/lib/trpc/client";

import { SrdHint } from "@/components/srd-hint";

import { EquipmentTab } from "./equipment-tab";
import { LevelUpDialog } from "./level-up-dialog";
import { SpellsTab } from "./spells-tab";

const TABS = ["Overview", "Equipment", "Spells", "Notes"] as const;
type Tab = (typeof TABS)[number];

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
  const [tab, setTab] = useState<Tab>("Overview");

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
  const progress = xpProgress(character.xp, sheet.level);
  const atCap = sheet.level >= MAX_CHARACTER_LEVEL;

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
          <div className="mt-3 max-w-xs">
            <div className="mb-1 flex items-center justify-between text-xs text-lore-muted">
              <span>
                XP {character.xp.toLocaleString()}
                {atCap
                  ? " · Max level"
                  : ` / ${progress.ceiling?.toLocaleString()}`}
              </span>
              {!atCap && progress.nextLevel && (
                <span>→ Lvl {progress.nextLevel}</span>
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-lore-surface">
              <div
                className="h-full rounded-full bg-lore-accent transition-all"
                style={{ width: `${Math.round(progress.fraction * 100)}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => setLevelingUp(true)}
              disabled={!progress.canLevelUp}
              title={
                atCap
                  ? "Already at the level 20 cap"
                  : progress.canLevelUp
                    ? undefined
                    : `Need ${progress.remaining?.toLocaleString()} more XP to level up`
              }
              className="mt-2 rounded-lg border border-lore-accent bg-lore-accent-dim px-4 py-1.5 text-sm font-medium text-lore-text transition-colors hover:border-lore-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              {atCap
                ? "Max level"
                : progress.canLevelUp
                  ? "Level Up"
                  : "Level Up (locked)"}
            </button>
          </div>
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
          <EditableStat
            label="XP"
            value={character.xp}
            onCommit={(xp) => update.mutate({ id, xp })}
          />
          <Stat label="Init" value={signed(sheet.initiative)} />
          <Stat label="Prof" value={signed(sheet.proficiencyBonus)} />
        </div>
      </header>

      <nav className="mt-6 flex flex-wrap gap-1 border-b border-lore-border">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
              tab === t
                ? "border-lore-accent text-lore-text"
                : "border-transparent text-lore-muted hover:text-lore-text"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "Overview" && (
        <>
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
                <SrdHint kind="ability" ability={ability} label={ability.toUpperCase()} />
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
                  <SrdHint
                    kind="ability"
                    ability={save.ability}
                    label={ABILITY_LABELS[save.ability]}
                  />
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
                  <SrdHint kind="skill" skill={skill} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
          Portrait
        </h2>
        {character.portraitUrl ? (
          // Portrait is a URL stub (#56); upload pipeline is deferred.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={character.portraitUrl}
            alt={`${character.name} portrait`}
            className="mb-2 h-40 w-40 rounded-lg border border-lore-border object-cover"
          />
        ) : (
          <p className="mb-2 text-sm text-lore-muted">No portrait yet.</p>
        )}
        <EditableText
          value={character.portraitUrl}
          placeholder="Portrait image URL…"
          onCommit={(portraitUrl) => update.mutate({ id, portraitUrl })}
          ariaLabel="Portrait URL"
          className="text-sm"
        />
      </section>

      <p className="mt-10 text-xs text-lore-muted">
        Click any score, HP, AC, XP, name, or detail to edit. Derived values are
        recomputed by <code className="text-lore-text">@app/engine</code>.
      </p>
        </>
      )}

      {tab === "Equipment" && (
        <div className="mt-8">
          <EquipmentTab
            equipment={character.equipment}
            saving={update.isPending}
            onSave={(equipment) => update.mutate({ id, equipment })}
          />
        </div>
      )}

      {tab === "Spells" && (
        <div className="mt-8">
          <SpellsTab
            spells={character.spells}
            saving={update.isPending}
            onSave={(spells) => update.mutate({ id, spells })}
          />
        </div>
      )}

      {tab === "Notes" && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
            Notes
          </h2>
          <EditableTextArea
            value={character.notes}
            placeholder="Backstory, goals, session notes…"
            onCommit={(notes) => update.mutate({ id, notes })}
            ariaLabel="Notes"
          />
        </section>
      )}

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

function EditableTextArea({
  value,
  onCommit,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
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
      <textarea
        ref={textareaRef}
        value={draft}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // Enter inserts a newline; Cmd/Ctrl+Enter commits, Escape cancels.
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
          if (e.key === "Escape") setEditing(false);
        }}
        rows={5}
        className={`${EDIT_INPUT_CLASS} w-full whitespace-pre-wrap`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      aria-label={ariaLabel ? `Edit ${ariaLabel}` : undefined}
      className={`block w-full whitespace-pre-wrap rounded border border-lore-border bg-lore-surface px-3 py-2 text-left text-sm hover:border-lore-accent ${
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
