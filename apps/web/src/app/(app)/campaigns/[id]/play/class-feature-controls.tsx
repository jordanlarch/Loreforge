"use client";

import {
  classFeaturesForLevel,
  classLevel,
  effectiveFeaturePoolSize,
  featureResourceKey,
  METAMAGIC_OPTIONS,
  remainingFeatureUses,
  selectedMetamagicOptions,
  type EntityState,
} from "@app/engine";

type MonkFocusSpend = "flurry" | "patient_defense" | "step_of_wind";

function hasMonkFocus(entity: EntityState): boolean {
  return classLevel(entity.classes ?? [], "Monk") >= 2;
}

function monkFocusKey(entity: EntityState): string | undefined {
  const level = classLevel(entity.classes ?? [], "Monk");
  if (level < 2) return undefined;
  const feat = classFeaturesForLevel("Monk", 2).find((f) => f.id === "monk-s-focus");
  if (!feat) return undefined;
  return featureResourceKey("Monk", 2, feat.id);
}

function hasStunningStrike(entity: EntityState): boolean {
  return classLevel(entity.classes ?? [], "Monk") >= 5;
}

export function ClassFeatureControls({
  entity,
  disabled,
  stunningStrike,
  onStunningStrikeChange,
  selectedMetamagic,
  onMetamagicChange,
  onUseClassFeature,
}: {
  entity: EntityState;
  disabled?: boolean;
  stunningStrike: boolean;
  onStunningStrikeChange: (value: boolean) => void;
  selectedMetamagic: string | undefined;
  onMetamagicChange: (value: string | undefined) => void;
  onUseClassFeature: (
    featureKey: string,
    opts?: {
      monkFocusSpend?: MonkFocusSpend;
      beneficiaryId?: string;
    },
  ) => void;
}) {
  const focusKey = monkFocusKey(entity);
  const focusFeat = focusKey
    ? classFeaturesForLevel("Monk", 2).find((f) => f.id === "monk-s-focus")
    : undefined;
  const focusRemaining =
    focusKey && focusFeat?.uses && entity.classes
      ? remainingFeatureUses(
          entity.resourceUses?.[focusKey],
          effectiveFeaturePoolSize(
            focusKey,
            entity.classes,
            focusFeat.uses,
          ),
        )
      : 0;

  const metamagicOptions = selectedMetamagicOptions(entity.featureChoices);
  const showMetamagic = metamagicOptions.length > 0;

  const rageKey =
    classLevel(entity.classes ?? [], "Barbarian") >= 1
      ? featureResourceKey("Barbarian", 1, "rage")
      : undefined;
  const rageFeat = rageKey
    ? classFeaturesForLevel("Barbarian", 1).find((f) => f.id === "rage")
    : undefined;
  const rageRemaining =
    rageKey && rageFeat?.uses
      ? remainingFeatureUses(entity.resourceUses?.[rageKey], rageFeat.uses)
      : 0;

  if (
    !hasStunningStrike(entity) &&
    !hasMonkFocus(entity) &&
    !showMetamagic &&
    !rageKey
  ) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-l border-lore-border pl-3">
      <span className="text-[10px] uppercase tracking-widest text-lore-muted">
        Features
      </span>

      {hasStunningStrike(entity) ? (
        <label className="flex items-center gap-1 rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted">
          <input
            type="checkbox"
            checked={stunningStrike}
            disabled={disabled || entity.actionEconomy?.stunningStrikeUsed}
            onChange={(e) => onStunningStrikeChange(e.target.checked)}
          />
          Stunning Strike
        </label>
      ) : null}

      {showMetamagic ? (
        <select
          value={selectedMetamagic ?? ""}
          disabled={disabled}
          onChange={(e) =>
            onMetamagicChange(e.target.value || undefined)
          }
          className="rounded border border-lore-border bg-lore-surface px-2 py-0.5 text-xs text-lore-text"
          aria-label="Metamagic"
        >
          <option value="">No Metamagic</option>
          {metamagicOptions.map((id) => (
            <option key={id} value={id}>
              {METAMAGIC_OPTIONS[id].name} ({METAMAGIC_OPTIONS[id].cost} SP)
            </option>
          ))}
        </select>
      ) : null}

      {rageKey && rageRemaining > 0 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onUseClassFeature(rageKey)}
          className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted hover:border-lore-accent hover:text-lore-text disabled:opacity-40"
        >
          Rage
        </button>
      ) : null}

      {focusKey && focusRemaining > 0 ? (
        <>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onUseClassFeature(focusKey, { monkFocusSpend: "patient_defense" })
            }
            className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted hover:border-lore-accent hover:text-lore-text disabled:opacity-40"
          >
            Patient Defense
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onUseClassFeature(focusKey, { monkFocusSpend: "step_of_wind" })
            }
            className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted hover:border-lore-accent hover:text-lore-text disabled:opacity-40"
          >
            Step of the Wind
          </button>
          <button
            type="button"
            disabled={disabled}
            title="Flurry combat loop deferred (FID-14)"
            onClick={() =>
              onUseClassFeature(focusKey, { monkFocusSpend: "flurry" })
            }
            className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted hover:border-lore-accent hover:text-lore-text disabled:opacity-40"
          >
            Flurry
          </button>
        </>
      ) : null}
    </div>
  );
}
