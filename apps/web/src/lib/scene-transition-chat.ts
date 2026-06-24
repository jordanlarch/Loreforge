import type { ChatEntry } from "@/lib/live-chat";

/** One-line subtitle for the scene banner / chat divider (from scene description). */
export function sceneSubtitle(description?: string | null): string | undefined {
  if (!description?.trim()) return undefined;
  const line = description.trim().split(/\n/)[0]?.trim();
  if (!line) return undefined;
  if (line.length <= 80) return line;
  return `${line.slice(0, 77)}…`;
}

export function formatSceneDividerLabel(name: string, subtitle?: string): string {
  return subtitle ? `📍 ${name} · ${subtitle}` : `📍 ${name}`;
}

export function makeSceneDividerEntry(sceneKey: string, label: string): ChatEntry {
  return {
    id: `scene-divider:${sceneKey}:${Date.now()}`,
    kind: "scene_divider",
    author: "",
    text: label,
    ts: Date.now(),
  };
}

/** Merge server chat with client-only scene dividers, ordered by timestamp. */
export function mergeChatEntries(
  server: ChatEntry[],
  local: ChatEntry[],
): ChatEntry[] {
  if (local.length === 0) return server;
  return [...server, ...local].sort(
    (a, b) => a.ts - b.ts || a.id.localeCompare(b.id),
  );
}

export function isCombatStart(prev: boolean, next: boolean): boolean {
  return !prev && next;
}

export function isCombatEnd(prev: boolean, next: boolean): boolean {
  return prev && !next;
}
