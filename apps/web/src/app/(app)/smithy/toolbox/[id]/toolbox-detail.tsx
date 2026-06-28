"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { SmithyToolboxForm } from "@/components/smithy-toolbox-form";
import { formatToolboxTopic } from "@/lib/codex-toolbox-display";
import { formatToolboxDefinitionSummary } from "@/lib/toolbox-mechanics-display";
import { trpc } from "@/lib/trpc/client";
import { useRecordSmithyView } from "@/lib/use-record-smithy-view";

export function ToolboxDetail({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const query = trpc.smithy.getToolboxEntry.useQuery({ id });

  useEffect(() => {
    if (searchParams.get("edit") === "1") {
      setEditing(true);
    }
  }, [searchParams]);

  useRecordSmithyView("toolbox", id, query.data?.name);

  const remove = trpc.smithy.deleteToolboxEntry.useMutation({
    onSuccess: async () => {
      await utils.smithy.listLibrary.invalidate();
      router.push("/smithy");
    },
  });

  const mechanicsLines = useMemo(() => {
    if (!query.data?.definition) return [];
    return formatToolboxDefinitionSummary(query.data.definition);
  }, [query.data?.definition]);

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-lore-muted">Loading…</div>
    );
  }

  const entry = query.data;
  if (!entry) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/smithy"
          className="text-sm text-lore-muted hover:text-lore-text"
        >
          ← The Smithy
        </Link>
        <div className="mt-6 rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
          Toolbox entry not found.
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/smithy"
          className="text-sm text-lore-muted hover:text-lore-text"
        >
          ← The Smithy
        </Link>
        <div className="mt-6">
          <SmithyToolboxForm
            entryId={entry.id}
            initial={{
              name: entry.name,
              topic: entry.topic,
              description: entry.description,
              source: entry.source,
              copiedFromSlug: entry.copiedFromSlug,
              definition: entry.definition,
            }}
            onSaved={async () => {
              await utils.smithy.getToolboxEntry.invalidate({ id });
              await utils.smithy.listLibrary.invalidate();
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/smithy"
        className="text-sm text-lore-muted hover:text-lore-text"
      >
        ← The Smithy
      </Link>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b border-lore-border pb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            {entry.name}
          </h1>
          <p className="mt-1 text-lore-muted">
            {formatToolboxTopic(entry.topic)}
            {entry.source === "codex" && entry.copiedFromSlug
              ? ` · copied from Codex`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded border border-lore-border px-3 py-1.5 text-sm text-lore-muted hover:text-lore-text"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete "${entry.name}"?`)) {
                remove.mutate({ id: entry.id });
              }
            }}
            disabled={remove.isPending}
            className="rounded border border-red-900/50 px-3 py-1.5 text-sm text-red-300 hover:border-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </header>

      <div className="mt-6 space-y-4">
        {entry.description ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {entry.description}
          </p>
        ) : null}

        {mechanicsLines.length > 0 ? (
          <section>
            <h2 className="mb-1 text-xs uppercase tracking-wide text-lore-muted">
              Data definition
            </h2>
            <ul className="space-y-1 text-sm">
              {mechanicsLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
