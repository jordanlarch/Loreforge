"use client";

import { useEffect, useState } from "react";

const WINDOW_SECONDS = 12;

export function IndomitablePrompt({
  entityName,
  ability,
  dc,
  fighterLevel,
  onUse,
  onPass,
}: {
  entityName: string;
  ability: string;
  dc: number;
  fighterLevel: number;
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
    <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold text-amber-200">
          Indomitable — failed {ability.toUpperCase()} save
        </span>
        <span className="text-xs tabular-nums text-amber-300/80">
          {remaining}s
        </span>
      </div>
      <p className="mb-2 text-xs text-lore-muted">
        {entityName} failed a save (DC {dc}). Reroll with +{fighterLevel} from
        Indomitable?
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onUse}
          className="rounded border border-amber-500/60 bg-amber-500/20 px-3 py-1 text-xs text-amber-100 transition-colors hover:border-amber-400"
        >
          Reroll save
        </button>
        <button
          type="button"
          onClick={onPass}
          className="rounded border border-lore-border px-3 py-1 text-xs text-lore-muted transition-colors hover:border-lore-accent"
        >
          Keep failure
        </button>
      </div>
    </div>
  );
}
