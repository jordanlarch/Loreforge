"use client";

import { useEffect, useMemo, useState } from "react";

import {
  abilityModifier,
  featureStubsForLevel,
  hpGainOnLevelUp,
  hpRollFromSeed,
  levelUpSeed,
  proficiencyBonusForLevel,
  totalLevel,
  type AbilityScores,
  type ClassLevel,
  type HpMethod,
} from "@app/engine";

import { trpc } from "@/lib/trpc/client";

const MAX_LEVEL = 20;

type Character = {
  id: string;
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

  const [classIndex, setClassIndex] = useState(0);
  const [hpMethod, setHpMethod] = useState<HpMethod>("average");

  const levelUp = trpc.characters.levelUp.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.characters.get.invalidate({ id: character.id }),
        utils.characters.list.invalidate(),
      ]);
      onClose();
    },
  });

  // Close on Escape for keyboard users.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const target = character.classes[classIndex];
  const conMod = abilityModifier(character.abilityScores.con);

  // Resolve the hit die for a live preview that matches the server result
  // exactly (same engine helper + same deterministic seed). The server still
  // re-resolves and recomputes authoritatively.
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

  const blocked = atClassCap || atTotalCap || hitDie == null;

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
              Level Up
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

        {atClassCap || atTotalCap ? (
          <p className="mt-6 rounded border border-lore-border bg-lore-surface px-3 py-4 text-sm text-lore-muted">
            {atClassCap
              ? `${target.class} is already at the level ${MAX_LEVEL} cap.`
              : `This character is already at the level ${MAX_LEVEL} cap.`}
          </p>
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
                  Can&apos;t find an SRD hit die for &ldquo;{target.class}&rdquo;.
                  Level-up needs a class from the Codex.
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
                <PreviewRow
                  label="Total level"
                  value={`${totalLevel(character.classes)} → ${newTotalLevel}`}
                />
              </dl>
            </section>

            <section className="mt-4">
              <h3 className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
                New at this level
              </h3>
              <ul className="space-y-1.5">
                {featureStubs.map((stub) => (
                  <li
                    key={stub}
                    className="flex items-center justify-between rounded border border-dashed border-lore-border px-3 py-2 text-sm text-lore-muted"
                  >
                    <span>{stub}</span>
                    <span className="text-xs uppercase tracking-wide">
                      Choose later
                    </span>
                  </li>
                ))}
              </ul>
            </section>
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

        <footer className="mt-6 flex items-center justify-end gap-3 border-t border-lore-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-lore-border px-4 py-2 text-sm text-lore-muted transition-colors hover:text-lore-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              levelUp.mutate({ id: character.id, classIndex, hpMethod })
            }
            disabled={blocked || levelUp.isPending}
            className="rounded border border-lore-accent bg-lore-accent-dim px-5 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {levelUp.isPending ? "Leveling up…" : `Level up to ${newClassLevel}`}
          </button>
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
