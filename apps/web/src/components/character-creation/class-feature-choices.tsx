"use client";

import {
  classFeatureChoicesForLevel,
  readFeatureChoice,
  writeFeatureChoice,
  type ClassFeatureChoiceDef,
} from "@app/engine";

export function ClassFeatureChoicePanel({
  className,
  level,
  subclass,
  choices,
  onChange,
}: {
  className: string;
  level: number;
  subclass?: string;
  choices: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const defs = classFeatureChoicesForLevel(className, level, subclass);
  if (defs.length === 0) return null;

  return (
    <div className="mt-4 space-y-4">
      {defs.map((def) => (
        <FeatureChoicePicker
          key={`${level}-${def.id}`}
          className={className}
          level={level}
          def={def}
          selected={readFeatureChoice(choices, className, level, def)}
          onChange={(values) =>
            onChange(writeFeatureChoice(choices, className, level, def, values))
          }
        />
      ))}
    </div>
  );
}

function FeatureChoicePicker({
  className,
  level,
  def,
  selected,
  onChange,
}: {
  className: string;
  level: number;
  def: ClassFeatureChoiceDef;
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  function toggle(option: string) {
    if (def.kind === "single") {
      onChange(selected[0] === option ? [] : [option]);
      return;
    }
    const set = new Set(selected);
    if (set.has(option)) set.delete(option);
    else if (set.size < def.choose) set.add(option);
    onChange([...set]);
  }

  return (
    <div className="rounded-lg border border-lore-border bg-lore-surface p-4">
      <h3 className="text-xs uppercase tracking-wide text-lore-muted">
        {def.label}
      </h3>
      {def.hint && (
        <p className="mt-1 text-xs text-lore-muted">{def.hint}</p>
      )}
      <p className="mt-1 text-xs text-lore-muted">
        {def.kind === "multi"
          ? `Choose ${def.choose}.`
          : "Choose one."}
        {selected.length > 0 && def.kind === "multi"
          ? ` (${selected.length}/${def.choose})`
          : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {def.options.map((option) => {
          const active = selected.includes(option);
          const disabled =
            def.kind === "multi" &&
            !active &&
            selected.length >= def.choose;
          return (
            <button
              key={`${className}-${level}-${def.id}-${option}`}
              type="button"
              disabled={disabled}
              onClick={() => toggle(option)}
              className={`rounded-full border px-3 py-1 text-xs disabled:opacity-40 ${
                active
                  ? "border-lore-accent bg-lore-accent-dim"
                  : "border-lore-border text-lore-muted hover:text-lore-text"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** @deprecated Use ClassFeatureChoicePanel — Ranger L1/L2 picks are interactive now. */
export function RangerFeatureChoices() {
  return null;
}

export function rangerFeatureChoicesComplete(
  className: string,
  level: number,
  choices: Record<string, string>,
  subclass?: string,
): boolean {
  const defs = classFeatureChoicesForLevel(className, level, subclass);
  if (defs.length === 0) return true;
  return defs.every((def) => {
    const selected = readFeatureChoice(choices, className, level, def);
    return selected.length === def.choose;
  });
}
