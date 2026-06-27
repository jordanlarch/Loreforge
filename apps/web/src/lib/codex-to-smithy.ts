import type { ItemType } from "@app/engine";

import type { CodexCategory } from "@/lib/codex-categories";

/** Idempotency key stored on `homebrew_items.copied_from_slug` (non-spell rows). */
export function codexSmithyCopyKey(
  category: CodexCategory,
  slug: string,
): string {
  if (category === "Items") return slug;
  return `${category}:${slug}`;
}

/** Map Open5e item category keys to Smithy item types. */
export function open5eItemCategoryToType(
  category: string | null | undefined,
): ItemType {
  const key = category?.toLowerCase() ?? "";
  if (key.includes("weapon")) return "Weapon";
  if (key.includes("armor")) return "Armor";
  if (key.includes("tool")) return "Tool";
  if (key.includes("potion")) return "Potion";
  if (
    key.includes("wondrous") ||
    key.includes("magic") ||
    key.includes("ring") ||
    key.includes("rod") ||
    key.includes("staff") ||
    key.includes("wand") ||
    key.includes("scroll")
  ) {
    return "Magic Item";
  }
  return "Adventuring Gear";
}

/** Smithy item type for Codex categories copied as text snapshots. */
export function codexCategorySnapshotType(
  category: CodexCategory,
): ItemType {
  if (category === "Animals" || category === "Monsters") return "Magic Item";
  return "Adventuring Gear";
}

function paragraphText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string").join("\n\n");
  }
  return "";
}

/** Flatten Codex row fields into editable Smithy item description text. */
export function buildCodexSnapshotDescription(input: {
  category: CodexCategory;
  name: string;
  description?: string | null;
  raw?: Record<string, unknown> | null;
  extras?: string[];
}): string {
  const lines: string[] = [
    `Copied from Codex — ${input.category}: ${input.name}`,
    "",
  ];
  if (input.description?.trim()) {
    lines.push(input.description.trim(), "");
  }
  if (input.extras?.length) {
    lines.push(...input.extras.filter(Boolean), "");
  }
  const raw = input.raw ?? {};
  const desc = paragraphText(raw.desc ?? raw.description ?? raw.text);
  if (desc && desc !== input.description?.trim()) {
    lines.push(desc, "");
  }
  lines.push(
    "—",
    "Homebrew snapshot from the SRD Codex. Edit freely in The Smithy.",
  );
  return lines.join("\n").trim();
}
