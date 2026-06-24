"use client";

import { useState } from "react";

import {
  abilityModifier,
  areHostile,
  type EntityState,
  type WorldState,
} from "@app/engine";

import { genericStrike, type WeaponAttack } from "@/lib/sheet-loadout";

/** The slice of the live session the HUD drives (decoupled from the hook). */
type HudSession = {
  state?: WorldState;
  isBusy: boolean;
  endTurn: () => void;
  attack: (
    attacker: string,
    target: string,
    attackBonus: number,
    damage: { notation: string; type: string },
  ) => void;
  sendChat: (text: string, mode?: string) => void;
};

const ABILITY_ROW: { key: keyof EntityState["abilityScores"]; label: string }[] =
  [
    { key: "str", label: "STR" },
    { key: "dex", label: "DEX" },
    { key: "con", label: "CON" },
    { key: "int", label: "INT" },
    { key: "wis", label: "WIS" },
    { key: "cha", label: "CHA" },
  ];

function fmtMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** Resolve the active combatant + the targets it may attack from the world. */
function readActive(state: WorldState | undefined): {
  entity: EntityState;
  targets: EntityState[];
  yourTurn: boolean;
} | null {
  const encounter = state?.encounter;
  if (!state || !encounter) return null;
  const activeRef = encounter.order[encounter.activeIndex]?.entity;
  const entity = activeRef ? state.entities[activeRef] : undefined;
  if (!entity) return null;

  const mySide = encounter.sides[entity.id];
  const targets = Object.values(state.entities).filter(
    (e) =>
      e.id !== entity.id &&
      e.alive &&
      areHostile(mySide, encounter.sides[e.id]),
  );
  return { entity, targets, yourTurn: entity.actionEconomy !== undefined };
}

/**
 * Live-play character HUD (#63, #98): the right-rail Live Stats panel for the
 * active combatant, driven entirely by the synced `WorldState` so it reflects
 * engine events live (HP, conditions, action economy, slots, death saves).
 * Quick-attack routes through the deterministic engine. When the campaign roster
 * is bridged in (#98) the attack + quick-use are driven by the character's real
 * weapon + consumables; otherwise they fall back to a generic Strike.
 */
