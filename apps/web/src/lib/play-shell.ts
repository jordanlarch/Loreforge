/**
 * Play shell IA (CAMP-UX UX-1) — left-nav ids, labels, and persisted UI prefs.
 */

export type PlayMapTab = "current" | "world";

export type PlayNavId =
  | "play"
  | "character"
  | "party"
  | "quests"
  | "world"
  | "memories"
  | "sessions"
  | "notes"
  | "settings";

export type PlayNavItem = {
  id: PlayNavId;
  label: string;
  icon: string;
  /** Requires a campaign context (hidden in sandbox). */
  campaignOnly?: boolean;
};

export const PLAY_NAV_ITEMS: readonly PlayNavItem[] = [
  { id: "play", label: "Play", icon: "▶" },
  { id: "character", label: "Character", icon: "👤" },
  { id: "party", label: "Party", icon: "👥", campaignOnly: true },
  { id: "quests", label: "Quests", icon: "📜", campaignOnly: true },
  { id: "world", label: "World", icon: "🌍", campaignOnly: true },
  { id: "memories", label: "Memories", icon: "🧠", campaignOnly: true },
  { id: "sessions", label: "Sessions", icon: "📖", campaignOnly: true },
  { id: "notes", label: "Notes", icon: "📝", campaignOnly: true },
  { id: "settings", label: "Settings", icon: "⚙", campaignOnly: true },
];

/** Lightbox titles mirror nav labels except Play (no lightbox). */
export function playNavLightboxTitle(id: PlayNavId): string | null {
  if (id === "play" || id === "character") return null;
  return PLAY_NAV_ITEMS.find((i) => i.id === id)?.label ?? null;
}

export function playRailStorageKey(campaignId?: string): string {
  return campaignId
    ? `loreforge:play-rail-collapsed:${campaignId}`
    : "loreforge:play-rail-collapsed:sandbox";
}

export function readRailCollapsed(campaignId?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(playRailStorageKey(campaignId)) === "1";
  } catch {
    return false;
  }
}

export function writeRailCollapsed(campaignId: string | undefined, collapsed: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(playRailStorageKey(campaignId), collapsed ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}
