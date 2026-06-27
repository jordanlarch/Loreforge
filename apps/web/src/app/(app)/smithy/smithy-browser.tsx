"use client";

import Link from "next/link";
import { useState } from "react";

import { ITEM_TYPES, type ItemType } from "@app/engine";

import {
  SmithyBrowseToolbar,
  SmithyLibraryViews,
  useSmithyBrowseState,
} from "@/components/smithy-library-browse";
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
  const browse = useSmithyBrowseState();
  const list = trpc.smithy.listLibrary.useQuery({
    category,
    ...browse.queryInput,
  });

  const entries = list.data ?? [];
  const title = smithyCategoryLabel(category);
  const countLabel = list.isLoading
    ? "Loading…"
    : `${entries.length} entr${entries.length === 1 ? "y" : "ies"}`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">{title}</h2>
        </div>
        <Link
          href="/codex"
          className="rounded border border-lore-border px-3 py-1.5 text-sm text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text"
        >
          Browse Codex to copy →
        </Link>
      </div>

      <SmithyBrowseToolbar
        search={browse.search}
        onSearchChange={browse.setSearch}
        source={browse.source}
        onSourceChange={browse.setSource}
        sort={browse.sort}
        onSortChange={browse.setSort}
        view={browse.view}
        onViewChange={browse.setView}
        countLabel={countLabel}
      />

      {!list.isLoading && entries.length === 0 ? (
        <SmithyLibraryViews
          entries={[]}
          view={browse.view}
          emptyMessage={
            browse.search || browse.source
              ? "No homebrew matches these filters."
              : category === "All"
                ? "No homebrew yet — copy from the Codex or forge items and spells."
                : `No custom ${title.toLowerCase()} yet. Copy from the Codex or forge from scratch.`
          }
        />
      ) : (
        <SmithyLibraryViews
          entries={entries}
          view={browse.view}
          emptyMessage="No homebrew matches these filters."
        />
      )}
    </>
  );
}

function ItemsBrowser() {
  const [typeFilter, setTypeFilter] = useState<ItemType | undefined>();
  const [forging, setForging] = useState(false);
  const browse = useSmithyBrowseState();

  const list = trpc.smithy.listLibrary.useQuery({
    category: "Items",
    itemType: typeFilter,
    ...browse.queryInput,
  });

  const entries = list.data ?? [];
  const countLabel = list.isLoading
    ? "Loading…"
    : `${entries.length} item${entries.length === 1 ? "" : "s"}`;

  return (
    <div className="grid gap-6 md:grid-cols-[180px_1fr]">
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
        <SmithyBrowseToolbar
          search={browse.search}
          onSearchChange={browse.setSearch}
          source={browse.source}
          onSourceChange={browse.setSource}
          sort={browse.sort}
          onSortChange={browse.setSort}
          view={browse.view}
          onViewChange={browse.setView}
          countLabel={countLabel}
          actions={
            <>
              <CopyFromCodexButton />
              <button
                onClick={() => setForging((f) => !f)}
                className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
              >
                {forging ? "Cancel" : "+ Forge New"}
              </button>
            </>
          }
        />

        {forging ? (
          <SmithyItemForm
            mode="create"
            className="mb-8"
            onDone={() => setForging(false)}
          />
        ) : null}

        {!list.isLoading && entries.length === 0 && !forging ? (
          <SmithyLibraryViews
            entries={[]}
            view={browse.view}
            emptyMessage={
              browse.search || browse.source
                ? "No items match these filters."
                : "Time to heat the anvil. No homebrew items yet — forge your first one."
            }
          />
        ) : (
          <SmithyLibraryViews
            entries={entries}
            view={browse.view}
            emptyMessage="No items match these filters."
          />
        )}
      </section>
    </div>
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
