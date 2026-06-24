"use client";

import type { WeaponPropertyEntry } from "@/lib/codex-item-display";

/**
 * Weapon/armor property row — name, optional mastery type, detail value, and SRD rules text.
 */
export function ItemPropertyRow({ entry }: { entry: WeaponPropertyEntry }) {
  return (
    <li className="rounded-lg border border-lore-border bg-lore-surface p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium text-lore-text">{entry.name}</span>
        {entry.type && (
          <span className="rounded bg-lore-bg px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-lore-muted">
            {entry.type}
          </span>
        )}
        {entry.detail && (
          <span className="text-sm text-lore-accent">{entry.detail}</span>
        )}
      </div>
      {entry.desc ? (
        <p className="mt-1.5 text-sm leading-relaxed text-lore-muted">{entry.desc}</p>
      ) : (
        <p className="mt-1.5 text-sm italic text-lore-muted">
          Full rules not yet catalogued.
        </p>
      )}
    </li>
  );
}
