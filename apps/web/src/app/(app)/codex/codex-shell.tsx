"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import {
  CODEX_CATEGORIES,
  isLiveCodexCategory,
  type CodexCategory,
} from "@/lib/codex-categories";
import {
  codexCategoryPath,
  codexDetailPath,
  parseCodexCategorySegment,
} from "@/lib/codex-routes";
import { CodexFooter } from "@/components/codex-footer";
import { CodexRightPane } from "@/components/codex-right-pane";

import { AdvancedBrowser } from "./advanced-browser";
import { BackgroundBrowser } from "./background-browser";
import { ClassBrowser } from "./class-browser";
import { CodexBrowser } from "./codex-browser";
import { CodexComingSoon } from "./codex-coming-soon";
import { FeatBrowser } from "./feat-browser";
import { ItemBrowser } from "./item-browser";
import { MonsterBrowser } from "./monster-browser";
import { RulesBrowser } from "./rules-browser";
import { SpeciesBrowser } from "./species-browser";

export function CodexShell() {
  const router = useRouter();
  const params = useParams<{ category?: string; slug?: string }>();
  const searchParams = useSearchParams();

  const category =
    parseCodexCategorySegment(params.category) ?? ("Spells" as CodexCategory);
  const selectedSlug = params.slug
    ? decodeURIComponent(params.slug)
    : null;
  const listSearch = searchParams.get("search");

  const pushList = useCallback(
    (cat: CodexCategory, search?: string | null) => {
      router.push(codexCategoryPath(cat, search ?? listSearch));
    },
    [listSearch, router],
  );

  const selectCategory = useCallback(
    (cat: CodexCategory) => {
      pushList(cat, null);
    },
    [pushList],
  );

  const selectSlug = useCallback(
    (slug: string | null) => {
      if (slug) {
        router.push(codexDetailPath(category, slug));
      } else {
        pushList(category);
      }
    },
    [category, pushList, router],
  );

  const navigateToRef = useCallback(
    (cat: CodexCategory, slug: string) => {
      router.push(codexDetailPath(cat, slug));
    },
    [router],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
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
              <Link
                key={cat}
                href={codexCategoryPath(cat)}
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
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div>
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
      {category === "Rules" && (
        <RulesBrowser selectedSlug={selectedSlug} onSelect={selectSlug} />
      )}
      {category === "Backgrounds" && (
        <BackgroundBrowser
          selectedSlug={selectedSlug}
          onSelect={selectSlug}
          onNavigateRef={navigateToRef}
        />
      )}
      {category === "Feats" && (
        <FeatBrowser selectedSlug={selectedSlug} onSelect={selectSlug} />
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
      {category === "Advanced" && (
        <AdvancedBrowser selectedSlug={selectedSlug} onSelect={selectSlug} />
      )}
      {!isLiveCodexCategory(category) && (
        <CodexComingSoon category={category} />
      )}
        </div>
        <CodexRightPane category={category} />
      </div>

      <CodexFooter category={category} />
    </div>
  );
}
