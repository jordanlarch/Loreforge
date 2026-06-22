"use client";

/**
 * Combat overlay (#58) — the round banner + horizontal initiative tracker that
 * sits above the battle map during an encounter. A pure presentational strip
 * driven by the synced view model.
 */
export type InitiativeChip = {
  id: string;
  name: string;
  isActive: boolean;
  hostile: boolean;
  alive: boolean;
};

export function CombatOverlay({
  round,
  activeName,
  order,
}: {
  round: number;
  activeName: string | undefined;
  order: InitiativeChip[];
}) {
  return (
    <div className="mb-3 rounded-lg border border-lore-border bg-lore-surface px-3 py-2">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-lore-accent-dim px-2 py-0.5 text-xs font-semibold uppercase tracking-widest text-lore-accent">
          Round {round}
        </span>
        {activeName && (
          <span className="text-sm text-lore-muted">
            {activeName}&apos;s turn
          </span>
        )}
      </div>
      <ol className="flex flex-wrap gap-1.5">
        {order.map((c) => (
          <li
            key={c.id}
            className={`flex items-center gap-1 rounded border px-2 py-1 text-xs ${
              c.isActive
                ? "border-lore-accent bg-lore-accent-dim text-lore-text"
                : c.hostile
                  ? "border-red-500/40 text-red-300/80"
                  : "border-lore-border text-lore-muted"
            } ${c.alive ? "" : "opacity-40 line-through"}`}
          >
            {c.isActive && <span aria-hidden>▶</span>}
            {c.name}
          </li>
        ))}
      </ol>
    </div>
  );
}
