"use client";

import Link from "next/link";
import { useState } from "react";

import { ITEM_TYPES, type ItemType } from "@app/engine";

import { SmithyItemForm } from "@/components/smithy-item-form";
import {
  SMITHY_LIBRARY_CATEGORIES,
  smithyCategoryLabel,
  type SmithyLibraryCategory,
} from "@/lib/smithy-categories";
import { trpc } from "@/lib/trpc/client";

import { SpellBrowser } from "./spell-browser";
import { CopyFromCodexButton } from "./codex-spell-copy";

export function SmithyBrowser() {
  const [category, setCategory] = useState<SmithyLibraryCategory>("All");

  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <aside className="space-y-1">
        <div className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
          Library
        </div>
        {SMITHY_LIBRARY_CATEGORIES.map((cat) => (
          <CategoryChip
            key={cat}
            active={category === cat}
            onClick={() => setCategory(cat)}
          >
            {smithyCategoryLabel(cat)}
          </CategoryChip>
        ))}
      </aside>

      <section>
        {category === "Spells" ? (
          <SpellBrowser />
        ) : category === "Items" ? (
          <ItemsBrowser />
        ) : (
          <LibraryGrid category={category} />
        )}
      </section>
    </div>
  );
}

function LibraryGrid({ category }: { category: SmithyLibraryCategory }) {
  const list = trpc.smithy.listLibrary.useQuery({ category });

  const entries = list.data ?? [];
  const title = smithyCategoryLabel(category);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">{title}</h2>
          <p className="mt-1 text-sm text-lore-muted">
            {list.isLoading
              ? "Loading…"
              : `${entries.length} entr${entries.length === 1 ? "y" : "ies"}`}
          </p>
        </div>
        <Link
          href="/codex"
          className="rounded border border-lore-border px-3 py-1.5 text-sm text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text"
        >
          Browse Codex to copy →
        </Link>
      </div>

      {!list.isLoading && entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
          {category === "All"
            ? "No homebrew yet — copy from the Codex or forge items and spells."
            : `No custom ${title.toLowerCase()} yet. Copy from the Codex or forge from scratch.`}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <li key={`${entry.kind}-${entry.id}`}>
              <Link
                href={entry.href}
                className="flex h-full flex-col gap-2 rounded-lg border border-lore-border bg-lore-surface p-5 transition-colors hover:border-lore-accent"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-display text-lg leading-tight">
                    {entry.name}
                  </span>
                  {entry.source === "codex" && (
                    <span className="shrink-0 rounded bg-lore-bg px-2 py-0.5 text-xs text-lore-muted">
                      Copied
                    </span>
                  )}
                </div>
                <span className="text-xs capitalize text-lore-muted">
                  {entry.subtitle}
                </span>
                {entry.descriptionSnippet ? (
                  <span className="line-clamp-2 text-xs text-lore-muted">
                    {entry.descriptionSnippet}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ItemsBrowser() {
  const [typeFilter, setTypeFilter] = useState<ItemType | undefined>();
  const [forging, setForging] = useState(false);

  const list = trpc.smithy.listLibrary.useQuery({
    category: "Items",
    itemType: typeFilter,
  });

  return (
    <>
      <div className="mb-4 grid gap-6 md:grid-cols-[180px_1fr]">
        <aside className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-lore-muted">
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
              Time to heat the anvil. No homebrew items yet — forge your first
              one.
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(list.data ?? []).map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={entry.href}
                    className="flex h-full flex-col gap-2 rounded-lg border border-lore-border bg-lore-surface p-5 transition-colors hover:border-lore-accent"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display text-lg leading-tight">
                        {entry.name}
                      </span>
                      {entry.source === "codex" && (
                        <span className="shrink-0 rounded bg-lore-bg px-2 py-0.5 text-xs text-lore-muted">
                          Copied
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-lore-muted">{entry.subtitle}</span>
                    {entry.descriptionSnippet ? (
                      <span className="line-clamp-2 text-xs text-lore-muted">
                        {entry.descriptionSnippet}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function CategoryChip({
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
