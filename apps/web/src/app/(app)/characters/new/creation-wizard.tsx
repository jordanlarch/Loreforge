"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";

import {
  ABILITIES,
  abilityModifier,
  applyAbilityBonuses,
  baseArmorClass,
  buildStartingCharacterStats,
  classFeaturesForLevel,
  featureStubsForLevel,
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
  type LevelAdvanceChoice,
} from "@app/engine";

import {
  AdvancementStep,
  advancementComplete,
} from "./advancement-step";

import { trpc } from "@/lib/trpc/client";
import type { EquipmentItem } from "@/lib/character";
import { mergeNotes, type PersonalityFields } from "@/lib/personality";
import {
  startingPackForClass,
  type StartingPack,
} from "@/lib/starting-equipment";

import { SrdHint } from "@/components/srd-hint";

const DRAFT_KEY = "loreforge-char-creation-draft";

const RANDOM_NAMES = [
  "Aldric Vale",
  "Branwen Ash",
  "Caelum Thorn",
  "Dara Flint",
  "Elowen Reed",
  "Finnian Croft",
  "Greta Moss",
  "Haldor Kane",
  "Isolde Wren",
  "Jorah Penn",
];

const BASE_STEPS = [
  "Concept",
  "Species",
  "Class",
  "Background",
  "Abilities",
  "Skills",
  "Equipment",
  "Features",
] as const;

type AbilityMethod = "point-buy" | "standard-array" | "manual" | "roll-4d6";

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

const ABILITY_LABELS: Record<Ability, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

function roll4d6DropLowest(): number {
  const rolls = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6));
  rolls.sort((a, b) => b - a);
  return rolls[0]! + rolls[1]! + rolls[2]!;
}

