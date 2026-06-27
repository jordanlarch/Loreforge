"use client";

import Link from "next/link";
import { useState } from "react";

import { totalLevel } from "@app/engine";

import type { SpellLoadout } from "@/lib/character";
import {
  mergeEquippedSmithyItem,
  mergePreparedSmithySpell,
} from "@/lib/character-library";
import { trpc } from "@/lib/trpc/client";

import {
  LibraryPickerModal,
  PICKER_LIST,
  PICKER_ROW,
} from "./library-picker-modal";

function CharacterPickerModal({
  title,
  onClose,
  onPick,
  pending,
}: {
  title: string;
  onClose: () => void;
  onPick: (characterId: string) => void;
  pending: boolean;
}) {
  const list = trpc.characters.listDashboard.useQuery();

  return (
    <LibraryPickerModal
      title={title}
      titleId="smithy-character-picker-title"
      onClose={onClose}
      overlayClassName="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
    >
      {list.isLoading ? (
        <p className="text-sm text-lore-muted">Loading characters…</p>
      ) : (list.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-lore-muted">
          No library characters yet.{" "}
          <Link href="/characters/new" className="text-lore-accent hover:underline">
            Create one
          </Link>
        </p>
      ) : (
        <ul className={PICKER_LIST}>
          {list.data!.map(({ character }) => (
            <li key={character.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onPick(character.id)}
                className={PICKER_ROW}
              >
                <span>{character.name}</span>
                <span className="text-xs text-lore-muted">
                  Level {totalLevel(character.classes)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </LibraryPickerModal>
  );
}

const CARD_ACTION =
  "text-xs text-lore-accent transition-colors hover:underline disabled:opacity-40";

/** Browse-card action: prepare a Smithy spell on a character (SMITH-3). */
export function SmithyPrepareOnCharacterAction({
  spellId,
  spellName,
  onApplied,
}: {
  spellId: string;
  spellName: string;
  onApplied?: (message: string) => void;
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);

  const update = trpc.characters.update.useMutation({
    onSuccess: async (row) => {
      await Promise.all([
        utils.characters.get.invalidate({ id: row.id }),
        utils.characters.listDashboard.invalidate(),
      ]);
      setOpen(false);
      onApplied?.(`Prepared ${spellName} on ${row.name}.`);
    },
  });

  async function onPick(characterId: string) {
    const [row, spell] = await Promise.all([
      utils.characters.get.fetch({ id: characterId }),
      utils.smithy.getSpell.fetch({ id: spellId }),
    ]);
    if (!row) return;
    if (!spell) return;

    const loadout = (row.spells as SpellLoadout | null) ?? {
      spells: [],
      slots: {},
    };
    await update.mutateAsync({
      id: characterId,
      spells: mergePreparedSmithySpell(loadout, {
        name: spell.name,
        level: spell.level,
        school: spell.school,
        concentration: spell.definition.concentration,
        ritual: spell.definition.ritual,
      }),
    });
  }

  return (
    <>
      <button
        type="button"
        className={CARD_ACTION}
        disabled={update.isPending}
        onClick={() => setOpen(true)}
      >
        {update.isPending ? "Saving…" : "Use in character"}
      </button>
      {open ? (
        <CharacterPickerModal
          title={`Prepare ${spellName} on…`}
          onClose={() => setOpen(false)}
          onPick={onPick}
          pending={update.isPending}
        />
      ) : null}
    </>
  );
}

/** Browse-card action: equip a Smithy item on a character (SMITH-3). */
export function SmithyEquipOnCharacterAction({
  itemId,
  itemName,
  onApplied,
}: {
  itemId: string;
  itemName: string;
  onApplied?: (message: string) => void;
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);

  const update = trpc.characters.update.useMutation({
    onSuccess: async (row) => {
      await Promise.all([
        utils.characters.get.invalidate({ id: row.id }),
        utils.characters.listDashboard.invalidate(),
      ]);
      setOpen(false);
      onApplied?.(`Equipped ${itemName} on ${row.name}.`);
    },
  });

  async function onPick(characterId: string) {
    const [row, item] = await Promise.all([
      utils.characters.get.fetch({ id: characterId }),
      utils.smithy.get.fetch({ id: itemId }),
    ]);
    if (!row || !item) return;

    const equipment = row.equipment ?? [];
    await update.mutateAsync({
      id: characterId,
      equipment: mergeEquippedSmithyItem(equipment, item),
    });
  }

  return (
    <>
      <button
        type="button"
        className={CARD_ACTION}
        disabled={update.isPending}
        onClick={() => setOpen(true)}
      >
        {update.isPending ? "Saving…" : "Use in character"}
      </button>
      {open ? (
        <CharacterPickerModal
          title={`Equip ${itemName} to…`}
          onClose={() => setOpen(false)}
          onPick={onPick}
          pending={update.isPending}
        />
      ) : null}
    </>
  );
}
