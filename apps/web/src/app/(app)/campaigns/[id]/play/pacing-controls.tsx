"use client";

/**
 * Pacing controls panel (PLAY-9 remainder, #104) — the popover behind the top
 * bar's 🎚 Pacing button. A persisted pacing style + soft round-timer limit, and
 * quick controls: Continue (nudge the AI to advance), Hold (the AI waits), and
 * Skip (request a time-skip). Continue/Skip route through chat; Hold is a local
 * indicator. Wiring the style into the AI's narration density and server-side
 * Hold enforcement are deferred.
 */
import { useState } from "react";

import {
  PACING_STYLES,
  TURN_LIMIT_OPTIONS,
  type PacingPrefs,
  type PacingStyle,
} from "@/lib/live-pacing";

const STYLE_LABELS: Record<PacingStyle, string> = {
  cinematic: "Cinematic",
  balanced: "Balanced",
  reactive: "Reactive",
};

const SKIP_OPTIONS = ["10 minutes", "1 hour", "until dawn"] as const;

export function PacingControls({
  prefs,
  onUpdate,
  holding,
  onToggleHold,
  onContinue,
  onSkip,
  disabled,
}: {
  prefs: PacingPrefs;
  onUpdate: (patch: Partial<PacingPrefs>) => void;
  holding: boolean;
  onToggleHold: () => void;
  onContinue: () => void;
  onSkip: (duration: string) => void;
  disabled: boolean;
}) {
  const [skipOpen, setSkipOpen] = useState(false);

  return (
    <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-lore-border bg-lore-surface p-3 shadow-lg">
      <div className="mb-2 text-[10px] uppercase tracking-widest text-lore-muted">
        Pacing
      </div>

      {/* Style */}
      <div className="mb-3">
        <div className="mb-1 text-xs text-lore-muted">Style</div>
        <div className="flex rounded border border-lore-border p-0.5">
          {PACING_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => onUpdate({ style })}
              className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
                prefs.style === style
                  ? "bg-lore-accent-dim text-lore-text"
                  : "text-lore-muted hover:text-lore-text"
              }`}
            >
              {STYLE_LABELS[style]}
            </button>
          ))}
        </div>
      </div>

      {/* Round timer */}
      <div className="mb-3">
        <div className="mb-1 text-xs text-lore-muted">Round timer</div>
        <div className="flex rounded border border-lore-border p-0.5">
          {TURN_LIMIT_OPTIONS.map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => onUpdate({ turnLimitSec: sec })}
              className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
                prefs.turnLimitSec === sec
                  ? "bg-lore-accent-dim text-lore-text"
                  : "text-lore-muted hover:text-lore-text"
              }`}
            >
              {sec === 0 ? "Off" : `${sec}s`}
            </button>
          ))}
        </div>
      </div>

      {/* Quick controls */}
      <div className="border-t border-lore-border pt-2">
        <div className="mb-1.5 text-xs text-lore-muted">Right now</div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onContinue}
            disabled={disabled}
            className="rounded border border-lore-accent bg-lore-accent-dim px-2 py-1 text-xs text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
          >
            ▶ Continue
          </button>
          <button
            type="button"
            onClick={onToggleHold}
            className={`rounded border px-2 py-1 text-xs transition-colors ${
              holding
                ? "border-lore-accent bg-lore-accent-dim text-lore-text"
                : "border-lore-border text-lore-muted hover:text-lore-text"
            }`}
          >
            {holding ? "⏸ Holding…" : "⏸ Hold"}
          </button>
          <button
            type="button"
            onClick={() => setSkipOpen((o) => !o)}
            disabled={disabled}
            className="rounded border border-lore-border px-2 py-1 text-xs text-lore-muted transition-colors hover:text-lore-text disabled:opacity-40"
          >
            ↷ Skip
          </button>
        </div>

        {skipOpen && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SKIP_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  onSkip(d);
                  setSkipOpen(false);
                }}
                disabled={disabled}
                className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted transition-colors hover:text-lore-text disabled:opacity-40"
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
