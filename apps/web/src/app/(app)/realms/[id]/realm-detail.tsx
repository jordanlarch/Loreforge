"use client";

import Link from "next/link";

import { buildCharacterSheet, type Ability } from "@app/engine";

import { trpc } from "@/lib/trpc/client";
import {
  REALM_TYPE_LABEL,
  npcToSheetInput,
  type NpcData,
  type RealmEntityType,
} from "@/lib/realms";

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

export function RealmEntityDetail({ id }: { id: string }) {
  const query = trpc.realms.get.useQuery({ id });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-lore-muted">
        Loading…
      </div>
    );
  }

  const entity = query.data;
  if (!entity) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <BackLink />
        <div className="mt-6 rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
          Entity not found.
        </div>
      </div>
    );
  }

  const type = entity.type as RealmEntityType;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <BackLink />

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4 border-b border-lore-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-4xl font-semibold tracking-tight">
              {entity.name}
            </h1>
            {entity.isStub && (
              <span
                title="A placeholder awaiting generator expansion."
                className="rounded bg-lore-bg px-2 py-0.5 text-xs text-lore-muted"
              >
                Stub
              </span>
            )}
          </div>
          <p className="mt-1 text-xs uppercase tracking-wide text-lore-muted">
            {REALM_TYPE_LABEL[type]}
          </p>
          {entity.summary && (
            <p className="mt-3 max-w-2xl text-lore-muted">{entity.summary}</p>
          )}
        </div>
        <ExpandWithGeneratorButton />
      </header>

      {type === "npc" ? (
        <NpcStatBlock id={entity.id} name={entity.name} data={entity.data} />
      ) : (
        <p className="mt-8 text-sm text-lore-muted">
          {REALM_TYPE_LABEL[type]} detail views arrive in a later slice.
        </p>
      )}
    </div>
  );
}

function NpcStatBlock({
  id,
  name,
  data,
}: {
  id: string;
  name: string;
  data: Record<string, unknown>;
}) {
  const sheet = buildCharacterSheet(npcToSheetInput({ id, name, data }));
  const npc = data as Partial<NpcData>;

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-3 text-center">
        <Stat label="AC" value={sheet.ac} />
        <Stat label="HP" value={sheet.hp.max} />
        <Stat label="Speed" value={`${sheet.speed} ft`} />
        <Stat label="Init" value={signed(sheet.initiative)} />
        <Stat label="Prof" value={signed(sheet.proficiencyBonus)} />
        {sheet.classLine && <Stat label="Class" value={sheet.classLine} />}
        {npc.alignment && <Stat label="Alignment" value={npc.alignment} />}
      </div>

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
              <div className="mt-1 text-sm text-lore-muted tabular-nums">
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
          {sheet.skillProficiencies.length === 0 ? (
            <p className="text-sm text-lore-muted">None.</p>
          ) : (
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
          )}
        </section>
      </div>

      <p className="mt-10 text-xs text-lore-muted">
        Stat block derived by{" "}
        <code className="text-lore-text">@app/engine</code> from the same
        character primitives as Character View.
      </p>
    </>
  );
}

function ExpandWithGeneratorButton() {
  return (
    <button
      type="button"
      disabled
      title="Generators arrive in a later slice — you'll be able to expand this entity with AI then."
      className="cursor-not-allowed rounded-lg border border-lore-border px-4 py-1.5 text-sm text-lore-muted opacity-60"
    >
      Expand with Generator
    </button>
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

function BackLink() {
  return (
    <Link
      href="/realms"
      className="text-sm text-lore-muted hover:text-lore-text"
    >
      ← Realms
    </Link>
  );
}
