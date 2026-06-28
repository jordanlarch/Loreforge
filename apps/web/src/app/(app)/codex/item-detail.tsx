"use client";

import { useEffect, useMemo } from "react";

import { open5eRawToItemDefinition } from "@app/engine";

import { ItemPropertyRow } from "@/components/item-property-hint";
import { CodexDetailActions } from "@/components/codex-detail-actions";
import {
  armorSummary,
  formatItemCategory,
  formatItemCost,
  formatItemWeight,
  weaponPropertyEntries,
  weaponSummary,
} from "@/lib/codex-item-display";
import { formatItemMechanicsSummary } from "@/lib/item-mechanics-display";
import { trpc } from "@/lib/trpc/client";
import { useRecordCodexView } from "@/lib/use-record-codex-view";

export function ItemDetail({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const item = trpc.codex.getItem.useQuery({ slug });

  useRecordCodexView("Items", slug, item.data?.name);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const raw = (item.data?.raw ?? {}) as Record<string, unknown>;
  const itemDefinition = useMemo(() => {
    if (!item.data) return undefined;
    return open5eRawToItemDefinition(raw, {
      slug: item.data.slug,
      name: item.data.name,
      category: item.data.category,
      description: item.data.description,
      cost: item.data.cost,
      weight: item.data.weight,
      weightUnit: item.data.weightUnit,
    });
  }, [item.data, raw]);
  const mechanicsLines = itemDefinition
    ? formatItemMechanicsSummary(itemDefinition)
    : [];
  const weaponLine = weaponSummary(raw);
  const armorLine = armorSummary(raw);
  const properties = weaponPropertyEntries(raw);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[6vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-detail-title"
      onClick={onClose}
    >
      <div
        className="mb-8 w-full max-w-2xl rounded-lg border border-lore-border bg-lore-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-lore-border px-5 py-4">
          <div>
            <h2 id="item-detail-title" className="font-display text-2xl">
              {item.data?.name ?? "Item"}
            </h2>
            {item.data && (
              <p className="mt-1 text-sm capitalize text-lore-muted">
                {[
                  formatItemCategory(item.data.category),
                  formatItemCost(item.data.cost),
                  formatItemWeight(item.data.weight, item.data.weightUnit),
                ]
                  .filter((part) => part !== "—")
                  .join(" · ")}
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
          {item.isLoading ? (
            <p className="text-sm text-lore-muted">Loading…</p>
          ) : !item.data ? (
            <p className="text-sm text-lore-muted">Item not found.</p>
          ) : (
            <>
              <CodexDetailActions
                category="Items"
                slug={slug}
                name={item.data.name}
                raw={raw}
                showCopyToSmithy
                onCopyClose={onClose}
                itemEquip={{
                  slug,
                  name: item.data.name,
                  category: item.data.category,
                  weight: item.data.weight,
                  cost: item.data.cost,
                  description: item.data.description,
                  requiresAttunement: Boolean(raw.requires_attunement),
                }}
              />
              {item.data.description && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-lore-text">
                  {item.data.description}
                </p>
              )}

              {mechanicsLines.length > 0 ? (
                <DetailBlock title="Data definition">
                  <ul className="space-y-1">
                    {mechanicsLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </DetailBlock>
              ) : null}

              {weaponLine && (
                <DetailBlock title="Weapon">{weaponLine}</DetailBlock>
              )}

              {armorLine && <DetailBlock title="Armor">{armorLine}</DetailBlock>}

              {properties.length > 0 && (
                <DetailBlock title="Properties">
                  <ul className="space-y-2">
                    {properties.map((prop) => (
                      <ItemPropertyRow key={prop.name} entry={prop} />
                    ))}
                  </ul>
                </DetailBlock>
              )}
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
