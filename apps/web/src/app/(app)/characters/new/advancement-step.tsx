"use client";

import { useState } from "react";

import {
  ABILITIES,
  abilityModifier,
  classFeaturesForLevel,
  grantsAsiAtLevel,
  type Ability,
  type AbilityScores,
  type AsiChoice,
  type HpMethod,
  type LevelAdvanceChoice,
} from "@app/engine";

const ABILITY_LABELS: Record<Ability, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

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
  const features = classFeaturesForLevel(className, currentLevel);

  const [asiMode, setAsiMode] = useState<"increase" | "split">("increase");
  const [asiAbility, setAsiAbility] = useState<Ability>("str");
  const [asiFirst, setAsiFirst] = useState<Ability>("str");
  const [asiSecond, setAsiSecond] = useState<Ability>("dex");

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

  function asiChoice(): AsiChoice | undefined {
    if (!needsAsi) return undefined;
    return asiMode === "increase"
      ? { mode: "increase", ability: asiAbility, amount: 2 }
      : { mode: "split", first: asiFirst, second: asiSecond };
  }

  const asiInvalid =
    needsAsi && asiMode === "split" && asiFirst === asiSecond;

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

      {needsAsi && (
        <div className="mt-6 rounded-lg border border-lore-accent/40 bg-lore-accent-dim/30 p-4">
          <h3 className="text-xs uppercase tracking-wide text-lore-muted">
            Ability Score Improvement
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["increase", "split"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAsiMode(m)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  asiMode === m
                    ? "border-lore-accent bg-lore-accent-dim"
                    : "border-lore-border"
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
                  {ABILITY_LABELS[a]}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-lore-muted">
              Pick two abilities in the confirm step (split ASI UI simplified — use +2 for now).
            </p>
          )}
          {asiInvalid && (
            <p className="mt-2 text-xs text-red-400">Choose two different abilities.</p>
          )}
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
          disabled={asiInvalid}
          onClick={() => {
            patchAdvance({
              hpMethod,
              asi: asiChoice(),
            });
            if (index < levels.length - 1) setIndex((i) => i + 1);
          }}
          className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm disabled:opacity-40"
        >
          {index < levels.length - 1
            ? `Save & level ${levels[index + 1]}`
            : "Finish advancement"}
        </button>
      </div>

      <p className="mt-4 text-xs text-lore-muted">
        Subclass (level 3), fighting style, and spell picks per level remain on
        your sheet after creation.
      </p>
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
    if (grantsAsiAtLevel(className, l) && !row.asi) return false;
  }
  return true;
}
