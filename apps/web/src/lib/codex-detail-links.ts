import type { CodexCategory } from "@/lib/codex-categories";
import { codexDeepLink } from "@/lib/codex-routes";

export { codexDeepLink } from "@/lib/codex-routes";

export type InCharacterAction = {
  href: string;
  label: string;
};

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

/** Creation Wizard / character flows for a Codex entry (CODEX-6). */
export function useInCharacterActions(
  category: CodexCategory,
  slug: string,
): InCharacterAction[] {
  if (category === "Species") {
    return [
      {
        href: `/characters/new?species=${encodeURIComponent(slug)}`,
        label: "Create character as this species",
      },
    ];
  }
  if (category === "Classes") {
    return [
      {
        href: `/characters/new?class=${encodeURIComponent(slug)}`,
        label: "Create character as this class",
      },
    ];
  }
  if (category === "Backgrounds") {
    return [
      {
        href: `/characters/new?background=${encodeURIComponent(slug)}`,
        label: "Create character with this background",
      },
    ];
  }
  if (category === "Feats") {
    return [
      {
        href: "/characters",
        label: "Add feat during level up",
      },
    ];
  }
  return [];
}

/** @deprecated Prefer {@link useInCharacterActions}. */
export function useInCharacterHref(
  category: CodexCategory,
  slug: string,
): string | null {
  return useInCharacterActions(category, slug)[0]?.href ?? null;
}

/** @deprecated Prefer {@link useInCharacterActions}. */
export function useInCharacterLabel(category: CodexCategory): string | null {
  const labels: Partial<Record<CodexCategory, string>> = {
    Species: "Create character as this species",
    Classes: "Create character as this class",
    Backgrounds: "Create character with this background",
    Feats: "Add feat during level up",
  };
  return labels[category] ?? null;
}
