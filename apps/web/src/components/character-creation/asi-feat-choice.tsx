"use client";

import { useState } from "react";

import {
  ABILITIES,
  type Ability,
  type AbilityScores,
  type AsiChoice,
} from "@app/engine";

import { trpc } from "@/lib/trpc/client";

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
  featSearch,
}: {
  scores: AbilityScores;
  value: AsiFeatSelection | null;
  onChange: (next: AsiFeatSelection) => void;
  featSearch?: string;
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
  const [featQuery, setFeatQuery] = useState(featSearch ?? "");
  const [selectedFeat, setSelectedFeat] = useState(
    value?.kind === "feat" ? value.featName : "",
  );

  const feats = trpc.codex.listFeats.useQuery({
    search: featQuery.trim() || undefined,
    featType: "general",
  });

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
          <input
            value={featQuery}
            onChange={(e) => setFeatQuery(e.target.value)}
            placeholder="Search SRD feats…"
            className="w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm"
          />
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
            {(feats.data ?? []).slice(0, 24).map((f) => (
              <li key={f.slug}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFeat(f.name);
                    onChange({ kind: "feat", featName: f.name });
                  }}
                  className={`w-full rounded border px-2 py-1.5 text-left text-sm ${
                    selectedFeat === f.name
                      ? "border-lore-accent bg-lore-accent-dim"
                      : "border-lore-border hover:border-lore-accent"
                  }`}
                >
                  <div className="font-medium">{f.name}</div>
                  {f.prerequisite && (
                    <div className="text-xs text-lore-muted">{f.prerequisite}</div>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {!selectedFeat && (
            <p className="mt-2 text-xs text-lore-muted">Select a feat to continue.</p>
          )}
        </div>
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
