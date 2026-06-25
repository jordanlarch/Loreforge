"use client";

/**
 * Horizontal combat controls — action economy, attack/cast/ready, end turn, and
 * reaction affordances. Sits above chat during an encounter; character vitals
 * live on the party rail (hover) or sheet peek (click).
 */
import type { EntityState } from "@app/engine";

import type { CastableSpell } from "@/lib/live-combat";
import type { WeaponAttack } from "@/lib/sheet-loadout";

import { CombatActionBar, type ArmedAction } from "./combat-action-bar";
import { ReactionPrompt } from "./reaction-prompt";

function EconChip({ label, used }: { label: string; used: boolean }) {
  return (
    <span
      className={`rounded border px-2 py-0.5 text-xs ${
        used
          ? "border-lore-border text-lore-muted line-through"
          : "border-lore-accent text-lore-accent"
      }`}
    >
      {label}
    </span>
  );
}

function ActionEconomyRow({ entity }: { entity: EntityState }) {
  const econ = entity.actionEconomy;
  if (!econ) return null;
  const moveLeft = econ.movement.total - econ.movement.used;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-r border-lore-border pr-3">
      <span className="text-[10px] uppercase tracking-widest text-lore-muted">
        Economy
      </span>
      <EconChip label="Action" used={econ.action !== "available"} />
      <EconChip label="Bonus" used={econ.bonusAction !== "available"} />
      <EconChip label="Reaction" used={entity.reaction !== "available"} />
      <span className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted">
        Move {moveLeft}/{econ.movement.total}ft
      </span>
    </div>
  );
}

export function CombatTurnBar({
  activeEntity,
  activeName,
  controllableTurn,
  paused,
  isBusy,
  onEndTurn,
  weapons,
  spells,
  armed,
  aimReady,
  readiedNote,
  canAttack,
  canAct,
  attacksLeft,
  onAttack,
  onCast,
  onReady,
  onConfirmAim,
  onCancelArmed,
  castTargetCount,
  castTargetMax,
  onConfirmMultiCast,
  items,
  onQuickUse,
  showReaction,
  reaction,
  reactorReactionSpells,
  onReactionAttack,
  onReactionPass,
  onCastShield,
  activeReactionSpells,
  onCastShieldSelf,
}: {
  activeEntity: EntityState | undefined;
  activeName: string | undefined;
  controllableTurn: boolean;
  paused: boolean;
  isBusy: boolean;
  onEndTurn: () => void;
  weapons: WeaponAttack[];
  spells: CastableSpell[];
  armed: ArmedAction;
  aimReady: boolean;
  readiedNote?: string;
  canAttack: boolean;
  canAct: boolean;
  attacksLeft: number;
  onAttack: (weapon: WeaponAttack) => void;
  onCast: (spell: CastableSpell) => void;
  onReady: (weapon: WeaponAttack) => void;
  onConfirmAim: () => void;
  onCancelArmed: () => void;
  castTargetCount?: number;
  castTargetMax?: number;
  onConfirmMultiCast?: () => void;
  items?: { name: string; quantity: number }[];
  onQuickUse?: (name: string) => void;
  showReaction: boolean;
  reaction?: { reactor: EntityState; mover: EntityState };
  reactorReactionSpells: CastableSpell[];
  onReactionAttack?: () => void;
  onReactionPass?: () => void;
  onCastShield?: () => void;
  activeReactionSpells: CastableSpell[];
  onCastShieldSelf?: () => void;
}) {
  const armedMode = armed !== null;

  return (
    <div className="space-y-2">
      {paused && (
        <div className="rounded-lg border border-lore-accent bg-lore-accent-dim px-3 py-2 text-xs text-lore-text">
          Session paused — turn actions are frozen. Press Resume to continue.
        </div>
      )}

      {showReaction && reaction && onReactionAttack && onReactionPass ? (
        <ReactionPrompt
          reactorName={reaction.reactor.name}
          moverName={reaction.mover.name}
          shieldLabel={
            reactorReactionSpells[0]
              ? `Cast ${reactorReactionSpells[0].name} (+5 AC)`
              : undefined
          }
          onCastShield={onCastShield}
          onTake={onReactionAttack}
          onPass={onReactionPass}
        />
      ) : null}

      {!showReaction &&
      activeReactionSpells[0] &&
      activeEntity &&
      onCastShieldSelf ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2">
          <span className="text-xs text-lore-muted">Reaction ready</span>
          <button
            type="button"
            disabled={isBusy}
            onClick={onCastShieldSelf}
            className="rounded border border-sky-500/60 bg-sky-500/20 px-3 py-1 text-xs text-sky-100 transition-colors hover:border-sky-400 disabled:opacity-40"
          >
            Cast {activeReactionSpells[0].name} (+5 AC)
          </button>
        </div>
      ) : null}

      <div className="rounded-lg border border-lore-border bg-lore-surface px-3 py-2">
        {armedMode ? (
          <CombatActionBar
            weapons={weapons}
            spells={spells}
            armed={armed}
            disabled={isBusy}
            aimReady={aimReady}
            readiedNote={readiedNote}
            canAttack={canAttack}
            canAct={canAct}
            attacksLeft={attacksLeft}
            onAttack={onAttack}
            onCast={onCast}
            onReady={onReady}
            onConfirm={onConfirmAim}
            onCancel={onCancelArmed}
            castTargetCount={castTargetCount}
            castTargetMax={castTargetMax}
            onConfirmMulti={onConfirmMultiCast}
            layout="inline"
          />
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {!controllableTurn && activeName ? (
              <span className="text-sm text-lore-muted">
                {activeName}&apos;s turn
              </span>
            ) : null}

            {controllableTurn && activeEntity && !paused ? (
              <>
                <ActionEconomyRow entity={activeEntity} />
                <CombatActionBar
                  weapons={weapons}
                  spells={spells}
                  armed={armed}
                  disabled={isBusy}
                  aimReady={aimReady}
                  readiedNote={readiedNote}
                  canAttack={canAttack}
                  canAct={canAct}
                  attacksLeft={attacksLeft}
                  onAttack={onAttack}
                  onCast={onCast}
                  onReady={onReady}
                  onConfirm={onConfirmAim}
                  onCancel={onCancelArmed}
                  castTargetCount={castTargetCount}
                  castTargetMax={castTargetMax}
                  onConfirmMulti={onConfirmMultiCast}
                  layout="inline"
                />
                {items && items.length > 0 && onQuickUse ? (
                  <div className="flex flex-wrap items-center gap-1.5 border-l border-lore-border pl-3">
                    {items.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => onQuickUse(item.name)}
                        className="rounded border border-lore-border px-2 py-1 text-xs text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text"
                      >
                        {item.name}
                        {item.quantity > 1 ? ` ×${item.quantity}` : ""}
                      </button>
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={onEndTurn}
                  disabled={isBusy}
                  className="ml-auto rounded border border-lore-accent bg-lore-accent-dim px-4 py-1.5 text-sm font-medium text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
                >
                  End turn
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
