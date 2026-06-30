"use client";

import { useEffect, useState } from "react";

const WINDOW_SECONDS = 12;

export function CounterspellPrompt({
  reactorName,
  castingName,
  spellName,
  slotLevel,
  counterspellSlotLevel,
  onUse,
  onPass,
}: {
  reactorName: string;
  castingName: string;
  spellName: string;
  slotLevel: number;
  counterspellSlotLevel: number;
  onUse: () => void;
  onPass: () => void;
}) {
  const [remaining, setRemaining] = useState(WINDOW_SECONDS);

  useEffect(() => {
    if (remaining <= 0) {
      onPass();
      return;
    }
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  return (
    <div className="rounded-lg border border-indigo-500/50 bg-indigo-500/10 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold text-indigo-200">
          Reaction — Counterspell
        </span>
        <span className="text-xs tabular-nums text-indigo-300/80">
          {remaining}s
        </span>
      </div>
      <p className="mb-2 text-xs text-lore-muted">
        {castingName} is casting {spellName}
        {slotLevel > 0 ? ` (level ${slotLevel})` : ""}. Attempt to interrupt?
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onUse}
          className="rounded border border-indigo-500/60 bg-indigo-500/20 px-3 py-1 text-xs text-indigo-100 transition-colors hover:border-indigo-400"
        >
          Counterspell ({reactorName}, slot {counterspellSlotLevel})
        </button>
        <button
          type="button"
          onClick={onPass}
          className="rounded border border-lore-border px-3 py-1 text-xs text-lore-muted transition-colors hover:border-lore-accent"
        >
          Pass
        </button>
      </div>
    </div>
  );
}
