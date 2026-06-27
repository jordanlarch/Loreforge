"use client";

import type { Ability } from "@app/engine";

import {
  abilityTooltip,
  skillTooltip,
} from "@/lib/srd-tooltips";

type SrdHintProps = (
  | { kind: "ability"; ability: Ability; label?: string }
  | { kind: "skill"; skill: string; label?: string }
) & { iconOnly?: boolean };

/**
 * Accessible ?-chip tooltip for SRD abilities and skills (CHAR UX polish).
 */
export function SrdHint(props: SrdHintProps) {
  const { title, body } =
    props.kind === "ability"
      ? abilityTooltip(props.ability)
      : skillTooltip(props.skill);
  const label = props.label ?? title;
  const iconOnly = props.iconOnly ?? false;

  return (
    <span className={iconOnly ? "inline-flex shrink-0" : "inline-flex items-center gap-1"}>
      {!iconOnly && <span>{label}</span>}
      <span className="group relative inline-flex">
        <button
          type="button"
          className="flex h-4 w-4 items-center justify-center rounded-full border border-lore-border text-[10px] leading-none text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text"
          aria-label={`About ${title}`}
        >
          ?
        </button>
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-56 -translate-x-1/2 rounded-lg border border-lore-border bg-lore-surface px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed text-lore-muted shadow-lg group-hover:block group-focus-within:block"
        >
          <span className="mb-0.5 block font-medium text-lore-text">{title}</span>
          {body}
        </span>
      </span>
    </span>
  );
}
