"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Dimmed-peek lightbox for play-shell nav panels (CAMP-UX UX-1).
 */
export function PlayLightbox({
  title,
  open,
  onClose,
  children,
  footer,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
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
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/55 p-4 pt-[6vh]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-lore-border bg-lore-bg shadow-xl"
        style={{ maxHeight: "min(85vh, 900px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-lore-border px-4 py-3">
          <h2 className="font-display text-lg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-lore-border px-2 py-1 text-xs text-lore-muted transition-colors hover:text-lore-text"
          >
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? (
          <footer className="shrink-0 border-t border-lore-border px-4 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
