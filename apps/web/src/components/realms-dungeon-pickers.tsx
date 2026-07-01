"use client";

import { useMemo, useState } from "react";

import type { ToolboxTopic } from "@app/engine";

import { formatToolboxTopic } from "@/lib/codex-toolbox-display";
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

export type CodexItemPick = {
  slug: string;
  name: string;
  category: string | null;
};

export type CodexToolboxPick = {
  slug: string;
  name: string;
  topic: ToolboxTopic;
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

/** Search Codex items for dungeon room treasure (DUN-11). */
export function CodexItemAddPicker({
  onPick,
  onClose,
  title = "Add from Codex — Items",
}: {
  onPick: (item: CodexItemPick) => void;
  onClose: () => void;
  title?: string;
}) {
  const [search, setSearch] = useState("");

  const list = trpc.codex.listItems.useQuery(
    {
      search: search.trim() || undefined,
      limit: 48,
      offset: 0,
    },
    { placeholderData: (prev) => prev },
  );

  const items = useMemo(() => list.data?.items ?? [], [list.data?.items]);

  return (
    <LibraryPickerModal title={title} titleId="codex-item-add-dungeon-title" onClose={onClose}>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search SRD gear and treasure…"
        autoFocus
        className={PICKER_SEARCH_INPUT}
      />

      {list.isLoading ? (
        <p className="text-sm text-lore-muted">Loading items…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-lore-muted">No items match.</p>
      ) : (
        <ul className={PICKER_LIST}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() =>
                  onPick({
                    slug: item.slug,
                    name: item.name,
                    category: item.category,
                  })
                }
                className={PICKER_ROW}
              >
                <span>{item.name}</span>
                <span className="text-xs capitalize text-lore-muted">
                  {item.category ?? "item"}
                  {item.cost ? ` · ${item.cost}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </LibraryPickerModal>
  );
}

/** Search Codex Gameplay Toolbox entries for dungeon prep (DUN-11). */
export function CodexToolboxAddPicker({
  topic,
  onPick,
  onClose,
  title,
}: {
  topic: ToolboxTopic;
  onPick: (entry: CodexToolboxPick) => void;
  onClose: () => void;
  title?: string;
}) {
  const [search, setSearch] = useState("");

  const list = trpc.codex.listToolboxEntries.useQuery(
    {
      topic,
      search: search.trim() || undefined,
    },
    { placeholderData: (prev) => prev },
  );

  const entries = useMemo(() => list.data ?? [], [list.data]);
  const modalTitle = title ?? `Add from Codex — ${formatToolboxTopic(topic)}`;

  return (
    <LibraryPickerModal
      title={modalTitle}
      titleId="codex-toolbox-add-dungeon-title"
      onClose={onClose}
    >
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search ${formatToolboxTopic(topic).toLowerCase()}…`}
        autoFocus
        className={PICKER_SEARCH_INPUT}
      />

      {list.isLoading ? (
        <p className="text-sm text-lore-muted">Loading entries…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-lore-muted">No entries match.</p>
      ) : (
        <ul className={PICKER_LIST}>
          {entries.map((entry) => (
            <li key={entry.slug}>
              <button
                type="button"
                onClick={() =>
                  onPick({
                    slug: entry.slug,
                    name: entry.name,
                    topic: entry.topic as ToolboxTopic,
                  })
                }
                className={PICKER_ROW}
              >
                <span>{entry.name}</span>
                {entry.description ? (
                  <span className="line-clamp-1 text-xs text-lore-muted">{entry.description}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </LibraryPickerModal>
  );
}

/** Pick a related Realms NPC for dungeon map placement (DUN-12). */
export function RealmsNpcAddPicker({
  npcs,
  onPick,
  onClose,
  title = "Place NPC on map",
}: {
  npcs: readonly { id: string; name: string; summary?: string | null }[];
  onPick: (npc: { npcEntityId: string; label: string }) => void;
  onClose: () => void;
  title?: string;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return npcs;
    return npcs.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        (n.summary ?? "").toLowerCase().includes(q),
    );
  }, [npcs, search]);

  return (
    <LibraryPickerModal title={title} titleId="realms-npc-add-dungeon-title" onClose={onClose}>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search linked NPCs…"
        autoFocus
        className={PICKER_SEARCH_INPUT}
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-lore-muted">
          No linked NPCs. Add NPC relationships on this dungeon first.
        </p>
      ) : (
        <ul className={PICKER_LIST}>
          {filtered.map((npc) => (
            <li key={npc.id}>
              <button
                type="button"
                onClick={() =>
                  onPick({ npcEntityId: npc.id, label: npc.name })
                }
                className={PICKER_ROW}
              >
                <span>{npc.name}</span>
                {npc.summary ? (
                  <span className="line-clamp-1 text-xs text-lore-muted">{npc.summary}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </LibraryPickerModal>
  );
}
