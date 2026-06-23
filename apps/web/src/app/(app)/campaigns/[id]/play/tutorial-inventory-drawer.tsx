"use client";

/**
 * Tutorial inventory side-drawer (TUT-1, #172) — the character's carried items.
 *
 * Opened from the exploration HUD. Slides in from the right and lists the hero's
 * real `equipment` rows (the same data the sheet stores), so the scripted Oil of
 * Brightness grant from Scene 3's shop shows up here the moment Toric gives it.
 * Closes on backdrop click or Escape. Tutorial-scoped for now; the full sheet
 * Equipment tab (CHAR-7) is a separate surface.
 */
import { useEffect } from "react";

import type { EquipmentItem } from "@/lib/character";
import { TUTORIAL_OIL_GRANT } from "@/lib/tutorial-shop";

export function TutorialInventoryDrawer({
  open,
  items,
  loading,
  onClose,
}: {
  open: boolean;
  items: readonly EquipmentItem[];
  loading?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <aside
        role="dialog"
        aria-label="Inventory"
        className="absolute right-0 top-0 flex h-full w-80 max-w-[90vw] flex-col gap-4 border-l border-lore-border bg-lore-surface p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="font-display text-lg leading-tight text-lore-text">
            🎒 Inventory
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted transition-colors hover:text-lore-text"
          >
            Close
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-lore-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-lore-muted">Your pack is empty.</p>
        ) : (
          <ul className="flex flex-col gap-2 overflow-y-auto">
            {items.map((item) => {
              const isGrant = item.name === TUTORIAL_OIL_GRANT.name;
              return (
                <li
                  key={item.name}
                  className={`rounded-lg border p-3 ${
                    isGrant
                      ? "border-lore-accent bg-lore-accent-dim"
                      : "border-lore-border bg-lore-bg"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-sm text-lore-text">
                    <span>
                      {item.name}
                      {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                    </span>
                    {item.equipped && (
                      <span className="text-[10px] uppercase tracking-widest text-lore-muted">
                        Equipped
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="mt-1 text-xs text-lore-muted">
                      {item.description}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}
