"use client";

/**
 * Combat action bar (#58) — the attack / cast affordances for the active
 * player-controlled combatant. Selecting an action arms the map's target
 * picker; the actual resolution runs through the engine once a target is
 * tapped. Shown only on a controllable turn.
 */
import { useState } from "react";

import type { CastableSpell } from "@/lib/live-combat";

export type ArmedAction =
  | { kind: "attack" }
  | { kind: "cast"; spell: CastableSpell }
  | null;

export function CombatActionBar({
  spells,
  armed,
  disabled,
  onAttack,
  onCast,
  onCancel,
}: {
  spells: CastableSpell[];
  armed: ArmedAction;
  disabled: boolean;
  onAttack: () => void;
  onCast: (spell: CastableSpell) => void;
  onCancel: () => void;
}) {
  const [castOpen, setCastOpen] = useState(false);

  if (armed) {
    const label =
      armed.kind === "attack"
        ? "Pick a target to strike"
        : `Pick a target for ${armed.spell.name}`;
    return (
      <div className="mb-3 flex items-center justify-between rounded-lg border border-lore-accent bg-lore-accent-dim px-3 py-2 text-sm">
        <span className="text-lore-text">🎯 {label}</span>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-lore-border px-2 py-1 text-xs text-lore-muted transition-colors hover:border-lore-accent"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-lore-border bg-lore-surface px-3 py-2">
      <span className="text-xs uppercase tracking-widest text-lore-muted">
        Actions
      </span>
      <button
        type="button"
        onClick={onAttack}
        disabled={disabled}
        className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
      >
        Attack
      </button>

      {spells.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setCastOpen((o) => !o)}
            disabled={disabled}
            className="rounded border border-lore-border px-3 py-1 text-sm transition-colors hover:border-lore-accent disabled:opacity-40"
          >
            Cast ▾
          </button>
          {castOpen && (
            <ul className="absolute z-10 mt-1 w-48 rounded border border-lore-border bg-lore-surface py-1 shadow-lg">
              {spells.map((spell) => (
                <li key={spell.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCastOpen(false);
                      onCast(spell);
                    }}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm text-lore-text transition-colors hover:bg-lore-accent-dim"
                  >
                    <span>{spell.name}</span>
                    <span className="text-xs text-lore-muted">
                      {spell.level === 0 ? "cantrip" : `L${spell.level}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
