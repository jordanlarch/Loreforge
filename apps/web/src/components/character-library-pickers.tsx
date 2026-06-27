"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  isSpellEligibleForCharacter,
  maxCastableSpellLevel,
  spellcastingClasses,
  type ClassLevel,
} from "@app/engine";

import { trpc } from "@/lib/trpc/client";
import type { CharacterSpell, EquipmentItem } from "@/lib/character";
import {
  codexItemToEquipment,
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

type LevelFilter = "all" | string;

/** Search Codex spells and add one to a character spellbook (CHAR-SPELL-GATE). */
export function CodexSpellAddPicker({
  existing,
  characterClasses,
  onAdd,
  onClose,
}: {
  existing: readonly CharacterSpell[];
  /** When set, only spells eligible for these classes/levels are shown. */
  characterClasses?: readonly ClassLevel[];
  onAdd: (spell: CharacterSpell) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const casters = useMemo(
    () => (characterClasses ? spellcastingClasses(characterClasses) : []),
    [characterClasses],
  );
  const maxLevel = useMemo(
    () =>
      characterClasses ? maxCastableSpellLevel(characterClasses) : 9,
    [characterClasses],
  );
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [spellClassFilter, setSpellClassFilter] = useState<string>(
    () => casters[0] ?? "",
  );

  const queryLevel =
    levelFilter === "all" ? undefined : levelFilter;
  const queryClass =
    spellClassFilter && casters.includes(spellClassFilter)
      ? spellClassFilter
      : casters[0];

  const list = trpc.codex.listSpells.useQuery(
    {
      search: search.trim() || undefined,
      level: queryLevel,
      spellClass: characterClasses?.length ? queryClass : undefined,
      sortBy: "name",
      sortDir: "asc",
      limit: 48,
      offset: 0,
    },
    {
      placeholderData: (prev) => prev,
      enabled: !characterClasses?.length || casters.length > 0,
    },
  );

  const existingKeys = new Set(existing.map(spellKey));

  const visibleSpells = useMemo(() => {
    const rows = list.data?.spells ?? [];
    if (!characterClasses?.length) return rows;
    return rows.filter((spell) =>
      isSpellEligibleForCharacter(spell, characterClasses),
    );
  }, [characterClasses, list.data?.spells]);

  const levelOptions = useMemo(() => {
    const opts: { id: LevelFilter; label: string }[] = [
      { id: "all", label: "All" },
      { id: "0", label: "Cantrip" },
    ];
    for (let l = 1; l <= maxLevel; l++) {
      opts.push({ id: String(l), label: `Level ${l}` });
    }
    return opts;
  }, [maxLevel]);

  function pick(spell: {
    name: string;
    level: string | null;
    school: string | null;
    slug: string;
    concentration?: boolean;
    ritual?: boolean;
    classes?: string[] | null;
  }) {
    if (
      characterClasses?.length &&
      !isSpellEligibleForCharacter(spell, characterClasses)
    ) {
      setNotice(`${spell.name} is not on your class spell list at this level.`);
      return;
    }
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
      {characterClasses && casters.length === 0 ? (
        <p className="text-sm text-lore-muted">
          This character has no spellcasting class — add spells after taking a
          caster level.
        </p>
      ) : (
        <>
          {casters.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="text-xs uppercase tracking-wide text-lore-muted">
                Class
              </label>
              <select
                value={spellClassFilter}
                onChange={(e) => {
                  setSpellClassFilter(e.target.value);
                  setNotice(null);
                }}
                className="rounded border border-lore-border bg-lore-bg px-2 py-1 text-sm text-lore-text"
              >
                {casters.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="text-xs text-lore-muted">
                Up to level {maxLevel || "cantrip only"}
              </span>
            </div>
          )}

          <div className="mb-3 flex flex-wrap gap-1.5">
            {levelOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setLevelFilter(opt.id);
                  setNotice(null);
                }}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  levelFilter === opt.id
                    ? "border-lore-accent bg-lore-accent-dim text-lore-text"
                    : "border-lore-border text-lore-muted hover:text-lore-text"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setNotice(null);
            }}
            placeholder="Search spells by name…"
            autoFocus
            className={PICKER_SEARCH_INPUT}
          />

          {notice && <p className="mb-3 text-sm text-amber-400">{notice}</p>}

          {list.isLoading ? (
            <p className="text-sm text-lore-muted">Loading spells…</p>
          ) : visibleSpells.length === 0 ? (
            <p className="text-sm text-lore-muted">
              No eligible spells match. Try another level or search term.
            </p>
          ) : (
            <ul className={PICKER_LIST}>
              {visibleSpells.map((spell) => (
                <li key={spell.slug}>
                  <button
                    type="button"
                    onClick={() => pick(spell)}
                    className={PICKER_ROW}
                  >
                    <span>{spell.name}</span>
                    <span className="text-xs capitalize text-lore-muted">
                      {spell.concentration ? "C · " : ""}
                      {spell.ritual ? "R · " : ""}
                      {spellLevelBadge(spell.level ?? "0")} ·{" "}
                      {spell.school ?? "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="mt-4 text-xs text-lore-muted">
        Only spells on your class list at a level you can cast are shown.{" "}
        <Link href="/codex/spells" className="text-lore-accent hover:underline">
          Browse Codex
        </Link>
      </p>
    </LibraryPickerModal>
  );
}

/** Search Codex equipment and add one to a character loadout (SMITH-5). */
export function CodexItemAddPicker({
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

  const list = trpc.codex.listItems.useQuery(
    { search: search || undefined, limit: 24, offset: 0 },
    { placeholderData: (prev) => prev },
  );

  const existingKeys = new Set(existing.map(equipmentKey));

  function pick(item: {
    name: string;
    slug: string;
    category?: string | null;
    weight?: string | null;
    description?: string | null;
  }) {
    const next = codexItemToEquipment({ ...item, slug: item.slug });
    if (existingKeys.has(equipmentKey(next))) {
      setNotice(`${next.name} is already on this character.`);
      return;
    }
    onAdd(next);
    onClose();
  }

  return (
    <LibraryPickerModal
      title="Add from Codex"
      titleId="codex-item-add-title"
      onClose={onClose}
    >
      <input
        type="search"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setNotice(null);
        }}
        placeholder="Search SRD gear…"
        autoFocus
        className={PICKER_SEARCH_INPUT}
      />

      {notice && <p className="mb-3 text-sm text-amber-400">{notice}</p>}

      {list.isLoading ? (
        <p className="text-sm text-lore-muted">Loading items…</p>
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <p className="text-sm text-lore-muted">No items match.</p>
      ) : (
        <ul className={PICKER_LIST}>
          {list.data!.items.map((item) => (
            <li key={item.slug}>
              <button
                type="button"
                onClick={() => pick(item)}
                className={PICKER_ROW}
              >
                <span>{item.name}</span>
                <span className="text-xs capitalize text-lore-muted">
                  {item.category ?? "gear"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-lore-muted">
        Adds gear to this character&apos;s inventory.{" "}
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
