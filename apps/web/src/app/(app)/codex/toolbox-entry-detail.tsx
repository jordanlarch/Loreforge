"use client";

import { useEffect, useMemo } from "react";

import { CodexDetailActions } from "@/components/codex-detail-actions";
import { formatToolboxTopic } from "@/lib/codex-toolbox-display";
import { formatToolboxDefinitionSummary } from "@/lib/toolbox-mechanics-display";
import { trpc } from "@/lib/trpc/client";
import { useRecordCodexView } from "@/lib/use-record-codex-view";

export function ToolboxEntryDetail({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const entry = trpc.codex.getToolboxEntry.useQuery({ slug });

  useRecordCodexView("Gameplay Toolbox", slug, entry.data?.name);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mechanicsLines = useMemo(() => {
    if (!entry.data?.definition) return [];
    return formatToolboxDefinitionSummary(entry.data.definition);
  }, [entry.data?.definition]);

  const description =
    entry.data?.description?.trim() ||
    entry.data?.definition.description?.trim() ||
    "";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[6vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="toolbox-detail-title"
      onClick={onClose}
    >
      <div
        className="mb-8 w-full max-w-2xl rounded-lg border border-lore-border bg-lore-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-lore-border px-5 py-4">
          <div>
            <h2 id="toolbox-detail-title" className="font-display text-2xl">
              {entry.data?.name ?? "Toolbox Entry"}
            </h2>
            {entry.data && (
              <p className="mt-1 text-sm text-lore-muted">
                {formatToolboxTopic(entry.data.topic)}
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
          {entry.isLoading ? (
            <p className="text-sm text-lore-muted">Loading…</p>
          ) : !entry.data ? (
            <p className="text-sm text-lore-muted">Entry not found.</p>
          ) : (
            <>
              <CodexDetailActions
                category="Gameplay Toolbox"
                slug={slug}
                name={entry.data.name}
                onCopyClose={onClose}
              />
              {description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-lore-text">
                  {description}
                </p>
              ) : null}

              {mechanicsLines.length > 0 ? (
                <DetailBlock title="Data definition">
                  <ul className="space-y-1">
                    {mechanicsLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </DetailBlock>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1 text-xs uppercase tracking-wide text-lore-muted">
        {title}
      </h3>
      <div className="text-sm text-lore-text">{children}</div>
    </section>
  );
}
