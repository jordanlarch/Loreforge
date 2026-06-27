"use client";

import Link from "next/link";
import { useState } from "react";

import { ITEM_TYPES, type ItemType } from "@app/engine";

import { SmithyItemForm } from "@/components/smithy-item-form";
import { trpc } from "@/lib/trpc/client";

import { SpellBrowser } from "./spell-browser";
import { CopyFromCodexButton } from "./codex-spell-copy";

type SmithyKind = "items" | "spells";

export function SmithyBrowser() {
  const [kind, setKind] = useState<SmithyKind>("items");

  return (
    <div>
      <div className="mb-6 inline-flex rounded-lg border border-lore-border p-1">
        {(["items", "spells"] as SmithyKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`rounded px-4 py-1.5 text-sm capitalize transition-colors ${
              kind === k
                ? "bg-lore-accent-dim text-lore-text"
                : "text-lore-muted hover:text-lore-text"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {kind === "items" ? <ItemsBrowser /> : <SpellBrowser />}
    </div>
  );
}

function ItemsBrowser() {
  const [typeFilter, setTypeFilter] = useState<ItemType | undefined>();
  const [forging, setForging] = useState(false);

  const list = trpc.smithy.list.useQuery(
    typeFilter ? { type: typeFilter } : undefined,
  );

  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <aside className="space-y-2">
        <div className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
          Item Type
        </div>
        <TypeChip
          active={typeFilter === undefined}
          onClick={() => setTypeFilter(undefined)}
        >
          All
        </TypeChip>
        {ITEM_TYPES.map((t) => (
          <TypeChip
            key={t}
            active={typeFilter === t}
            onClick={() => setTypeFilter(t)}
          >
            {t}
          </TypeChip>
        ))}
      </aside>

      <section>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-lore-muted">
            {list.isLoading
              ? "Loading…"
              : `${list.data?.length ?? 0} item${
                  list.data?.length === 1 ? "" : "s"
                }`}
          </span>
          <div className="flex gap-2">
            <CopyFromCodexButton />
            <button
              onClick={() => setForging((f) => !f)}
              className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
            >
              {forging ? "Cancel" : "+ Forge New"}
            </button>
          </div>
        </div>

        {forging ? (
          <SmithyItemForm
            mode="create"
            className="mb-8"
            onDone={() => setForging(false)}
          />
        ) : null}

        {!list.isLoading && (list.data?.length ?? 0) === 0 && !forging ? (
          <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
            Time to heat the anvil. No homebrew items yet — forge your first one.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(list.data ?? []).map((item) => (
              <li key={item.id}>
                <Link
                  href={`/smithy/${item.id}`}
                  className="flex h-full flex-col gap-2 rounded-lg border border-lore-border bg-lore-surface p-5 transition-colors hover:border-lore-accent"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display text-lg leading-tight">
                      {item.name}
                    </span>
                    {item.source === "codex" && (
                      <span className="shrink-0 rounded bg-lore-bg px-2 py-0.5 text-xs text-lore-muted">
                        Copied
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-lore-muted">
                    {item.type} · {item.rarity}
                  </span>
                  {item.properties.length > 0 && (
                    <span className="text-xs text-lore-muted">
                      {item.properties.join(", ")}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TypeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded border px-3 py-1.5 text-left text-sm transition-colors ${
        active
          ? "border-lore-accent bg-lore-accent-dim text-lore-text"
          : "border-lore-border text-lore-muted hover:text-lore-text"
      }`}
    >
      {children}
    </button>
  );
}
