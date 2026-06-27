"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { trpc } from "@/lib/trpc/client";
import { useRecordSmithyView } from "@/lib/use-record-smithy-view";

export function ItemDetail({ id }: { id: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const query = trpc.smithy.get.useQuery({ id });

  useRecordSmithyView("item", id, query.data?.name);

  const remove = trpc.smithy.delete.useMutation({
    onSuccess: async () => {
      await utils.smithy.list.invalidate();
      router.push("/smithy");
    },
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-lore-muted">Loading…</div>
    );
  }

  const item = query.data;
  if (!item) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/smithy"
          className="text-sm text-lore-muted hover:text-lore-text"
        >
          ← The Smithy
        </Link>
        <div className="mt-6 rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
          Item not found.
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
            {item.name}
          </h1>
          <p className="mt-1 text-lore-muted">
            {item.type} · {item.rarity}
            {item.requiresAttunement && " · requires attunement"}
            {item.source === "codex" && " · copied from Codex"}
          </p>
        </div>
        <button
          onClick={() => remove.mutate({ id })}
          disabled={remove.isPending}
          className="rounded border border-red-500/40 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
        >
          {remove.isPending ? "Deleting…" : "Delete"}
        </button>
      </header>

      {item.properties.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
            Properties
          </h2>
          <ul className="flex flex-wrap gap-2">
            {item.properties.map((p) => (
              <li
                key={p}
                className="rounded-full border border-lore-border bg-lore-surface px-3 py-1 text-sm"
              >
                {p}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
          Description
        </h2>
        {item.description ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {item.description}
          </p>
        ) : (
          <p className="text-sm text-lore-muted">No description yet.</p>
        )}
      </section>

      {remove.error && (
        <p className="mt-6 text-sm text-red-400">{remove.error.message}</p>
      )}
    </div>
  );
}
