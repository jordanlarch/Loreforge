"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Dimmed-peek lightbox for prep-shell panels (CAMP-UX UX-6).
 */
export function PrepLightbox({
  title,
  open,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Use Realms detail width (~5xl) when editing stubs. */
  wide?: boolean;
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
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/55 p-4 pt-[5vh]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={`flex w-full flex-col overflow-hidden rounded-lg border border-lore-border bg-lore-bg shadow-xl ${
          wide ? "max-w-5xl" : "max-w-3xl"
        }`}
        style={{ maxHeight: "min(90vh, 960px)" }}
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
