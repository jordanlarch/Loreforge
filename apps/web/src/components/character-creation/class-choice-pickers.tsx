"use client";

import {
  FIGHTING_STYLES,
  fightingStylePickLevel,
  needsSubclassPick,
  subclassOptionsFor,
  subclassPickLevel,
} from "@app/engine";

export function FightingStylePicker({
  className,
  level,
  value,
  onChange,
}: {
  className: string;
  level: number;
  value: string;
  onChange: (style: string) => void;
}) {
  const pickLevel = fightingStylePickLevel(className);
  if (pickLevel == null || level < pickLevel) return null;

  return (
    <div className="mt-4">
      <h3 className="text-xs uppercase tracking-wide text-lore-muted">
        Fighting Style
      </h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {FIGHTING_STYLES.map((style) => (
          <button
            key={style}
            type="button"
            onClick={() => onChange(style)}
            className={`rounded-full border px-3 py-1 text-xs ${
              value === style
                ? "border-lore-accent bg-lore-accent-dim"
                : "border-lore-border text-lore-muted hover:text-lore-text"
            }`}
          >
            {style}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SubclassPicker({
  className,
  level,
  value,
  onChange,
}: {
  className: string;
  level: number;
  value: string;
  onChange: (subclass: string) => void;
}) {
  const options = subclassOptionsFor(className);
  const pickLevel = subclassPickLevel(className);
  if (options.length === 0 || pickLevel == null || level < pickLevel) {
    return null;
  }

  return (
    <div className="mt-4">
      <h3 className="text-xs uppercase tracking-wide text-lore-muted">
        {pickLevel === 1 ? "Subclass" : `Subclass (level ${pickLevel}+)`}
      </h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((sub) => (
          <button
            key={sub}
            type="button"
            onClick={() => onChange(sub)}
            className={`rounded border px-3 py-1.5 text-left text-xs ${
              value === sub
                ? "border-lore-accent bg-lore-accent-dim"
                : "border-lore-border text-lore-muted hover:border-lore-accent"
            }`}
          >
            {sub}
          </button>
        ))}
      </div>
    </div>
  );
}

export function classChoicesComplete(
  className: string,
  level: number,
  fightingStyle: string,
  subclass: string,
): boolean {
  const needsStyle =
    fightingStylePickLevel(className) != null &&
    level >= fightingStylePickLevel(className)!;
  if (needsStyle && !fightingStyle.trim()) return false;
  if (needsSubclassPick(className, level) && !subclass.trim()) return false;
  return true;
}
