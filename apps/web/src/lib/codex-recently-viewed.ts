import type { CodexCategory } from "@/lib/codex-categories";
import { codexDetailPath } from "@/lib/codex-routes";

const STORAGE_KEY = "loreforge-recently-viewed";
export const RECENT_UPDATE_EVENT = "loreforge-recent-update";
const MAX_ENTRIES = 24;

export type RecentCodexEntry = {
  source: "codex";
  category: CodexCategory;
  slug: string;
  name: string;
  ts: number;
};

export type RecentSmithyEntry = {
  source: "smithy";
  kind: "spell" | "item";
  id: string;
  name: string;
  ts: number;
};

export type RecentEntry = RecentCodexEntry | RecentSmithyEntry;

function entryKey(entry: RecentEntry): string {
  if (entry.source === "codex") {
    return `codex:${entry.category}:${entry.slug}`;
  }
  return `smithy:${entry.kind}:${entry.id}`;
}

function notifyRecentUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RECENT_UPDATE_EVENT));
}

export function readRecentlyViewed(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordCodexView(entry: {
  category: CodexCategory;
  slug: string;
  name: string;
}): void {
  if (typeof window === "undefined") return;
  const key = entryKey({
    source: "codex",
    category: entry.category,
    slug: entry.slug,
    name: entry.name,
    ts: 0,
  });
  const next: RecentCodexEntry = { source: "codex", ...entry, ts: Date.now() };
  const filtered = readRecentlyViewed().filter((e) => entryKey(e) !== key);
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([next, ...filtered].slice(0, MAX_ENTRIES)),
  );
  notifyRecentUpdate();
}

export function recordSmithyView(entry: {
  kind: "spell" | "item";
  id: string;
  name: string;
}): void {
  if (typeof window === "undefined") return;
  const key = entryKey({
    source: "smithy",
    kind: entry.kind,
    id: entry.id,
    name: entry.name,
    ts: 0,
  });
  const next: RecentSmithyEntry = { source: "smithy", ...entry, ts: Date.now() };
  const filtered = readRecentlyViewed().filter((e) => entryKey(e) !== key);
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([next, ...filtered].slice(0, MAX_ENTRIES)),
  );
  notifyRecentUpdate();
}

export function recentEntryHref(entry: RecentEntry): string {
  if (entry.source === "codex") {
    return codexDetailPath(entry.category, entry.slug);
  }
  return entry.kind === "spell"
    ? `/smithy/spells/${entry.id}`
    : `/smithy/${entry.id}`;
}
