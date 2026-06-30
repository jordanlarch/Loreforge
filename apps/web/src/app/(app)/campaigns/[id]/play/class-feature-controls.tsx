"use client";

import {
  classFeaturesForLevel,
  classLevel,
  effectiveFeaturePoolSize,
  entityIsFrenzied,
  featureResourceKey,
  hasClassSubclass,
  METAMAGIC_OPTIONS,
  remainingFeatureUses,
  selectedMetamagicOptions,
  type EntityState,
} from "@app/engine";

type MonkFocusSpend = "flurry" | "patient_defense" | "step_of_wind";
type OpenHandTechnique = "prone" | "push" | "no_reactions";
type FastHandsAction = "sleight_of_hand" | "thieves_tools" | "use_object";

export type ClassFeatureUseOpts = {
  monkFocusSpend?: MonkFocusSpend;
  beneficiaryId?: string;
  rageFrenzy?: boolean;
  channelDivinitySpend?: "divine_sense" | "sacred_weapon" | "turn_undead";
};

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

function channelDivinityKey(entity: EntityState): string | undefined {
  if (classLevel(entity.classes ?? [], "Paladin") < 3) return undefined;
  const feat = classFeaturesForLevel("Paladin", 3).find(
    (f) => f.id === "channel-divinity",
  );
  if (!feat) return undefined;
  return featureResourceKey("Paladin", 3, feat.id);
}

function actionSurgeKey(entity: EntityState): string | undefined {
  const level = classLevel(entity.classes ?? [], "Fighter");
  if (level < 2) return undefined;
  const feat = classFeaturesForLevel("Fighter", 2).find(
    (f) => f.id === "action-surge",
  );
  if (!feat) return undefined;
  return featureResourceKey("Fighter", 2, feat.id);
}

