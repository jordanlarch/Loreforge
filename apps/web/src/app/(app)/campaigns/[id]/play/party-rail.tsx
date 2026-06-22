"use client";

/**
 * Party rail (PLAY-4, #100) — the slim bottom strip showing every party-side
 * member at a glance. Each chip carries name + HP + (in combat) action-economy
 * ticks; hovering a chip reveals a mini-HUD with abilities, conditions,
 * concentration, and spell slots. The active combatant's chip gets the gold
 * turn pulse. Driven entirely by the synced `WorldState` (the engine is the
 * authority). Read-only sheet peek on click and cross-character assist pulses
 * are deferred follow-ups (see docs/deferrals.md PLAY-4).
 */
import {
  abilityModifier,
  type EntityState,
  type WorldState,
} from "@app/engine";

import { activeMemberId, hpPercent, partyMembers } from "@/lib/live-party";

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

function hpBarColor(pct: number): string {
  if (pct <= 25) return "bg-red-500";
  if (pct <= 50) return "bg-amber-500";
  return "bg-lore-accent";
}

export function PartyRail({ state }: { state: WorldState }) {
  const members = partyMembers(state);
  if (members.length === 0) return null;
  const activeId = activeMemberId(state);

  return (
    <section
      aria-label="Party"
      className="mt-6 rounded-lg border border-lore-border bg-lore-surface px-3 py-2"
    >
      <div className="mb-1.5 text-[10px] uppercase tracking-widest text-lore-muted">
        Party
      </div>
      <ul className="flex flex-wrap gap-2">
        {members.map((m) => (
          <PartyChip key={m.id} member={m} active={m.id === activeId} />
        ))}
      </ul>
    </section>
  );
}

function PartyChip({
  member,
  active,
}: {
  member: EntityState;
  active: boolean;
}) {
  const pct = hpPercent(member.hp);
  const icon = member.kind === "character" ? "🛡" : "👤";
  const downed = !member.alive;

  const econ = member.actionEconomy;
  const moveLeft = econ
    ? econ.movement.total - econ.movement.used
    : undefined;

  return (
    <li className="group/chip relative">
      <div
        className={`flex min-w-[8.5rem] flex-col gap-1 rounded border px-2.5 py-1.5 text-xs transition-colors ${
          active
            ? "border-lore-accent bg-lore-accent-dim shadow-[0_0_0_1px_var(--tw-shadow-color)] shadow-lore-accent/40"
            : "border-lore-border bg-lore-bg"
        } ${downed ? "opacity-60" : ""}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 font-medium text-lore-text">
            <span aria-hidden>{icon}</span>
            <span className="line-clamp-1">{member.name}</span>
            {member.kind !== "character" && (
              <span className="text-[10px] text-lore-muted">NPC</span>
            )}
          </span>
          {active && (
            <span
              aria-label="Active turn"
              className="text-[10px] font-semibold uppercase tracking-wide text-lore-accent"
            >
              ▶
            </span>
          )}
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-lore-surface">
          <div
            className={`h-full rounded-full transition-all ${hpBarColor(pct)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-lore-muted">
          <span>
            {downed ? (member.dead ? "Dead" : "Down") : `${member.hp.current}/${member.hp.max} HP`}
          </span>
          {econ && (
            <span className="flex items-center gap-1.5">
              <EconTick label="A" used={econ.action !== "available"} />
              <EconTick label="B" used={econ.bonusAction !== "available"} />
              <span>{moveLeft}ft</span>
            </span>
          )}
        </div>
      </div>

      <MiniHud member={member} />
    </li>
  );
}

function EconTick({ label, used }: { label: string; used: boolean }) {
  return (
    <span className={used ? "text-lore-muted line-through" : "text-lore-accent"}>
      {label}
    </span>
  );
}

/** The hover popover: a richer at-a-glance read of a party member. */
function MiniHud({ member }: { member: EntityState }) {
  const level = member.classes.reduce((sum, c) => sum + c.level, 0);
  const classLine = member.classes.map((c) => `${c.class} ${c.level}`).join(" / ");
  const slots = member.spellcasting?.slots ?? {};
  const slotEntries = Object.entries(slots);

  return (
    <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-60 rounded-lg border border-lore-border bg-lore-surface p-3 shadow-lg group-hover/chip:block">
      <div className="font-display text-sm leading-tight text-lore-text">
        {member.name}
      </div>
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

      {member.concentration && (
        <div className="mt-2 text-[10px] text-lore-muted">
          🧠 Concentrating: {member.concentration.spell}
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
