"use client";

import type { PoisonMenuItem } from "@/lib/live-poisons";

/** Inline Coat controls for the combat action rail (GRILL-LIVE-POISON Q5). */
export function PoisonTurnControls({
  poisons,
  coatedSlug,
  disabled,
  canAct,
  onCoat,
  leading = false,
}: {
  poisons: readonly PoisonMenuItem[];
  coatedSlug?: string;
  disabled?: boolean;
  canAct: boolean;
  onCoat: (poisonSlug: string) => void;
  leading?: boolean;
}) {
  if (!canAct || poisons.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${
        leading ? "" : "border-l border-lore-border pl-3"
      }`}
    >
      <span className="text-[10px] uppercase tracking-widest text-lore-muted">
        Poison
      </span>
      {coatedSlug ? (
        <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
          Coated
        </span>
      ) : null}
      {poisons.map((poison) => (
        <button
          key={poison.slug}
          type="button"
          disabled={disabled || coatedSlug === poison.slug}
          onClick={() => onCoat(poison.slug)}
          className="rounded border border-lore-border px-2 py-1 text-xs text-lore-muted transition-colors hover:border-emerald-500/50 hover:text-lore-text disabled:opacity-40"
          title={`Coat weapon with ${poison.label}`}
        >
          Coat{poisons.length > 1 ? `: ${poison.label}` : ""}
          {poison.quantity > 1 ? ` ×${poison.quantity}` : ""}
        </button>
      ))}
    </div>
  );
}