export function ClassFeatureControls({
  entity,
  disabled,
  stunningStrike,
  onStunningStrikeChange,
  selectedMetamagic,
  onMetamagicChange,
  flurryStrike,
  onFlurryStrikeChange,
  frenzyStrike,
  onFrenzyStrikeChange,
  openHandTechnique,
  onOpenHandTechniqueChange,
  onUseClassFeature,
  onFastHands,
}: {
  entity: EntityState;
  disabled?: boolean;
  stunningStrike: boolean;
  onStunningStrikeChange: (value: boolean) => void;
  selectedMetamagic: string | undefined;
  onMetamagicChange: (value: string | undefined) => void;
  flurryStrike?: boolean;
  onFlurryStrikeChange?: (value: boolean) => void;
  frenzyStrike?: boolean;
  onFrenzyStrikeChange?: (value: boolean) => void;
  openHandTechnique?: OpenHandTechnique;
  onOpenHandTechniqueChange?: (value: OpenHandTechnique | undefined) => void;
  onUseClassFeature: (featureKey: string, opts?: ClassFeatureUseOpts) => void;
  onFastHands?: (action: FastHandsAction) => void;
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
  const isBerserker = hasClassSubclass(
    entity.classes,
    "Barbarian",
    "Path of the Berserker",
  );
  const frenzied = entityIsFrenzied(entity);
  const bonusActionFree = entity.actionEconomy?.bonusAction === "available";

  const cdKey = channelDivinityKey(entity);
  const cdFeat = cdKey
    ? classFeaturesForLevel("Paladin", 3).find((f) => f.id === "channel-divinity")
    : undefined;
  const cdRemaining =
    cdKey && cdFeat?.uses && entity.classes
      ? remainingFeatureUses(
          entity.resourceUses?.[cdKey],
          effectiveFeaturePoolSize(cdKey, entity.classes, cdFeat.uses),
        )
      : 0;
  const showSacredWeapon =
    cdKey &&
    cdRemaining > 0 &&
    hasClassSubclass(entity.classes, "Paladin", "Oath of Devotion");

  const surgeKey = actionSurgeKey(entity);
  const surgeFeat = surgeKey
    ? classFeaturesForLevel("Fighter", 2).find((f) => f.id === "action-surge")
    : undefined;
  const surgeRemaining =
    surgeKey && surgeFeat?.uses && entity.classes
      ? remainingFeatureUses(
          entity.resourceUses?.[surgeKey],
          effectiveFeaturePoolSize(surgeKey, entity.classes, surgeFeat.uses),
        )
      : 0;

  const showFastHands =
    onFastHands &&
    hasClassSubclass(entity.classes, "Rogue", "Thief") &&
    classLevel(entity.classes ?? [], "Rogue") >= 3;

  const flurryAttacksLeft = entity.actionEconomy?.flurryAttacksRemaining ?? 0;
  const showOpenHand =
    flurryAttacksLeft > 0 &&
    hasClassSubclass(entity.classes, "Monk", "Warrior of the Open Hand");

  if (
    !hasStunningStrike(entity) &&
    !hasMonkFocus(entity) &&
    !showMetamagic &&
    !rageKey &&
    !showSacredWeapon &&
    !surgeKey &&
    !showFastHands &&
    flurryAttacksLeft < 1 &&
    !frenzied
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
        isBerserker ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onUseClassFeature(rageKey, { rageFrenzy: true })}
            className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted hover:border-lore-accent hover:text-lore-text disabled:opacity-40"
          >
            Frenzy Rage
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onUseClassFeature(rageKey)}
            className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted hover:border-lore-accent hover:text-lore-text disabled:opacity-40"
          >
            Rage
          </button>
        )
      ) : null}

      {frenzied && bonusActionFree && onFrenzyStrikeChange ? (
        <label className="flex items-center gap-1 rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted">
          <input
            type="checkbox"
            checked={frenzyStrike ?? false}
            disabled={disabled}
            onChange={(e) => onFrenzyStrikeChange(e.target.checked)}
          />
          Frenzy Attack
        </label>
      ) : null}

      {showSacredWeapon ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onUseClassFeature(cdKey!, {
              channelDivinitySpend: "sacred_weapon",
            })
          }
          className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted hover:border-lore-accent hover:text-lore-text disabled:opacity-40"
        >
          Sacred Weapon
        </button>
      ) : null}

      {surgeKey && surgeRemaining > 0 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onUseClassFeature(surgeKey)}
          className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted hover:border-lore-accent hover:text-lore-text disabled:opacity-40"
        >
          Action Surge
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
            onClick={() =>
              onUseClassFeature(focusKey, { monkFocusSpend: "flurry" })
            }
            className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted hover:border-lore-accent hover:text-lore-text disabled:opacity-40"
          >
            Flurry
          </button>
        </>
      ) : null}

      {flurryAttacksLeft > 0 && onFlurryStrikeChange ? (
        <>
          <span className="rounded border border-lore-accent px-2 py-0.5 text-xs text-lore-accent">
            Flurry ×{flurryAttacksLeft}
          </span>
          <label className="flex items-center gap-1 rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted">
            <input
              type="checkbox"
              checked={flurryStrike ?? true}
              disabled={disabled}
              onChange={(e) => onFlurryStrikeChange(e.target.checked)}
            />
            Flurry strike
          </label>
        </>
      ) : null}

      {showOpenHand && onOpenHandTechniqueChange ? (
        <select
          value={openHandTechnique ?? ""}
          disabled={disabled || !flurryStrike}
          onChange={(e) =>
            onOpenHandTechniqueChange(
              (e.target.value as OpenHandTechnique) || undefined,
            )
          }
          className="rounded border border-lore-border bg-lore-surface px-2 py-0.5 text-xs text-lore-text"
          aria-label="Open Hand Technique"
        >
          <option value="">No technique</option>
          <option value="prone">Prone</option>
          <option value="push">Push</option>
          <option value="no_reactions">No reactions</option>
        </select>
      ) : null}

      {showFastHands ? (
        <>
          <button
            type="button"
            disabled={disabled || !bonusActionFree}
            onClick={() => onFastHands!("sleight_of_hand")}
            className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted hover:border-lore-accent hover:text-lore-text disabled:opacity-40"
          >
            Fast Hands (Sleight)
          </button>
          <button
            type="button"
            disabled={disabled || !bonusActionFree}
            onClick={() => onFastHands!("thieves_tools")}
            className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted hover:border-lore-accent hover:text-lore-text disabled:opacity-40"
          >
            Fast Hands (Tools)
          </button>
          <button
            type="button"
            disabled={disabled || !bonusActionFree}
            onClick={() => onFastHands!("use_object")}
            className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted hover:border-lore-accent hover:text-lore-text disabled:opacity-40"
          >
            Fast Hands (Object)
          </button>
        </>
      ) : null}
    </div>
  );
}
