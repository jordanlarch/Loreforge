"use client";

import type { SceneTrapInstance } from "@app/engine";

import { trapLabel } from "@/lib/live-traps";

/** Inline Detect / Disable controls for the combat explore action rail. */
export function TrapTurnControls({
  traps,
  disabled,
  onDetect,
  onDisable,
  leading = false,
}: {
  traps: readonly SceneTrapInstance[];
  disabled?: boolean;
  onDetect: (trapInstanceId: string) => void;
  onDisable: (trapInstanceId: string) => void;
  /** When true, omit the left divider (first section on the action rail). */
  leading?: boolean;
}) {
  const actionable = traps.filter((t) => !t.disabled && !t.triggered);
  if (actionable.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${
        leading ? "" : "border-l border-lore-border pl-3"
      }`}
    >
      <span className="text-[10px] uppercase tracking-widest text-lore-muted">
        Traps
      </span>
      {actionable.map((trap) => {
        const label = trapLabel(trap, trap.detected);
        if (!trap.detected) {
          return (
            <button
              key={trap.instanceId}
              type="button"
              disabled={disabled}
              onClick={() => onDetect(trap.instanceId)}
              className="rounded border border-lore-border px-2 py-1 text-xs text-lore-muted transition-colors hover:border-amber-500/50 hover:text-lore-text disabled:opacity-40"
              title={label}
            >
              Detect
            </button>
          );
        }
        return (
          <button
            key={trap.instanceId}
            type="button"
            disabled={disabled}
            onClick={() => onDisable(trap.instanceId)}
            className="rounded border border-lore-border px-2 py-1 text-xs text-lore-muted transition-colors hover:border-amber-500/50 hover:text-lore-text disabled:opacity-40"
            title={`Disable ${label}`}
          >
            Disable{actionable.length > 1 ? `: ${label}` : ""}
          </button>
        );
      })}
    </div>
  );
}
