"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  ABILITIES,
  abilityModifier,
  applyAbilityBonuses,
  baseArmorClass,
  isValidPointBuy,
  MANUAL_MAX,
  MANUAL_MIN,
  maxHpAtFirstLevel,
  POINT_BUY_BUDGET,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  pointBuyCost,
  pointBuyRemaining,
  STANDARD_ARRAY,
  type Ability,
  type AbilityScores,
} from "@app/engine";

import { trpc } from "@/lib/trpc/client";

import { SrdHint } from "@/components/srd-hint";

const ABILITY_LABELS: Record<Ability, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

const STEPS = ["Species", "Class", "Abilities", "Skills", "Review"] as const;

type AbilityMethod = "point-buy" | "standard-array" | "manual";

const POINT_BUY_BASE: AbilityScores = {
  str: 8,
  dex: 8,
  con: 8,
  int: 8,
  wis: 8,
  cha: 8,
};

const MANUAL_BASE: AbilityScores = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
};

// Standard array assigned in canonical ability order as a starting point.
const STANDARD_ARRAY_BASE: AbilityScores = {
  str: STANDARD_ARRAY[0],
  dex: STANDARD_ARRAY[1],
  con: STANDARD_ARRAY[2],
  int: STANDARD_ARRAY[3],
  wis: STANDARD_ARRAY[4],
  cha: STANDARD_ARRAY[5],
};

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function CreationWizard() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const species = trpc.codex.listSpecies.useQuery();
  const classes = trpc.codex.listClasses.useQuery();

  const create = trpc.characters.create.useMutation({
    onSuccess: async (row) => {
      if (!row) return;
      await utils.characters.list.invalidate();
      router.push(`/characters/${row.id}`);
    },
  });

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [speciesSlug, setSpeciesSlug] = useState<string | null>(null);
  const [classSlug, setClassSlug] = useState<string | null>(null);
  const [method, setMethod] = useState<AbilityMethod>("point-buy");
  const [base, setBase] = useState<AbilityScores>(POINT_BUY_BASE);
  const [skills, setSkills] = useState<string[]>([]);

  const selectedSpecies = useMemo(
    () => species.data?.find((s) => s.slug === speciesSlug) ?? null,
    [species.data, speciesSlug],
  );
  const selectedClass = useMemo(
    () => classes.data?.find((c) => c.slug === classSlug) ?? null,
    [classes.data, classSlug],
  );

  const finalScores = useMemo(
    () => applyAbilityBonuses(base, selectedSpecies?.abilityBonuses ?? {}),
    [base, selectedSpecies],
  );

  function switchMethod(next: AbilityMethod) {
    setMethod(next);
    if (next === "point-buy") setBase(POINT_BUY_BASE);
    else if (next === "manual") setBase(MANUAL_BASE);
    else setBase(STANDARD_ARRAY_BASE);
  }

  // Standard array is valid when each canonical value is used exactly once.
  const standardArrayValid = useMemo(() => {
    const chosen = ABILITIES.map((a) => base[a]).sort((x, y) => x - y);
    const expected = [...STANDARD_ARRAY].sort((x, y) => x - y);
    return chosen.every((v, i) => v === expected[i]);
  }, [base]);

  const manualValid = ABILITIES.every(
    (a) => base[a] >= MANUAL_MIN && base[a] <= MANUAL_MAX,
  );

  const abilitiesValid =
    method === "point-buy"
      ? isValidPointBuy(base)
      : method === "standard-array"
        ? standardArrayValid
        : manualValid;

  const skillsRemaining = (selectedClass?.skillChoice.choose ?? 0) - skills.length;
  const skillsValid = selectedClass != null && skillsRemaining === 0;
  const nameValid = name.trim().length > 0;

  const stepValid = [
    selectedSpecies != null,
    selectedClass != null,
    abilitiesValid,
    skillsValid,
    nameValid,
  ];

  const canCreate =
    selectedSpecies != null &&
    selectedClass != null &&
    abilitiesValid &&
    skillsValid &&
    nameValid;

  function submit() {
    if (!canCreate || !selectedSpecies || !selectedClass) return;
    create.mutate({
      name: name.trim(),
      species: selectedSpecies.name,
      background: "",
      classes: [{ class: selectedClass.name, level: 1 }],
      abilityScores: finalScores,
      maxHp: maxHpAtFirstLevel(selectedClass.hitDie, finalScores.con),
      baseAc: baseArmorClass(finalScores.dex),
      speed: selectedSpecies.speed,
      saveProficiencies: selectedClass.savingThrows,
      skillProficiencies: skills,
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/characters"
          className="text-sm text-lore-muted hover:text-lore-text"
        >
          ← Characters
        </Link>
        <span className="text-xs uppercase tracking-widest text-lore-muted">
          Character Creator · 5E SRD
        </span>
      </div>

      <Stepper current={step} valid={stepValid} onJump={setStep} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
        <main className="min-w-0">
          {step === 0 && (
            <SpeciesStep
              loading={species.isLoading}
              items={species.data ?? []}
              selected={speciesSlug}
              onSelect={setSpeciesSlug}
            />
          )}
          {step === 1 && (
            <ClassStep
              loading={classes.isLoading}
              items={classes.data ?? []}
              selected={classSlug}
              onSelect={(slug) => {
                setClassSlug(slug);
                setSkills([]);
              }}
            />
          )}
          {step === 2 && (
            <AbilitiesStep
              method={method}
              onMethod={switchMethod}
              base={base}
              setBase={setBase}
              bonuses={selectedSpecies?.abilityBonuses ?? {}}
              finalScores={finalScores}
              standardArrayValid={standardArrayValid}
            />
          )}
          {step === 3 && (
            <SkillsStep
              selectedClass={selectedClass}
              skills={skills}
              setSkills={setSkills}
              remaining={skillsRemaining}
            />
          )}
          {step === 4 && (
            <ReviewStep
              name={name}
              setName={setName}
              nameValid={nameValid}
              species={selectedSpecies?.name ?? "—"}
              className={selectedClass?.name ?? "—"}
              finalScores={finalScores}
              skills={skills}
              maxHp={
                selectedClass
                  ? maxHpAtFirstLevel(selectedClass.hitDie, finalScores.con)
                  : 0
              }
              baseAc={baseArmorClass(finalScores.dex)}
              speed={selectedSpecies?.speed ?? 30}
              error={create.error?.message ?? null}
            />
          )}
        </main>

        <SummaryCard
          name={name}
          species={selectedSpecies?.name ?? null}
          className={selectedClass?.name ?? null}
          finalScores={finalScores}
        />
      </div>

      <footer className="mt-10 flex items-center justify-between border-t border-lore-border pt-6">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded border border-lore-border px-4 py-2 text-sm text-lore-muted transition-colors hover:text-lore-text disabled:opacity-40"
        >
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={!stepValid[step]}
            className="rounded border border-lore-accent bg-lore-accent-dim px-5 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canCreate || create.isPending}
            className="rounded border border-lore-accent bg-lore-accent-dim px-5 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {create.isPending ? "Creating…" : "Create character"}
          </button>
        )}
      </footer>
    </div>
  );
}

