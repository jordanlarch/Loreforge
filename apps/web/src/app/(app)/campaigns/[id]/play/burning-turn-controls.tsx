"use client";

import type { ActiveBurningInstance } from "@app/engine";

/** Inline Extinguish control for the combat action rail (GRILL-EXPLORATION Q4). */
export function BurningTurnControls({
  instances,
  disabled,
  canAct,
  onExtinguish,
}: {
  instances: readonly ActiveBurningInstance[];
  disabled?: boolean;
  canAct: boolean;
  onExtinguish: (instanceId: string) => void;
}) {
  if (!canAct || instances.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-l border-lore-border pl-3">
      <span className="text-[10px] uppercase tracking-widest text-lore-muted">
        Burning
      </span>
      {instances.map((instance) => (
        <button
          key={instance.instanceId}
          type="button"
          disabled={disabled}
          onClick={() => onExtinguish(instance.instanceId)}
          className="rounded border border-orange-500/40 bg-orange-500/10 px-2 py-1 text-xs text-orange-200 transition-colors hover:border-orange-400 hover:text-orange-100 disabled:opacity-40"
          title="Use an action to extinguish flames (Dex DC 15 on fail)"
        >
          Extinguish
        </button>
      ))}
    </div>
  );
}
