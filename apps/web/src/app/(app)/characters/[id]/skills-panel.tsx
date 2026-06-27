"use client";

import type { CharacterSheet } from "@app/engine";

import { SrdHint } from "@/components/srd-hint";

import { ProficiencyDot, signed } from "./abilities-panel";

const ABILITY_ABBR: Record<string, string> = {
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
            className="grid grid-cols-[minmax(0,1fr)_2.25rem_2.75rem_2rem] items-center gap-x-2 px-3 py-2.5 text-sm sm:px-4"
          >
            <span className="min-w-0 truncate font-medium text-lore-text">
              <SrdHint kind="skill" skill={row.skill} label={row.skill} />
            </span>
            <span
              className="justify-self-center rounded border border-lore-border bg-lore-bg px-1 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-lore-muted"
              title={`${ABILITY_ABBR[row.ability] ?? row.ability} skill`}
            >
              {ABILITY_ABBR[row.ability] ?? row.ability}
            </span>
            <span
              className={`justify-self-center rounded px-1.5 py-0.5 text-center font-display tabular-nums ${
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
              className="flex h-8 w-8 shrink-0 items-center justify-center justify-self-end rounded transition-colors hover:bg-lore-bg"
            >
              <ProficiencyDot proficient={row.proficient} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
