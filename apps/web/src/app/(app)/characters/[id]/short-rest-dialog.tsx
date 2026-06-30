"use client";

import { useMemo, useState } from "react";

export function ShortRestDialog({
  expendedLevels,
  budget,
  onConfirm,
  onCancel,
}: {
  expendedLevels: number[];
  budget: number;
  onConfirm: (slotLevels: number[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const total = useMemo(
    () => selected.reduce((sum, level) => sum + level, 0),
    [selected],
  );

  function toggle(level: number) {
    setSelected((prev) => {
      if (prev.includes(level)) {
        return prev.filter((l) => l !== level);
      }
      const next = [...prev, level];
      const nextTotal = next.reduce((s, l) => s + l, 0);
      if (nextTotal > budget) return prev;
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-lore-border bg-lore-surface p-4 shadow-xl">
        <h3 className="text-sm font-semibold text-lore-text">Short Rest</h3>
        {expendedLevels.length > 0 ? (
          <>
            <p className="mt-2 text-xs text-lore-muted">
              Natural Recovery — pick expended slots to restore (budget{" "}
              {budget}, selected {total}).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {expendedLevels.map((level, index) => {
                const picked = selected.includes(level);
                return (
                  <button
                    key={`${level}-${index}`}
                    type="button"
                    onClick={() => toggle(level)}
                    className={`rounded border px-2 py-1 text-xs ${
                      picked
                        ? "border-lore-accent bg-lore-accent-dim text-lore-text"
                        : "border-lore-border text-lore-muted hover:border-lore-accent"
                    }`}
                  >
                    Level {level}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="mt-2 text-xs text-lore-muted">
            Take a short rest and refresh short-rest resources.
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-lore-border px-3 py-1 text-xs text-lore-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1 text-xs text-lore-text"
          >
            Finish Short Rest
          </button>
        </div>
      </div>
    </div>
  );
}
