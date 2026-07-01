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
  | { kind: "ready"; attack: WeaponAttack }
  | { kind: "cast"; spell: CastableSpell }
  | { kind: "lay_on_hands"; featureKey: string; healAmount: number }
  | { kind: "turn_undead"; featureKey: string }
  | { kind: "spiritual_weapon_strike" }
  | null;

export function CombatActionBar({
  weapons,
  spells,
  armed,
  disabled,
  aimReady,
  readiedNote,
  canAttack,
  canAct,
  attacksLeft,
  onAttack,
  onCast,
  onReady,
  onConfirm,
  onCancel,
  castTargetCount,
  castTargetMax,
  onConfirmMulti,
  layout = "stacked",
}: {
  weapons: WeaponAttack[];
  spells: CastableSpell[];
  armed: ArmedAction;
  disabled: boolean;
  /** AoE aim mode only: whether an aim cell is placed and the cast can fire. */
  aimReady: boolean;
  /** A held-action confirmation line shown when an action is readied (#104). */
  readiedNote?: string;
  /** Attacks remain in the Attack action's budget this turn (action economy). */
  canAttack: boolean;
  /** The single action is still available (cast / ready). */
  canAct: boolean;
  /** Attacks left this turn (Extra Attack / Multiattack), for the hint label. */
  attacksLeft: number;
  onAttack: (weapon: WeaponAttack) => void;
  onCast: (spell: CastableSpell) => void;
  /** Arm the picker to ready a strike against a chosen foe (#104). */
  onReady: (weapon: WeaponAttack) => void;
  /** Fire the armed AoE cast at the placed aim cell (#99). */
  onConfirm: () => void;
  onCancel: () => void;
  /** Multi-target cast: how many allies are selected so far. */
  castTargetCount?: number;
  castTargetMax?: number;
  onConfirmMulti?: () => void;
  /** When inline, sits in the horizontal turn bar (no outer margin). */
  layout?: "stacked" | "inline";
}) {
  const inline = layout === "inline";
  const [castOpen, setCastOpen] = useState(false);
  const [attackOpen, setAttackOpen] = useState(false);
  const [readyOpen, setReadyOpen] = useState(false);

  if (armed) {
    // AoE cast: place an aim cell on the map, then confirm (#99).
    if (armed.kind === "cast" && armed.spell.area) {
      const shape =
        armed.spell.area.shape === "cone"
          ? `${armed.spell.area.sizeFt}-ft cone`
          : `${armed.spell.area.sizeFt}-ft radius`;
      return (
        <div
          className={`flex items-center justify-between gap-2 rounded-lg border border-lore-accent bg-lore-accent-dim px-3 py-2 text-sm ${inline ? "" : "mb-3"}`}
        >
          <span className="text-lore-text">
            💥 Aim {armed.spell.name} ({shape}) —{" "}
            {aimReady ? "confirm to unleash" : "tap a cell to place it"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onConfirm}
              disabled={disabled || !aimReady}
              className="rounded border border-lore-accent bg-lore-accent px-2 py-1 text-xs font-semibold text-lore-bg transition-colors disabled:opacity-40"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-lore-border px-2 py-1 text-xs text-lore-muted transition-colors hover:border-lore-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    const multi =
      armed.kind === "cast" &&
      armed.spell.maxTargets !== undefined &&
      armed.spell.maxTargets > 1;
    const label =
      armed.kind === "attack"
        ? `Pick a target for ${armed.attack.label}`
        : armed.kind === "ready"
          ? `Pick a foe to ready ${armed.attack.label} against — it fires when they enter range`
          : armed.kind === "lay_on_hands"
            ? `Pick an ally to heal (+${armed.healAmount} HP)`
            : armed.kind === "turn_undead"
              ? "Pick an Undead target for Turn Undead"
              : armed.kind === "spiritual_weapon_strike"
                ? "Pick a target for Spiritual Weapon (60 ft)"
                : multi
                ? `Pick up to ${armed.spell.maxTargets} allies for ${armed.spell.name} (${castTargetCount ?? 0}/${armed.spell.maxTargets})`
                : armed.spell.targetKind === "ally"
                  ? `Pick an ally for ${armed.spell.name}`
                  : `Pick a target for ${armed.spell.name}`;
    return (
      <div
        className={`flex items-center justify-between gap-2 rounded-lg border border-lore-accent bg-lore-accent-dim px-3 py-2 text-sm ${inline ? "" : "mb-3"}`}
      >
        <span className="text-lore-text">
          {armed.kind === "ready" ? "⏳" : "🎯"} {label}
        </span>
        <div className="flex items-center gap-2">
          {multi ? (
            <button
              type="button"
              onClick={onConfirmMulti}
              disabled={disabled || !castTargetCount || castTargetCount < 1}
              className="rounded border border-lore-accent bg-lore-accent px-2 py-1 text-xs font-semibold text-lore-bg transition-colors disabled:opacity-40"
            >
              Confirm
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-lore-border px-2 py-1 text-xs text-lore-muted transition-colors hover:border-lore-accent"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        inline
          ? "flex flex-wrap items-center gap-2"
          : "mb-3 space-y-2"
      }
    >
      <div
        className={
          inline
            ? "flex flex-wrap items-center gap-2"
            : "flex flex-wrap items-center gap-2 rounded-lg border border-lore-border bg-lore-surface px-3 py-2"
        }
      >
      {!inline && (
      <span className="text-xs uppercase tracking-widest text-lore-muted">
        Actions
      </span>
      )}
      {weapons.length <= 1 ? (
        <button
          type="button"
          onClick={() => weapons[0] && onAttack(weapons[0])}
          disabled={disabled || weapons.length === 0 || !canAttack}
          title={!canAttack ? "No attacks left this turn — End turn" : undefined}
          className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
        >
          {weapons[0] ? `Attack: ${weapons[0].label}` : "Attack"}
        </button>
      ) : (
        <div className="relative">
          <button
            type="button"
            onClick={() => setAttackOpen((o) => !o)}
            disabled={disabled || !canAttack}
            title={!canAttack ? "No attacks left this turn — End turn" : undefined}
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

      {weapons.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              if (weapons.length === 1) onReady(weapons[0]!);
              else setReadyOpen((o) => !o);
            }}
            disabled={disabled || !canAct}
            title={!canAct ? "Action already used this turn" : undefined}
            className="rounded border border-lore-border px-3 py-1 text-sm transition-colors hover:border-lore-accent disabled:opacity-40"
          >
            {weapons.length === 1 ? "Ready" : "Ready ▾"}
          </button>
          {readyOpen && weapons.length > 1 && (
            <ul className="absolute z-10 mt-1 w-56 rounded border border-lore-border bg-lore-surface py-1 shadow-lg">
              {weapons.map((weapon) => (
                <li key={weapon.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setReadyOpen(false);
                      onReady(weapon);
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
            disabled={disabled || !canAct}
            title={!canAct ? "Action already used this turn" : undefined}
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
      {attacksLeft > 1 && (
        <p
          className={
            inline
              ? "text-xs text-lore-muted"
              : "rounded border border-lore-border bg-lore-bg px-3 py-1.5 text-xs text-lore-muted"
          }
        >
          ⚔️ {attacksLeft} attacks left this turn (Extra Attack).
        </p>
      )}
      {!canAttack && !canAct && (
        <p
          className={
            inline
              ? "text-xs text-lore-muted"
              : "rounded border border-lore-border bg-lore-bg px-3 py-1.5 text-xs text-lore-muted"
          }
        >
          Action used — move if you like, then End turn.
        </p>
      )}
      {readiedNote && (
        <p
          className={
            inline
              ? "text-xs text-amber-200"
              : "rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200"
          }
        >
          ⏳ {readiedNote}
        </p>
      )}
    </div>
  );
}
