"use client";

import { useState } from "react";

type HitDiePool = { class: string; current: number; max: number };

export function SheetHpPanel({
  current,
  max,
  temp,
  hitDice,
  onPatch,
  onShortRest,
  onLongRest,
}: {
  current: number;
  max: number;
  temp: number;
  hitDice: HitDiePool[];
  onPatch: (patch: { currentHp?: number; tempHp?: number }) => void;
  onShortRest: () => void;
  onLongRest: () => void;
}) {
  const [damage, setDamage] = useState("");
  const [heal, setHeal] = useState("");

  function applyDamage() {
    const n = Number.parseInt(damage, 10);
    if (Number.isNaN(n) || n <= 0) return;
    onPatch({ currentHp: Math.max(0, current - n) });
    setDamage("");
  }

  function applyHeal() {
    const n = Number.parseInt(heal, 10);
    if (Number.isNaN(n) || n <= 0) return;
    onPatch({ currentHp: Math.min(max, current + n) });
    setHeal("");
  }

  return (
    <div className="rounded-lg border border-lore-border bg-lore-surface p-4">
      <div className="text-[10px] uppercase tracking-widest text-lore-muted">
        Hit Points
      </div>
      <div className="mt-1 font-display text-3xl tabular-nums">
        <input
          type="number"
          min={0}
          max={9999}
          value={current}
          onChange={(e) =>
            onPatch({ currentHp: Math.max(0, Number(e.target.value) || 0) })
          }
          className="w-16 border-b border-lore-border bg-transparent text-center outline-none focus:border-lore-accent"
          aria-label="Current HP"
        />
        <span className="text-lore-muted"> / </span>
        <span>{max}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="text-lore-muted">Temp</span>
        <input
          type="number"
          min={0}
          value={temp}
          onChange={(e) =>
            onPatch({ tempHp: Math.max(0, Number(e.target.value) || 0) })
          }
          className="w-14 rounded border border-lore-border bg-lore-bg px-2 py-0.5 text-center tabular-nums"
          aria-label="Temporary HP"
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="flex gap-1">
          <input
            type="number"
            min={1}
            value={damage}
            onChange={(e) => setDamage(e.target.value)}
            placeholder="Dmg"
            className="w-full rounded border border-lore-border bg-lore-bg px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={applyDamage}
            className="shrink-0 rounded border border-red-500/50 px-2 text-xs text-red-300"
          >
            ♥−
          </button>
        </div>
        <div className="flex gap-1">
          <input
            type="number"
            min={1}
            value={heal}
            onChange={(e) => setHeal(e.target.value)}
            placeholder="Heal"
            className="w-full rounded border border-lore-border bg-lore-bg px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={applyHeal}
            className="shrink-0 rounded border border-emerald-500/50 px-2 text-xs text-emerald-300"
          >
            ♥+
          </button>
        </div>
      </div>
      {hitDice.length > 0 && (
        <div className="mt-3 border-t border-lore-border pt-3">
          <div className="text-[10px] uppercase tracking-widest text-lore-muted">
            Hit Dice
          </div>
          <ul className="mt-1 space-y-1 text-xs">
            {hitDice.map((hd) => (
              <li key={hd.class} className="flex justify-between text-lore-muted">
                <span>{hd.class}</span>
                <span className="font-mono tabular-nums">
                  {hd.current}/{hd.max}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onShortRest}
          className="flex-1 rounded border border-lore-border py-1 text-xs text-lore-muted hover:border-lore-accent hover:text-lore-text"
        >
          Short rest
        </button>
        <button
          type="button"
          onClick={onLongRest}
          className="flex-1 rounded border border-lore-border py-1 text-xs text-lore-muted hover:border-lore-accent hover:text-lore-text"
        >
          Long rest
        </button>
      </div>
    </div>
  );
}
