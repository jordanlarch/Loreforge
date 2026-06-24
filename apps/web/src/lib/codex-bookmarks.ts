import type { CodexCategory } from "@/lib/codex-categories";

const STORAGE_KEY = "loreforge-codex-bookmarks";

export type CodexBookmark = {
  category: CodexCategory;
  slug: string;
  name: string;
  ts: number;
};

function bookmarkKey(category: CodexCategory, slug: string): string {
  return `${category}:${slug}`;
}

export function readCodexBookmarks(): CodexBookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CodexBookmark[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isCodexBookmarked(
  category: CodexCategory,
  slug: string,
): boolean {
  const key = bookmarkKey(category, slug);
  return readCodexBookmarks().some((b) => bookmarkKey(b.category, b.slug) === key);
}

/** Toggle bookmark; returns the new bookmarked state. */
export function toggleCodexBookmark(entry: {
  category: CodexCategory;
  slug: string;
  name: string;
}): boolean {
  const key = bookmarkKey(entry.category, entry.slug);
  const existing = readCodexBookmarks();
  const found = existing.findIndex((b) => bookmarkKey(b.category, b.slug) === key);
  if (found >= 0) {
    existing.splice(found, 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    return false;
  }
  const next = [
    { ...entry, ts: Date.now() },
    ...existing,
  ].slice(0, 48);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return true;
}
