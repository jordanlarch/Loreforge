"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { ItemPropertyRow } from "@/components/item-property-hint";
import {
  formatItemCostLine,
  formatItemMechanicsSummary,
  formatItemWeightLine,
} from "@/lib/item-mechanics-display";
import { SmithyItemForm } from "@/components/smithy-item-form";
import { SmithyResetToSrdButton } from "@/components/smithy-reset-to-srd";
import { smithyRarityBadgeClass } from "@/lib/smithy-rarity-styles";
import { trpc } from "@/lib/trpc/client";
import { useRecordSmithyView } from "@/lib/use-record-smithy-view";

export function ItemDetail({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const query = trpc.smithy.get.useQuery({ id });

  useEffect(() => {
    if (searchParams.get("edit") === "1") {
      setEditing(true);
    }
  }, [searchParams]);

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
          {item.definition &&
          (formatItemCostLine(item.definition) ||
            formatItemWeightLine(item.definition)) ? (
            <p className="mt-1 text-sm text-lore-muted">
              {[
                formatItemCostLine(item.definition),
                formatItemWeightLine(item.definition),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {item.rarity !== "Common" ? (
            <span
              className={`mt-2 inline-block rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide ${smithyRarityBadgeClass(item.rarity)}`}
            >
              {item.rarity}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {item.source === "codex" && item.copiedFromSlug ? (
            <SmithyResetToSrdButton
              kind="item"
              id={id}
              onReset={() => {
                setEditing(false);
                void query.refetch();
              }}
            />
          ) : null}
          <button
            onClick={() => setEditing(true)}
            className="rounded border border-lore-border px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
          >
            Edit
          </button>
          <button
            onClick={() => remove.mutate({ id })}
            disabled={remove.isPending}
            className="rounded border border-red-500/40 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
          >
            {remove.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </header>

      {editing ? (
        <SmithyItemForm
          mode="edit"
          itemId={id}
          initial={{
            name: item.name,
            type: item.type,
            rarity: item.rarity,
            properties: item.properties,
            description: item.description,
            requiresAttunement: item.requiresAttunement,
            source: item.source,
            copiedFromSlug: item.copiedFromSlug,
            definition: item.definition,
          }}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
          className="mt-8"
        />
      ) : (
        <>
          {item.definition
            ? formatItemMechanicsSummary(item.definition).length > 0 && (
                <section className="mt-8">
                  <h2 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
                    Mechanics
                  </h2>
                  <ul className="space-y-1 text-sm leading-relaxed">
                    {formatItemMechanicsSummary(item.definition).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </section>
              )
            : null}

          {item.definition?.propertyDetails?.length ? (
            <section className="mt-8">
              <h2 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
                Properties
              </h2>
              <ul className="space-y-2">
                {item.definition.propertyDetails.map((prop) => (
                  <ItemPropertyRow
                    key={prop.key}
                    entry={{
                      name: prop.name,
                      desc: prop.description ?? null,
                      detail: prop.detail ?? null,
                      type: prop.mastery ? "Mastery" : null,
                    }}
                  />
                ))}
              </ul>
            </section>
          ) : item.properties.length > 0 ? (
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
          ) : null}

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
        </>
      )}

      {remove.error && (
        <p className="mt-6 text-sm text-red-400">{remove.error.message}</p>
      )}
    </div>
  );
}
