"use client";

import type { ReactNode } from "react";

import type { ShopListing } from "@/lib/tutorial-shop";

/** Read-only shop or tavern catalog in a modal (tutorial tracer, no commerce). */
export function TutorialCatalogOverlay({
  title,
  subtitle,
  listings,
  purseGp,
  footer,
  primaryAction,
  onClose,
}: {
  title: string;
  subtitle?: string;
  listings: readonly ShopListing[];
  /** When set, shown as "You have X gp" (display only). */
  purseGp?: number;
  footer?: ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    pending?: boolean;
  };
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[75] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[6vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-catalog-title"
      onClick={onClose}
    >
      <div
        className="mb-8 w-full max-w-lg rounded-lg border border-lore-border bg-lore-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-lore-border px-5 py-4">
          <div>
            <h2 id="tutorial-catalog-title" className="font-display text-xl">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-sm text-lore-muted">{subtitle}</p>
            ) : null}
            {purseGp !== undefined ? (
              <p className="mt-1 text-xs text-lore-muted">
                You have {purseGp} gp — purchases aren&apos;t part of this
                tutorial beat.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-lore-border px-2 py-1 text-sm text-lore-muted hover:text-lore-text"
          >
            Close
          </button>
        </header>

        <ul className="max-h-[min(50vh,24rem)] space-y-2 overflow-y-auto px-5 py-4">
          {listings.map((listing) => (
            <li
              key={listing.name}
              className="rounded border border-lore-border bg-lore-surface p-3"
            >
              <div className="flex items-center justify-between gap-2 text-sm text-lore-text">
                <span>
                  {listing.icon} {listing.name}
                </span>
                <span className="shrink-0 text-lore-muted">{listing.price}</span>
              </div>
              <p className="mt-1 text-xs text-lore-muted">{listing.blurb}</p>
              {listing.granted ? (
                <p className="mt-1 text-[11px] text-lore-accent">
                  Toric may give you this on credit.
                </p>
              ) : null}
            </li>
          ))}
        </ul>

        {(footer || primaryAction) && (
          <footer className="space-y-3 border-t border-lore-border px-5 py-4">
            {footer}
            {primaryAction ? (
              <button
                type="button"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled || primaryAction.pending}
                className="w-full rounded-lg border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
              >
                {primaryAction.pending ? "Taking…" : primaryAction.label}
              </button>
            ) : null}
          </footer>
        )}
      </div>
    </div>
  );
}