function Stepper({
  current,
  valid,
  onJump,
}: {
  current: number;
  valid: boolean[];
  onJump: (step: number) => void;
}) {
  return (
    <ol className="flex flex-wrap gap-2">
      {STEPS.map((label, i) => {
        const active = i === current;
        const done = i < current && valid[i];
        return (
          <li key={label}>
            <button
              type="button"
              onClick={() => onJump(i)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-lore-accent bg-lore-accent-dim text-lore-text"
                  : done
                    ? "border-lore-border text-lore-text"
                    : "border-lore-border text-lore-muted hover:text-lore-text"
              }`}
            >
              <span className="font-mono text-xs">{i + 1}</span>
              {label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

type SpeciesItem = {
  slug: string;
  name: string;
  abilityBonuses: Partial<AbilityScores>;
  speed: number;
  size: string;
  traits: string[];
};

function bonusLine(bonuses: Partial<AbilityScores>): string {
  const parts = ABILITIES.filter((a) => bonuses[a]).map(
    (a) => `${signed(bonuses[a]!)} ${ABILITY_LABELS[a]}`,
  );
  return parts.length > 0 ? parts.join(", ") : "—";
}

function SpeciesStep({
  loading,
  items,
  selected,
  onSelect,
}: {
  loading: boolean;
  items: SpeciesItem[];
  selected: string | null;
  onSelect: (slug: string) => void;
}) {
  return (
    <section>
      <h2 className="font-display text-2xl">Choose Your Species</h2>
      <p className="mt-1 text-sm text-lore-muted">
        Sourced from the Codex SRD data. Ability bonuses apply automatically.
      </p>
      {loading ? (
        <p className="mt-6 text-lore-muted">Loading species…</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((s) => (
            <button
              key={s.slug}
              type="button"
              onClick={() => onSelect(s.slug)}
              className={`rounded-lg border bg-lore-surface p-4 text-left transition-colors ${
                selected === s.slug
                  ? "border-lore-accent"
                  : "border-lore-border hover:border-lore-accent"
              }`}
            >
              <div className="font-display text-lg">{s.name}</div>
              <div className="mt-1 text-sm text-lore-accent">
                {bonusLine(s.abilityBonuses)}
              </div>
              <div className="mt-1 text-xs text-lore-muted">
                {s.size} · {s.speed} ft
              </div>
              <div className="mt-2 text-xs text-lore-muted">
                {s.traits.slice(0, 3).join(" · ")}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

type ClassItem = {
  slug: string;
  name: string;
  hitDie: number;
  savingThrows: Ability[];
  skillChoice: { choose: number; from: string[] };
};

function ClassStep({
  loading,
  items,
  selected,
  onSelect,
}: {
  loading: boolean;
  items: ClassItem[];
  selected: string | null;
  onSelect: (slug: string) => void;
}) {
  return (
    <section>
      <h2 className="font-display text-2xl">Choose Your Class</h2>
      <p className="mt-1 text-sm text-lore-muted">
        Determines hit die, saving throws, and skill choices.
      </p>
      {loading ? (
        <p className="mt-6 text-lore-muted">Loading classes…</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => onSelect(c.slug)}
              className={`rounded-lg border bg-lore-surface p-4 text-left transition-colors ${
                selected === c.slug
                  ? "border-lore-accent"
                  : "border-lore-border hover:border-lore-accent"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-lg">{c.name}</span>
                <span className="rounded bg-lore-bg px-2 py-0.5 text-xs text-lore-accent">
                  d{c.hitDie}
                </span>
              </div>
              <div className="mt-1 text-sm text-lore-muted">
                Saves: {c.savingThrows.map((s) => ABILITY_LABELS[s]).join(", ")}
              </div>
              <div className="mt-1 text-xs text-lore-muted">
                Pick {c.skillChoice.choose} skill
                {c.skillChoice.choose === 1 ? "" : "s"}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function AbilitiesStep({
  method,
  onMethod,
  base,
  setBase,
  bonuses,
  finalScores,
  standardArrayValid,
}: {
  method: AbilityMethod;
  onMethod: (m: AbilityMethod) => void;
  base: AbilityScores;
  setBase: React.Dispatch<React.SetStateAction<AbilityScores>>;
  bonuses: Partial<AbilityScores>;
  finalScores: AbilityScores;
  standardArrayValid: boolean;
}) {
  const remaining = pointBuyRemaining(base);
  const methods: { id: AbilityMethod; label: string }[] = [
    { id: "point-buy", label: "Point Buy" },
    { id: "standard-array", label: "Standard Array" },
    { id: "manual", label: "Manual" },
  ];

  return (
    <section>
      <h2 className="font-display text-2xl">Determine Ability Scores</h2>
      <div className="mt-4 flex gap-2">
        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onMethod(m.id)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              method === m.id
                ? "border-lore-accent bg-lore-accent-dim text-lore-text"
                : "border-lore-border text-lore-muted hover:text-lore-text"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {method === "point-buy" && (
        <p
          className={`mt-4 text-sm ${
            remaining < 0 ? "text-red-400" : "text-lore-muted"
          }`}
        >
          Points remaining: <span className="font-mono">{remaining}</span> /{" "}
          {POINT_BUY_BUDGET}
          {remaining < 0 && " — over budget"}
        </p>
      )}
      {method === "standard-array" && !standardArrayValid && (
        <p className="mt-4 text-sm text-red-400">
          Assign each of {STANDARD_ARRAY.join(", ")} exactly once.
        </p>
      )}

      <div className="mt-4 space-y-2">
        {ABILITIES.map((a) => (
          <div
            key={a}
            className="flex items-center gap-3 rounded border border-lore-border bg-lore-surface px-3 py-2"
          >
            <span className="w-28 text-sm font-medium">
              <SrdHint kind="ability" ability={a} label={ABILITY_LABELS[a]} />
            </span>

            <div className="flex-1">
              {method === "point-buy" && (
                <PointBuyControl
                  value={base[a]}
                  onChange={(v) => setBase((p) => ({ ...p, [a]: v }))}
                  base={base}
                  ability={a}
                />
              )}
              {method === "standard-array" && (
                <select
                  value={base[a]}
                  onChange={(e) =>
                    setBase((p) => ({ ...p, [a]: Number(e.target.value) }))
                  }
                  className="rounded border border-lore-border bg-lore-bg px-2 py-1 text-sm"
                >
                  {STANDARD_ARRAY.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              )}
              {method === "manual" && (
                <input
                  type="number"
                  min={MANUAL_MIN}
                  max={MANUAL_MAX}
                  value={base[a]}
                  onChange={(e) =>
                    setBase((p) => ({ ...p, [a]: Number(e.target.value) }))
                  }
                  className="w-20 rounded border border-lore-border bg-lore-bg px-2 py-1 text-sm"
                />
              )}
            </div>

            <span className="w-16 text-right text-xs text-lore-muted">
              {bonuses[a] ? `${base[a]} ${signed(bonuses[a]!)}` : `${base[a]}`}
            </span>
            <span className="w-14 text-right font-display text-lg">
              {finalScores[a]}
              <span className="ml-1 text-xs text-lore-muted">
                {signed(abilityModifier(finalScores[a]))}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PointBuyControl({
  value,
  onChange,
  base,
  ability,
}: {
  value: number;
  onChange: (v: number) => void;
  base: AbilityScores;
  ability: Ability;
}) {
  const canInc =
    value < POINT_BUY_MAX &&
    pointBuyRemaining({ ...base, [ability]: value + 1 }) >= 0;
  const canDec = value > POINT_BUY_MIN;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => canDec && onChange(value - 1)}
        disabled={!canDec}
        className="h-7 w-7 rounded border border-lore-border text-lore-muted hover:text-lore-text disabled:opacity-30"
      >
        −
      </button>
      <span className="w-6 text-center font-mono">{value}</span>
      <button
        type="button"
        onClick={() => canInc && onChange(value + 1)}
        disabled={!canInc}
        className="h-7 w-7 rounded border border-lore-border text-lore-muted hover:text-lore-text disabled:opacity-30"
      >
        +
      </button>
      <span className="ml-1 text-xs text-lore-muted">
        cost {pointBuyCost(value)}
      </span>
    </div>
  );
}

function SkillsStep({
  selectedClass,
  skills,
  setSkills,
  remaining,
}: {
  selectedClass: ClassItem | null;
  skills: string[];
  setSkills: React.Dispatch<React.SetStateAction<string[]>>;
  remaining: number;
}) {
  if (!selectedClass) {
    return (
      <section>
        <h2 className="font-display text-2xl">Select Skills</h2>
        <p className="mt-4 text-sm text-lore-muted">Choose a class first.</p>
      </section>
    );
  }

  function toggle(skill: string) {
    setSkills((prev) => {
      if (prev.includes(skill)) return prev.filter((s) => s !== skill);
      if (prev.length >= selectedClass!.skillChoice.choose) return prev;
      return [...prev, skill];
    });
  }

  return (
    <section>
      <h2 className="font-display text-2xl">Select Skills</h2>
      <p
        className={`mt-1 text-sm ${
          remaining === 0 ? "text-lore-muted" : "text-lore-accent"
        }`}
      >
        {remaining > 0
          ? `Choose ${remaining} more skill${remaining === 1 ? "" : "s"}.`
          : "All skill choices made."}
      </p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {selectedClass.skillChoice.from.map((skill) => {
          const checked = skills.includes(skill);
          const atLimit = !checked && remaining === 0;
          return (
            <label
              key={skill}
              className={`flex items-center gap-3 rounded border px-3 py-2 text-sm transition-colors ${
                checked
                  ? "border-lore-accent bg-lore-accent-dim"
                  : atLimit
                    ? "border-lore-border opacity-40"
                    : "border-lore-border bg-lore-surface hover:border-lore-accent"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={atLimit}
                onChange={() => toggle(skill)}
                className="accent-lore-accent"
              />
              <SrdHint kind="skill" skill={skill} />
            </label>
          );
        })}
      </div>
    </section>
  );
}

function ReviewStep({
  name,
  setName,
  nameValid,
  species,
  className,
  finalScores,
  skills,
  maxHp,
  baseAc,
  speed,
  error,
}: {
  name: string;
  setName: (v: string) => void;
  nameValid: boolean;
  species: string;
  className: string;
  finalScores: AbilityScores;
  skills: string[];
  maxHp: number;
  baseAc: number;
  speed: number;
  error: string | null;
}) {
  return (
    <section>
      <h2 className="font-display text-2xl">Review &amp; Create</h2>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
          Character Name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Thorin Ironfist"
          className="w-full max-w-sm rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
        />
        {!nameValid && (
          <span className="mt-1 block text-xs text-red-400">
            A name is required.
          </span>
        )}
      </label>

      <dl className="mt-6 grid gap-x-8 gap-y-2 sm:grid-cols-2">
        <Row label="Species" value={species} />
        <Row label="Class" value={`${className} 1`} />
        <Row label="Max HP" value={String(maxHp)} />
        <Row label="Base AC" value={String(baseAc)} />
        <Row label="Speed" value={`${speed} ft`} />
        <Row label="Skills" value={skills.join(", ") || "—"} />
      </dl>

      <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {ABILITIES.map((a) => (
          <div
            key={a}
            className="rounded border border-lore-border bg-lore-surface p-3 text-center"
          >
            <div className="text-xs uppercase text-lore-muted">
              {ABILITY_LABELS[a]}
            </div>
            <div className="font-display text-xl">{finalScores[a]}</div>
            <div className="text-xs text-lore-muted">
              {signed(abilityModifier(finalScores[a]))}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          {error}
        </p>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-lore-border/50 py-1.5">
      <dt className="text-sm text-lore-muted">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function SummaryCard({
  name,
  species,
  className,
  finalScores,
}: {
  name: string;
  species: string | null;
  className: string | null;
  finalScores: AbilityScores;
}) {
  return (
    <aside className="h-fit rounded-lg border border-lore-border bg-lore-surface p-5 lg:sticky lg:top-6">
      <div className="text-xs uppercase tracking-widest text-lore-muted">
        Summary
      </div>
      <div className="mt-2 font-display text-xl">
        {name.trim() || "New Character"}
      </div>
      <div className="mt-1 text-sm text-lore-muted">
        Level 1 {[species, className].filter(Boolean).join(" ") || "—"}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {ABILITIES.map((a) => (
          <div
            key={a}
            className="rounded border border-lore-border bg-lore-bg p-2 text-center"
          >
            <div className="text-[10px] uppercase text-lore-muted">
              {ABILITY_LABELS[a]}
            </div>
            <div className="font-display text-lg">{finalScores[a]}</div>
            <div className="text-[10px] text-lore-muted">
              {signed(abilityModifier(finalScores[a]))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
