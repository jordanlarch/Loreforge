"use client";

import type { Ability, CharacterSheet } from "@app/engine";

import { SrdHint } from "@/components/srd-hint";

import { ProficiencyDot, signed } from "./abilities-panel";

const ABILITY_ABBR: Record<Ability, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

/**
 * D&D Beyond–style skills list: all 18 skills with ability tag, modifier, proficiency dot.
 */
export function SkillsPanel({
  sheet,
  onToggleSkillProficiency,
}: {
  sheet: CharacterSheet;
  onToggleSkillProficiency: (skill: string) => void;
}) {
  return (
    <section className="rounded-lg border border-lore-border bg-lore-surface">
      <header className="border-b border-lore-border px-4 py-2">
        <h2 className="font-display text-sm uppercase tracking-widest text-lore-accent">
          Skills
        </h2>
      </header>
      <ul className="divide-y divide-lore-border/60">
        {sheet.skills.map((row) => (
          <li
            key={row.skill}
            className="flex items-center gap-3 px-4 py-2.5 text-sm"
          >
            <span className="min-w-0 flex-1 font-medium text-lore-text">
              <SrdHint kind="skill" skill={row.skill} label={row.skill} />
            </span>
            <span className="shrink-0 rounded border border-lore-border bg-lore-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lore-muted">
              {ABILITY_ABBR[row.ability]}
            </span>
            <span
              className={`min-w-[2.75rem] shrink-0 rounded px-2 py-0.5 text-center font-display tabular-nums ${
                row.proficient
                  ? "border border-red-600/80 bg-red-950/60 text-lore-text"
                  : "text-lore-text"
              }`}
            >
              {signed(row.modifier)}
            </span>
            <button
              type="button"
              onClick={() => onToggleSkillProficiency(row.skill)}
              aria-label={
                row.proficient
                  ? `Remove ${row.skill} proficiency`
                  : `Add ${row.skill} proficiency`
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded transition-colors hover:bg-lore-bg"
            >
              <ProficiencyDot proficient={row.proficient} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
