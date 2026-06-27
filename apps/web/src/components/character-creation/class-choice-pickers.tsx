"use client";

import {
  FIGHTING_STYLES,
  fightingStyleDescription,
  fightingStylePickLevel,
  needsSubclassPick,
  subclassPickLevel,
} from "@app/engine";

import { trpc } from "@/lib/trpc/client";

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
          <span key={style} className="group relative inline-flex">
            <button
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
            {fightingStyleDescription(style) && (
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-lg border border-lore-border bg-lore-surface px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed text-lore-muted shadow-lg group-hover:block group-focus-within:block"
              >
                {fightingStyleDescription(style)}
              </span>
            )}
          </span>
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
  const pickLevel = subclassPickLevel(className);
  const catalog = trpc.codex.listSubclasses.useQuery(undefined);
  const options =
    catalog.data?.filter((s) => s.className === className) ?? [];

  if (pickLevel == null || level < pickLevel) {
    return null;
  }

  return (
    <div className="mt-4">
      <h3 className="text-xs uppercase tracking-wide text-lore-muted">
        {pickLevel === 1 ? "Subclass" : `Subclass (level ${pickLevel}+)`}
      </h3>
      {catalog.isLoading ? (
        <p className="mt-2 text-sm text-lore-muted">Loading subclasses…</p>
      ) : options.length === 0 ? (
        <p className="mt-2 text-sm text-lore-muted">
          No Codex subclasses found for {className}.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {options.map((sub) => (
            <span key={sub.slug} className="group relative inline-flex">
              <button
                type="button"
                onClick={() => onChange(sub.name)}
                className={`rounded border px-3 py-1.5 text-left text-xs ${
                  value === sub.name
                    ? "border-lore-accent bg-lore-accent-dim"
                    : "border-lore-border text-lore-muted hover:border-lore-accent"
                }`}
              >
                {sub.name}
              </button>
              {sub.description?.trim() && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-lg border border-lore-border bg-lore-surface px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed text-lore-muted shadow-lg group-hover:block group-focus-within:block"
                >
                  {sub.description}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
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
