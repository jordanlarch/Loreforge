"use client";

import Link from "next/link";
import { useState } from "react";

import { trpc } from "@/lib/trpc/client";
import type { CharacterSpell, EquipmentItem } from "@/lib/character";
import {
  codexSpellToCharacterSpell,
  equipmentKey,
  smithyItemToEquipment,
  smithySpellToCharacterSpell,
  spellKey,
} from "@/lib/character-library";

import {
  LibraryPickerModal,
  PICKER_LIST,
  PICKER_ROW,
  PICKER_SEARCH_INPUT,
} from "./library-picker-modal";

function spellLevelBadge(level: number | string): string {
  const n = typeof level === "string" ? Number(level) : level;
  return n === 0 ? "Cantrip" : `Lvl ${n}`;
}

/** Search Codex spells and add one to a character spellbook. */
export function CodexSpellAddPicker({
  existing,
  onAdd,
  onClose,
}: {
  existing: readonly CharacterSpell[];
  onAdd: (spell: CharacterSpell) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const list = trpc.codex.listSpells.useQuery(
    { search: search || undefined, limit: 24, offset: 0 },
    { placeholderData: (prev) => prev },
  );

  const existingKeys = new Set(existing.map(spellKey));

  function pick(spell: {
    name: string;
    level: string | null;
    school: string | null;
  }) {
    const next = codexSpellToCharacterSpell(spell);
    if (existingKeys.has(spellKey(next))) {
      setNotice(`${next.name} is already on this character.`);
      return;
    }
    onAdd(next);
    onClose();
  }

  return (
    <LibraryPickerModal
      title="Add from Codex"
      titleId="codex-spell-add-title"
      onClose={onClose}
    >
      <input
        type="search"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setNotice(null);
        }}
        placeholder="Search SRD spells…"
        autoFocus
        className={PICKER_SEARCH_INPUT}
      />

      {notice && <p className="mb-3 text-sm text-amber-400">{notice}</p>}

      {list.isLoading ? (
        <p className="text-sm text-lore-muted">Loading spells…</p>
      ) : (list.data?.spells.length ?? 0) === 0 ? (
        <p className="text-sm text-lore-muted">No spells match.</p>
      ) : (
        <ul className={PICKER_LIST}>
          {list.data!.spells.map((spell) => (
            <li key={spell.slug}>
              <button
                type="button"
                onClick={() => pick(spell)}
                className={PICKER_ROW}
              >
                <span>{spell.name}</span>
                <span className="text-xs capitalize text-lore-muted">
                  {spellLevelBadge(spell.level ?? "0")} · {spell.school ?? "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-lore-muted">
        Adds the spell to this character&apos;s spellbook.{" "}
        <Link href="/codex" className="text-lore-accent hover:underline">
          Browse Codex
        </Link>
      </p>
    </LibraryPickerModal>
  );
}

/** Search Smithy grimoire and add a homebrew spell to the character. */
export function SmithySpellAddPicker({
  existing,
  onAdd,
  onClose,
}: {
  existing: readonly CharacterSpell[];
  onAdd: (spell: CharacterSpell) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const list = trpc.smithy.listSpells.useQuery(undefined, {
    placeholderData: (prev) => prev,
  });

  const existingKeys = new Set(existing.map(spellKey));
  const filtered =
    list.data?.filter((spell) =>
      search
        ? spell.name.toLowerCase().includes(search.toLowerCase())
        : true,
    ) ?? [];

  function pick(spell: { name: string; level: number; school: string }) {
    const next = smithySpellToCharacterSpell(spell);
    if (existingKeys.has(spellKey(next))) {
      setNotice(`${next.name} is already on this character.`);
      return;
    }
    onAdd(next);
    onClose();
  }

  return (
    <LibraryPickerModal
      title="Add from Smithy"
      titleId="smithy-spell-add-title"
      onClose={onClose}
    >
      <input
        type="search"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setNotice(null);
        }}
        placeholder="Search your grimoire…"
        autoFocus
        className={PICKER_SEARCH_INPUT}
      />

      {notice && <p className="mb-3 text-sm text-amber-400">{notice}</p>}

      {list.isLoading ? (
        <p className="text-sm text-lore-muted">Loading spells…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-lore-muted">
          {list.data?.length === 0
            ? "No homebrew spells yet — inscribe one in the Smithy first."
            : "No spells match."}
        </p>
      ) : (
        <ul className={PICKER_LIST}>
          {filtered.map((spell) => (
            <li key={spell.id}>
              <button
                type="button"
                onClick={() => pick(spell)}
                className={PICKER_ROW}
              >
                <span>{spell.name}</span>
                <span className="text-xs capitalize text-lore-muted">
                  {spellLevelBadge(spell.level)} · {spell.school}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-lore-muted">
        Adds a copy to this character&apos;s spellbook.{" "}
        <Link href="/smithy" className="text-lore-accent hover:underline">
          Open Smithy
        </Link>
      </p>
    </LibraryPickerModal>
  );
}

/** Search Smithy items and equip one on the character. */
export function SmithyItemAddPicker({
  existing,
  onAdd,
  onClose,
}: {
  existing: readonly EquipmentItem[];
  onAdd: (item: EquipmentItem) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const list = trpc.smithy.list.useQuery(undefined, {
    placeholderData: (prev) => prev,
  });

  const existingKeys = new Set(existing.map(equipmentKey));
  const filtered =
    list.data?.filter((item) =>
      search ? item.name.toLowerCase().includes(search.toLowerCase()) : true,
    ) ?? [];

  function pick(item: Parameters<typeof smithyItemToEquipment>[0]) {
    const next = smithyItemToEquipment(item);
    if (existingKeys.has(equipmentKey(next))) {
      setNotice(`${next.name} is already on this character.`);
      return;
    }
    onAdd(next);
    onClose();
  }

  return (
    <LibraryPickerModal
      title="Add from Smithy"
      titleId="smithy-item-add-title"
      onClose={onClose}
    >
      <input
        type="search"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setNotice(null);
        }}
        placeholder="Search your forged items…"
        autoFocus
        className={PICKER_SEARCH_INPUT}
      />

      {notice && <p className="mb-3 text-sm text-amber-400">{notice}</p>}

      {list.isLoading ? (
        <p className="text-sm text-lore-muted">Loading items…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-lore-muted">
          {list.data?.length === 0
            ? "No homebrew items yet — forge one in the Smithy first."
            : "No items match."}
        </p>
      ) : (
        <ul className={PICKER_LIST}>
          {filtered.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => pick(item)}
                className={PICKER_ROW}
              >
                <span>{item.name}</span>
                <span className="text-xs capitalize text-lore-muted">
                  {item.type} · {item.rarity}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-lore-muted">
        Codex equipment isn&apos;t ingested yet — Smithy items only for now.{" "}
        <Link href="/smithy" className="text-lore-accent hover:underline">
          Open Smithy
        </Link>
      </p>
    </LibraryPickerModal>
  );
}
