"use client";

import { useEffect, useMemo, useState } from "react";

import {
  abilityModifier,
  ABILITIES,
  classFeaturesForLevel,
  featureStubsForLevel,
  grantsAsiAtLevel,
  hpGainOnLevelUp,
  hpRollFromSeed,
  levelUpSeed,
  proficiencyBonusForLevel,
  totalLevel,
  type Ability,
  type AbilityScores,
  type AsiChoice,
  type ClassLevel,
  type HpMethod,
} from "@app/engine";

import { trpc } from "@/lib/trpc/client";

const MAX_LEVEL = 20;
const WIZARD_STEPS = ["Hit Points", "New Features", "Confirm"] as const;

const ABILITY_LABELS: Record<Ability, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

type Character = {
  id: string;
  name: string;
  classes: ClassLevel[];
  abilityScores: AbilityScores;
  maxHp: number;
};

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function LevelUpDialog({
  character,
  onClose,
}: {
  character: Character;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const codexClasses = trpc.codex.listClasses.useQuery();

  const [wizardStep, setWizardStep] = useState(0);
  const [classIndex, setClassIndex] = useState(0);
  const [hpMethod, setHpMethod] = useState<HpMethod>("average");
  const [celebrating, setCelebrating] = useState(false);
  const [asiMode, setAsiMode] = useState<"increase" | "split">("increase");
  const [asiAbility, setAsiAbility] = useState<Ability>("str");
  const [asiFirst, setAsiFirst] = useState<Ability>("str");
  const [asiSecond, setAsiSecond] = useState<Ability>("dex");

  const levelUp = trpc.characters.levelUp.useMutation({
    onSuccess: async () => {
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
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !celebrating) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, celebrating]);

  const target = character.classes[classIndex];
  const conMod = abilityModifier(character.abilityScores.con);

  const hitDie = useMemo(() => {
    if (!target) return null;
    return (
      codexClasses.data?.find((c) => c.name === target.class)?.hitDie ?? null
    );
  }, [codexClasses.data, target]);

  if (!target) return null;

  const atClassCap = target.level >= MAX_LEVEL;
  const atTotalCap = totalLevel(character.classes) >= MAX_LEVEL;
  const newClassLevel = target.level + 1;
  const newTotalLevel = totalLevel(character.classes) + 1;

  const profBefore = proficiencyBonusForLevel(totalLevel(character.classes));
  const profAfter = proficiencyBonusForLevel(newTotalLevel);

  const hpGain =
    hitDie == null
      ? null
      : hpMethod === "roll"
        ? hpRollFromSeed(
            hitDie,
            conMod,
            levelUpSeed(character.id, newTotalLevel),
          )
        : hpGainOnLevelUp(hitDie, conMod, { mode: "average" });

  const featureStubs = featureStubsForLevel(target.class, newClassLevel);
  const levelFeatures = classFeaturesForLevel(target.class, newClassLevel);
  const grantsAsi = grantsAsiAtLevel(target.class, newClassLevel);
  const asiChoice: AsiChoice | undefined = grantsAsi
    ? asiMode === "increase"
      ? { mode: "increase", ability: asiAbility, amount: 2 }
      : { mode: "split", first: asiFirst, second: asiSecond }
    : undefined;
  const blocked = atClassCap || atTotalCap || hitDie == null;
  const asiInvalid =
    grantsAsi &&
    asiChoice != null &&
    asiChoice.mode === "split" &&
    asiChoice.first === asiChoice.second;

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Level up"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-lore-border bg-lore-bg p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-lore-border pb-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-lore-muted">
              Level Up · Step {wizardStep + 1} of {WIZARD_STEPS.length}
            </div>
            <h2 className="mt-1 font-display text-2xl">
              {target.class} → Level {newClassLevel}
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
          {WIZARD_STEPS.map((label, i) => (
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
              ? `${target.class} is already at the level ${MAX_LEVEL} cap.`
              : `This character is already at the level ${MAX_LEVEL} cap.`}
          </p>
        ) : (
          <>
            {wizardStep === 0 && (
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
                          onClick={() => setClassIndex(i)}
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

                <section className="mt-6">
                  <h3 className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
                    Hit Points
                  </h3>
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
                  {hitDie == null && (
                    <p className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                      Can&apos;t find an SRD hit die for &ldquo;{target.class}
                      &rdquo;. Level-up needs a class from the Codex.
                    </p>
                  )}
                </section>

                <section className="mt-6 rounded-lg border border-lore-border bg-lore-surface p-4">
                  <h3 className="mb-3 text-xs uppercase tracking-wide text-lore-muted">
                    Preview
                  </h3>
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
                    <PreviewRow
                      label="Proficiency bonus"
                      value={
                        profBefore === profAfter
                          ? signed(profAfter)
                          : `${signed(profBefore)} → ${signed(profAfter)}`
                      }
                    />
                  </dl>
                </section>
              </>
            )}

            {wizardStep === 1 && (
              <section className="mt-6">
                <h3 className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
                  New at {target.class} {newClassLevel}
                </h3>
                {levelFeatures.length > 0 ? (
                  <ul className="space-y-2">
                    {levelFeatures.map((f) => (
                      <li
                        key={f.id}
                        className="rounded border border-lore-border px-3 py-2 text-sm"
                      >
                        <div className="font-medium">{f.name}</div>
                        <p className="mt-1 text-xs text-lore-muted">{f.description}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-lore-muted">
                    No new class features at this level.
                  </p>
                )}

                {grantsAsi && (
                  <div className="mt-6 rounded-lg border border-lore-accent/40 bg-lore-accent-dim/30 p-4">
                    <h4 className="text-xs uppercase tracking-wide text-lore-muted">
                      Ability Score Improvement
                    </h4>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(["increase", "split"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setAsiMode(m)}
                          className={`rounded-full border px-3 py-1 text-xs ${
                            asiMode === m
                              ? "border-lore-accent bg-lore-accent-dim"
                              : "border-lore-border text-lore-muted"
                          }`}
                        >
                          {m === "increase" ? "+2 to one" : "+1 to two"}
                        </button>
                      ))}
                    </div>
                    {asiMode === "increase" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {ABILITIES.map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => setAsiAbility(a)}
                            className={`rounded border px-2 py-1 text-xs font-mono ${
                              asiAbility === a
                                ? "border-lore-accent bg-lore-accent-dim"
                                : "border-lore-border"
                            }`}
                          >
                            {ABILITY_LABELS[a]}{" "}
                            {character.abilityScores[a]}
                            →{character.abilityScores[a] + 2}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <AsiPickRow
                          label="First +1"
                          value={asiFirst}
                          scores={character.abilityScores}
                          onChange={setAsiFirst}
                        />
                        <AsiPickRow
                          label="Second +1"
                          value={asiSecond}
                          scores={character.abilityScores}
                          onChange={setAsiSecond}
                        />
                        {asiInvalid && (
                          <p className="text-xs text-red-400">
                            Choose two different abilities.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {featureStubs.length === 0 && !grantsAsi && (
                  <p className="mt-4 text-xs text-lore-muted">
                    Spell updates happen on the Spells tab after level-up.
                  </p>
                )}
              </section>
            )}

            {wizardStep === 2 && (
              <section className="mt-6 rounded-lg border border-lore-border bg-lore-surface p-4">
                <h3 className="mb-3 text-xs uppercase tracking-wide text-lore-muted">
                  Confirm level up
                </h3>
                <dl className="space-y-1.5 text-sm">
                  <PreviewRow label="Character" value={character.name} />
                  <PreviewRow
                    label="Class advance"
                    value={`${target.class} ${target.level} → ${newClassLevel}`}
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
                  <PreviewRow label="HP method" value={hpMethod} />
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

          {!blocked && wizardStep < WIZARD_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setWizardStep((s) => s + 1)}
              disabled={wizardStep === 1 && asiInvalid}
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
                  asi: asiChoice,
                })
              }
              disabled={
                blocked ||
                levelUp.isPending ||
                wizardStep < 2 ||
                (grantsAsi && asiInvalid)
              }
              className="rounded border border-lore-accent bg-lore-accent-dim px-5 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              {levelUp.isPending
                ? "Leveling up…"
                : `Level up to ${newClassLevel}`}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-lore-muted">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}

function AsiPickRow({
  label,
  value,
  scores,
  onChange,
}: {
  label: string;
  value: Ability;
  scores: AbilityScores;
  onChange: (a: Ability) => void;
}) {
  return (
    <div>
      <span className="text-xs text-lore-muted">{label}</span>
      <div className="mt-1 flex flex-wrap gap-2">
        {ABILITIES.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => onChange(a)}
            className={`rounded border px-2 py-1 text-xs font-mono ${
              value === a
                ? "border-lore-accent bg-lore-accent-dim"
                : "border-lore-border"
            }`}
          >
            {ABILITY_LABELS[a]} {scores[a]}→{scores[a] + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
