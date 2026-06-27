import type { CodexCategory } from "@/lib/codex-categories";
import { codexDeepLink } from "@/lib/codex-routes";

export { codexDeepLink } from "@/lib/codex-routes";

const OPEN5E_API_PATH: Partial<Record<CodexCategory, string>> = {
  Spells: "spells",
  Backgrounds: "backgrounds",
  Feats: "feats",
  Items: "items",
  Animals: "creatures",
  Monsters: "creatures",
  Rules: "rules",
};

/** Absolute share URL for clipboard copy. */
export function codexShareUrl(
  category: CodexCategory,
  slug: string,
  origin?: string,
): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${codexDeepLink(category, slug)}`;
}

/** Open5e API record URL when the category is ingested from Open5e. */
export function open5eSourceUrl(
  category: CodexCategory,
  slug: string,
  raw?: Record<string, unknown> | null,
): string | null {
  const path = OPEN5E_API_PATH[category];
  if (!path) return null;
  const key = typeof raw?.key === "string" && raw.key.trim() ? raw.key : slug;
  return `https://api.open5e.com/v2/${path}/${encodeURIComponent(key)}/`;
}

/** Creation Wizard entry when the category maps to a wizard step (CODEX-6). */
export function useInCharacterHref(
  category: CodexCategory,
  slug: string,
): string | null {
  if (category === "Species") {
    return `/characters/new?species=${encodeURIComponent(slug)}`;
  }
  if (category === "Classes") {
    return `/characters/new?class=${encodeURIComponent(slug)}`;
  }
  return null;
}

export function useInCharacterLabel(category: CodexCategory): string | null {
  if (category === "Species") return "Create character as this species";
  if (category === "Classes") return "Create character as this class";
  return null;
}
