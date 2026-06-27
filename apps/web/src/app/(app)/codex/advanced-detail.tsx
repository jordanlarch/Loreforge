"use client";

import { useEffect } from "react";

import { CodexDetailActions } from "@/components/codex-detail-actions";
import { formatAdvancedTopic } from "@/lib/codex-advanced-display";
import { trpc } from "@/lib/trpc/client";
import { useRecordCodexView } from "@/lib/use-record-codex-view";

export function AdvancedDetail({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const rule = trpc.codex.getAdvancedRule.useQuery({ slug });

  useRecordCodexView("Advanced", slug, rule.data?.name);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const description =
    rule.data?.description?.trim() ||
    (typeof rule.data?.raw?.desc === "string" ? rule.data.raw.desc.trim() : "");

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[6vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="advanced-detail-title"
      onClick={onClose}
    >
      <div
        className="mb-8 w-full max-w-2xl rounded-lg border border-lore-border bg-lore-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-lore-border px-5 py-4">
          <div>
            <h2 id="advanced-detail-title" className="font-display text-2xl">
              {rule.data?.name ?? "Advanced Rule"}
            </h2>
            {rule.data && (
              <p className="mt-1 text-sm text-lore-muted">
                {formatAdvancedTopic(rule.data.topic)}
              </p>
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

        <div className="space-y-4 px-5 py-4">
          {rule.isLoading ? (
            <p className="text-sm text-lore-muted">Loading…</p>
          ) : !rule.data ? (
            <p className="text-sm text-lore-muted">Rule not found.</p>
          ) : (
            <>
              <CodexDetailActions
                category="Advanced"
                slug={slug}
                name={rule.data.name}
              />
              {description ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {description}
                </div>
              ) : (
                <p className="text-sm text-lore-muted">No description available.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
