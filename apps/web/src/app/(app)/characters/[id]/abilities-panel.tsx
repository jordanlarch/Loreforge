"use client";

import type { Ability, AbilityScores, CharacterSheet, SavingThrow } from "@app/engine";
import { ABILITIES } from "@app/engine";

import { SrdHint } from "@/components/srd-hint";

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function saveForAbility(
  saves: SavingThrow[],
  ability: Ability,
): SavingThrow {
  return saves.find((s) => s.ability === ability)!;
}

/**
 * D&D Beyond–style ability row: score + Mod / Save boxes with proficiency cues.
 */
export function AbilitiesPanel({
  sheet,
  abilityScores,
  onScoreChange,
  onToggleSaveProficiency,
}: {
  sheet: CharacterSheet;
  abilityScores: AbilityScores;
  onScoreChange: (ability: Ability, score: number) => void;
  onToggleSaveProficiency: (ability: Ability) => void;
}) {
  return (
    <section className="rounded-lg border border-lore-border bg-lore-surface">
      <header className="flex items-center justify-between border-b border-lore-border px-4 py-2">
        <h2 className="font-display text-sm uppercase tracking-widest text-lore-accent">
          Abilities
        </h2>
      </header>
      <div className="grid grid-cols-3 divide-x divide-lore-border sm:grid-cols-6">
        {ABILITIES.map((ability) => {
          const save = saveForAbility(sheet.savingThrows, ability);
          return (
            <div key={ability} className="flex flex-col px-2 py-3 sm:px-3">
              <div className="mb-2 flex items-center justify-between gap-1">
                <span className="text-sm font-bold tracking-wide text-lore-text">
                  <SrdHint
                    kind="ability"
                    ability={ability}
                    label={ability.toUpperCase()}
                  />
                </span>
                <ScoreBox
                  value={abilityScores[ability]}
                  ariaLabel={`${ability} score`}
                  onChange={(score) => onScoreChange(ability, score)}
                />
              </div>
              <div className="flex gap-1.5">
                <ModifierBox
                  label="Mod"
                  value={signed(sheet.abilityModifiers[ability])}
                  variant="mod"
                />
                <ModifierBox
                  label="Save"
                  value={signed(save.modifier)}
                  variant={save.proficient ? "proficient" : "default"}
                  onClick={() => onToggleSaveProficiency(ability)}
                  proficient={save.proficient}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ScoreBox({
  value,
  ariaLabel,
  onChange,
}: {
  value: number;
  ariaLabel: string;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      min={1}
      max={30}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => {
        const next = Number.parseInt(e.target.value, 10);
        if (!Number.isNaN(next)) onChange(next);
      }}
      className="h-7 w-9 rounded border border-lore-border bg-lore-bg text-center text-sm tabular-nums text-lore-text outline-none focus:border-lore-accent"
    />
  );
}

function ModifierBox({
  label,
  value,
  variant,
  proficient,
  onClick,
}: {
  label: string;
  value: string;
  variant: "mod" | "proficient" | "default";
  proficient?: boolean;
  onClick?: () => void;
}) {
  const boxClass =
    variant === "proficient"
      ? "border-red-600/80 bg-red-950/60 text-lore-text"
      : variant === "mod"
        ? "border-lore-border bg-lore-bg text-lore-text"
        : "border-lore-border bg-black/40 text-lore-text";

  return (
    <div className="flex flex-1 flex-col items-center">
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={`flex w-full flex-col items-center rounded-md border px-1 py-2 transition-colors ${boxClass} ${
          onClick ? "cursor-pointer hover:brightness-110" : "cursor-default"
        }`}
      >
        <span className="font-display text-lg leading-none tabular-nums">
          {value}
        </span>
        {onClick && (
          <ProficiencyDot proficient={proficient ?? false} className="mt-1.5" />
        )}
      </button>
      <span className="mt-1 text-[10px] uppercase tracking-wider text-lore-muted">
        {label}
      </span>
    </div>
  );
}

function ProficiencyDot({
  proficient,
  className = "",
}: {
  proficient: boolean;
  className?: string;
}) {
  if (proficient) {
    return (
      <span
        className={`block h-2 w-2 rounded-full bg-red-500 ${className}`}
        aria-hidden
      />
    );
  }
  return (
    <span
      className={`block h-2.5 w-2.5 rounded-full border border-dashed border-lore-muted/70 ${className}`}
      aria-hidden
    />
  );
}

export { ProficiencyDot, signed };
