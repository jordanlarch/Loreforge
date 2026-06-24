"use client";

import { useEffect } from "react";

import {
  abilityScoreRows,
  formatChallengeRating,
  formatCreatureType,
  formatSize,
  formatSpeedLine,
  namedBlocks,
} from "@/lib/codex-monster-display";
import { trpc } from "@/lib/trpc/client";

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function MonsterDetail({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const monster = trpc.codex.getMonster.useQuery({ slug });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const raw = (monster.data?.raw ?? {}) as Record<string, unknown>;
  const abilities = abilityScoreRows(raw);
  const traits = namedBlocks(raw, "traits");
  const actions = namedBlocks(raw, "actions");

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[6vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="monster-detail-title"
      onClick={onClose}
    >
      <div
        className="mb-8 w-full max-w-2xl rounded-lg border border-lore-border bg-lore-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-lore-border px-5 py-4">
          <div>
            <h2 id="monster-detail-title" className="font-display text-2xl">
              {monster.data?.name ?? "Creature"}
            </h2>
            {monster.data && (
              <p className="mt-1 text-sm capitalize text-lore-muted">
                {[
                  formatSize(monster.data.size),
                  formatCreatureType(monster.data.creatureType),
                  monster.data.alignment,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-lore-border px-2 py-1 text-sm text-lore-muted hover:text-lore-text"
          >
            Close
          </button>
        </header>

        <div className="px-5 py-4">
          {monster.isLoading ? (
            <p className="text-sm text-lore-muted">Loading…</p>
          ) : !monster.data ? (
            <p className="text-sm text-red-400">Creature not found.</p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                <Stat label="Challenge" value={formatChallengeRating(monster.data.challengeRating)} />
                <Stat
                  label="Armor Class"
                  value={
                    monster.data.armorClass != null
                      ? String(monster.data.armorClass)
                      : "—"
                  }
                />
                <Stat
                  label="Hit Points"
                  value={
                    monster.data.hitPoints != null
                      ? String(monster.data.hitPoints)
                      : "—"
                  }
                />
                <Stat label="Speed" value={formatSpeedLine(raw)} className="sm:col-span-2" />
              </dl>

              {abilities.length > 0 && (
                <section className="mt-6">
                  <h3 className="mb-2 text-xs uppercase tracking-widest text-lore-muted">
                    Ability Scores
                  </h3>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {abilities.map((a) => (
                      <div
                        key={a.abbr}
                        className="rounded border border-lore-border bg-lore-surface px-2 py-2 text-center"
                      >
                        <div className="text-[10px] font-bold uppercase tracking-widest text-lore-muted">
                          {a.abbr}
                        </div>
                        <div className="font-display text-lg tabular-nums">
                          {a.score}
                        </div>
                        <div className="text-xs tabular-nums text-lore-muted">
                          {signed(a.mod)}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {traits.length > 0 && (
                <BlockSection title="Traits" items={traits} />
              )}
              {actions.length > 0 && (
                <BlockSection title="Actions" items={actions} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[10px] uppercase tracking-widest text-lore-muted">
        {label}
      </dt>
      <dd className="mt-0.5 text-lore-text">{value}</dd>
    </div>
  );
}

function BlockSection({
  title,
  items,
}: {
  title: string;
  items: { name?: string; desc?: string }[];
}) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-xs uppercase tracking-widest text-lore-muted">
        {title}
      </h3>
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.name}
            className="rounded-lg border border-lore-border bg-lore-surface p-3"
          >
            <div className="text-sm font-medium text-lore-text">{item.name}</div>
            {item.desc && (
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-lore-muted">
                {item.desc}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
