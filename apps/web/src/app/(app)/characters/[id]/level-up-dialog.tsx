"use client";

import { useEffect, useMemo, useState } from "react";

import {
  abilityModifier,
  extraAttackCount,
  fightingStylePickLevel,
  grantsAsiAtLevel,
  featureStubsForLevel,
  classFeaturesForLevel,
  hasThirdCasterSlots,
  hpGainOnLevelUp,
  hpRollFromSeed,
  isSpellcastingClasses,
  levelUpSeed,
  multiclassCasterLevel,
  multiclassEligible,
  multiclassIneligibilityReason,
  multiclassRequirementLabel,
  proficiencyBonusForLevel,
  sheetSlotPoolsFromClasses,
  subclassPickLevel,
  totalLevel,
  warlockLevelFromClasses,
  warlockPactMagic,
  type AbilityScores,
  type ClassLevel,
  type HpMethod,
} from "@app/engine";

import {
  AsiFeatChoice,
  asiFeatComplete,
  type AsiFeatSelection,
} from "@/components/character-creation/asi-feat-choice";
import {
  FightingStylePicker,
  SubclassPicker,
} from "@/components/character-creation/class-choice-pickers";
import {
  RangerFeatureChoices,
  rangerFeatureChoicesComplete,
} from "@/components/character-creation/class-feature-choices";
import { CodexSpellAddPicker } from "@/components/character-library-pickers";
import type { CharacterSpell, SpellLoadout } from "@/lib/character";
import { spellKey } from "@/lib/character-library";
import { parseCharacterNotes } from "@/lib/character-sheet-storage";
import { trpc } from "@/lib/trpc/client";

const MAX_LEVEL = 20;

function draftKey(characterId: string) {
  return `loreforge-level-up-draft:${characterId}`;
}

type Character = {
  id: string;
  name: string;
  classes: ClassLevel[];
  abilityScores: AbilityScores;
  maxHp: number;
  notes: string;
  spells: SpellLoadout;
};

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function previewClasses(
  character: Character,
  classIndex: number,
  addingClass: string | null,
): ClassLevel[] {
  if (addingClass) {
    return [...character.classes, { class: addingClass, level: 1 }];
  }
  return character.classes.map((c, i) =>
    i === classIndex ? { ...c, level: c.level + 1 } : c,
  );
}

function formatSlotTable(
  classes: ClassLevel[],
): { level: string; max: number }[] {
  const pools = sheetSlotPoolsFromClasses(classes);
  return Object.entries(pools)
    .map(([level, pool]) => ({ level, max: pool.max }))
    .filter((r) => r.max > 0)
    .sort((a, b) => Number(a.level) - Number(b.level));
}