export function CharacterHud({
  session,
  weapons,
  items,
  onViewSheet,
}: {
  session: HudSession;
  /** Sheet-derived weapons for the active entity (#98); generic Strike if absent. */
  weapons?: WeaponAttack[];
  /** Sheet-derived quick-use consumables (#98). */
  items?: { name: string; quantity: number }[];
  /** Open the full character sheet overlay when the roster id is known. */
  onViewSheet?: () => void;
}) {
  const [compact, setCompact] = useState(false);
  const [targetId, setTargetId] = useState("");

  const active = readActive(session.state);
  if (!active) return null;
  const { entity, targets, yourTurn } = active;

  const level = entity.classes.reduce((sum, c) => sum + c.level, 0) || 1;
  const classLine = entity.classes
    .map((c) => `${c.class} ${c.level}`)
    .join(" / ");
  const hpPct = Math.max(
    0,
    Math.min(100, Math.round((entity.hp.current / Math.max(1, entity.hp.max)) * 100)),
  );

  // Primary weapon: the first sheet-derived weapon (#98), or a generic Strike
  // when no roster is bridged in. The map action bar offers the full list.
  const strike = weapons?.[0] ?? genericStrike(entity);

  const chosenTarget = targetId || targets[0]?.id || "";

  function onStrike() {
    if (!chosenTarget) return;
    session.attack(
      entity.id,
      chosenTarget,
      strike.attackBonus,
      strike.damage,
      strike.rangeFt,
    );
  }

  const borderClass = yourTurn
    ? "border-lore-accent shadow-[0_0_0_1px_var(--tw-shadow-color)] shadow-lore-accent/40"
    : "border-lore-border";

  if (compact) {
    return (
      <div className={`rounded-lg border bg-lore-surface p-3 ${borderClass}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-sm">{entity.name}</span>
          <button
            type="button"
            onClick={() => setCompact(false)}
            className="text-xs text-lore-muted hover:text-lore-text"
          >
            Expand ↓
          </button>
        </div>
        <HpBar pct={hpPct} hp={entity.hp} />
        <div className="mt-1 flex gap-3 text-xs text-lore-muted">
          <span>AC {entity.baseAc}</span>
          <span>Speed {entity.speed}ft</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border bg-lore-surface p-4 ${borderClass}`}>
      {/* Identity */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-lg leading-tight">{entity.name}</div>
          <div className="text-xs text-lore-muted">
            Lvl {level}
            {classLine ? ` · ${classLine}` : ""}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {onViewSheet ? (
            <button
              type="button"
              onClick={onViewSheet}
              className="text-xs text-lore-accent hover:text-lore-text"
            >
              Full sheet
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setCompact(true)}
            className="text-xs text-lore-muted hover:text-lore-text"
          >
            Compact ↑
          </button>
        </div>
      </div>

      {/* Abilities */}
      <div className="mb-3 grid grid-cols-3 gap-1.5 text-center text-xs">
        {ABILITY_ROW.map(({ key, label }) => {
          const score = entity.abilityScores[key];
          return (
            <div key={key} className="rounded border border-lore-border py-1">
              <div className="text-lore-muted">{label}</div>
              <div className="text-sm text-lore-text">
                {score}{" "}
                <span className="text-lore-muted">
                  ({fmtMod(abilityModifier(score))})
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Vitals */}
      <HpBar pct={hpPct} hp={entity.hp} />
      <div className="mb-3 mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-lore-muted">
        <span>AC {entity.baseAc}</span>
        <span>Speed {entity.speed}ft</span>
        <span>Prof {fmtMod(entity.proficiencyBonus)}</span>
        {entity.hp.temp > 0 && <span>THP {entity.hp.temp}</span>}
      </div>

      {/* Action economy (combat only) */}
      {entity.actionEconomy && (
        <Section title="Action Economy">
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Chip
              label="Action"
              state={entity.actionEconomy.action}
            />
            <Chip label="Bonus" state={entity.actionEconomy.bonusAction} />
            <Chip label="Reaction" state={entity.reaction ?? "available"} />
            <span className="rounded border border-lore-border px-2 py-0.5 text-lore-muted">
              Move{" "}
              {entity.actionEconomy.movement.total -
                entity.actionEconomy.movement.used}
              /{entity.actionEconomy.movement.total}ft
            </span>
          </div>
        </Section>
      )}

      {/* Conditions */}
      {entity.conditions.length > 0 && (
        <Section title="Conditions">
          <div className="flex flex-wrap gap-1.5 text-xs">
            {entity.conditions.map((c, i) => (
              <span
                key={`${c.condition}-${i}`}
                className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 capitalize text-amber-300"
              >
                {c.condition}
                {c.level ? ` ${c.level}` : ""}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Concentration */}
      {entity.concentration && (
        <Section title="Concentration">
          <p className="text-xs text-lore-muted">
            🧠 {entity.concentration.spell}
          </p>
        </Section>
      )}

      {/* Spell slots */}
      {entity.spellcasting &&
        Object.keys(entity.spellcasting.slots).length > 0 && (
          <Section title="Spell Slots">
            <div className="flex flex-wrap gap-1.5 text-xs">
              {Object.entries(entity.spellcasting.slots).map(([lvl, slot]) => (
                <span
                  key={lvl}
                  className="rounded border border-lore-border px-2 py-0.5 text-lore-muted"
                >
                  L{lvl} {slot.current}/{slot.max}
                </span>
              ))}
            </div>
          </Section>
        )}

      {/* Death saves */}
      {entity.deathSaves && (
        <Section title="Death Saves">
          <p className="text-xs text-lore-muted">
            Successes {entity.deathSaves.successes} · Failures{" "}
            {entity.deathSaves.failures}
          </p>
        </Section>
      )}

      {/* Attacks */}
      <Section title="Attacks">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-lore-text">{strike.label}</span>
          {targets.length > 0 ? (
            <>
              <select
                value={chosenTarget}
                onChange={(e) => setTargetId(e.target.value)}
                className="rounded border border-lore-border bg-lore-bg px-2 py-1 outline-none focus:border-lore-accent"
              >
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.hp.current}/{t.hp.max})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onStrike}
                disabled={session.isBusy || !chosenTarget}
                className="rounded border border-lore-accent bg-lore-accent-dim px-2 py-1 text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
              >
                Attack
              </button>
            </>
          ) : (
            <span className="text-lore-muted">No hostile targets</span>
          )}
        </div>
      </Section>

      {/* Inventory quick-use — real consumables from the sheet (#98); using an
          item is still a narrative action (sendChat) until item effects route
          through the engine (SMITH-7). */}
      {items && items.length > 0 && (
        <Section title="Quick Use">
          <div className="flex flex-wrap gap-1.5">
            {items.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() =>
                  session.sendChat(`uses ${item.name}`, "use_item")
                }
                className="rounded border border-lore-border px-2 py-1 text-xs text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text"
              >
                🧪 {item.name}
                {item.quantity > 1 ? ` ×${item.quantity}` : ""}
              </button>
            ))}
          </div>
        </Section>
      )}

      {yourTurn && (
        <button
          type="button"
          onClick={session.endTurn}
          disabled={session.isBusy}
          className="mt-3 w-full rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent disabled:opacity-40"
        >
          End turn
        </button>
      )}
    </div>
  );
}

function HpBar({
  pct,
  hp,
}: {
  pct: number;
  hp: { current: number; max: number };
}) {
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-lore-bg">
        <div
          className="h-full rounded-full bg-lore-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-0.5 text-right text-xs text-lore-muted">
        {hp.current} / {hp.max} HP
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 border-t border-lore-border pt-2">
      <div className="mb-1.5 text-[10px] uppercase tracking-widest text-lore-muted">
        {title}
      </div>
      {children}
    </div>
  );
}

function Chip({ label, state }: { label: string; state: string }) {
  const used = state !== "available";
  return (
    <span
      className={`rounded border px-2 py-0.5 ${
        used
          ? "border-lore-border text-lore-muted line-through"
          : "border-lore-accent text-lore-accent"
      }`}
    >
      {label}
    </span>
  );
}
