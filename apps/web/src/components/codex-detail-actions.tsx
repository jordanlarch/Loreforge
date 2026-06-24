"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import type { CodexCategory } from "@/lib/codex-categories";
import {
  isCodexBookmarked,
  toggleCodexBookmark,
} from "@/lib/codex-bookmarks";
import {
  codexShareUrl,
  open5eSourceUrl,
  useInCharacterHref,
  useInCharacterLabel,
} from "@/lib/codex-detail-links";

/**
 * Standard Codex detail action row (CODEX-6): use in character, share,
 * bookmark, and view Open5e source. Copy-to-Smithy stays per-type when wired.
 */
export function CodexDetailActions({
  category,
  slug,
  name,
  raw,
  copyAction,
}: {
  category: CodexCategory;
  slug: string;
  name: string;
  raw?: Record<string, unknown> | null;
  /** Optional primary action (e.g. Copy to The Smithy on spells). */
  copyAction?: React.ReactNode;
}) {
  const [bookmarked, setBookmarked] = useState(() =>
    isCodexBookmarked(category, slug),
  );
  const [shareNote, setShareNote] = useState<string | null>(null);

  const useHref = useInCharacterHref(category, slug);
  const useLabel = useInCharacterLabel(category);
  const sourceUrl = open5eSourceUrl(category, slug, raw);

  const onShare = useCallback(async () => {
    const url = codexShareUrl(category, slug);
    try {
      await navigator.clipboard.writeText(url);
      setShareNote("Link copied");
    } catch {
      setShareNote(url);
    }
    setTimeout(() => setShareNote(null), 2000);
  }, [category, slug]);

  const onBookmark = useCallback(() => {
    const next = toggleCodexBookmark({ category, slug, name });
    setBookmarked(next);
  }, [category, slug, name]);

  const btn =
    "rounded border border-lore-border px-3 py-1.5 text-sm text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text disabled:opacity-50";
  const btnPrimary =
    "rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50";

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        {copyAction}
        {useHref && useLabel ? (
          <Link href={useHref} className={btnPrimary}>
            {useLabel}
          </Link>
        ) : null}
        <button type="button" className={btn} onClick={onShare}>
          {shareNote ?? "Share link"}
        </button>
        <button
          type="button"
          className={bookmarked ? btnPrimary : btn}
          onClick={onBookmark}
        >
          {bookmarked ? "Bookmarked" : "Bookmark"}
        </button>
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={btn}
          >
            View SRD source
          </a>
        ) : null}
      </div>
      {shareNote && shareNote !== "Link copied" ? (
        <p className="text-xs text-lore-muted break-all">{shareNote}</p>
      ) : null}
    </div>
  );
}
