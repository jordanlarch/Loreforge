"use client";

import { useEffect, useState } from "react";

import {
  ABILITIES,
  type Ability,
  type AbilityScores,
  type BackgroundAsiChoice,
  formatBackgroundAsiLabel,
  isValidBackgroundAsiChoice,
} from "@app/engine";

const ABILITY_LABELS: Record<Ability, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

export function backgroundAsiComplete(
  scores: AbilityScores,
  choice: BackgroundAsiChoice | null,
): boolean {
  return choice != null && isValidBackgroundAsiChoice(scores, choice);
}

function AbilitySelect({
  value,
  onChange,
  label,
  exclude = [],
}: {
  value: Ability;
  onChange: (next: Ability) => void;
  label: string;
  exclude?: Ability[];
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs text-lore-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Ability)}
        className="rounded border border-lore-border bg-lore-bg px-2 py-1.5"
      >
        {ABILITIES.filter((a) => a === value || !exclude.includes(a)).map((a) => (
          <option key={a} value={a}>
            {ABILITY_LABELS[a]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function BackgroundAsiPicker({
  scores,
  backgroundName,
  value,
  onChange,
}: {
  scores: AbilityScores;
  backgroundName: string;
  value: BackgroundAsiChoice | null;
  onChange: (next: BackgroundAsiChoice | null) => void;
}) {
  const [mode, setMode] = useState<"boost" | "triple">(
    value?.mode === "triple" ? "triple" : "boost",
  );
  const [primary, setPrimary] = useState<Ability>(
    value?.mode === "boost" ? value.primary : "str",
  );
  const [secondary, setSecondary] = useState<Ability>(
    value?.mode === "boost" ? value.secondary : "dex",
  );
  const [first, setFirst] = useState<Ability>(
    value?.mode === "triple" ? value.first : "str",
  );
  const [second, setSecond] = useState<Ability>(
    value?.mode === "triple" ? value.second : "dex",
  );
  const [third, setThird] = useState<Ability>(
    value?.mode === "triple" ? value.third : "con",
  );

  const draft: BackgroundAsiChoice =
    mode === "boost"
      ? { mode: "boost", primary, secondary }
      : { mode: "triple", first, second, third };

  const valid = isValidBackgroundAsiChoice(scores, draft);

  useEffect(() => {
    const next: BackgroundAsiChoice =
      mode === "boost"
        ? { mode: "boost", primary, secondary }
        : { mode: "triple", first, second, third };
    onChange(isValidBackgroundAsiChoice(scores, next) ? next : null);
  }, [
    mode,
    primary,
    secondary,
    first,
    second,
    third,
    scores.str,
    scores.dex,
    scores.con,
    scores.int,
    scores.wis,
    scores.cha,
    onChange,
  ]);

  return (
    <div className="mt-6 rounded-lg border border-lore-accent/40 bg-lore-accent-dim/30 p-4">
      <h3 className="text-xs uppercase tracking-wide text-lore-muted">
        Background ability increases
      </h3>
      <p className="mt-2 text-sm text-lore-muted">
        <span className="text-lore-text">{backgroundName}</span> grants +2 to one
        ability and +1 to another, or +1 to three different abilities (SRD 5.2).
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            { id: "boost" as const, label: "+2 and +1" },
            { id: "triple" as const, label: "Three +1s" },
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              mode === m.id
                ? "border-lore-accent bg-lore-accent-dim text-lore-text"
                : "border-lore-border text-lore-muted hover:text-lore-text"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "boost" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <AbilitySelect
            label="+2 to"
            value={primary}
            onChange={setPrimary}
            exclude={[secondary]}
          />
          <AbilitySelect
            label="+1 to"
            value={secondary}
            onChange={setSecondary}
            exclude={[primary]}
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <AbilitySelect
            label="+1 to"
            value={first}
            onChange={setFirst}
            exclude={[second, third]}
          />
          <AbilitySelect
            label="+1 to"
            value={second}
            onChange={setSecond}
            exclude={[first, third]}
          />
          <AbilitySelect
            label="+1 to"
            value={third}
            onChange={setThird}
            exclude={[first, second]}
          />
        </div>
      )}

      {valid && (
        <p className="mt-3 text-sm text-lore-accent">
          {formatBackgroundAsiLabel(draft)}
        </p>
      )}
      {!valid && (
        <p className="mt-3 text-sm text-red-400">
          This assignment would raise an ability above 20 — pick different
          abilities or lower your base scores.
        </p>
      )}
    </div>
  );
}
