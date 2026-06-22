"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { MONSTER_TEMPLATES, MONSTER_TEMPLATE_LIST } from "@app/engine";

import { trpc } from "@/lib/trpc/client";

type FoeRow = { template: string; count: number; name?: string };

type Encounter = {
  id: string;
  name: string;
  foes: FoeRow[];
  active: boolean;
};

/** Max foe rows / total foes — mirrors the router + battle-map seat caps. */
const MAX_ROWS = 8;

/** "2× Goblin, 1× Ogre" — a one-line roster summary from foe rows. */
function foeSummary(foes: FoeRow[]): string {
  if (foes.length === 0) return "No foes";
  return foes
    .map((f) => {
      const name = f.name?.trim() || MONSTER_TEMPLATES[f.template]?.name || f.template;
      return `${f.count}× ${name}`;
    })
    .join(", ");
}

/**
 * Combat tab (#115, CAMP-8): author named encounters from a small monster
 * catalog and **Run Now** to seed them into Live Play. Removes the goblin-only
 * fixture wall — an authored encounter arms the campaign and the live room seeds
 * its foes on the next load.
 */
export function CombatTab({ campaignId }: { campaignId: string }) {
  const utils = trpc.useUtils();
  const router = useRouter();
  const encounters = trpc.campaigns.encounters.useQuery({ campaignId });

  async function refresh() {
    await utils.campaigns.encounters.invalidate({ campaignId });
  }

  const run = trpc.campaigns.runEncounter.useMutation({
    onSuccess: () => router.push(`/campaigns/${campaignId}/play`),
  });
  const remove = trpc.campaigns.deleteEncounter.useMutation({
    onSuccess: refresh,
  });

  const list = (encounters.data ?? []) as Encounter[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Combat</h2>
      </div>
      <p className="-mt-3 text-sm text-lore-muted">
        Build an encounter, then <strong>Run Now</strong> to drop it onto the
        battle map. Running an encounter starts a fresh fight (it replaces the
        current one).
      </p>

      <NewEncounterForm campaignId={campaignId} onCreated={refresh} />

      {encounters.isLoading ? (
        <p className="text-sm text-lore-muted">Loading encounters…</p>
      ) : list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-lore-border p-8 text-center text-sm text-lore-muted">
          No encounters yet. Build one above — until you run one, Live Play uses
          the default goblin ambush.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((enc) => (
            <li
              key={enc.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-lore-border bg-lore-surface p-4"
            >
              <div className="min-w-[12rem] flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg text-lore-text">
                    {enc.name}
                  </span>
                  {enc.active && (
                    <span className="rounded border border-lore-accent px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-lore-accent">
                      Armed
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-lore-muted">
                  {foeSummary(enc.foes)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    run.mutate({ campaignId, encounterId: enc.id })
                  }
                  disabled={run.isPending}
                  className="rounded border border-lore-accent bg-lore-accent px-3 py-1.5 text-sm font-semibold text-lore-bg transition-colors disabled:opacity-40"
                >
                  {run.isPending ? "Starting…" : "Run Now"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    remove.mutate({ campaignId, encounterId: enc.id })
                  }
                  disabled={remove.isPending}
                  className="text-sm text-lore-muted transition-colors hover:text-red-400 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewEncounterForm({
  campaignId,
  onCreated,
}: {
  campaignId: string;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [rows, setRows] = useState<FoeRow[]>([
    { template: MONSTER_TEMPLATE_LIST[0]!.slug, count: 1 },
  ]);
  const create = trpc.campaigns.createEncounter.useMutation({
    onSuccess: async () => {
      setName("");
      setRows([{ template: MONSTER_TEMPLATE_LIST[0]!.slug, count: 1 }]);
      await onCreated();
    },
  });

  function setRow(i: number, patch: Partial<FoeRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0 || rows.length === 0) return;
    create.mutate({
      campaignId,
      name: trimmed,
      foes: rows.map((r) => ({
        template: r.template,
        count: r.count,
        ...(r.name?.trim() ? { name: r.name.trim() } : {}),
      })),
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-lg border border-lore-border bg-lore-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-lore-muted">
          New encounter
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Encounter name (e.g. Cellar Ambush)"
          maxLength={120}
          className="min-w-[14rem] flex-1 rounded border border-lore-border bg-lore-bg px-3 py-1.5 text-sm outline-none focus:border-lore-accent"
        />
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select
              value={row.template}
              onChange={(e) => setRow(i, { template: e.target.value })}
              className="rounded border border-lore-border bg-lore-bg px-3 py-1.5 text-sm outline-none focus:border-lore-accent"
            >
              {MONSTER_TEMPLATE_LIST.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name} (HP {t.maxHp}, AC {t.baseAc})
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-sm text-lore-muted">
              ×
              <input
                type="number"
                min={1}
                max={8}
                value={row.count}
                onChange={(e) =>
                  setRow(i, {
                    count: Math.max(1, Math.min(8, Number(e.target.value) || 1)),
                  })
                }
                className="w-16 rounded border border-lore-border bg-lore-bg px-2 py-1.5 text-sm outline-none focus:border-lore-accent"
              />
            </label>
            <input
              value={row.name ?? ""}
              onChange={(e) => setRow(i, { name: e.target.value })}
              placeholder="Name override (optional)"
              maxLength={60}
              className="min-w-[10rem] flex-1 rounded border border-lore-border bg-lore-bg px-3 py-1.5 text-sm outline-none focus:border-lore-accent"
            />
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-sm text-lore-muted transition-colors hover:text-red-400"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() =>
            setRows((prev) =>
              prev.length >= MAX_ROWS
                ? prev
                : [...prev, { template: MONSTER_TEMPLATE_LIST[0]!.slug, count: 1 }],
            )
          }
          disabled={rows.length >= MAX_ROWS}
          className="rounded border border-lore-border px-3 py-1.5 text-sm text-lore-muted transition-colors hover:border-lore-accent disabled:opacity-40"
        >
          + Add foe
        </button>
        <button
          type="submit"
          disabled={create.isPending || name.trim().length === 0}
          className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
        >
          {create.isPending ? "Saving…" : "Save encounter"}
        </button>
      </div>
    </form>
  );
}
