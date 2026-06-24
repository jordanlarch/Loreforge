/**
 * Parse background benefit text into linkable/hintable segments for the Codex UI.
 */
import { ABILITIES, SKILLS, type Ability, type Skill } from "@app/engine";

import { ABILITY_LABELS } from "@/lib/codex-display";
import type { CodexCategory } from "@/lib/codex-categories";

export type CodexLinkEntry = {
  slug: string;
  name: string;
  preview: string | null;
};

export type CodexLinkIndex = {
  feats: CodexLinkEntry[];
  items: CodexLinkEntry[];
};

export type BenefitSegment =
  | { kind: "text"; text: string }
  | {
      kind: "codex";
      text: string;
      category: Extract<CodexCategory, "Feats" | "Items">;
      slug: string;
      preview: string | null;
    }
  | { kind: "skill"; text: string; skill: Skill }
  | { kind: "ability"; text: string; ability: Ability };

const ABILITY_BY_LABEL = Object.fromEntries(
  ABILITIES.map((a) => [ABILITY_LABELS[a].toLowerCase(), a]),
) as Record<string, Ability>;

const SKILL_SET = new Set<string>(SKILLS);

/** Strip parenthetical suffixes for fuzzy item/feat name matching. */
export function normalizeEntityName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function featByName(index: CodexLinkIndex, name: string): CodexLinkEntry | undefined {
  const target = normalizeEntityName(name);
  return index.feats.find(
    (feat) => normalizeEntityName(feat.name) === target,
  );
}

function itemByToken(index: CodexLinkIndex, token: string): CodexLinkEntry | undefined {
  const target = normalizeEntityName(token);
  if (!target) return undefined;
  return index.items.find((item) => {
    const normalized = normalizeEntityName(item.name);
    return normalized === target || normalized.startsWith(`${target} `);
  });
}

function splitList(text: string): string[] {
  return text
    .split(/\s+and\s+|,\s*|\s*;\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function segmentsFromList<T extends BenefitSegment>(
  parts: string[],
  mapPart: (part: string) => T | { kind: "text"; text: string },
): BenefitSegment[] {
  const out: BenefitSegment[] = [];
  for (let i = 0; i < parts.length; i++) {
    const mapped = mapPart(parts[i]!);
    out.push(mapped);
    if (i < parts.length - 1) {
      out.push({ kind: "text", text: i === parts.length - 2 ? " and " : ", " });
    }
  }
  return out;
}

function matchItemsInText(
  text: string,
  index: CodexLinkIndex,
): BenefitSegment[] {
  const items = [...index.items].sort(
    (a, b) => normalizeEntityName(b.name).length - normalizeEntityName(a.name).length,
  );
  const lower = text.toLowerCase();
  const matches: { start: number; end: number; entry: CodexLinkEntry; label: string }[] =
    [];

  for (const entry of items) {
    const needle = normalizeEntityName(entry.name);
    if (needle.length < 3) continue;
    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      const end = idx + needle.length;
      const overlaps = matches.some(
        (m) => !(end <= m.start || idx >= m.end),
      );
      if (!overlaps) {
        matches.push({
          start: idx,
          end,
          entry,
          label: text.slice(idx, end),
        });
      }
      from = idx + 1;
    }
  }

  matches.sort((a, b) => a.start - b.start);

  if (matches.length === 0) {
    return [{ kind: "text", text }];
  }

  const out: BenefitSegment[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) {
      out.push({ kind: "text", text: text.slice(cursor, match.start) });
    }
    out.push({
      kind: "codex",
      text: match.label,
      category: "Items",
      slug: match.entry.slug,
      preview: match.entry.preview,
    });
    cursor = match.end;
  }
  if (cursor < text.length) {
    out.push({ kind: "text", text: text.slice(cursor) });
  }
  return out;
}

export function segmentBenefitDescription(
  desc: string,
  benefitType: string | null | undefined,
  index: CodexLinkIndex,
): BenefitSegment[] {
  const text = desc.trim();
  if (!text) return [];

  if (benefitType === "skill_proficiency") {
    return segmentsFromList(splitList(text), (part) => {
      if (SKILL_SET.has(part)) {
        return { kind: "skill", text: part, skill: part as Skill };
      }
      return { kind: "text", text: part };
    });
  }

  if (benefitType === "ability_score") {
    return segmentsFromList(splitList(text), (part) => {
      const ability = ABILITY_BY_LABEL[part.toLowerCase()];
      if (ability) {
        return { kind: "ability", text: part, ability };
      }
      return { kind: "text", text: part };
    });
  }

  if (benefitType === "feat") {
    const feat = featByName(index, text);
    if (feat) {
      return [
        {
          kind: "codex",
          text,
          category: "Feats",
          slug: feat.slug,
          preview: feat.preview,
        },
      ];
    }
    return [{ kind: "text", text }];
  }

  if (benefitType === "tool_proficiency") {
    const item = itemByToken(index, text);
    if (item) {
      return [
        {
          kind: "codex",
          text,
          category: "Items",
          slug: item.slug,
          preview: item.preview,
        },
      ];
    }
    return [{ kind: "text", text }];
  }

  if (benefitType === "equipment") {
    return matchItemsInText(text, index);
  }

  return [{ kind: "text", text }];
}
