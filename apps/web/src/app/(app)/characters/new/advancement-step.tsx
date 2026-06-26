"use client";

import { useMemo, useState } from "react";

import {
  abilityModifier,
  classFeaturesForLevel,
  grantsAsiAtLevel,
  subclassPickLevel,
  type AbilityScores,
  type HpMethod,
  type LevelAdvanceChoice,
} from "@app/engine";

import {
  AsiFeatChoice,
  asiFeatComplete,
  type AsiFeatSelection,
} from "@/components/character-creation/asi-feat-choice";
import { SubclassPicker } from "@/components/character-creation/class-choice-pickers";

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function AdvancementStep({
  className,
  hitDie,
  startingLevel,
  abilityScores,
  advances,
  onChange,
}: {
  className: string;
  hitDie: number;
  startingLevel: number;
  abilityScores: AbilityScores;
  advances: LevelAdvanceChoice[];
  onChange: (advances: LevelAdvanceChoice[]) => void;
}) {
  const levels = Array.from({ length: startingLevel - 1 }, (_, i) => i + 2);
  const [index, setIndex] = useState(0);
  const currentLevel = levels[index] ?? 2;
  const current = advances.find((a) => a.level === currentLevel);
  const hpMethod: HpMethod = current?.hpMethod ?? "average";
  const conMod = abilityModifier(abilityScores.con);
  const needsAsi = grantsAsiAtLevel(className, currentLevel);
  const needsSubclass =
    subclassPickLevel(className) === currentLevel;
  const features = classFeaturesForLevel(className, currentLevel);

  const asiFeatValue: AsiFeatSelection | null = useMemo(() => {
    if (current?.feat) return { kind: "feat", featName: current.feat };
    if (current?.asi) return { kind: "asi", asi: current.asi };
    return null;
  }, [current]);

  function patchAdvance(patch: Partial<LevelAdvanceChoice>) {
    const next = [...advances.filter((a) => a.level !== currentLevel)];
    next.push({
      level: currentLevel,
      hpMethod,
      ...current,
      ...patch,
    });
    next.sort((a, b) => a.level - b.level);
    onChange(next);
  }

  const asiFeatInvalid = needsAsi && !asiFeatComplete(asiFeatValue);
  const subclassInvalid =
    needsSubclass && !(current?.subclass?.trim().length ?? 0);

  const hpPreview =
    hpMethod === "average"
      ? Math.floor(hitDie / 2) + 1 + conMod
      : `1d${hitDie} ${signed(conMod)}`;

  return (
    <section>
      <h2 className="font-display text-2xl">
        Advance to Level {currentLevel}
      </h2>
      <p className="mt-1 text-sm text-lore-muted">
        Level {index + 1} of {levels.length} · {className} {currentLevel}
      </p>

      <div className="mt-6">
        <h3 className="text-xs uppercase tracking-wide text-lore-muted">
          Hit Points
        </h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["average", "roll"] as HpMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => patchAdvance({ hpMethod: m })}
              className={`rounded-lg border px-3 py-3 text-left text-sm ${
                hpMethod === m
                  ? "border-lore-accent bg-lore-accent-dim"
                  : "border-lore-border"
              }`}
            >
              {m === "average" ? "Take average" : "Roll hit die"}
              <div className="mt-0.5 text-xs text-lore-muted">
                {m === "average" ? `+${hpPreview}` : `+1d${hitDie} ${signed(conMod)}`}
              </div>
            </button>
          ))}
        </div>
      </div>

      {features.length > 0 && (
        <ul className="mt-6 space-y-2">
          {features.map((f) => (
            <li
              key={f.id}
              className="rounded border border-lore-border px-3 py-2 text-sm"
            >
              <div className="font-medium">{f.name}</div>
              <p className="text-xs text-lore-muted">{f.description}</p>
            </li>
          ))}
        </ul>
      )}

      {needsSubclass && (
        <SubclassPicker
          className={className}
          level={currentLevel}
          value={current?.subclass ?? ""}
          onChange={(subclass) => patchAdvance({ subclass })}
        />
      )}

      {needsAsi && (
        <div className="mt-6">
          <AsiFeatChoice
            scores={abilityScores}
            value={asiFeatValue}
            onChange={(sel) => {
              if (sel.kind === "feat") {
                patchAdvance({ feat: sel.featName, asi: undefined });
              } else {
                patchAdvance({ asi: sel.asi, feat: undefined });
              }
            }}
          />
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
          className="rounded border border-lore-border px-4 py-2 text-sm disabled:opacity-40"
        >
          Previous level
        </button>
        <button
          type="button"
          disabled={asiFeatInvalid || subclassInvalid}
          onClick={() => {
            if (index < levels.length - 1) setIndex((i) => i + 1);
          }}
          className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm disabled:opacity-40"
        >
          {index < levels.length - 1
            ? `Save & level ${levels[index + 1]}`
            : "Finish advancement"}
        </button>
      </div>
    </section>
  );
}

export function advancementComplete(
  className: string,
  startingLevel: number,
  advances: LevelAdvanceChoice[],
): boolean {
  if (startingLevel <= 1) return true;
  for (let l = 2; l <= startingLevel; l += 1) {
    const row = advances.find((a) => a.level === l);
    if (!row) return false;
    if (grantsAsiAtLevel(className, l)) {
      const hasAsi = Boolean(row.asi);
      const hasFeat = Boolean(row.feat?.trim());
      if (!hasAsi && !hasFeat) return false;
    }
    if (subclassPickLevel(className) === l && !row.subclass?.trim()) {
      return false;
    }
  }
  return true;
}
