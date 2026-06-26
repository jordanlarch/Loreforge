"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  MONSTER_TEMPLATES,
  MONSTER_TEMPLATE_LIST,
  ENCOUNTER_MAP_PRESET_LIST,
  rateEncounter,
  totalLevel,
  type EncounterDifficulty,
  type EncounterMapPresetId,
} from "@app/engine";

import { trpc } from "@/lib/trpc/client";

type FoeRow = { template: string; count: number; name?: string };

const MAX_ROWS = 8;

function foeSummary(foes: FoeRow[]): string {
  if (foes.length === 0) return "No foes";
  return foes
    .map((f) => {
      const name = f.name?.trim() || MONSTER_TEMPLATES[f.template]?.name || f.template;
      return `${f.count}× ${name}`;
    })
    .join(", ");
}

function foeXps(foes: FoeRow[]): number[] {
  const xps: number[] = [];
  for (const row of foes) {
    const xp = MONSTER_TEMPLATES[row.template]?.xp ?? 0;
    for (let i = 0; i < row.count; i += 1) xps.push(xp);
  }
  return xps;
}

const DIFFICULTY_STYLE: Record<EncounterDifficulty, { label: string; cls: string }> = {
  trivial: { label: "Trivial", cls: "border-lore-border text-lore-muted" },
  easy: { label: "Easy", cls: "border-emerald-500/60 text-emerald-400" },
  medium: { label: "Medium", cls: "border-amber-500/60 text-amber-400" },
  hard: { label: "Hard", cls: "border-orange-500/60 text-orange-400" },
  deadly: { label: "Deadly", cls: "border-red-500/60 text-red-400" },
  unknown: { label: "No party", cls: "border-lore-border text-lore-muted" },
};

/**
 * Stub-scoped encounter authoring + Test in Play (CAMP-UX UX-4).
 */
export function StubEncounterPanel({
  campaignId,
  entityId,
  entityName,
  defaultExpanded = false,
}: {
  campaignId: string;
  entityId: string;
  entityName: string;
  defaultExpanded?: boolean;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(defaultExpanded);
  const [name, setName] = useState(`${entityName} encounter`);
  const [mapPreset, setMapPreset] = useState<EncounterMapPresetId>("ambush");
  const [rows, setRows] = useState<FoeRow[]>([
    { template: MONSTER_TEMPLATE_LIST[0]!.slug, count: 1 },
  ]);

  const party = trpc.campaigns.party.useQuery({ campaignId });
  const list = trpc.campaigns.encountersForEntity.useQuery(
    { campaignId, entityId },
    { enabled: open },
  );

  const partyLevels = useMemo(
    () =>
      (party.data ?? [])
        .filter((m) => m.status !== "bench")
        .map((m) => Math.max(1, totalLevel(m.classes ?? []))),
    [party.data],
  );

  const rating = useMemo(
    () => rateEncounter(partyLevels, foeXps(rows)),
    [partyLevels, rows],
  );

  const create = trpc.campaigns.createEncounter.useMutation({
    onSuccess: async () => {
      await utils.campaigns.encountersForEntity.invalidate({ campaignId, entityId });
      setRows([{ template: MONSTER_TEMPLATE_LIST[0]!.slug, count: 1 }]);
    },
  });

  const run = trpc.campaigns.runEncounter.useMutation({
    onSuccess: (_data, { encounterId }) => {
      router.push(
        `/campaigns/${campaignId}/play?arm=${encodeURIComponent(encounterId)}&enter=${encodeURIComponent(entityId)}`,
      );
    },
  });

  const remove = trpc.campaigns.deleteEncounter.useMutation({
    onSuccess: async () => {
      await utils.campaigns.encountersForEntity.invalidate({ campaignId, entityId });
    },
  });

  function setRow(i: number, patch: Partial<FoeRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  return (
    <div className="mt-2 border-t border-lore-border pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-lore-accent underline"
      >
        {open ? "Hide encounters" : "Encounters on this stub"}
      </button>

      {open ? (
        <div className="mt-2 flex flex-col gap-3 rounded border border-lore-border bg-lore-bg/50 p-3">
          {(list.data ?? []).length > 0 ? (
            <ul className="flex flex-col gap-2">
              {list.data!.map((enc) => (
                <li
                  key={enc.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-medium text-lore-text">{enc.name}</span>
                    <span className="ml-2 text-lore-muted">{foeSummary(enc.foes)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        run.mutate({ campaignId, encounterId: enc.id })
                      }
                      disabled={run.isPending}
                      className="rounded border border-lore-accent px-2 py-0.5 text-lore-accent"
                    >
                      Test in Play
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        remove.mutate({ campaignId, encounterId: enc.id })
                      }
                      className="text-lore-muted hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-lore-muted">No encounters on this stub yet.</p>
          )}

          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = name.trim();
              if (!trimmed || rows.length === 0) return;
              create.mutate({
                campaignId,
                name: trimmed,
                mapPreset,
                sourceEntityId: entityId,
                foes: rows.map((r) => ({
                  template: r.template,
                  count: r.count,
                  ...(r.name?.trim() ? { name: r.name.trim() } : {}),
                })),
              });
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Encounter name"
              className="rounded border border-lore-border bg-lore-bg px-2 py-1 text-xs outline-none focus:border-lore-accent"
            />
            <select
              value={mapPreset}
              onChange={(e) => setMapPreset(e.target.value as EncounterMapPresetId)}
              className="rounded border border-lore-border bg-lore-bg px-2 py-1 text-xs"
            >
              {ENCOUNTER_MAP_PRESET_LIST.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            {rows.map((row, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1">
                <select
                  value={row.template}
                  onChange={(e) => setRow(i, { template: e.target.value })}
                  className="rounded border border-lore-border bg-lore-bg px-2 py-1 text-xs"
                >
                  {MONSTER_TEMPLATE_LIST.map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
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
                  className="w-12 rounded border border-lore-border bg-lore-bg px-1 py-1 text-xs"
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setRows((prev) =>
                    prev.length >= MAX_ROWS
                      ? prev
                      : [...prev, { template: MONSTER_TEMPLATE_LIST[0]!.slug, count: 1 }],
                  )
                }
                className="text-xs text-lore-muted underline"
              >
                + foe
              </button>
              <button
                type="submit"
                disabled={create.isPending}
                className="rounded border border-lore-accent px-2 py-0.5 text-xs text-lore-text"
              >
                Save encounter
              </button>
              <span
                className={`ml-auto rounded border px-1 text-[10px] ${DIFFICULTY_STYLE[rating.difficulty].cls}`}
              >
                {DIFFICULTY_STYLE[rating.difficulty].label}
              </span>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
