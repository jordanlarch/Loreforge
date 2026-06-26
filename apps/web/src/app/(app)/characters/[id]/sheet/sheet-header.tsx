"use client";

import Link from "next/link";

import {
  MAX_CHARACTER_LEVEL,
  xpProgress,
  type CharacterSheet,
} from "@app/engine";

type HeaderCharacter = {
  id: string;
  name: string;
  species: string;
  background: string;
  portraitUrl: string;
  xp: number;
  classes: { class: string; level: number; subclass?: string }[];
};

export function SheetHeader({
  character,
  sheet,
  embedded,
  onNameChange,
  onSpeciesChange,
  onBackgroundChange,
  onPortraitChange,
  onLevelUp,
  canLevelUp,
  atCap,
  onXpChange,
  xpRemaining,
}: {
  character: HeaderCharacter;
  sheet: CharacterSheet;
  embedded: boolean;
  onNameChange: (name: string) => void;
  onSpeciesChange: (species: string) => void;
  onBackgroundChange: (background: string) => void;
  onPortraitChange: (url: string) => void;
  onLevelUp: () => void;
  canLevelUp: boolean;
  atCap: boolean;
  onXpChange: (xp: number) => void;
  xpRemaining: number | null;
}) {
  const progress = xpProgress(character.xp, sheet.level);
  const subclassLine = character.classes
    .map((c) =>
      c.subclass ? `${c.class} ${c.level} — ${c.subclass}` : `${c.class} ${c.level}`,
    )
    .join(" · ");

  return (
    <header className="rounded-lg border border-lore-border bg-lore-surface p-4">
      <div className="flex flex-wrap gap-4">
        <div className="relative shrink-0">
          {character.portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={character.portraitUrl}
              alt=""
              className="h-24 w-24 rounded-lg border border-lore-border object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-lore-border bg-lore-bg text-xs text-lore-muted">
              Portrait
            </div>
          )}
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded bg-lore-accent px-2 py-0.5 font-display text-sm text-lore-bg">
            {sheet.level}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          {!embedded && (
            <Link
              href="/characters"
              className="text-xs text-lore-muted hover:text-lore-text"
            >
              ← Characters
            </Link>
          )}
          <InlineField
            value={character.name}
            onCommit={onNameChange}
            className="font-display text-2xl font-semibold lg:text-3xl"
            ariaLabel="Character name"
          />
          <p className="mt-0.5 text-sm text-lore-muted">{subclassLine || sheet.classLine}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-sm text-lore-muted">
            <InlineField
              value={character.species}
              placeholder="Species"
              onCommit={onSpeciesChange}
              ariaLabel="Species"
            />
            <span aria-hidden>·</span>
            <InlineField
              value={character.background}
              placeholder="Background"
              onCommit={onBackgroundChange}
              ariaLabel="Background"
            />
          </p>
          <div className="mt-2 max-w-sm">
            <div className="mb-1 flex justify-between text-xs text-lore-muted">
              <label className="flex items-center gap-1">
                XP
                <input
                  type="number"
                  min={0}
                  defaultValue={character.xp}
                  key={character.xp}
                  onBlur={(e) => {
                    const next = Math.max(0, Number(e.target.value) || 0);
                    if (next !== character.xp) onXpChange(next);
                  }}
                  className="w-20 rounded border border-lore-border bg-lore-bg px-1 py-0.5 text-right font-mono tabular-nums outline-none focus:border-lore-accent"
                  aria-label="Experience points"
                />
              </label>
              {atCap ? (
                <span>Max level</span>
              ) : progress.nextLevel ? (
                <span>
                  → Lvl {progress.nextLevel}
                  {!canLevelUp && xpRemaining != null && xpRemaining > 0 && (
                    <span className="text-lore-accent">
                      {" "}
                      ({xpRemaining.toLocaleString()} to unlock)
                    </span>
                  )}
                </span>
              ) : null}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-lore-bg">
              <div
                className="h-full rounded-full bg-lore-accent"
                style={{ width: `${Math.round(progress.fraction * 100)}%` }}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onLevelUp}
              disabled={!canLevelUp && !atCap}
              className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-1.5 text-sm font-medium disabled:opacity-40"
            >
              {atCap ? "Max level" : canLevelUp ? "Level Up" : "Level Up (locked)"}
            </button>
            <span className="rounded border border-lore-border px-3 py-1.5 text-sm text-lore-muted">
              Prof {sheet.proficiencyBonus >= 0 ? `+${sheet.proficiencyBonus}` : sheet.proficiencyBonus}
            </span>
          </div>
        </div>

        <div className="w-full max-w-[140px] shrink-0">
          <label className="block text-[10px] uppercase tracking-widest text-lore-muted">
            Portrait URL
          </label>
          <input
            defaultValue={character.portraitUrl}
            placeholder="https://…"
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next !== character.portraitUrl) onPortraitChange(next);
            }}
            className="mt-1 w-full rounded border border-lore-border bg-lore-bg px-2 py-1 text-xs outline-none focus:border-lore-accent"
          />
        </div>
      </div>
    </header>
  );
}

function InlineField({
  value,
  onCommit,
  className = "",
  placeholder,
  ariaLabel,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      defaultValue={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onBlur={(e) => {
        const next = e.target.value.trim();
        if (next !== value) onCommit(next);
      }}
      className={`-mx-1 rounded border border-transparent bg-transparent px-1 outline-none hover:border-lore-border focus:border-lore-accent ${className} ${
        value ? "text-lore-text" : "italic text-lore-muted"
      }`}
    />
  );
}

export { MAX_CHARACTER_LEVEL };
