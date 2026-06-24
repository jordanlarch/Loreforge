"use client";

/**
 * Tutorial "Stuck?" hint chip (TUT-1, #178, §7).
 *
 * Scripted per-scene suggestions with a Dismiss control. The parent tracks idle
 * time and dismissal count; this component is presentational only.
 */
import type { TutorialSceneHint } from "@app/engine";

export function TutorialHintChip({
  hint,
  onDismiss,
}: {
  hint: TutorialSceneHint;
  onDismiss: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-labelledby="tutorial-hint-title"
      className="fixed bottom-24 left-1/2 z-40 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-lore-accent/40 bg-lore-surface/95 p-4 shadow-lg backdrop-blur-sm"
    >
      <p
        id="tutorial-hint-title"
        className="text-xs font-medium uppercase tracking-widest text-lore-accent"
      >
        Stuck?
      </p>
      <ul className="mt-2 space-y-1 text-sm text-lore-text">
        {hint.suggestions.map((s) => (
          <li key={s} className="flex gap-2">
            <span className="text-lore-muted" aria-hidden>
              •
            </span>
            {s}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded border border-lore-border px-3 py-1 text-xs text-lore-muted transition-colors hover:text-lore-text"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
