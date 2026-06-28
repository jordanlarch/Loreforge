"use client";

import { useState } from "react";

import {
  FIGHTING_STYLES,
  fightingStyleDescription,
  fightingStyleOnFeaturesStep,
  fightingStylePickLevel,
  subclassPickLevel,
  type LevelAdvanceChoice,
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
              onClick={() => onChange(value === style ? "" : style)}
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

function SubclassDetailModal({
  name,
  description,
  features,
  onClose,
}: {
  name: string;
  description: string;
  features: { level: number; name: string; description: string }[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${name} details`}
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-lore-border bg-lore-bg p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl">{name}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded px-2 py-1 text-lore-muted hover:text-lore-text"
          >
            ✕
          </button>
        </div>
        {description.trim() && (
          <p className="mt-3 text-sm text-lore-muted">{description}</p>
        )}
        {features.length > 0 && (
          <ul className="mt-4 space-y-3">
            {features.map((f) => (
              <li
                key={`${f.level}-${f.name}`}
                className="rounded border border-lore-border bg-lore-surface px-3 py-2"
              >
                <div className="text-xs uppercase tracking-wide text-lore-accent">
                  Level {f.level}
                </div>
                <div className="mt-0.5 text-sm font-medium">{f.name}</div>
                <p className="mt-1 text-xs leading-relaxed text-lore-muted">
                  {f.description}
                </p>
              </li>
            ))}
          </ul>
        )}
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
  const [detailSlug, setDetailSlug] = useState<string | null>(null);
  const detailSub = options.find((s) => s.slug === detailSlug);

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
            <span key={sub.slug} className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => onChange(value === sub.name ? "" : sub.name)}
                className={`rounded border px-3 py-1.5 text-left text-xs ${
                  value === sub.name
                    ? "border-lore-accent bg-lore-accent-dim"
                    : "border-lore-border text-lore-muted hover:border-lore-accent"
                }`}
              >
                {sub.name}
              </button>
              <button
                type="button"
                onClick={() => setDetailSlug(sub.slug)}
                aria-label={`View ${sub.name} details`}
                className="rounded border border-lore-border px-1.5 py-1 text-xs text-lore-muted hover:border-lore-accent hover:text-lore-text"
              >
                ⓘ
              </button>
            </span>
          ))}
        </div>
      )}
      {value && (
        <button
          type="button"
          onClick={() => {
            const sub = options.find((s) => s.name === value);
            if (sub) setDetailSlug(sub.slug);
          }}
          className="mt-2 text-xs text-lore-accent hover:underline"
        >
          View {value} breakdown
        </button>
      )}
      {detailSub && (
        <SubclassDetailModal
          name={detailSub.name}
          description={detailSub.description}
          features={detailSub.features}
          onClose={() => setDetailSlug(null)}
        />
      )}
    </div>
  );
}

/** Read-only subclass catalog with detail modals (for classes that pick later). */
export function SubclassCatalogPreview({
  className,
  startingLevel,
}: {
  className: string;
  startingLevel: number;
}) {
  const pickLevel = subclassPickLevel(className);
  const catalog = trpc.codex.listSubclasses.useQuery(undefined);
  const options =
    catalog.data?.filter((s) => s.className === className) ?? [];
  const [detailSlug, setDetailSlug] = useState<string | null>(null);
  const detailSub = options.find((s) => s.slug === detailSlug);

  if (
    pickLevel == null ||
    pickLevel <= 1 ||
    startingLevel < pickLevel ||
    options.length === 0
  ) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg border border-lore-border bg-lore-surface px-4 py-3">
      <h3 className="text-xs uppercase tracking-wide text-lore-muted">
        Subclass (level {pickLevel})
      </h3>
      <p className="mt-1 text-xs text-lore-muted">
        You&apos;ll choose your subclass on the Advancement step. Preview SRD
        options below.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((sub) => (
          <span key={sub.slug} className="inline-flex items-center gap-1">
            <span className="rounded border border-lore-border px-3 py-1.5 text-xs text-lore-muted">
              {sub.name}
            </span>
            <button
              type="button"
              onClick={() => setDetailSlug(sub.slug)}
              aria-label={`View ${sub.name} details`}
              className="rounded border border-lore-border px-1.5 py-1 text-xs text-lore-muted hover:border-lore-accent hover:text-lore-text"
            >
              ⓘ
            </button>
          </span>
        ))}
      </div>
      {detailSub && (
        <SubclassDetailModal
          name={detailSub.name}
          description={detailSub.description}
          features={detailSub.features}
          onClose={() => setDetailSlug(null)}
        />
      )}
    </div>
  );
}

/** Validates choices made on the Features step only (not deferred to Advancement). */
export function featuresStepChoicesComplete(
  className: string,
  startingLevel: number,
  fightingStyle: string,
  startingSubclass: string,
  _featureChoices: Record<string, string>,
  _advances: LevelAdvanceChoice[] = [],
): boolean {
  if (
    fightingStyleOnFeaturesStep(className, startingLevel) &&
    !fightingStyle.trim()
  ) {
    return false;
  }
  const subPick = subclassPickLevel(className);
  if (subPick === 1 && startingLevel >= 1 && !startingSubclass.trim()) {
    return false;
  }
  return true;
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
  const pick = subclassPickLevel(className);
  if (pick != null && level >= pick && !subclass.trim()) return false;
  return true;
}
