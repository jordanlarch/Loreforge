"use client";

import {
  abilityModifier,
  type ActiveCurseInstance,
  type ActiveEnvironmentalEffectInstance,
  type ActiveFearStressInstance,
  type ActiveBurningInstance,
  type ActivePoisonInstance,
  type EntityState,
} from "@app/engine";

import { activeCurseHudLabel } from "@/lib/live-curses";
import { activeEnvironmentalEffectHudLabel } from "@/lib/live-environmental-effects";
import { activeFearStressHudLabel } from "@/lib/live-fear-stress";
import { activeBurningHudLabel } from "@/lib/live-exploration-hazards";
import { activePoisonHudLabel } from "@/lib/live-poisons";

const ABILITIES: { key: keyof EntityState["abilityScores"]; label: string }[] = [
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

function hpPercent(hp: { current: number; max: number }): number {
  if (hp.max <= 0) return 0;
  return Math.round((hp.current / hp.max) * 100);
}

function hpBarColor(pct: number): string {
  if (pct <= 25) return "bg-red-500";
  if (pct <= 50) return "bg-amber-500";
  return "bg-lore-accent";
}

/** Inline detail block shared by hover popover and expanded NPC rows. */
export function PartyMemberDetail({ member }: { member: EntityState }) {
  const level = member.classes.reduce((sum, c) => sum + c.level, 0);
  const classLine = member.classes.map((c) => `${c.class} ${c.level}`).join(" / ");
  const slots = member.spellcasting?.slots ?? {};
  const slotEntries = Object.entries(slots);

  return (
    <div className="text-xs">
      <div className="mb-2 text-[10px] text-lore-muted">
        {level > 0 ? `Lvl ${level}` : member.kind}
        {classLine ? ` · ${classLine}` : ""}
      </div>

      <div className="mb-2 grid grid-cols-6 gap-1 text-center text-[10px]">
        {ABILITIES.map(({ key, label }) => (
          <div key={key} className="rounded border border-lore-border py-0.5">
            <div className="text-lore-muted">{label}</div>
            <div className="text-lore-text">
              {fmtMod(abilityModifier(member.abilityScores[key]))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-lore-muted">
        <span>AC {member.baseAc}</span>
        <span>Speed {member.speed}ft</span>
        {member.hp.temp > 0 && <span>THP {member.hp.temp}</span>}
      </div>

      {member.conditions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {member.conditions.map((c, i) => (
            <span
              key={`${c.condition}-${i}`}
              className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] capitalize text-amber-300"
            >
              {c.condition}
              {c.level ? ` ${c.level}` : ""}
            </span>
          ))}
        </div>
      )}

      {member.activePoisons && member.activePoisons.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {member.activePoisons.map((p: ActivePoisonInstance) => (
            <span
              key={p.instanceId}
              className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-200"
            >
              {activePoisonHudLabel(p)}
            </span>
          ))}
        </div>
      ) : null}

      {member.activeCurses && member.activeCurses.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {member.activeCurses.map((c: ActiveCurseInstance) => (
            <span
              key={c.instanceId}
              className="rounded border border-violet-500/40 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-200"
            >
              {activeCurseHudLabel(c)}
            </span>
          ))}
        </div>
      ) : null}

      {member.activeEnvironmentalEffects &&
      member.activeEnvironmentalEffects.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {member.activeEnvironmentalEffects.map(
            (e: ActiveEnvironmentalEffectInstance) => (
              <span
                key={e.instanceId}
                className="rounded border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-200"
              >
                {activeEnvironmentalEffectHudLabel(e)}
              </span>
            ),
          )}
        </div>
      ) : null}

      {member.activeFearStress && member.activeFearStress.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {member.activeFearStress.map((f: ActiveFearStressInstance) => (
            <span
              key={f.instanceId}
              className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-200"
            >
              {activeFearStressHudLabel(f)}
            </span>
          ))}
        </div>
      ) : null}

      {member.activeBurning && member.activeBurning.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {member.activeBurning.map((b: ActiveBurningInstance) => (
            <span
              key={b.instanceId}
              className="rounded border border-orange-500/40 bg-orange-500/10 px-1.5 py-0.5 text-[10px] text-orange-200"
            >
              {activeBurningHudLabel(b)}
            </span>
          ))}
        </div>
      ) : null}

      {member.concentration && (
        <div className="mt-2 text-[10px] text-lore-muted">
          Concentrating: {member.concentration.spell}
        </div>
      )}

      {slotEntries.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {slotEntries.map(([lvl, slot]) => (
            <span
              key={lvl}
              className="rounded border border-lore-border px-1.5 py-0.5 text-[10px] text-lore-muted"
            >
              L{lvl} {slot.current}/{slot.max}
            </span>
          ))}
        </div>
      )}

      {member.deathSaves && (
        <div className="mt-2 text-[10px] text-lore-muted">
          Death saves — ✓{member.deathSaves.successes} ✗{member.deathSaves.failures}
        </div>
      )}
    </div>
  );
}

