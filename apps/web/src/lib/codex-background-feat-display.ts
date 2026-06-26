/** Display helpers for Open5e background rows in the Codex UI. */

import { SKILLS, type Skill } from "@app/engine";

const SKILL_SET = new Set<string>(SKILLS);

function splitSkillList(text: string): string[] {
  return text
    .split(/\s+and\s+|,\s*|\s*;\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

type BackgroundBenefit = {
  name?: string | null;
  desc?: string | null;
  type?: string | null;
};

export function backgroundBenefits(
  raw: Record<string, unknown>,
): BackgroundBenefit[] {
  const benefits = raw.benefits;
  if (!Array.isArray(benefits)) return [];
  return benefits.filter(
    (entry): entry is BackgroundBenefit =>
      typeof entry === "object" && entry != null && "name" in entry,
  );
}

export function backgroundBenefitSummary(
  raw: Record<string, unknown>,
): string | null {
  const skills = backgroundBenefits(raw).find(
    (b) => b.type === "skill_proficiency",
  );
  return skills?.desc?.trim() ?? null;
}

/** Parse structured skill_proficiency benefits into SRD skill names. */
export function backgroundSkillProficiencies(
  raw: Record<string, unknown>,
): Skill[] {
  const benefit = backgroundBenefits(raw).find(
    (b) => b.type === "skill_proficiency",
  );
  const desc = benefit?.desc?.trim();
  if (!desc) return [];
  return splitSkillList(desc).filter((part): part is Skill =>
    SKILL_SET.has(part),
  );
}

/** Display helpers for Open5e feat rows in the Codex UI. */

type FeatBenefit = { desc?: string | null };

export function featBenefits(raw: Record<string, unknown>): string[] {
  const benefits = raw.benefits;
  if (!Array.isArray(benefits)) return [];
  return benefits
    .map((entry) => {
      if (typeof entry !== "object" || entry == null) return null;
      const desc = (entry as FeatBenefit).desc?.trim();
      return desc || null;
    })
    .filter((line): line is string => line != null);
}

export function formatFeatType(type: string | null | undefined): string {
  if (!type) return "—";
  return type.replace(/-/g, " ");
}
