"use client";

import type { SceneTrapInstance } from "@app/engine";

import { trapLabel } from "@/lib/live-traps";

export function TrapActionBar({
  traps,
  disabled,
  onDetect,
  onDisable,
}: {
  traps: readonly SceneTrapInstance[];
  disabled?: boolean;
  onDetect: (trapInstanceId: string) => void;
  onDisable: (trapInstanceId: string) => void;
}) {
  if (traps.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
      <p className="text-[10px] uppercase tracking-widest text-amber-200/80">
        Traps nearby
      </p>
      <ul className="mt-2 space-y-2">
        {traps.map((trap) => (
          <li
            key={trap.instanceId}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <span className="min-w-0 flex-1 truncate text-lore-text">
              {trapLabel(trap, trap.detected)}
              {trap.triggered ? (
                <span className="ml-2 text-xs text-lore-muted">(spent)</span>
              ) : null}
            </span>
            {!trap.disabled && !trap.triggered ? (
              <>
                {!trap.detected ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onDetect(trap.instanceId)}
                    className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text disabled:opacity-40"
                  >
                    Detect
                  </button>
                ) : null}
                {trap.detected ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onDisable(trap.instanceId)}
                    className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text disabled:opacity-40"
                  >
                    Disable
                  </button>
                ) : null}
              </>
            ) : trap.disabled ? (
              <span className="text-xs text-lore-muted">Disabled</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