function EconTick({ label, used }: { label: string; used: boolean }) {
  return (
    <span className={used ? "text-lore-muted line-through" : "text-lore-accent"}>
      {label}
    </span>
  );
}

export function PartyMemberRow({
  member,
  active,
  expandable,
  expanded,
  onToggleExpand,
  onViewSheet,
}: {
  member: EntityState;
  active: boolean;
  expandable: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onViewSheet?: (characterId: string) => void;
}) {
  const pct = hpPercent(member.hp);
  const icon = member.kind === "character" ? "🛡" : "👤";
  const downed = !member.alive;
  const econ = member.actionEconomy;
  const moveLeft = econ ? econ.movement.total - econ.movement.used : undefined;
  const isNpc = member.kind !== "character" || member.id.startsWith("npc:");

  const header = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 font-medium text-lore-text">
          <span aria-hidden>{icon}</span>
          <span className="line-clamp-2">{member.name}</span>
          {isNpc ? (
            <span className="text-[10px] text-lore-muted">NPC</span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {active ? (
            <span
              aria-label="Active turn"
              className="text-[10px] font-semibold uppercase tracking-wide text-lore-accent"
            >
              ▶
            </span>
          ) : null}
          {expandable ? (
            <span className="text-xs text-lore-muted" aria-hidden>
              {expanded ? "▾" : "▸"}
            </span>
          ) : null}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-lore-bg">
        <div
          className={`h-full rounded-full transition-all ${hpBarColor(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-lore-muted">
        <span>
          {downed ? (member.dead ? "Dead" : "Down") : `${member.hp.current}/${member.hp.max} HP`}
        </span>
        {econ ? (
          <span className="flex items-center gap-1.5">
            <EconTick label="A" used={econ.action !== "available"} />
            <EconTick label="B" used={econ.bonusAction !== "available"} />
            <span>{moveLeft}ft</span>
          </span>
        ) : null}
      </div>
      {member.activePoisons?.[0] ? (
        <span className="text-[10px] text-emerald-200 line-clamp-1">
          {activePoisonHudLabel(member.activePoisons[0])}
        </span>
      ) : member.activeCurses?.[0] ? (
        <span className="text-[10px] text-violet-200 line-clamp-1">
          {activeCurseHudLabel(member.activeCurses[0])}
        </span>
      ) : member.activeEnvironmentalEffects?.[0] ? (
        <span className="text-[10px] text-cyan-200 line-clamp-1">
          {activeEnvironmentalEffectHudLabel(member.activeEnvironmentalEffects[0])}
        </span>
      ) : member.activeFearStress?.[0] ? (
        <span className="text-[10px] text-amber-200 line-clamp-1">
          {activeFearStressHudLabel(member.activeFearStress[0])}
        </span>
      ) : member.activeBurning?.[0] ? (
        <span className="text-[10px] text-orange-200 line-clamp-1">
          {activeBurningHudLabel(member.activeBurning[0])}
        </span>
      ) : null}
    </>
  );

  if (expandable) {
    return (
      <li className="rounded-lg border border-lore-border bg-lore-bg">
        <button
          type="button"
          onClick={onToggleExpand}
          className={`flex w-full flex-col gap-1 px-2 py-1.5 text-left text-xs transition-colors ${
            active ? "bg-lore-accent-dim" : ""
          } ${downed ? "opacity-60" : ""}`}
          aria-expanded={expanded}
        >
          {header}
        </button>
        {expanded ? (
          <div className="border-t border-lore-border px-2 py-2">
            <PartyMemberDetail member={member} />
            {onViewSheet ? (
              <button
                type="button"
                onClick={() => onViewSheet(member.id)}
                className="mt-2 text-[11px] text-lore-accent hover:text-lore-text"
              >
                View sheet
              </button>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <li className="group/chip relative">
      <div
        role={onViewSheet ? "button" : undefined}
        tabIndex={onViewSheet ? 0 : undefined}
        onClick={onViewSheet ? () => onViewSheet(member.id) : undefined}
        onKeyDown={
          onViewSheet
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onViewSheet(member.id);
                }
              }
            : undefined
        }
        className={`flex flex-col gap-1 rounded-lg border px-2 py-1.5 text-xs ${
          onViewSheet ? "cursor-pointer" : ""
        } ${
          active
            ? "border-lore-accent bg-lore-accent-dim shadow-[0_0_0_1px_var(--tw-shadow-color)] shadow-lore-accent/40"
            : "border-lore-border bg-lore-surface"
        } ${downed ? "opacity-60" : ""}`}
      >
        {header}
      </div>
      <div className="pointer-events-none absolute left-0 top-0 z-20 hidden w-60 -translate-x-full rounded-lg border border-lore-border bg-lore-surface p-3 shadow-lg group-hover/chip:block">
        <div className="mb-1 font-display text-sm text-lore-text">{member.name}</div>
        <PartyMemberDetail member={member} />
      </div>
    </li>
  );
}
