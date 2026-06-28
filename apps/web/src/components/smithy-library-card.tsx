"use client";

import Link from "next/link";
import { useState } from "react";

import { formatRelativeTime } from "@/lib/format-relative-time";
import { smithyRarityBadgeClass } from "@/lib/smithy-rarity-styles";
import { trpc } from "@/lib/trpc/client";

import {
  SmithyEquipOnCharacterAction,
  SmithyPrepareOnCharacterAction,
} from "./smithy-use-on-character";

export type SmithyLibraryCardProps = {
  id: string;
  kind: "item" | "spell" | "toolbox";
  name: string;
  href: string;
  subtitle: string;
  source: "codex" | "original";
  descriptionSnippet?: string | null;
  updatedAt: Date | string;
  /** When true, show "Use in character" (forge items + spells). */
  useOnCharacter?: boolean;
  rarity?: string | null;
};

const CARD_ACTION =
  "text-xs text-lore-accent transition-colors hover:underline disabled:opacity-40";

export function SmithyLibraryCard({
  id,
  kind,
  name,
  href,
  subtitle,
  source,
  descriptionSnippet,
  updatedAt,
  useOnCharacter = kind === "spell",
  rarity,
}: SmithyLibraryCardProps) {
  const utils = trpc.useUtils();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const duplicateItem = trpc.smithy.duplicate.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.smithy.listLibrary.invalidate(),
        utils.smithy.list.invalidate(),
      ]);
      setNotice(`Duplicated ${name}.`);
    },
  });

  const duplicateSpell = trpc.smithy.duplicateSpell.useMutation({
    onSuccess: async () => {
      await utils.smithy.listLibrary.invalidate();
      await utils.smithy.listSpells.invalidate();
      setNotice(`Duplicated ${name}.`);
    },
  });

  const deleteItem = trpc.smithy.delete.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.smithy.listLibrary.invalidate(),
        utils.smithy.list.invalidate(),
      ]);
      setConfirmingDelete(false);
    },
  });

  const deleteSpell = trpc.smithy.deleteSpell.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.smithy.listLibrary.invalidate(),
        utils.smithy.listSpells.invalidate(),
      ]);
      setConfirmingDelete(false);
    },
  });

  const duplicating =
    kind === "spell" ? duplicateSpell.isPending : duplicateItem.isPending;
  const deleting =
    kind === "spell" ? deleteSpell.isPending : deleteItem.isPending;

  function onDuplicate() {
    setNotice(null);
    if (kind === "spell") {
      duplicateSpell.mutate({ id });
    } else {
      duplicateItem.mutate({ id });
    }
  }

  function onDelete() {
    if (kind === "spell") {
      deleteSpell.mutate({ id });
    } else {
      deleteItem.mutate({ id });
    }
  }

  const editHref = `${href}?edit=1`;
  const relativeTime = formatRelativeTime(updatedAt);

  return (
    <article className="flex h-full flex-col gap-2 rounded-lg border border-lore-border bg-lore-surface p-5 transition-colors hover:border-lore-accent/60">
      <div className="flex items-start justify-between gap-2">
        <Link href={href} className="font-display text-lg leading-tight hover:underline">
          {name}
        </Link>
        {source === "codex" && (
          <span className="shrink-0 rounded bg-lore-bg px-2 py-0.5 text-xs text-lore-muted">
            Copied
          </span>
        )}
      </div>

      <span className="text-xs capitalize text-lore-muted">{subtitle}</span>

      {kind === "item" && rarity && rarity !== "Common" ? (
        <span
          className={`w-fit rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide ${smithyRarityBadgeClass(rarity)}`}
        >
          {rarity}
        </span>
      ) : null}

      {descriptionSnippet ? (
        <p className="line-clamp-2 flex-1 text-xs text-lore-muted">
          {descriptionSnippet}
        </p>
      ) : (
        <div className="flex-1" />
      )}

      {relativeTime ? (
        <p className="text-xs text-lore-muted">Edited {relativeTime}</p>
      ) : null}

      {notice ? <p className="text-xs text-lore-muted">{notice}</p> : null}

      {(duplicateItem.error ?? duplicateSpell.error ?? deleteItem.error ?? deleteSpell.error) && (
        <p className="text-xs text-red-400">
          {(duplicateItem.error ?? duplicateSpell.error ?? deleteItem.error ?? deleteSpell.error)?.message}
        </p>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-lore-border/60 pt-3">
        <Link href={editHref} className={CARD_ACTION}>
          Edit
        </Link>
        <button
          type="button"
          className={CARD_ACTION}
          disabled={duplicating}
          onClick={onDuplicate}
        >
          {duplicating ? "Duplicating…" : "Duplicate"}
        </button>
        {confirmingDelete ? (
          <>
            <button
              type="button"
              className="text-xs text-red-300 hover:underline disabled:opacity-40"
              disabled={deleting}
              onClick={onDelete}
            >
              {deleting ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              type="button"
              className="text-xs text-lore-muted hover:text-lore-text"
              disabled={deleting}
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="text-xs text-red-300 transition-colors hover:underline"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </button>
        )}
        {useOnCharacter ? (
          kind === "spell" ? (
            <SmithyPrepareOnCharacterAction
              spellId={id}
              spellName={name}
              onApplied={setNotice}
            />
          ) : (
            <SmithyEquipOnCharacterAction
              itemId={id}
              itemName={name}
              onApplied={setNotice}
            />
          )
        ) : null}
      </div>
    </article>
  );
}
