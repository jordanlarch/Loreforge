"use client";

import { useState } from "react";

import {
  ABILITIES,
  type Ability,
  type AbilityScores,
  type AsiChoice,
  type FeatEligibilityContext,
} from "@app/engine";

import { CodexFeatAddPicker } from "@/components/character-library-pickers";

const ABILITY_LABELS: Record<Ability, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

export type AsiFeatSelection =
  | { kind: "asi"; asi: AsiChoice }
  | { kind: "feat"; featName: string };

export function AsiFeatChoice({
  scores,
  value,
  onChange,
  featEligibility,
}: {
  scores: AbilityScores;
  value: AsiFeatSelection | null;
  onChange: (next: AsiFeatSelection) => void;
  /** When set, feat browse filters by SRD prerequisites. */
  featEligibility?: FeatEligibilityContext;
}) {
  const [mode, setMode] = useState<"asi" | "feat">(
    value?.kind === "feat" ? "feat" : "asi",
  );
  const [asiMode, setAsiMode] = useState<"increase" | "split">(
    value?.kind === "asi" && value.asi.mode === "split" ? "split" : "increase",
  );
  const [asiAbility, setAsiAbility] = useState<Ability>("str");
  const [asiFirst, setAsiFirst] = useState<Ability>("str");
  const [asiSecond, setAsiSecond] = useState<Ability>("dex");
  const [featPickerOpen, setFeatPickerOpen] = useState(false);
  const selectedFeat = value?.kind === "feat" ? value.featName : "";

  const asiInvalid = asiMode === "split" && asiFirst === asiSecond;

  function emitAsi() {
    const asi: AsiChoice =
      asiMode === "increase"
        ? { mode: "increase", ability: asiAbility, amount: 2 }
        : { mode: "split", first: asiFirst, second: asiSecond };
    onChange({ kind: "asi", asi });
  }

  function switchMode(next: "asi" | "feat") {
    setMode(next);
    if (next === "feat" && selectedFeat) {
      onChange({ kind: "feat", featName: selectedFeat });
    } else if (next === "asi" && !asiInvalid) {
      emitAsi();
    }
  }

  return (
    <div className="rounded-lg border border-lore-accent/40 bg-lore-accent-dim/30 p-4">
      <h3 className="text-xs uppercase tracking-wide text-lore-muted">
        Ability Score Improvement or Feat
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["asi", "feat"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`rounded-full border px-3 py-1 text-xs ${
              mode === m
                ? "border-lore-accent bg-lore-accent-dim"
                : "border-lore-border text-lore-muted"
            }`}
          >
            {m === "asi" ? "Ability scores" : "Take a feat"}
          </button>
        ))}
      </div>

      {mode === "asi" ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["increase", "split"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setAsiMode(m);
                  if (m === "increase") {
                    onChange({
                      kind: "asi",
                      asi: { mode: "increase", ability: asiAbility, amount: 2 },
                    });
                  }
                }}
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
                  onClick={() => {
                    setAsiAbility(a);
                    onChange({
                      kind: "asi",
                      asi: { mode: "increase", ability: a, amount: 2 },
                    });
                  }}
                  className={`rounded border px-2 py-1 text-xs font-mono ${
                    asiAbility === a
                      ? "border-lore-accent bg-lore-accent-dim"
                      : "border-lore-border"
                  }`}
                >
                  {ABILITY_LABELS[a]} {scores[a]}→{scores[a] + 2}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <AsiPickRow
                label="First +1"
                value={asiFirst}
                scores={scores}
                onChange={(a) => {
                  setAsiFirst(a);
                  if (a !== asiSecond) {
                    onChange({ kind: "asi", asi: { mode: "split", first: a, second: asiSecond } });
                  }
                }}
              />
              <AsiPickRow
                label="Second +1"
                value={asiSecond}
                scores={scores}
                onChange={(a) => {
                  setAsiSecond(a);
                  if (a !== asiFirst) {
                    onChange({ kind: "asi", asi: { mode: "split", first: asiFirst, second: a } });
                  }
                }}
              />
              {asiInvalid && (
                <p className="text-xs text-red-400">Choose two different abilities.</p>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="mt-3">
          {selectedFeat ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm font-medium">
                {selectedFeat}
              </span>
              <button
                type="button"
                onClick={() => setFeatPickerOpen(true)}
                className="rounded border border-lore-border px-3 py-1.5 text-xs text-lore-muted hover:text-lore-text"
              >
                Change
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFeatPickerOpen(true)}
              className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm"
            >
              Browse SRD feats…
            </button>
          )}
          {!selectedFeat && (
            <p className="mt-2 text-xs text-lore-muted">
              Opens a scrollable list of eligible feats from the Codex.
            </p>
          )}
        </div>
      )}

      {featPickerOpen && (
        <CodexFeatAddPicker
          selected={selectedFeat}
          featEligibility={featEligibility}
          onSelect={(featName) => onChange({ kind: "feat", featName })}
          onClose={() => setFeatPickerOpen(false)}
        />
      )}
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

export function asiFeatComplete(value: AsiFeatSelection | null): boolean {
  if (!value) return false;
  if (value.kind === "feat") return value.featName.trim().length > 0;
  if (value.asi.mode === "split") return value.asi.first !== value.asi.second;
  return true;
}