function rollAbilityScores(): AbilityScores {
  return {
    str: roll4d6DropLowest(),
    dex: roll4d6DropLowest(),
    con: roll4d6DropLowest(),
    int: roll4d6DropLowest(),
    wis: roll4d6DropLowest(),
    cha: roll4d6DropLowest(),
  };
}

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
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const species = trpc.codex.listSpecies.useQuery();
  const classes = trpc.codex.listClasses.useQuery();
  const backgrounds = trpc.codex.listBackgrounds.useQuery();

  const create = trpc.characters.create.useMutation();
  const addToCampaign = trpc.characters.addToCampaign.useMutation();

  const campaignId = searchParams.get("campaignId");

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [concept, setConcept] = useState("");
  const [speciesSlug, setSpeciesSlug] = useState<string | null>(null);
  const [classSlug, setClassSlug] = useState<string | null>(null);
  const [backgroundSlug, setBackgroundSlug] = useState<string | null>(null);
  const [method, setMethod] = useState<AbilityMethod>("point-buy");
  const [base, setBase] = useState<AbilityScores>(POINT_BUY_BASE);
  const [skills, setSkills] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [equipmentPack, setEquipmentPack] = useState<StartingPack | null>(null);
  const [personality, setPersonality] = useState<PersonalityFields>({
    traits: "",
    ideals: "",
    bonds: "",
    flaws: "",
  });
  const [startingLevel, setStartingLevel] = useState(1);
  const [advances, setAdvances] = useState<LevelAdvanceChoice[]>([]);
  const [backstory, setBackstory] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Codex deep links (CODEX-6): ?species=hill-dwarf&class=fighter
  useEffect(() => {
    const speciesParam = searchParams.get("species");
    const classParam = searchParams.get("class");
    if (speciesParam) {
      setSpeciesSlug(speciesParam);
    }
    if (classParam) {
      setClassSlug(classParam);
      setStep(2);
    } else if (speciesParam) {
      setStep(1);
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) {
        setDraftLoaded(true);
        return;
      }
      const draft = JSON.parse(raw) as {
        step?: number;
        name?: string;
        concept?: string;
        speciesSlug?: string | null;
        classSlug?: string | null;
        backgroundSlug?: string | null;
        method?: AbilityMethod;
        base?: AbilityScores;
        skills?: string[];
        personality?: PersonalityFields;
        backstory?: string;
      };
      if (draft.name) setName(draft.name);
      if (draft.concept) setConcept(draft.concept);
      if (draft.speciesSlug) setSpeciesSlug(draft.speciesSlug);
      if (draft.classSlug) setClassSlug(draft.classSlug);
      if (draft.backgroundSlug) setBackgroundSlug(draft.backgroundSlug);
      if (draft.method) setMethod(draft.method);
      if (draft.base) setBase(draft.base);
      if (draft.skills) setSkills(draft.skills);
      if (draft.personality) setPersonality(draft.personality);
      if (draft.backstory) setBackstory(draft.backstory);
      if (typeof draft.step === "number") setStep(draft.step);
    } catch {
      /* ignore corrupt draft */
    }
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    const draft = {
      step,
      name,
      concept,
      speciesSlug,
      classSlug,
      backgroundSlug,
      method,
      base,
      skills,
      personality,
      backstory,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [
    draftLoaded,
    step,
    name,
    concept,
    speciesSlug,
    classSlug,
    backgroundSlug,
    method,
    base,
    skills,
    personality,
    backstory,
  ]);

  useEffect(() => {
    if (!classSlug) return;
    const pack = startingPackForClass(classSlug);
    setEquipmentPack(pack);
    setEquipment(pack.items);
  }, [classSlug]);

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

  const selectedBackground = useMemo(
    () => backgrounds.data?.find((b) => b.slug === backgroundSlug) ?? null,
    [backgrounds.data, backgroundSlug],
  );

  const backgroundSkills = useMemo(
    () => selectedBackground?.skillProficiencies ?? [],
    [selectedBackground],
  );

  const allSkillProficiencies = useMemo(
    () => [...new Set([...backgroundSkills, ...skills])],
    [backgroundSkills, skills],
  );

  const steps = useMemo(() => {
    const list: string[] = [...BASE_STEPS];
    if (startingLevel > 1) list.push("Advancement");
    list.push("Flavor", "Review");
    return list;
  }, [startingLevel]);

  const hasAdvancement = startingLevel > 1;
  const flavorStep = hasAdvancement ? 9 : 8;
  const reviewStep = hasAdvancement ? 10 : 9;

  const previewStats = useMemo(() => {
    if (!selectedClass) return null;
    if (startingLevel <= 1) {
      return {
        maxHp: maxHpAtFirstLevel(selectedClass.hitDie, finalScores.con),
        abilityScores: finalScores,
        xp: 0,
      };
    }
    return buildStartingCharacterStats(
      selectedClass.hitDie,
      startingLevel,
      finalScores,
      advances,
      `create-preview:${name.trim() || "hero"}`,
    );
  }, [selectedClass, startingLevel, finalScores, advances, name]);

  function switchMethod(next: AbilityMethod) {
    setMethod(next);
    if (next === "point-buy") setBase(POINT_BUY_BASE);
    else if (next === "manual") setBase(MANUAL_BASE);
    else if (next === "roll-4d6") setBase(rollAbilityScores());
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

  const rollValid = ABILITIES.every(
    (a) => base[a] >= 3 && base[a] <= 18,
  );

  const abilitiesValid =
    method === "point-buy"
      ? isValidPointBuy(base)
      : method === "standard-array"
        ? standardArrayValid
        : method === "roll-4d6"
          ? rollValid
          : manualValid;

  const skillsRemaining = (selectedClass?.skillChoice.choose ?? 0) - skills.length;
  const skillsValid = selectedClass != null && skillsRemaining === 0;
  const nameValid = name.trim().length > 0;

  const advancementOk =
    !hasAdvancement ||
    (selectedClass != null &&
      advancementComplete(selectedClass.name, startingLevel, advances));

  const stepValid = [
    nameValid,
    selectedSpecies != null,
    selectedClass != null,
    selectedBackground != null,
    abilitiesValid,
    skillsValid,
    equipment.length > 0,
    selectedClass != null,
    ...(hasAdvancement ? [advancementOk] : []),
    true,
    nameValid,
  ];

  const canCreate =
    selectedSpecies != null &&
    selectedClass != null &&
    selectedBackground != null &&
    abilitiesValid &&
    skillsValid &&
    equipment.length > 0 &&
    nameValid &&
    advancementOk;

  async function submit() {
    if (!canCreate || !selectedSpecies || !selectedClass || !selectedBackground)
      return;
    setCreateError(null);
    setCreating(true);
    try {
      const notesParts = [concept.trim(), backstory.trim()].filter(Boolean);
      const notesBody = notesParts.join("\n\n");
      const stats =
        startingLevel > 1
          ? buildStartingCharacterStats(
              selectedClass.hitDie,
              startingLevel,
              finalScores,
              advances,
              `create:${name.trim()}`,
            )
          : {
              maxHp: maxHpAtFirstLevel(selectedClass.hitDie, finalScores.con),
              abilityScores: finalScores,
              xp: 0,
            };
      const row = await create.mutateAsync({
        name: name.trim(),
        species: selectedSpecies.name,
        background: selectedBackground.name,
        classes: [{ class: selectedClass.name, level: startingLevel }],
        abilityScores: stats.abilityScores,
        maxHp: stats.maxHp,
        xp: stats.xp,
        baseAc: equipmentPack?.baseAc ?? baseArmorClass(finalScores.dex),
        speed: selectedSpecies.speed,
        saveProficiencies: selectedClass.savingThrows,
        skillProficiencies: allSkillProficiencies,
        equipment,
        notes: mergeNotes(notesBody, personality),
      });
      if (!row) return;
      localStorage.removeItem(DRAFT_KEY);
      await utils.characters.list.invalidate();
      await utils.characters.listDashboard.invalidate();
      setSuccessToast(`${row.name} created!`);
      await new Promise((r) => setTimeout(r, 800));
      if (campaignId) {
        await addToCampaign.mutateAsync({
          characterId: row.id,
          campaignId,
          role: "pc",
        });
        router.push(`/campaigns/${campaignId}?tab=party`);
      } else {
        router.push(`/characters/${row.id}`);
      }
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Could not create character.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={campaignId ? `/campaigns/${campaignId}` : "/characters"}
          className="text-sm text-lore-muted hover:text-lore-text"
        >
          {campaignId ? "← Campaign" : "← Characters"}
        </Link>
        <span className="text-xs uppercase tracking-widest text-lore-muted">
          Character Creator · 5E SRD
        </span>
      </div>

      <Stepper current={step} valid={stepValid} steps={steps} onJump={setStep} />

      {successToast && (
        <p className="mt-4 rounded border border-lore-accent bg-lore-accent-dim px-3 py-2 text-sm text-lore-text">
          {successToast}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
        <main className="min-w-0">
          {step === 0 && (
            <ConceptStep
              name={name}
              setName={setName}
              concept={concept}
              setConcept={setConcept}
              nameValid={nameValid}
            />
          )}
          {step === 1 && (
            <SpeciesStep
              loading={species.isLoading}
              items={species.data ?? []}
              selected={speciesSlug}
              onSelect={setSpeciesSlug}
            />
          )}
          {step === 2 && (
            <ClassStep
              loading={classes.isLoading}
              items={classes.data ?? []}
              selected={classSlug}
              startingLevel={startingLevel}
              onStartingLevel={setStartingLevel}
              onSelect={(slug) => {
                setClassSlug(slug);
                setSkills([]);
                setAdvances([]);
              }}
            />
          )}
          {step === 3 && (
            <BackgroundStep
              loading={backgrounds.isLoading}
              items={backgrounds.data ?? []}
              selected={backgroundSlug}
              onSelect={setBackgroundSlug}
            />
          )}
          {step === 4 && (
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
          {step === 5 && (
            <SkillsStep
              selectedClass={selectedClass}
              backgroundSkills={backgroundSkills}
              skills={skills}
              setSkills={setSkills}
              remaining={skillsRemaining}
            />
          )}
          {step === 6 && (
            <EquipmentStep
              className={selectedClass?.name ?? "—"}
              pack={equipmentPack}
              equipment={equipment}
            />
          )}
          {step === 7 && (
            <FeaturesStep className={selectedClass?.name ?? "Adventurer"} />
          )}
          {step === 8 && hasAdvancement && selectedClass && (
            <AdvancementStep
              className={selectedClass.name}
              hitDie={selectedClass.hitDie}
              startingLevel={startingLevel}
              abilityScores={finalScores}
              advances={advances}
              onChange={setAdvances}
            />
          )}
          {step === flavorStep && (
            <FlavorStep
              personality={personality}
              setPersonality={setPersonality}
              backstory={backstory}
              setBackstory={setBackstory}
            />
          )}
          {step === reviewStep && (
            <ReviewStep
              name={name}
              setName={setName}
              nameValid={nameValid}
              species={selectedSpecies?.name ?? "—"}
              className={
                selectedClass
                  ? `${selectedClass.name} ${startingLevel}`
                  : "—"
              }
              background={selectedBackground?.name ?? "—"}
              finalScores={previewStats?.abilityScores ?? finalScores}
              skills={allSkillProficiencies}
              equipment={equipment}
              maxHp={previewStats?.maxHp ?? 0}
              baseAc={equipmentPack?.baseAc ?? baseArmorClass(finalScores.dex)}
              speed={selectedSpecies?.speed ?? 30}
              error={createError}
            />
          )}
        </main>

        <SummaryCard
          name={name}
          species={selectedSpecies?.name ?? null}
          className={selectedClass?.name ?? null}
          background={selectedBackground?.name ?? null}
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

        {step < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
            disabled={!stepValid[step]}
            className="rounded border border-lore-accent bg-lore-accent-dim px-5 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!canCreate || creating}
            className="rounded border border-lore-accent bg-lore-accent-dim px-5 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {creating ? "Creating…" : "Create character"}
          </button>
        )}
      </footer>
    </div>
  );
}

function Stepper({
  current,
  valid,
  steps,
  onJump,
}: {
  current: number;
  valid: boolean[];
  steps: string[];
  onJump: (step: number) => void;
}) {
  return (
    <ol className="flex flex-wrap gap-2">
      {steps.map((label, i) => {
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
  startingLevel,
  onStartingLevel,
  onSelect,
}: {
  loading: boolean;
  items: ClassItem[];
  selected: string | null;
  startingLevel: number;
  onStartingLevel: (level: number) => void;
  onSelect: (slug: string) => void;
}) {
  return (
    <section>
      <h2 className="font-display text-2xl">Choose Your Class</h2>
      <p className="mt-1 text-sm text-lore-muted">
        Determines hit die, saving throws, and skill choices.
      </p>
      <label className="mt-4 block max-w-xs">
        <span className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
          Starting level
        </span>
        <select
          value={startingLevel}
          onChange={(e) => onStartingLevel(Number(e.target.value))}
          className="w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm"
        >
          {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              Level {n}
            </option>
          ))}
        </select>
      </label>
      {startingLevel > 1 && (
        <p className="mt-2 text-xs text-lore-accent">
          You will choose HP and features for each level after equipment.
        </p>
      )}
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
    { id: "roll-4d6", label: "Roll 4d6" },
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
      {method === "roll-4d6" && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              setBase({
                str: roll4d6DropLowest(),
                dex: roll4d6DropLowest(),
                con: roll4d6DropLowest(),
                int: roll4d6DropLowest(),
                wis: roll4d6DropLowest(),
                cha: roll4d6DropLowest(),
              })
            }
            className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text hover:border-lore-accent"
          >
            Re-roll all
          </button>
          <span className="text-xs text-lore-muted">
            4d6 drop lowest per ability; species bonuses apply after.
          </span>
        </div>
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
              {method === "roll-4d6" && (
                <span className="font-mono text-sm">{base[a]}</span>
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
  backgroundSkills,
  skills,
  setSkills,
  remaining,
}: {
  selectedClass: ClassItem | null;
  backgroundSkills: string[];
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
    if (backgroundSkills.includes(skill)) return;
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
          ? `Choose ${remaining} more class skill${remaining === 1 ? "" : "s"}.`
          : "All class skill choices made."}
      </p>
      {backgroundSkills.length > 0 && (
        <p className="mt-2 text-xs text-lore-muted">
          From background (automatic):{" "}
          <span className="text-lore-accent">{backgroundSkills.join(", ")}</span>
        </p>
      )}
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {selectedClass.skillChoice.from.map((skill) => {
          const fromBackground = backgroundSkills.includes(skill);
          const checked = fromBackground || skills.includes(skill);
          const atLimit = !checked && remaining === 0;
          return (
            <label
              key={skill}
              className={`flex items-center gap-3 rounded border px-3 py-2 text-sm transition-colors ${
                fromBackground
                  ? "border-lore-accent/60 bg-lore-accent-dim/50 opacity-90"
                  : checked
                    ? "border-lore-accent bg-lore-accent-dim"
                    : atLimit
                      ? "border-lore-border opacity-40"
                      : "border-lore-border bg-lore-surface hover:border-lore-accent"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={fromBackground || atLimit}
                onChange={() => toggle(skill)}
                className="accent-lore-accent"
              />
              <SrdHint kind="skill" skill={skill} />
              {fromBackground && (
                <span className="ml-auto text-[10px] uppercase tracking-wide text-lore-muted">
                  Background
                </span>
              )}
            </label>
          );
        })}
      </div>
    </section>
  );
}

function EquipmentStep({
  className,
  pack,
  equipment,
}: {
  className: string;
  pack: StartingPack | null;
  equipment: EquipmentItem[];
}) {
  return (
    <section>
      <h2 className="font-display text-2xl">Starting Equipment</h2>
      <p className="mt-1 text-sm text-lore-muted">
        Default {className} loadout from the SRD. Full pack choices and gold-buy
        come in a later slice.
      </p>

      {pack ? (
        <>
          <p className="mt-4 text-sm text-lore-text">{pack.label}</p>
          <p className="mt-1 text-xs text-lore-muted">
            Base AC {pack.baseAc} with equipped armor
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {equipment.map((item) => (
              <li
                key={item.name}
                className="rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm"
              >
                <span className="font-medium text-lore-text">{item.name}</span>
                {item.quantity > 1 && (
                  <span className="text-lore-muted"> ×{item.quantity}</span>
                )}
                {item.equipped && (
                  <span className="ml-2 text-xs uppercase text-lore-accent">
                    equipped
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-6 text-sm text-lore-muted">
          Choose a class on the previous steps to see your starting gear.
        </p>
      )}
    </section>
  );
}

function ReviewStep({
  name,
  setName,
  nameValid,
  species,
  className,
  background,
  finalScores,
  skills,
  equipment,
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
  background: string;
  finalScores: AbilityScores;
  skills: string[];
  equipment: EquipmentItem[];
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
        <Row label="Background" value={background} />
        <Row label="Max HP" value={String(maxHp)} />
        <Row label="Base AC" value={String(baseAc)} />
        <Row label="Speed" value={`${speed} ft`} />
        <Row label="Skills" value={skills.join(", ") || "—"} />
        <Row
          label="Equipment"
          value={
            equipment.length > 0
              ? `${equipment.length} item${equipment.length === 1 ? "" : "s"}`
              : "—"
          }
        />
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
  background,
  finalScores,
}: {
  name: string;
  species: string | null;
  className: string | null;
  background: string | null;
  finalScores: AbilityScores;
}) {
  return (
    <aside className="h-fit rounded-lg border border-lore-border bg-lore-surface p-5 lg:sticky lg:top-6">
      <div className="text-xs uppercase tracking-widest text-lore-muted">
        Preview
      </div>
      <div className="mt-2 font-display text-xl">
        {name.trim() || "New Character"}
      </div>
      <div className="mt-1 text-sm text-lore-muted">
        Level 1 {[species, className].filter(Boolean).join(" ") || "—"}
      </div>
      {background && (
        <div className="mt-1 text-xs text-lore-muted">{background}</div>
      )}
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

function ConceptStep({
  name,
  setName,
  concept,
  setConcept,
  nameValid,
}: {
  name: string;
  setName: (v: string) => void;
  concept: string;
  setConcept: (v: string) => void;
  nameValid: boolean;
}) {
  function randomizeName() {
    const pick = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]!;
    setName(pick);
  }

  return (
    <section>
      <h2 className="font-display text-2xl">Character Concept</h2>
      <p className="mt-1 text-sm text-lore-muted">
        Name your hero and jot a one-line concept. You can flesh out personality
        and backstory later.
      </p>
      <label className="mt-6 block max-w-md">
        <span className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
          Name
        </span>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Thorin Ironfist"
            className="flex-1 rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
          />
          <button
            type="button"
            onClick={randomizeName}
            className="shrink-0 rounded border border-lore-border px-3 py-2 text-xs text-lore-muted hover:text-lore-text"
          >
            Random
          </button>
        </div>
        {!nameValid && name.length > 0 && (
          <span className="mt-1 block text-xs text-red-400">
            Name cannot be blank.
          </span>
        )}
      </label>
      <label className="mt-4 block max-w-lg">
        <span className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
          Concept (optional)
        </span>
        <input
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder="A dwarven soldier seeking redemption…"
          className="w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
        />
      </label>
    </section>
  );
}

type BackgroundItem = {
  slug: string;
  name: string;
  description: string | null;
  skillSummary: string | null;
  skillProficiencies: string[];
};

function BackgroundStep({
  loading,
  items,
  selected,
  onSelect,
}: {
  loading: boolean;
  items: BackgroundItem[];
  selected: string | null;
  onSelect: (slug: string) => void;
}) {
  return (
    <section>
      <h2 className="font-display text-2xl">Choose Your Background</h2>
      <p className="mt-1 text-sm text-lore-muted">
        SRD backgrounds from the Codex. Skill proficiencies auto-apply when
        structured in the source data.
      </p>
      {loading ? (
        <p className="mt-6 text-lore-muted">Loading backgrounds…</p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {items.map((b) => (
            <button
              key={b.slug}
              type="button"
              onClick={() => onSelect(b.slug)}
              className={`rounded-lg border bg-lore-surface p-4 text-left transition-colors ${
                selected === b.slug
                  ? "border-lore-accent"
                  : "border-lore-border hover:border-lore-accent"
              }`}
            >
              <div className="font-display text-lg">{b.name}</div>
              {b.skillSummary && (
                <div className="mt-1 text-xs text-lore-accent">
                  {b.skillSummary}
                </div>
              )}
              <p className="mt-2 line-clamp-2 text-xs text-lore-muted">
                {b.description}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function FeaturesStep({ className }: { className: string }) {
  const features = classFeaturesForLevel(className, 1);
  const stubs = featureStubsForLevel(className, 1);
  return (
    <section>
      <h2 className="font-display text-2xl">Class Features &amp; Spells</h2>
      <p className="mt-1 text-sm text-lore-muted">
        At level 1 you gain the features below. Spell selection for casters
        happens on the character sheet Spells tab after creation.
      </p>
      <ul className="mt-6 space-y-2">
        {features.length > 0
          ? features.map((f) => (
              <li
                key={f.id}
                className="rounded border border-lore-border bg-lore-surface px-4 py-3 text-sm"
              >
                <div className="font-medium">{f.name}</div>
                <p className="mt-1 text-xs text-lore-muted">{f.description}</p>
              </li>
            ))
          : stubs.map((stub) => (
              <li
                key={stub}
                className="rounded border border-lore-border bg-lore-surface px-4 py-3 text-sm"
              >
                {stub}
              </li>
            ))}
      </ul>
      <p className="mt-4 text-xs text-lore-muted">
        Cantrip and spell picks use the Codex spell browser on your sheet (#198).
      </p>
    </section>
  );
}

function FlavorStep({
  personality,
  setPersonality,
  backstory,
  setBackstory,
}: {
  personality: PersonalityFields;
  setPersonality: React.Dispatch<React.SetStateAction<PersonalityFields>>;
  backstory: string;
  setBackstory: (v: string) => void;
}) {
  function patch(key: keyof PersonalityFields, value: string) {
    setPersonality((p: PersonalityFields) => ({ ...p, [key]: value }));
  }

  return (
    <section>
      <h2 className="font-display text-2xl">Personality &amp; Flavor</h2>
      <p className="mt-1 text-sm text-lore-muted">
        Optional — all fields can be edited later on the Personality tab.
      </p>
      <div className="mt-6 space-y-4">
        {(
          [
            ["traits", "Personality traits"],
            ["ideals", "Ideals"],
            ["bonds", "Bonds"],
            ["flaws", "Flaws"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
              {label}
            </span>
            <textarea
              value={personality[key]}
              onChange={(e) => patch(key, e.target.value)}
              rows={2}
              className="w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
            />
          </label>
        ))}
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
            Backstory
          </span>
          <textarea
            value={backstory}
            onChange={(e) => setBackstory(e.target.value)}
            rows={4}
            className="w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
          />
        </label>
      </div>
    </section>
  );
}
