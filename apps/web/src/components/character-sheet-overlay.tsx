"use client";

import { CharacterSheetView } from "@/app/(app)/characters/[id]/character-sheet";
import type { CastableSpell } from "@/lib/live-combat";

/** Full character sheet in a modal overlay (live play, tutorial HUD). */
export function CharacterSheetOverlay({
  characterId,
  onClose,
  onFeatureUse,
  onCastSpell,
  liveConditions,
}: {
  characterId: string;
  onClose: () => void;
  onFeatureUse?: (featureName: string) => void;
  onCastSpell?: (spell: CastableSpell) => void;
  liveConditions?: { condition: string; level?: number }[];
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[4vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="character-sheet-overlay-title"
      onClick={onClose}
    >
      <div
        className="mb-8 flex max-h-[92dvh] w-full max-w-6xl flex-col rounded-lg border border-lore-border bg-lore-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-lore-border px-5 py-3">
          <h2
            id="character-sheet-overlay-title"
            className="font-display text-lg font-semibold"
          >
            Character sheet
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-lore-border px-2 py-1 text-sm text-lore-muted hover:text-lore-text"
          >
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-5">
          <CharacterSheetView
            id={characterId}
            embedded
            onFeatureUse={onFeatureUse}
            onCastSpell={onCastSpell}
            liveConditions={liveConditions}
          />
        </div>
      </div>
    </div>
  );
}
