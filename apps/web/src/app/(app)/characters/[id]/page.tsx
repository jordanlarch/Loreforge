import Link from "next/link";
import { notFound } from "next/navigation";

import {
  buildCharacterSheet,
  FIXTURE_CHARACTERS,
  type Ability,
} from "@app/engine";

function slugFor(id: string): string {
  return id.split(":").pop() ?? id;
}

const ABILITY_LABELS: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function generateStaticParams() {
  return FIXTURE_CHARACTERS.map((c) => ({ id: slugFor(c.id) }));
}

export default async function CharacterSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const character = FIXTURE_CHARACTERS.find((c) => slugFor(c.id) === id);
  if (!character) notFound();

  const sheet = buildCharacterSheet(character);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/characters"
        className="text-sm text-lore-muted hover:text-lore-text"
      >
        ← Characters
      </Link>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b border-lore-border pb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            {sheet.name}
          </h1>
          <p className="mt-1 text-lore-muted">
            {sheet.species} · {sheet.classLine} · {sheet.background}
          </p>
        </div>
        <div className="flex gap-3 text-center">
          <Stat label="AC" value={sheet.ac} />
          <Stat label="HP" value={`${sheet.hp.current}/${sheet.hp.max}`} />
          <Stat label="Speed" value={`${sheet.speed} ft`} />
          <Stat label="Init" value={signed(sheet.initiative)} />
          <Stat label="Prof" value={signed(sheet.proficiencyBonus)} />
        </div>
      </header>

      <section className="mt-8">
        <h2 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
          Ability Scores
        </h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {(Object.keys(ABILITY_LABELS) as Ability[]).map((ability) => (
            <div
              key={ability}
              className="rounded-lg border border-lore-border bg-lore-surface p-4 text-center"
            >
              <div className="text-xs uppercase tracking-wide text-lore-muted">
                {ability}
              </div>
              <div className="mt-1 font-display text-3xl">
                {signed(sheet.abilityModifiers[ability])}
              </div>
              <div className="mt-1 text-sm text-lore-muted">
                {sheet.abilityScores[ability]}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
            Saving Throws
          </h2>
          <ul className="space-y-1.5">
            {sheet.savingThrows.map((save) => (
              <li
                key={save.ability}
                className="flex items-center justify-between rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      save.proficient ? "bg-lore-accent" : "bg-lore-border"
                    }`}
                    aria-hidden
                  />
                  {ABILITY_LABELS[save.ability]}
                </span>
                <span className="font-mono">{signed(save.modifier)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
            Skill Proficiencies
          </h2>
          <ul className="flex flex-wrap gap-2">
            {sheet.skillProficiencies.map((skill) => (
              <li
                key={skill}
                className="rounded-full border border-lore-border bg-lore-surface px-3 py-1 text-sm"
              >
                {skill}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="mt-10 text-xs text-lore-muted">
        Derived by <code className="text-lore-text">@app/engine</code> ·
        read-only fixture sheet.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-[60px] rounded-lg border border-lore-border bg-lore-surface px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-lore-muted">
        {label}
      </div>
      <div className="mt-0.5 font-display text-lg">{value}</div>
    </div>
  );
}
