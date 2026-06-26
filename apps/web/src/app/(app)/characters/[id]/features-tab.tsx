"use client";

import { featureStubsForLevel, type ClassLevel } from "@app/engine";

export function FeaturesTab({ classes }: { classes: ClassLevel[] }) {
  const rows: { class: string; level: number; label: string }[] = [];
  for (const cl of classes) {
    for (let level = 1; level <= cl.level; level++) {
      for (const label of featureStubsForLevel(cl.class, level)) {
        rows.push({ class: cl.class, level, label });
      }
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-lore-muted">No class features recorded yet.</p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-lore-muted">
        Class features gained so far. ASI/feat and subclass choices are surfaced
        as stubs until full feature ingestion ships.
      </p>
      <ul className="divide-y divide-lore-border rounded-lg border border-lore-border">
        {rows.map((row, i) => (
          <li
            key={`${row.class}-${row.level}-${row.label}-${i}`}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
          >
            <span>{row.label}</span>
            <span className="text-xs text-lore-muted">
              {row.class} {row.level}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
