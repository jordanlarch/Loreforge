"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import {
  CODEX_CATEGORIES,
  isLiveCodexCategory,
  parseCodexCategory,
  type CodexCategory,
} from "@/lib/codex-categories";

import { ClassBrowser } from "./class-browser";
import { CodexBrowser } from "./codex-browser";
import { CodexComingSoon } from "./codex-coming-soon";
import { ItemBrowser } from "./item-browser";
import { MonsterBrowser } from "./monster-browser";
import { SpeciesBrowser } from "./species-browser";

export function CodexShell() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const category = parseCodexCategory(searchParams.get("category"));
  const selectedSlug = searchParams.get("slug");

  const pushParams = useCallback(
    (next: { category?: CodexCategory; slug?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      const cat = next.category ?? category;
      params.set("category", cat);
      if (next.slug === null || next.slug === undefined) {
        params.delete("slug");
      } else {
        params.set("slug", next.slug);
      }
      router.push(`/codex?${params.toString()}`);
    },
    [category, router, searchParams],
  );

  function selectCategory(cat: CodexCategory) {
    pushParams({ category: cat, slug: null });
  }

  function selectSlug(slug: string | null) {
    pushParams({ slug });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-lore-accent">
          Official 5E SRD 5.2 Reference
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            The Codex
          </h1>
          <Link
            href="/smithy"
            className="rounded-full border border-lore-accent bg-lore-accent-dim px-4 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
          >
            Forge in The Smithy →
          </Link>
        </div>
        <nav
          className="mt-4 flex flex-wrap gap-2"
          aria-label="Codex categories"
        >
          {CODEX_CATEGORIES.map((cat) => {
            const live = isLiveCodexCategory(cat);
            const active = cat === category;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => selectCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${
                  active
                    ? "bg-lore-accent-dim text-lore-text"
                    : live
                      ? "border border-lore-border text-lore-muted hover:text-lore-text"
                      : "border border-dashed border-lore-border text-lore-muted hover:text-lore-text"
                }`}
              >
                {cat}
                {!live && (
                  <span className="ml-1 text-[10px] opacity-70">soon</span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {category === "Spells" && (
        <CodexBrowser
          selectedSlug={selectedSlug}
          onSelectSlug={selectSlug}
        />
      )}
      {category === "Species" && (
        <SpeciesBrowser
          selectedSlug={selectedSlug}
          onSelect={selectSlug}
        />
      )}
      {category === "Classes" && (
        <ClassBrowser selectedSlug={selectedSlug} onSelect={selectSlug} />
      )}
      {category === "Animals" && (
        <MonsterBrowser
          mode="animals"
          selectedSlug={selectedSlug}
          onSelect={selectSlug}
        />
      )}
      {category === "Monsters" && (
        <MonsterBrowser
          mode="monsters"
          selectedSlug={selectedSlug}
          onSelect={selectSlug}
        />
      )}
      {category === "Items" && (
        <ItemBrowser selectedSlug={selectedSlug} onSelect={selectSlug} />
      )}
      {!isLiveCodexCategory(category) && (
        <CodexComingSoon category={category} />
      )}
    </div>
  );
}
