"use client";

import { useMemo, useState } from "react";

import { trpc } from "@/lib/trpc/client";

import {
  LibraryPickerModal,
  PICKER_LIST,
  PICKER_ROW,
  PICKER_SEARCH_INPUT,
} from "./library-picker-modal";

export type CodexMonsterPick = {
  slug: string;
  name: string;
  creatureType: string | null;
  challengeRating: number | null;
};

/** Search Codex monsters for dungeon encounter / patrol authoring (DUN-10). */
export function CodexMonsterAddPicker({
  onPick,
  onClose,
  title = "Add from Codex — Monsters",
}: {
  onPick: (monster: CodexMonsterPick, count: number) => void;
  onClose: () => void;
  title?: string;
}) {
  const [search, setSearch] = useState("");
  const [count, setCount] = useState(2);

  const list = trpc.codex.listMonsters.useQuery(
    {
      search: search.trim() || undefined,
      limit: 48,
      offset: 0,
    },
    { placeholderData: (prev) => prev },
  );

  const monsters = useMemo(() => list.data?.monsters ?? [], [list.data?.monsters]);

  return (
    <LibraryPickerModal title={title} titleId="codex-monster-add-title" onClose={onClose}>
      <div className="mb-3 flex items-center gap-3">
        <label className="text-xs text-lore-muted">
          Count
          <input
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 1)}
            className="ml-2 w-16 rounded border border-lore-border bg-lore-surface px-2 py-1 text-sm"
          />
        </label>
      </div>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search SRD creatures…"
        autoFocus
        className={PICKER_SEARCH_INPUT}
      />

      {list.isLoading ? (
        <p className="text-sm text-lore-muted">Loading creatures…</p>
      ) : monsters.length === 0 ? (
        <p className="text-sm text-lore-muted">No creatures match.</p>
      ) : (
        <ul className={PICKER_LIST}>
          {monsters.map((monster) => (
            <li key={monster.id}>
              <button
                type="button"
                onClick={() =>
                  onPick(
                    {
                      slug: monster.slug,
                      name: monster.name,
                      creatureType: monster.creatureType,
                      challengeRating: monster.challengeRating,
                    },
                    count,
                  )
                }
                className={PICKER_ROW}
              >
                <span>{monster.name}</span>
                <span className="text-xs capitalize text-lore-muted">
                  {monster.creatureType ?? "creature"}
                  {monster.challengeRating != null ? ` · CR ${monster.challengeRating}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-lore-muted">
        Live Play resolves creatures through the engine bestiary when a matching template exists;
        otherwise prose labels are used as a fallback.
      </p>
    </LibraryPickerModal>
  );
}
