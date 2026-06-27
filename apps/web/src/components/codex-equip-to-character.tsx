"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { totalLevel } from "@app/engine";

import type { SpellLoadout } from "@/lib/character";
import {
  mergeEquippedCodexItem,
  mergePreparedCodexSpell,
  type CodexItemRow,
} from "@/lib/character-library";
import { trpc } from "@/lib/trpc/client";

import {
  LibraryPickerModal,
  PICKER_LIST,
  PICKER_ROW,
} from "./library-picker-modal";

const BTN_PRIMARY =
  "rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50";

type CodexSpellEquip = {
  slug: string;
  name: string;
  level: string | null;
  school: string | null;
  concentration?: boolean;
  ritual?: boolean;
};

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
      titleId="codex-character-picker-title"
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

export function CodexPrepareOnCharacterButton({
  spell,
  onApplied,
}: {
  spell: CodexSpellEquip;
  onApplied?: () => void;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const update = trpc.characters.update.useMutation({
    onSuccess: async (row) => {
      await Promise.all([
        utils.characters.get.invalidate({ id: row.id }),
        utils.characters.listDashboard.invalidate(),
      ]);
      setOpen(false);
      setNotice(`Prepared ${spell.name} on ${row.name}.`);
      onApplied?.();
      router.push(`/characters/${row.id}`);
    },
  });

  async function onPick(characterId: string) {
    setNotice(null);
    const row = await utils.characters.get.fetch({ id: characterId });
    if (!row) {
      setNotice("Character not found.");
      return;
    }
    const loadout = (row.spells as SpellLoadout | null) ?? {
      spells: [],
      slots: {},
    };
    await update.mutateAsync({
      id: characterId,
      spells: mergePreparedCodexSpell(loadout, { ...spell, slug: spell.slug }),
    });
  }

  return (
    <>
      <button
        type="button"
        className={BTN_PRIMARY}
        disabled={update.isPending}
        onClick={() => {
          setNotice(null);
          setOpen(true);
        }}
      >
        {update.isPending ? "Saving…" : "Prepare on character"}
      </button>
      {notice ? <p className="w-full text-sm text-lore-muted">{notice}</p> : null}
      {update.error ? (
        <p className="w-full text-sm text-red-400">{update.error.message}</p>
      ) : null}
      {open ? (
        <CharacterPickerModal
          title={`Prepare ${spell.name} on…`}
          onClose={() => setOpen(false)}
          onPick={onPick}
          pending={update.isPending}
        />
      ) : null}
    </>
  );
}

export function CodexEquipToCharacterButton({
  item,
  onApplied,
}: {
  item: CodexItemRow & { slug: string };
  onApplied?: () => void;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const update = trpc.characters.update.useMutation({
    onSuccess: async (row) => {
      await Promise.all([
        utils.characters.get.invalidate({ id: row.id }),
        utils.characters.listDashboard.invalidate(),
      ]);
      setOpen(false);
      setNotice(`Equipped ${item.name} on ${row.name}.`);
      onApplied?.();
      router.push(`/characters/${row.id}`);
    },
  });

  async function onPick(characterId: string) {
    setNotice(null);
    const row = await utils.characters.get.fetch({ id: characterId });
    if (!row) {
      setNotice("Character not found.");
      return;
    }
    const equipment = row.equipment ?? [];
    await update.mutateAsync({
      id: characterId,
      equipment: mergeEquippedCodexItem(equipment, item),
    });
  }

  return (
    <>
      <button
        type="button"
        className={BTN_PRIMARY}
        disabled={update.isPending}
        onClick={() => {
          setNotice(null);
          setOpen(true);
        }}
      >
        {update.isPending ? "Saving…" : "Equip to character"}
      </button>
      {notice ? <p className="w-full text-sm text-lore-muted">{notice}</p> : null}
      {update.error ? (
        <p className="w-full text-sm text-red-400">{update.error.message}</p>
      ) : null}
      {open ? (
        <CharacterPickerModal
          title={`Equip ${item.name} to…`}
          onClose={() => setOpen(false)}
          onPick={onPick}
          pending={update.isPending}
        />
      ) : null}
    </>
  );
}
