"use client";

/**
 * Shared modal shell for Codex/Smithy library pickers (SMITH-5).
 */
export function LibraryPickerModal({
  title,
  titleId,
  onClose,
  children,
}: {
  title: string;
  titleId: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-lore-border bg-lore-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-lore-border px-4 py-3">
          <h2 id={titleId} className="font-display text-lg">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-lore-border px-2 py-1 text-sm text-lore-muted hover:text-lore-text"
          >
            Close
          </button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export const PICKER_SEARCH_INPUT =
  "mb-4 w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent";

export const PICKER_LIST =
  "max-h-72 space-y-1 overflow-y-auto";

export const PICKER_ROW =
  "flex w-full items-center justify-between rounded border border-transparent px-3 py-2 text-left text-sm transition-colors hover:border-lore-border hover:bg-lore-surface disabled:opacity-50";
