"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { trpc } from "@/lib/trpc/client";

/**
 * Search Codex spells and copy one into the Smithy grimoire (SMITH-6).
 */
export function CodexSpellCopyPicker({
  onClose,
}: {
  onClose: () => void;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");

  const list = trpc.codex.listSpells.useQuery(
    { search: search || undefined, limit: 24, offset: 0 },
    { placeholderData: (prev) => prev },
  );

  const copy = trpc.smithy.copySpellFromCodex.useMutation({
    onSuccess: async (row) => {
      if (!row) return;
      await Promise.all([
        utils.smithy.listSpells.invalidate(),
        utils.smithy.getSpell.invalidate({ id: row.id }),
      ]);
      onClose();
      router.push(`/smithy/spells/${row.id}`);
    },
  });

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="codex-copy-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-lore-border bg-lore-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-lore-border px-4 py-3">
          <h2 id="codex-copy-title" className="font-display text-lg">
            Copy from Codex
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-lore-border px-2 py-1 text-sm text-lore-muted hover:text-lore-text"
          >
            Close
          </button>
        </header>

        <div className="p-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SRD spells…"
            autoFocus
            className="mb-4 w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
          />

          {copy.error && (
            <p className="mb-3 text-sm text-red-400">{copy.error.message}</p>
          )}

          {list.isLoading ? (
            <p className="text-sm text-lore-muted">Loading spells…</p>
          ) : (list.data?.spells.length ?? 0) === 0 ? (
            <p className="text-sm text-lore-muted">No spells match.</p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {list.data!.spells.map((spell) => (
                <li key={spell.slug}>
                  <button
                    type="button"
                    disabled={copy.isPending}
                    onClick={() => copy.mutate({ slug: spell.slug })}
                    className="flex w-full items-center justify-between rounded border border-transparent px-3 py-2 text-left text-sm transition-colors hover:border-lore-border hover:bg-lore-surface disabled:opacity-50"
                  >
                    <span>{spell.name}</span>
                    <span className="text-xs capitalize text-lore-muted">
                      {spell.level === "0"
                        ? "Cantrip"
                        : `Lvl ${spell.level}`}{" "}
                      · {spell.school}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-xs text-lore-muted">
            Spells are converted to engine-ready Smithy definitions. Complex SRD
            spells may need manual touch-up after copy.{" "}
            <Link href="/codex" className="text-lore-accent hover:underline">
              Browse Codex
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function CopyFromCodexButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-lore-border px-3 py-1.5 text-sm text-lore-muted transition-colors hover:text-lore-text"
      >
        Copy from Codex
      </button>
      {open && <CodexSpellCopyPicker onClose={() => setOpen(false)} />}
    </>
  );
}