export function LevelUpDialog({
  character,
  milestoneXp,
  onClose,
}: {
  character: Character;
  milestoneXp?: boolean;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const codexClasses = trpc.codex.listClasses.useQuery();
  const existingMeta = useMemo(
    () => parseCharacterNotes(character.notes).meta,
    [character.notes],
  );

  const [wizardStep, setWizardStep] = useState(0);
  const [classIndex, setClassIndex] = useState(0);
  const [addNewClass, setAddNewClass] = useState<string | null>(null);
  const [hpMethod, setHpMethod] = useState<HpMethod>("average");
  const [celebrating, setCelebrating] = useState(false);
  const [subclass, setSubclass] = useState("");
  const [fightingStyle, setFightingStyle] = useState("");
  const [asiFeat, setAsiFeat] = useState<AsiFeatSelection | null>(null);
  const [applySpellSlots, setApplySpellSlots] = useState(true);
  const [spellPickerOpen, setSpellPickerOpen] = useState(false);
  const [addedSpells, setAddedSpells] = useState<CharacterSpell[]>([]);
  const [featureChoices, setFeatureChoices] = useState<Record<string, string>>(
    () => existingMeta.featureChoices ?? {},
  );

  const levelUp = trpc.characters.levelUp.useMutation({
    onSuccess: async () => {
      localStorage.removeItem(draftKey(character.id));
      await Promise.all([
        utils.characters.get.invalidate({ id: character.id }),
        utils.characters.list.invalidate(),
        utils.characters.listDashboard.invalidate(),
      ]);
      setCelebrating(true);
      window.setTimeout(() => {
        onClose();
      }, 1400);
    },
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(character.id));
      if (!raw) return;
      const d = JSON.parse(raw) as {
        wizardStep?: number;
        classIndex?: number;
        addNewClass?: string | null;
        hpMethod?: HpMethod;
        applySpellSlots?: boolean;
      };
      if (typeof d.wizardStep === "number") setWizardStep(d.wizardStep);
      if (typeof d.classIndex === "number") setClassIndex(d.classIndex);
      if (d.addNewClass !== undefined) setAddNewClass(d.addNewClass);
      if (d.hpMethod) setHpMethod(d.hpMethod);
      if (typeof d.applySpellSlots === "boolean") setApplySpellSlots(d.applySpellSlots);
    } catch {
      /* ignore corrupt draft */
    }
  }, [character.id]);

  useEffect(() => {
    localStorage.setItem(
      draftKey(character.id),
      JSON.stringify({
        wizardStep,
        classIndex,
        addNewClass,
        hpMethod,
        applySpellSlots,
      }),
    );
  }, [
    character.id,
    wizardStep,
    classIndex,
    addNewClass,
    hpMethod,
    applySpellSlots,
  ]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !celebrating) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, celebrating]);

  const addingClass = addNewClass != null;
  const target = addingClass ? null : character.classes[classIndex];
  const conMod = abilityModifier(character.abilityScores.con);

  const hitDie = useMemo(() => {
    const className = addingClass ? addNewClass : target?.class;
    if (!className) return null;
    return (
      codexClasses.data?.find((c) => c.name === className)?.hitDie ?? null
    );
  }, [codexClasses.data, target, addingClass, addNewClass]);

  const nextClasses = useMemo(
    () => previewClasses(character, classIndex, addNewClass),
    [character, classIndex, addNewClass],
  );

  const showSpellsStep = useMemo(
    () =>
      isSpellcastingClasses(character.classes) ||
      isSpellcastingClasses(nextClasses),
    [character.classes, nextClasses],
  );

  const stepLabels = useMemo(() => {
    const steps = ["Class", "Hit Points", "Features"];
    if (showSpellsStep) steps.push("Spells & Magic");
    steps.push("Review");
    return steps;
  }, [showSpellsStep]);

  const reviewStepIndex = stepLabels.length - 1;
  const featuresStepIndex = 2;

  if (!addingClass && !target) return null;

  const atClassCap = !addingClass && target!.level >= MAX_LEVEL;
  const atTotalCap = totalLevel(character.classes) >= MAX_LEVEL;
  const newClassLevel = addingClass ? 1 : target!.level + 1;
  const newTotalLevel = totalLevel(character.classes) + 1;
  const className = addingClass ? addNewClass! : target!.class;

  const profBefore = proficiencyBonusForLevel(totalLevel(character.classes));
  const profAfter = proficiencyBonusForLevel(newTotalLevel);

  const hpGain =
    hitDie == null
      ? null
      : addingClass
        ? hitDie + conMod
        : hpMethod === "roll"
          ? hpRollFromSeed(
              hitDie,
              conMod,
              levelUpSeed(character.id, newTotalLevel),
            )
          : hpGainOnLevelUp(hitDie, conMod, { mode: "average" });

  const featureStubs = addingClass
    ? featureStubsForLevel(className, 1)
    : featureStubsForLevel(className, newClassLevel);
  const levelFeatures = addingClass
    ? classFeaturesForLevel(className, 1)
    : classFeaturesForLevel(className, newClassLevel);
  const grantsAsi = !addingClass && grantsAsiAtLevel(className, newClassLevel);
  const needsSubclass = subclassPickLevel(className) === newClassLevel;
  const needsFightingStyle =
    fightingStylePickLevel(className) === newClassLevel;
  const needsRangerChoices =
    className === "Ranger" &&
    newClassLevel >= 1 &&
    !rangerFeatureChoicesComplete(existingMeta.featureChoices ?? {});

  const blocked = atClassCap || atTotalCap || hitDie == null;
  const asiInvalid = grantsAsi && !asiFeatComplete(asiFeat);
  const subclassInvalid = needsSubclass && !subclass.trim();
  const fightingStyleInvalid =
    needsFightingStyle && !fightingStyle.trim() && !existingMeta.fightingStyles?.[className];
  const rangerChoicesInvalid =
    needsRangerChoices && !rangerFeatureChoicesComplete(featureChoices);

  const multiclassClassNames = useMemo(() => {
    if (!addingClass || !addNewClass) {
      return character.classes.map((c) => c.class);
    }
    return [...character.classes.map((c) => c.class), addNewClass];
  }, [addingClass, addNewClass, character.classes]);

  const multiclassValid = multiclassEligible(
    multiclassClassNames,
    character.abilityScores,
  );
  const multiclassWarning = addingClass
    ? multiclassIneligibilityReason(
        multiclassClassNames,
        character.abilityScores,
      )
    : null;
  const classStepInvalid =
    addingClass && (!addNewClass || !multiclassValid);

  const existingSpells = character.spells?.spells ?? [];
  const spellbookSpells = useMemo(
    () => [...existingSpells, ...addedSpells],
    [existingSpells, addedSpells],
  );
  const showSpellPicker = isSpellcastingClasses(nextClasses);

  const canMulticlass =
    character.classes[0] != null &&
    character.classes[0].level >= 2 &&
    totalLevel(character.classes) < MAX_LEVEL;

  const availableNewClasses = (codexClasses.data ?? []).filter(
    (c) => !character.classes.some((cl) => cl.class === c.name),
  );

  const slotsBefore = formatSlotTable(character.classes);
  const slotsAfter = formatSlotTable(nextClasses);
  const casterLevelBefore = multiclassCasterLevel(character.classes);
  const casterLevelAfter = multiclassCasterLevel(nextClasses);
  const warlockBefore = warlockLevelFromClasses(character.classes);
  const warlockAfter = warlockLevelFromClasses(nextClasses);
  const pactAfter =
    warlockAfter > 0 ? warlockPactMagic(warlockAfter) : null;
  const extraAttacksBefore = extraAttackCount(character.classes);
  const extraAttacksAfter = extraAttackCount(nextClasses);

  if (celebrating) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Level up complete"
      >
        <div className="rounded-xl border border-lore-accent bg-lore-bg px-10 py-8 text-center shadow-2xl">
          <div className="text-3xl">⬆</div>
          <h2 className="mt-3 font-display text-2xl">
            {character.name} reached level {newTotalLevel}!
          </h2>
          {hpGain != null && (
            <p className="mt-2 text-sm text-lore-muted">+{hpGain} max HP</p>
          )}
        </div>
      </div>
    );
  }

  const currentStepLabel = stepLabels[wizardStep] ?? "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Level up"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-lore-border bg-lore-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid md:grid-cols-[220px_1fr]">
          <aside className="hidden border-r border-lore-border bg-lore-surface p-5 md:block">
            <div className="text-xs uppercase tracking-widest text-lore-muted">
              Character
            </div>
            <h3 className="mt-1 font-display text-lg">{character.name}</h3>
            <p className="mt-2 text-sm text-lore-muted">
              {character.classes.map((c) => `${c.class} ${c.level}`).join(" / ")}
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-lore-muted">Total level</dt>
                <dd>{totalLevel(character.classes)} → {newTotalLevel}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-lore-muted">Proficiency</dt>
                <dd>
                  {profBefore === profAfter
                    ? signed(profAfter)
                    : `${signed(profBefore)} → ${signed(profAfter)}`}
                </dd>
              </div>
              {hpGain != null && (
                <div className="flex justify-between">
                  <dt className="text-lore-muted">HP gain</dt>
                  <dd>+{hpGain}</dd>
                </div>
              )}
            </dl>
            <p className="mt-6 text-[10px] text-lore-muted">
              Draft auto-saves locally. Cancel to resume later.
            </p>
          </aside>

          <div className="p-6">
        <header className="flex items-start justify-between gap-4 border-b border-lore-border pb-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-lore-muted">
              Level Up · Step {wizardStep + 1} of {stepLabels.length}
            </div>
            <h2 className="mt-1 font-display text-2xl">
              {addingClass
                ? `Multiclass: ${addNewClass} 1`
                : `${target!.class} → Level ${newClassLevel}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded px-2 py-1 text-lore-muted hover:text-lore-text"
          >
            ✕
          </button>
        </header>

        <ol className="mt-4 flex flex-wrap gap-2">
          {stepLabels.map((label, i) => (
            <li
              key={label}
              className={`rounded-full border px-2.5 py-0.5 text-xs ${
                i === wizardStep
                  ? "border-lore-accent bg-lore-accent-dim text-lore-text"
                  : i < wizardStep
                    ? "border-lore-border text-lore-muted"
                    : "border-lore-border text-lore-muted/60"
              }`}
            >
              {label}
            </li>
          ))}
        </ol>

        {atClassCap || atTotalCap ? (
          <p className="mt-6 rounded border border-lore-border bg-lore-surface px-3 py-4 text-sm text-lore-muted">
            {atClassCap
              ? `${target!.class} is already at the level ${MAX_LEVEL} cap.`
              : `This character is already at the level ${MAX_LEVEL} cap.`}
          </p>
        ) : (
          <>
            {currentStepLabel === "Class" && (
              <>
                {addingClass ? (
                  <section className="mt-6 rounded-lg border border-lore-accent/40 bg-lore-accent-dim/20 p-4">
                    <h3 className="text-sm font-medium">
                      Multiclass: {addNewClass} 1
                    </h3>
                    <p className="mt-1 text-xs text-lore-muted">
                      Requires {multiclassRequirementLabel(addNewClass!)} and
                      prerequisites for your existing classes.
                    </p>
                    {multiclassWarning && (
                      <p
                        role="alert"
                        className="mt-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400"
                      >
                        {multiclassWarning}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setAddNewClass(null)}
                      className="mt-3 rounded border border-lore-border px-3 py-1.5 text-xs text-lore-muted hover:text-lore-text"
                    >
                      Cancel multiclass — advance existing class instead
                    </button>
                  </section>
                ) : (
                  <>
                    {character.classes.length > 1 && (
                      <section className="mt-6">
                        <h3 className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
                          Advance which class?
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {character.classes.map((c, i) => (
                            <button
                              key={`${c.class}-${i}`}
                              type="button"
                              onClick={() => {
                                setClassIndex(i);
                                setAddNewClass(null);
                              }}
                              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                i === classIndex
                                  ? "border-lore-accent bg-lore-accent-dim text-lore-text"
                                  : "border-lore-border text-lore-muted hover:text-lore-text"
                              }`}
                            >
                              {c.class} {c.level}
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                    {canMulticlass && (
                      <section className="mt-4">
                        <h3 className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
                          Or multiclass into…
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {availableNewClasses.slice(0, 12).map((c) => {
                            const previewNames = [
                              ...character.classes.map((cl) => cl.class),
                              c.name,
                            ];
                            const eligible = multiclassEligible(
                              previewNames,
                              character.abilityScores,
                            );
                            return (
                              <button
                                key={c.slug}
                                type="button"
                                onClick={() => setAddNewClass(c.name)}
                                title={multiclassRequirementLabel(c.name)}
                                className={`rounded-full border px-3 py-1.5 text-xs ${
                                  eligible
                                    ? "border-lore-border text-lore-muted hover:border-lore-accent"
                                    : "border-lore-border/60 text-lore-muted/50"
                                }`}
                              >
                                {c.name}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    )}
                  </>
                )}

                <section className="mt-6 rounded-lg border border-lore-border bg-lore-surface p-4">
                  <h3 className="mb-3 text-xs uppercase tracking-wide text-lore-muted">
                    Progression preview
                  </h3>
                  <dl className="space-y-1.5 text-sm">
                    <PreviewRow
                      label="Total level"
                      value={`${totalLevel(character.classes)} → ${newTotalLevel}`}
                    />
                    <PreviewRow
                      label="Class line"
                      value={
                        addingClass
                          ? `${character.classes.map((c) => `${c.class} ${c.level}`).join(" / ")} / ${addNewClass} 1`
                          : `${target!.class} ${target!.level} → ${newClassLevel}`
                      }
                    />
                    <PreviewRow
                      label="Proficiency bonus"
                      value={
                        profBefore === profAfter
                          ? signed(profAfter)
                          : `${signed(profBefore)} → ${signed(profAfter)}`
                      }
                    />
                    {extraAttacksAfter > extraAttacksBefore && (
                      <PreviewRow
                        label="Extra Attack"
                        value={`${extraAttacksBefore} → ${extraAttacksAfter} per Attack action`}
                      />
                    )}
                  </dl>
                </section>
              </>
            )}

            {currentStepLabel === "Hit Points" && (
              <section className="mt-6">
                <h3 className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
                  Hit Points
                </h3>
                {addingClass ? (
                  <p className="text-sm text-lore-muted">
                    First level in a new class: {hitDie ?? "—"} + CON (
                    {signed(conMod)}) = {hpGain ?? "—"} HP
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {(["average", "roll"] as HpMethod[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setHpMethod(m)}
                        className={`rounded-lg border px-3 py-3 text-left transition-colors ${
                          hpMethod === m
                            ? "border-lore-accent bg-lore-accent-dim"
                            : "border-lore-border bg-lore-surface hover:border-lore-accent"
                        }`}
                      >
                        <div className="text-sm font-medium">
                          {m === "average" ? "Take average" : "Roll hit die"}
                        </div>
                        <div className="mt-0.5 text-xs text-lore-muted">
                          {hitDie == null
                            ? "—"
                            : m === "average"
                              ? `${Math.floor(hitDie / 2) + 1} + ${signed(conMod)} CON`
                              : `1d${hitDie} + ${signed(conMod)} CON`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <section className="mt-6 rounded-lg border border-lore-border bg-lore-surface p-4">
                  <dl className="space-y-1.5 text-sm">
                    <PreviewRow
                      label="HP gain"
                      value={hpGain == null ? "—" : `+${hpGain}`}
                    />
                    <PreviewRow
                      label="Max HP"
                      value={
                        hpGain == null
                          ? String(character.maxHp)
                          : `${character.maxHp} → ${character.maxHp + hpGain}`
                      }
                    />
                    {milestoneXp && (
                      <PreviewRow label="XP mode" value="Milestone (auto-sync)" />
                    )}
                  </dl>
                </section>
              </section>
            )}

            {currentStepLabel === "Features" && (
              <section className="mt-6">
                <h3 className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
                  New at {className} {newClassLevel}
                </h3>
                {levelFeatures.length > 0 ? (
                  <ul className="space-y-2">
                    {levelFeatures.map((f) => (
                      <li
                        key={f.id}
                        className="rounded border border-lore-border px-3 py-2 text-sm"
                      >
                        <div className="font-medium">{f.name}</div>
                        <p className="mt-1 text-xs text-lore-muted">
                          {f.description}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-lore-muted">
                    {featureStubs.length > 0
                      ? featureStubs.join(" · ")
                      : "No new class features at this level."}
                  </p>
                )}

                {needsSubclass && (
                  <SubclassPicker
                    className={className}
                    level={newClassLevel}
                    value={subclass}
                    onChange={setSubclass}
                  />
                )}

                {needsFightingStyle && (
                  <FightingStylePicker
                    className={className}
                    level={newClassLevel}
                    value={
                      fightingStyle ||
                      existingMeta.fightingStyles?.[className] ||
                      ""
                    }
                    onChange={setFightingStyle}
                  />
                )}

                {needsRangerChoices && (
                  <RangerFeatureChoices
                    choices={featureChoices}
                    onChange={setFeatureChoices}
                  />
                )}

                {grantsAsi && (
                  <div className="mt-6">
                    <AsiFeatChoice
                      scores={character.abilityScores}
                      value={asiFeat}
                      featEligibility={{
                        characterLevel: newTotalLevel,
                        abilityScores: character.abilityScores,
                      }}
                      onChange={setAsiFeat}
                    />
                  </div>
                )}
              </section>
            )}

            {currentStepLabel === "Spells & Magic" && (
              <section className="mt-6 space-y-4">
                {showSpellPicker && (
                  <div className="rounded-lg border border-lore-border bg-lore-surface p-4">
                    <h3 className="text-xs uppercase tracking-wide text-lore-muted">
                      Spells
                    </h3>
                    <p className="mt-1 text-xs text-lore-muted">
                      Add spells known or prepared for your updated caster
                      levels. You can edit more on the Spells tab after
                      level-up.
                    </p>
                    {spellbookSpells.length > 0 && (
                      <ul className="mt-3 space-y-1 text-sm">
                        {spellbookSpells.map((s) => (
                          <li key={spellKey(s)}>
                            {s.name}
                            {s.level > 0 ? ` (level ${s.level})` : " (cantrip)"}
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      onClick={() => setSpellPickerOpen(true)}
                      className="mt-3 rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm"
                    >
                      {addedSpells.length > 0 || existingSpells.length > 0
                        ? "Add more spells…"
                        : "Choose spells…"}
                    </button>
                  </div>
                )}

                <p className="text-sm text-lore-muted">
                  Slot maxima follow SRD multiclass pooling
                  {hasThirdCasterSlots(nextClasses)
                    ? " + third-caster archetype slots"
                    : ""}
                  .
                </p>

                {casterLevelAfter > 0 && (
                  <div className="rounded-lg border border-lore-border bg-lore-surface p-4 text-sm">
                    <h3 className="text-xs uppercase tracking-wide text-lore-muted">
                      Pooled caster level
                    </h3>
                    <p className="mt-1">
                      {casterLevelBefore === casterLevelAfter
                        ? casterLevelAfter
                        : `${casterLevelBefore} → ${casterLevelAfter}`}
                    </p>
                  </div>
                )}

                {slotsAfter.length > 0 && (
                  <div className="rounded-lg border border-lore-border bg-lore-surface p-4">
                    <h3 className="text-xs uppercase tracking-wide text-lore-muted">
                      Spell slots
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm">
                      {slotsAfter.map((row) => {
                        const before = slotsBefore.find(
                          (s) => s.level === row.level,
                        );
                        return (
                          <li key={row.level} className="flex justify-between">
                            <span>Level {row.level}</span>
                            <span className="font-mono tabular-nums">
                              {before && before.max !== row.max
                                ? `${before.max} → ${row.max}`
                                : row.max}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {pactAfter && (
                  <div className="rounded-lg border border-lore-border bg-lore-surface p-4 text-sm">
                    <h3 className="text-xs uppercase tracking-wide text-lore-muted">
                      Pact Magic
                    </h3>
                    <p className="mt-1">
                      {warlockBefore !== warlockAfter && warlockBefore > 0
                        ? `${warlockBefore} → ${warlockAfter} Warlock levels · `
                        : ""}
                      {pactAfter.max} slot{pactAfter.max === 1 ? "" : "s"} at
                      spell level {pactAfter.slotLevel}
                    </p>
                  </div>
                )}

                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={applySpellSlots}
                    onChange={(e) => setApplySpellSlots(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Apply suggested slot maxima on level-up (keeps used counts
                    capped to new max)
                  </span>
                </label>
              </section>
            )}

            {currentStepLabel === "Review" && (
              <section className="mt-6 rounded-lg border border-lore-border bg-lore-surface p-4">
                <h3 className="mb-3 text-xs uppercase tracking-wide text-lore-muted">
                  Before → After
                </h3>
                <dl className="space-y-1.5 text-sm">
                  <PreviewRow label="Character" value={character.name} />
                  <PreviewRow
                    label="Advance"
                    value={
                      addingClass
                        ? `New class: ${addNewClass} 1`
                        : `${target!.class} ${target!.level} → ${newClassLevel}`
                    }
                  />
                  <PreviewRow
                    label="Total level"
                    value={`${totalLevel(character.classes)} → ${newTotalLevel}`}
                  />
                  <PreviewRow
                    label="HP"
                    value={
                      hpGain == null
                        ? "—"
                        : `${character.maxHp} → ${character.maxHp + hpGain} (+${hpGain})`
                    }
                  />
                  {!addingClass && (
                    <PreviewRow label="HP method" value={hpMethod} />
                  )}
                  {subclass && (
                    <PreviewRow label="Subclass" value={subclass} />
                  )}
                  {(fightingStyle ||
                    existingMeta.fightingStyles?.[className]) && (
                    <PreviewRow
                      label="Fighting style"
                      value={
                        fightingStyle ||
                        existingMeta.fightingStyles?.[className] ||
                        ""
                      }
                    />
                  )}
                  {asiFeat?.kind === "feat" && (
                    <PreviewRow label="Feat" value={asiFeat.featName} />
                  )}
                  {asiFeat?.kind === "asi" && (
                    <PreviewRow
                      label="ASI"
                      value={
                        asiFeat.asi.mode === "increase"
                          ? `${asiFeat.asi.ability.toUpperCase()} +2`
                          : `${asiFeat.asi.first.toUpperCase()} +1, ${asiFeat.asi.second.toUpperCase()} +1`
                      }
                    />
                  )}
                  {addedSpells.length > 0 && (
                    <PreviewRow
                      label="New spells"
                      value={addedSpells.map((s) => s.name).join(", ")}
                    />
                  )}
                  {extraAttacksAfter > 1 && (
                    <PreviewRow
                      label="Attacks / action"
                      value={String(extraAttacksAfter)}
                    />
                  )}
                  {showSpellsStep && applySpellSlots && (
                    <PreviewRow label="Spell slots" value="Apply SRD maxima" />
                  )}
                </dl>
              </section>
            )}
          </>
        )}

        {levelUp.error && (
          <p
            role="alert"
            className="mt-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400"
          >
            {levelUp.error.message}
          </p>
        )}

        <footer className="mt-6 flex items-center justify-between gap-3 border-t border-lore-border pt-4">
          <button
            type="button"
            onClick={() =>
              wizardStep > 0 ? setWizardStep((s) => s - 1) : onClose()
            }
            className="rounded border border-lore-border px-4 py-2 text-sm text-lore-muted transition-colors hover:text-lore-text"
          >
            {wizardStep > 0 ? "Back" : "Cancel"}
          </button>

          {!blocked && wizardStep < reviewStepIndex ? (
            <button
              type="button"
              onClick={() => setWizardStep((s) => s + 1)}
              disabled={
                (wizardStep === 0 && classStepInvalid) ||
                (wizardStep === featuresStepIndex && asiInvalid) ||
                (wizardStep === featuresStepIndex && subclassInvalid) ||
                (wizardStep === featuresStepIndex && fightingStyleInvalid) ||
                (wizardStep === featuresStepIndex && rangerChoicesInvalid)
              }
              className="rounded border border-lore-accent bg-lore-accent-dim px-5 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                levelUp.mutate({
                  id: character.id,
                  classIndex,
                  hpMethod,
                  addNewClass: addingClass ? addNewClass! : undefined,
                  asi: asiFeat?.kind === "asi" ? asiFeat.asi : undefined,
                  feat: asiFeat?.kind === "feat" ? asiFeat.featName : undefined,
                  subclass: subclass.trim() || undefined,
                  fightingStyle:
                    fightingStyle.trim() ||
                    existingMeta.fightingStyles?.[className] ||
                    undefined,
                  featureChoices: needsRangerChoices ? featureChoices : undefined,
                  addedSpells:
                    addedSpells.length > 0 ? addedSpells : undefined,
                  milestone: milestoneXp,
                  applySpellSlots: showSpellsStep && applySpellSlots,
                })
              }
              disabled={
                blocked ||
                levelUp.isPending ||
                wizardStep < reviewStepIndex ||
                classStepInvalid ||
                asiInvalid ||
                subclassInvalid ||
                fightingStyleInvalid ||
                rangerChoicesInvalid ||
                (addingClass && !addNewClass)
              }
              className="rounded border border-lore-accent bg-lore-accent-dim px-5 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              {levelUp.isPending
                ? "Leveling up…"
                : `Level up to ${newTotalLevel}`}
            </button>
          )}
        </footer>
        {spellPickerOpen && (
          <CodexSpellAddPicker
            existing={spellbookSpells}
            characterClasses={nextClasses}
            onAdd={(spell) => {
              setAddedSpells((prev) => {
                if (prev.some((s) => spellKey(s) === spellKey(spell))) {
                  return prev;
                }
                return [...prev, spell];
              });
            }}
            onClose={() => setSpellPickerOpen(false)}
          />
        )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-lore-muted">{label}</dt>
      <dd className="text-right font-mono text-sm tabular-nums">{value}</dd>
    </div>
  );
}
