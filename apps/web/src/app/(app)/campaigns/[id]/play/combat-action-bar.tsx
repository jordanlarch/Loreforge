"use client";

/**
 * Combat action bar (#58) — the attack / cast affordances for the active
 * player-controlled combatant. Selecting an action arms the map's target
 * picker; the actual resolution runs through the engine once a target is
 * tapped. Shown only on a controllable turn.
 */
import { useState } from "react";

import type { CastableSpell } from "@/lib/live-combat";
import type { WeaponAttack } from "@/lib/sheet-loadout";

export type ArmedAction =
  | { kind: "attack"; attack: WeaponAttack }
  | { kind: "cast"; spell: CastableSpell }
  | null;

export function CombatActionBar({
  weapons,
  spells,
  armed,
  disabled,
  onAttack,
  onCast,
  onCancel,
}: {
  weapons: WeaponAttack[];
  spells: CastableSpell[];
  armed: ArmedAction;
  disabled: boolean;
  onAttack: (weapon: WeaponAttack) => void;
  onCast: (spell: CastableSpell) => void;
  onCancel: () => void;
}) {
  const [castOpen, setCastOpen] = useState(false);
  const [attackOpen, setAttackOpen] = useState(false);

  if (armed) {
    const label =
      armed.kind === "attack"
        ? `Pick a target for ${armed.attack.label}`
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
      {weapons.length <= 1 ? (
        <button
          type="button"
          onClick={() => weapons[0] && onAttack(weapons[0])}
          disabled={disabled || weapons.length === 0}
          className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
        >
          {weapons[0] ? `Attack: ${weapons[0].label}` : "Attack"}
        </button>
      ) : (
        <div className="relative">
          <button
            type="button"
            onClick={() => setAttackOpen((o) => !o)}
            disabled={disabled}
            className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
          >
            Attack ▾
          </button>
          {attackOpen && (
            <ul className="absolute z-10 mt-1 w-56 rounded border border-lore-border bg-lore-surface py-1 shadow-lg">
              {weapons.map((weapon) => (
                <li key={weapon.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setAttackOpen(false);
                      onAttack(weapon);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-sm text-lore-text transition-colors hover:bg-lore-accent-dim"
                  >
                    {weapon.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
