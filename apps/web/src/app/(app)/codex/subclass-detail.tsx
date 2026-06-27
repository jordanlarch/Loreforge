"use client";

import { useEffect } from "react";

import { CodexDetailActions } from "@/components/codex-detail-actions";
import { trpc } from "@/lib/trpc/client";
import { useRecordCodexView } from "@/lib/use-record-codex-view";

export function SubclassDetail({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const sub = trpc.codex.getSubclass.useQuery({ slug });

  useRecordCodexView("Classes", slug, sub.data?.name);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[8vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subclass-detail-title"
      onClick={onClose}
    >
      <div
        className="mb-8 w-full max-w-2xl rounded-lg border border-lore-border bg-lore-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-lore-border px-5 py-4">
          <div>
            <h2 id="subclass-detail-title" className="font-display text-2xl">
              {sub.data?.name ?? "Subclass"}
            </h2>
            {sub.data && (
              <p className="mt-1 text-sm text-lore-muted">
                {sub.data.className} · pick at level {sub.data.pickLevel}
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
          {sub.isLoading ? (
            <p className="text-sm text-lore-muted">Loading…</p>
          ) : !sub.data ? (
            <p className="text-sm text-lore-muted">Subclass not found.</p>
          ) : (
            <>
              <SubclassCopyActions
                slug={slug}
                name={sub.data.name}
                onCopyClose={onClose}
              />
              {sub.data.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-lore-text">
                  {sub.data.description}
                </p>
              ) : null}

              {sub.data.features.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
                    Features
                  </h3>
                  <ul className="space-y-2">
                    {sub.data.features.map((feature) => (
                      <li
                        key={`${feature.level}-${feature.name}`}
                        className="rounded-lg border border-lore-border bg-lore-surface p-3"
                      >
                        <div className="text-sm font-medium text-lore-text">
                          {feature.name}
                          <span className="ml-2 text-xs font-normal text-lore-muted">
                            Level {feature.level}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-lore-muted">
                          {feature.description}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SubclassCopyActions({
  slug,
  name,
  onCopyClose,
}: {
  slug: string;
  name: string;
  onCopyClose: () => void;
}) {
  const utils = trpc.useUtils();
  const copy = trpc.smithy.copySubclassFromCodex.useMutation({
    onSuccess: async () => {
      await utils.smithy.list.invalidate();
      onCopyClose();
    },
  });

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => copy.mutate({ slug })}
        disabled={copy.isPending}
        className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
      >
        {copy.isPending ? "Copying…" : "Copy to Smithy"}
      </button>
      {copy.error ? (
        <p className="text-sm text-red-400">{copy.error.message}</p>
      ) : null}
      <span className="sr-only">Copy {name} to The Smithy</span>
    </div>
  );
}
