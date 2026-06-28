"use client";

import { useEffect, useMemo } from "react";

import {
  open5eRawToItemDefinition,
  type ItemDefinition,
} from "@app/engine";

import { ItemPropertyRow } from "@/components/item-property-hint";
import { formatItemMechanicsSummary } from "@/lib/item-mechanics-display";
import type { EquipmentItem } from "@/lib/character";
import { trpc } from "@/lib/trpc/client";

export function EquipmentItemInspectDialog({
  item,
  onClose,
}: {
  item: EquipmentItem;
  onClose: () => void;
}) {
  const smithyQuery = trpc.smithy.get.useQuery(
    { id: item.smithyItemId! },
    { enabled: Boolean(item.smithyItemId) },
  );
  const codexQuery = trpc.codex.getItem.useQuery(
    { slug: item.codexSlug! },
    { enabled: Boolean(item.codexSlug) && !item.smithyItemId },
  );

  const definition = useMemo((): ItemDefinition | undefined => {
    if (item.smithyItemId && smithyQuery.data?.definition) {
      return smithyQuery.data.definition;
    }
    if (item.codexSlug && codexQuery.data) {
      const row = codexQuery.data;
      return open5eRawToItemDefinition((row.raw ?? {}) as Record<string, unknown>, {
        slug: row.slug,
        name: row.name,
        category: row.category,
        description: row.description,
        cost: row.cost,
        weight: row.weight,
        weightUnit: row.weightUnit,
      });
    }
    return undefined;
  }, [item.smithyItemId, item.codexSlug, smithyQuery.data, codexQuery.data]);

  const loading =
    (item.smithyItemId && smithyQuery.isLoading) ||
    (item.codexSlug && !item.smithyItemId && codexQuery.isLoading);

  const mechanics = definition ? formatItemMechanicsSummary(definition) : [];
  const sourceLabel = item.smithyItemId
    ? "Smithy"
    : item.codexSlug
      ? "Codex"
      : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[8vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="equipment-inspect-title"
      onClick={onClose}
    >
      <div
        className="mb-8 w-full max-w-lg rounded-lg border border-lore-border bg-lore-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-lore-border px-5 py-4">
          <div>
            <h2 id="equipment-inspect-title" className="font-display text-xl">
              {item.name}
            </h2>
            <p className="mt-1 text-sm text-lore-muted">
              {[
                sourceLabel,
                item.rarity,
                item.equipped ? "Equipped" : undefined,
                item.attunement ? "Attuned" : undefined,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
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
          {loading ? (
            <p className="text-sm text-lore-muted">Loading mechanics…</p>
          ) : (
            <>
              {item.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-lore-text">
                  {item.description}
                </p>
              ) : null}

              {mechanics.length > 0 ? (
                <section>
                  <h3 className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
                    Mechanics
                  </h3>
                  <ul className="space-y-1 text-sm leading-relaxed">
                    {mechanics.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </section>
              ) : !item.smithyItemId && !item.codexSlug ? (
                <p className="text-sm text-lore-muted">
                  No linked Smithy or Codex definition — only manual notes are
                  available for this item.
                </p>
              ) : null}

              {definition?.propertyDetails?.length ? (
                <section>
                  <h3 className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
                    Properties
                  </h3>
                  <ul className="space-y-2">
                    {definition.propertyDetails.map((prop) => (
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
              ) : null}

              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-lore-muted">Quantity</dt>
                  <dd>{item.quantity}</dd>
                </div>
                {item.weight != null ? (
                  <div>
                    <dt className="text-lore-muted">Weight</dt>
                    <dd>{(item.weight * item.quantity).toFixed(1)} lb</dd>
                  </div>
                ) : null}
              </dl>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
