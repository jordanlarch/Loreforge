"use client";

import type { CharacterSheet } from "@app/engine";

import { SkillsPanel } from "../skills-panel";

const TOOL_HINTS = ["tools", "kit", "thieves", "disguise", "herbalism"];

export function SheetLeftRail({
  sheet,
  equipment,
  onToggleSkill,
}: {
  sheet: CharacterSheet;
  equipment: { name: string }[];
  onToggleSkill: (skill: string) => void;
}) {
  const tools = equipment
    .map((e) => e.name)
    .filter((name) =>
      TOOL_HINTS.some((h) => name.toLowerCase().includes(h)),
    );

  return (
    <div className="space-y-4">
      <SkillsPanel sheet={sheet} onToggleSkillProficiency={onToggleSkill} />
      <section className="rounded-lg border border-lore-border bg-lore-surface">
        <header className="border-b border-lore-border px-4 py-2">
          <h2 className="font-display text-sm uppercase tracking-widest text-lore-accent">
            Tools
          </h2>
        </header>
        {tools.length === 0 ? (
          <p className="px-4 py-3 text-sm text-lore-muted">No tools listed.</p>
        ) : (
          <ul className="divide-y divide-lore-border/60">
            {tools.map((t) => (
              <li key={t} className="px-4 py-2 text-sm">
                {t}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
