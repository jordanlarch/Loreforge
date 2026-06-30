"use client";

import { useEffect, useState } from "react";

const WINDOW_SECONDS = 12;

export function CuttingWordsPrompt({
  reactorName,
  againstName,
  attackTotal,
  targetAc,
  hit,
  onUse,
  onPass,
}: {
  reactorName: string;
  againstName: string;
  attackTotal: number;
  targetAc: number;
  hit: boolean;
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
    <div className="rounded-lg border border-violet-500/50 bg-violet-500/10 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold text-violet-200">
          Reaction — Cutting Words
        </span>
        <span className="text-xs tabular-nums text-violet-300/80">
          {remaining}s
        </span>
      </div>
      <p className="mb-2 text-xs text-lore-muted">
        {againstName} rolled {attackTotal} vs AC {targetAc}
        {hit ? " (hit)" : " (miss)"}. Spend Bardic Inspiration to subtract a die?
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onUse}
          className="rounded border border-violet-500/60 bg-violet-500/20 px-3 py-1 text-xs text-violet-100 transition-colors hover:border-violet-400"
        >
          Cutting Words ({reactorName})
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
