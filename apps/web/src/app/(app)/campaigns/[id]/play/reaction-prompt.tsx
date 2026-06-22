"use client";

/**
 * Reaction prompt (#58) — a timed opportunity-attack offer.
 *
 * When the engine opens a reaction window (a creature left a controlled
 * reactor's reach), the reactor's controller gets a short countdown to take the
 * opportunity attack or let the window pass. Resolution runs through the engine
 * (`opportunity_attack`); on timeout the prompt auto-passes.
 */
import { useEffect, useState } from "react";

const WINDOW_SECONDS = 12;

export function ReactionPrompt({
  reactorName,
  moverName,
  onTake,
  onPass,
}: {
  reactorName: string;
  moverName: string;
  onTake: () => void;
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
          Reaction — Opportunity Attack
        </span>
        <span className="text-xs tabular-nums text-amber-300/80">
          {remaining}s
        </span>
      </div>
      <p className="mb-2 text-xs text-lore-muted">
        {moverName} left {reactorName}&apos;s reach. Strike as a reaction?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onTake}
          className="rounded border border-amber-500/60 bg-amber-500/20 px-3 py-1 text-xs text-amber-100 transition-colors hover:border-amber-400"
        >
          Opportunity Attack
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
