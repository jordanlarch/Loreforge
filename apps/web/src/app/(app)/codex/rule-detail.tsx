"use client";

import Link from "next/link";
import { useEffect } from "react";

import { CodexDetailActions } from "@/components/codex-detail-actions";
import {
  EXPLORATION_HAZARDS_OVERVIEW_SLUG,
  isExplorationHazardGlossarySlug,
} from "@/lib/codex-exploration-hazards";
import { codexDetailPath } from "@/lib/codex-routes";
import { trpc } from "@/lib/trpc/client";
import { useRecordCodexView } from "@/lib/use-record-codex-view";

export function RuleDetail({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const section = trpc.codex.getRuleSection.useQuery({ slug });
  const chapters = trpc.codex.listRuleChapters.useQuery(undefined, {
    enabled: !!section.data?.chapterSlug,
  });

  useRecordCodexView("Rules", slug, section.data?.name);

  const chapterName =
    chapters.data?.find((ch) => ch.slug === section.data?.chapterSlug)?.name ??
    null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[6vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rule-detail-title"
      onClick={onClose}
    >
      <div
        className="mb-8 w-full max-w-3xl rounded-lg border border-lore-border bg-lore-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-lore-border px-5 py-4">
          <div>
            <h2 id="rule-detail-title" className="font-display text-2xl">
              {section.data?.name ?? "Rule"}
            </h2>
            {chapterName && (
              <p className="mt-1 text-sm text-lore-muted">{chapterName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-lore-border px-2 py-1 text-sm text-lore-muted hover:text-lore-text"
          >
            Close
          </button>
        </header>

        <div className="px-5 py-4">
          {section.isLoading ? (
            <p className="text-sm text-lore-muted">Loading…</p>
          ) : !section.data ? (
            <p className="text-sm text-lore-muted">Rule section not found.</p>
          ) : (
            <>
              {isExplorationHazardGlossarySlug(slug) ? (
                <p className="mb-4 text-sm">
                  <Link
                    href={codexDetailPath("Rules", EXPLORATION_HAZARDS_OVERVIEW_SLUG)}
                    className="text-lore-accent hover:underline"
                  >
                    ← Exploration Hazards overview
                  </Link>
                </p>
              ) : null}
              <CodexDetailActions
                category="Rules"
                slug={slug}
                name={section.data.name}
                raw={section.data.raw as Record<string, unknown>}
                showCopyToSmithy
                onCopyClose={onClose}
              />
              {section.data.description ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-lore-text">
                  {section.data.description}
                </div>
              ) : (
                <p className="text-sm text-lore-muted">No body text for this section.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
