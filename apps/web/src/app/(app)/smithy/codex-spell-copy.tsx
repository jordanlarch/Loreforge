"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatItemCategory } from "@/lib/codex-item-display";
import { trpc } from "@/lib/trpc/client";

import { SmithyToast } from "@/components/smithy-toast";

type CopyTab = "spells" | "items";

/**
 * Search Codex spells or items and copy into the Smithy (SMITH-6).
 */
export function CodexCopyPicker({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<CopyTab>("spells");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<"success" | "error">("success");

  const spells = trpc.codex.listSpells.useQuery(
    { search: search || undefined, limit: 24, offset: 0 },
    { enabled: tab === "spells", placeholderData: (prev) => prev },
  );

  const items = trpc.codex.listItems.useQuery(
    { search: search || undefined, limit: 24, offset: 0 },
    { enabled: tab === "items", placeholderData: (prev) => prev },
  );

  const copy = trpc.smithy.copyFromCodex.useMutation({
    onSuccess: async (result) => {
      setToast(`Copied to The Smithy — ready to forge!`);
      setToastTone("success");
      await Promise.all([
        utils.smithy.listLibrary.invalidate(),
        utils.smithy.listSpells.invalidate(),
        utils.smithy.list.invalidate(),
      ]);
      onClose();
      if (result.kind === "spell") {
        router.push(`/smithy/spells/${result.id}`);
      } else {
        router.push(`/smithy/${result.id}`);
      }
    },
    onError: (err) => {
      setToast(err.message);
      setToastTone("error");
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

        <div className="border-b border-lore-border px-4 pt-3">
          <div className="inline-flex rounded-lg border border-lore-border p-1">
            {(["spells", "items"] as CopyTab[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setTab(mode);
                  setSearch("");
                }}
                className={`rounded px-3 py-1 text-xs capitalize transition-colors ${
                  tab === mode
                    ? "bg-lore-accent-dim text-lore-text"
                    : "text-lore-muted hover:text-lore-text"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "spells" ? "Search SRD spells…" : "Search SRD items…"
            }
            autoFocus
            className="mb-4 w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
          />

          {toast ? (
            <div className="mb-3">
              <SmithyToast
                message={toast}
                tone={toastTone}
                onDismiss={() => setToast(null)}
              />
            </div>
          ) : null}

          {tab === "spells" ? (
            spells.isLoading ? (
              <p className="text-sm text-lore-muted">Loading spells…</p>
            ) : (spells.data?.spells.length ?? 0) === 0 ? (
              <p className="text-sm text-lore-muted">No spells match.</p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {spells.data!.spells.map((spell) => (
                  <li key={spell.slug}>
                    <button
                      type="button"
                      disabled={copy.isPending}
                      onClick={() =>
                        copy.mutate({ category: "Spells", slug: spell.slug })
                      }
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
            )
          ) : items.isLoading ? (
            <p className="text-sm text-lore-muted">Loading items…</p>
          ) : (items.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-lore-muted">No items match.</p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {items.data!.items.map((item) => (
                <li key={item.slug}>
                  <button
                    type="button"
                    disabled={copy.isPending}
                    onClick={() =>
                      copy.mutate({ category: "Items", slug: item.slug })
                    }
                    className="flex w-full items-center justify-between rounded border border-transparent px-3 py-2 text-left text-sm transition-colors hover:border-lore-border hover:bg-lore-surface disabled:opacity-50"
                  >
                    <span>{item.name}</span>
                    <span className="text-xs capitalize text-lore-muted">
                      {formatItemCategory(item.category ?? "gear")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-xs text-lore-muted">
            {tab === "spells"
              ? "Spells convert to engine-ready Smithy definitions."
              : "Items copy as editable Smithy gear rows."}{" "}
            <Link href="/codex" className="text-lore-accent hover:underline">
              Browse Codex
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/** @deprecated use CodexCopyPicker — kept as alias for imports */
export const CodexSpellCopyPicker = CodexCopyPicker;

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
      {open && <CodexCopyPicker onClose={() => setOpen(false)} />}
    </>
  );
}
