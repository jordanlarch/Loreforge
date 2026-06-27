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
  useInCharacterActions,
  type InCharacterAction,
} from "@/lib/codex-detail-links";

import { CodexCopyToSmithyButton } from "./codex-copy-to-smithy";
import {
  CodexEquipToCharacterButton,
  CodexPrepareOnCharacterButton,
} from "./codex-equip-to-character";
import type { CodexItemRow } from "@/lib/character-library";

/**
 * Standard Codex detail action row (CODEX-6): copy to Smithy, use in character,
 * share, bookmark, and view Open5e source.
 */
export function CodexDetailActions({
  category,
  slug,
  name,
  raw,
  showCopyToSmithy = false,
  onCopyClose,
  copyAction,
  spellEquip,
  itemEquip,
}: {
  category: CodexCategory;
  slug: string;
  name: string;
  raw?: Record<string, unknown> | null;
  /** When true, renders the shared Copy to Smithy button (CODEX A4). */
  showCopyToSmithy?: boolean;
  onCopyClose?: () => void;
  /** Legacy override (spells used this before A4 unified button). */
  copyAction?: React.ReactNode;
  /** CODEX-6: add spell as prepared on a library character. */
  spellEquip?: {
    slug: string;
    name: string;
    level: string | null;
    school: string | null;
    concentration?: boolean;
    ritual?: boolean;
  };
  /** CODEX-6: add item as equipped on a library character. */
  itemEquip?: CodexItemRow & { slug: string };
}) {
  const [bookmarked, setBookmarked] = useState(() =>
    isCodexBookmarked(category, slug),
  );
  const [shareNote, setShareNote] = useState<string | null>(null);

  const inCharacterActions = useInCharacterActions(category, slug);
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
        {copyAction ??
          (showCopyToSmithy ? (
            <CodexCopyToSmithyButton
              category={category}
              slug={slug}
              onCopied={onCopyClose}
            />
          ) : null)}
        {spellEquip ? (
          <CodexPrepareOnCharacterButton spell={spellEquip} onApplied={onCopyClose} />
        ) : null}
        {itemEquip ? (
          <CodexEquipToCharacterButton item={itemEquip} onApplied={onCopyClose} />
        ) : null}
        <UseInCharacterControl actions={inCharacterActions} btn={btnPrimary} />
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

function UseInCharacterControl({
  actions,
  btn,
}: {
  actions: InCharacterAction[];
  btn: string;
}) {
  if (actions.length === 0) return null;
  if (actions.length === 1) {
    const action = actions[0]!;
    return (
      <Link href={action.href} className={btn}>
        {action.label}
      </Link>
    );
  }
  return (
    <details className="relative">
      <summary className={`${btn} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        Use in Character ▾
      </summary>
      <div className="absolute left-0 z-10 mt-1 min-w-[220px] rounded border border-lore-border bg-lore-bg py-1 shadow-lg">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="block px-3 py-2 text-sm text-lore-text hover:bg-lore-surface"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
