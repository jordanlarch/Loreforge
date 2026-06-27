"use client";

import { useState } from "react";

import { SmithyItemAddPicker } from "@/components/character-library-pickers";
import {
  SheetSearchBar,
  SheetSection,
  SheetTag,
  useSheetSearch,
} from "@/components/character-sheet/sheet-ui";
import { formatItemCost } from "@/lib/codex-item-display";
import {
  blankEquipmentItem,
  totalWeight,
  type EquipmentItem,
} from "@/lib/character";
import {
  EMPTY_CURRENCY,
  type CharacterSheetMeta,
  type Currency,
} from "@/lib/character-sheet-storage";
import { trpc } from "@/lib/trpc/client";

const COIN_LABELS: { key: keyof Currency; label: string }[] = [
  { key: "pp", label: "Platinum" },
  { key: "gp", label: "Gold" },
  { key: "ep", label: "Electrum" },
  { key: "sp", label: "Silver" },
  { key: "cp", label: "Copper" },
];

function parseGpCost(cost: string | null | undefined): number {
  const value = parseFloat(cost ?? "");
  return Number.isNaN(value) ? 0 : value;
}

function parseWeightLb(
  weight: string | null | undefined,
): number | undefined {
  const value = parseFloat(weight ?? "");
  return Number.isNaN(value) || value <= 0 ? undefined : value;
}

export function InventoryTab({
  equipment,
  meta,
  saving,
  onSaveEquipment,
  onPatchMeta,
}: {
  equipment: EquipmentItem[];
  meta: CharacterSheetMeta;
  saving: boolean;
  onSaveEquipment: (equipment: EquipmentItem[]) => void;
  onPatchMeta: (patch: Partial<CharacterSheetMeta>) => void;
}) {
  const [draft, setDraft] = useState(equipment);
  const [search, setSearch] = useState("");
  const [shopSearch, setShopSearch] = useState("");
  const [smithyOpen, setSmithyOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(equipment);

  const currency = meta.currency ?? EMPTY_CURRENCY;
  const equipped = useSheetSearch(
    draft.filter((i) => i.equipped),
    search,
    (i) => i.name,
  );
  const other = useSheetSearch(
    draft.filter((i) => !i.equipped),
    search,
    (i) => i.name,
  );
  const attuned = draft.filter((i) => i.attunement);
  const weight = totalWeight(draft);
  const carryCap = 15 * 30;

  const shop = trpc.codex.listItems.useQuery({
    search: shopSearch.trim() || undefined,
    limit: 12,
  });

  function patch(index: number, fields: Partial<EquipmentItem>) {
    setDraft((items) =>
      items.map((item, i) => (i === index ? { ...item, ...fields } : item)),
    );
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    setDraft((items) => {
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
  }

  function removeItem(index: number) {
    setDraft((items) => items.filter((_, i) => i !== index));
  }

  function save() {
    onSaveEquipment(
      draft
        .filter((i) => i.name.trim())
        .map((i) => ({ ...i, name: i.name.trim() })),
    );
  }

  function patchCurrency(key: keyof Currency, value: number) {
    onPatchMeta({ currency: { ...currency, [key]: Math.max(0, value) } });
  }

  function buyFromCodex(item: {
    name: string;
    cost: string | null;
    weight: string | null;
  }) {
    const gp = parseGpCost(item.cost);
    if (gp > 0 && currency.gp < gp) return;
    if (gp > 0) {
      onPatchMeta({ currency: { ...currency, gp: currency.gp - gp } });
    }
    setDraft((d) => [
      ...d,
      {
        ...blankEquipmentItem(),
        name: item.name,
        weight: parseWeightLb(item.weight),
        quantity: 1,
      },
    ]);
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-5 gap-2">
        {COIN_LABELS.map(({ key, label }) => (
          <label key={key} className="text-center text-xs">
            <span className="text-lore-muted">{label}</span>
            <input
              type="number"
              min={0}
              value={currency[key]}
              onChange={(e) =>
                patchCurrency(key, Number(e.target.value) || 0)
              }
              className="mt-1 w-full rounded border border-lore-border bg-lore-bg px-2 py-1 text-center text-sm"
            />
          </label>
        ))}
      </div>

      <SheetSearchBar value={search} onChange={setSearch} />

      <p className="mb-4 text-sm text-lore-muted">
        {weight.toFixed(1)} / {carryCap} lb ·{" "}
        {weight > carryCap ? "Encumbered" : "Unencumbered"}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-1.5 text-sm disabled:opacity-40"
        >
          {saving ? "Saving…" : dirty ? "Save inventory" : "Saved"}
        </button>
        <button
          type="button"
          onClick={() => setDraft((d) => [...d, blankEquipmentItem()])}
          className="rounded border border-dashed border-lore-border px-3 py-1.5 text-sm text-lore-muted"
        >
          + Add item
        </button>
        <button
          type="button"
          onClick={() => setSmithyOpen(true)}
          className="rounded border border-lore-border px-3 py-1.5 text-sm text-lore-muted"
        >
          Smithy
        </button>
      </div>

      <SheetSection title="Codex Shop">
        <input
          type="search"
          value={shopSearch}
          onChange={(e) => setShopSearch(e.target.value)}
          placeholder="Search SRD gear…"
          className="mb-3 w-full rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm outline-none focus:border-lore-accent"
        />
        {shop.isLoading ? (
          <p className="text-sm text-lore-muted">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {shop.data?.items.map((item) => {
              const gp = parseGpCost(item.cost);
              const canBuy = gp === 0 || currency.gp >= gp;
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-lore-border px-3 py-2 text-sm"
                >
                  <span>{item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-lore-muted">
                      {formatItemCost(item.cost)}
                    </span>
                    <button
                      type="button"
                      disabled={!canBuy}
                      onClick={() => buyFromCodex(item)}
                      className="rounded border border-lore-border px-2 py-0.5 text-xs disabled:opacity-40"
                    >
                      Buy
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SheetSection>

      <div className="mt-4">
        <SheetSection
          title="Equipment"
          weight={`${totalWeight(draft.filter((i) => i.equipped)).toFixed(1)} lb`}
        >
          <ItemList
            items={equipped}
            draft={draft}
            onPatch={patch}
            onRemove={removeItem}
            showEquipToggle
            dragIndex={dragIndex}
            onDragStart={setDragIndex}
            onDrop={reorder}
          />
        </SheetSection>
      </div>

      <div className="mt-4">
        <SheetSection title="Attunement">
          {attuned.length === 0 ? (
            <p className="text-sm text-lore-muted">No attunable items.</p>
          ) : (
            <ItemList items={attuned} draft={draft} onPatch={patch} onRemove={removeItem} />
          )}
        </SheetSection>
      </div>

      <div className="mt-4">
        <SheetSection
          title="Other Possessions"
          weight={`${totalWeight(draft.filter((i) => !i.equipped)).toFixed(1)} lb`}
        >
          <ItemList
            items={other}
            draft={draft}
            onPatch={patch}
            onRemove={removeItem}
            showEquipToggle
            dragIndex={dragIndex}
            onDragStart={setDragIndex}
            onDrop={reorder}
          />
          <p className="mt-2 text-xs text-lore-muted">
            Drag rows to reorder. Save inventory to persist order.
          </p>
        </SheetSection>
      </div>

      {smithyOpen && (
        <SmithyItemAddPicker
          existing={draft}
          onAdd={(item) => setDraft((d) => [...d, item])}
          onClose={() => setSmithyOpen(false)}
        />
      )}
    </div>
  );
}

function ItemList({
  items,
  draft,
  onPatch,
  onRemove,
  showEquipToggle,
  dragIndex,
  onDragStart,
  onDrop,
}: {
  items: EquipmentItem[];
  draft: EquipmentItem[];
  onPatch: (index: number, fields: Partial<EquipmentItem>) => void;
  onRemove: (index: number) => void;
  showEquipToggle?: boolean;
  dragIndex?: number | null;
  onDragStart?: (index: number | null) => void;
  onDrop?: (from: number, to: number) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-lore-muted">No items.</p>;
  }

  return (
    <ul className="divide-y divide-lore-border">
      {items.map((item) => {
        const index = draft.indexOf(item);
        const tags = [
          item.rarity,
          item.equipped ? "Equipped" : undefined,
          item.attunement ? "Attuned" : undefined,
        ].filter(Boolean) as string[];
        const draggable = onDrop != null && onDragStart != null;

        return (
          <li
            key={`${item.name}-${index}`}
            className={`py-3 ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
            draggable={draggable}
            onDragStart={() => onDragStart?.(index)}
            onDragEnd={() => onDragStart?.(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex != null && dragIndex !== index) {
                onDrop?.(dragIndex, index);
              }
              onDragStart?.(null);
            }}
          >
            <div className="flex flex-wrap items-start gap-2">
              {draggable && (
                <span className="mt-1 text-lore-muted" aria-hidden>
                  ⠿
                </span>
              )}
              {showEquipToggle && (
                <input
                  type="checkbox"
                  checked={item.equipped}
                  onChange={(e) => onPatch(index, { equipped: e.target.checked })}
                  aria-label="Equipped"
                  className="mt-1"
                />
              )}
              <div className="min-w-0 flex-1">
                <input
                  value={item.name}
                  onChange={(e) => onPatch(index, { name: e.target.value })}
                  className="w-full bg-transparent font-medium outline-none"
                />
                <div className="mt-1 flex flex-wrap gap-1">
                  {tags.map((t) => (
                    <SheetTag key={t} label={t} />
                  ))}
                </div>
              </div>
              <span className="text-xs text-lore-muted">
                {(item.weight ?? 0) * item.quantity || "—"} lb
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (item.quantity <= 1) onRemove(index);
                    else onPatch(index, { quantity: item.quantity - 1 });
                  }}
                  className="rounded border border-lore-border px-2"
                  aria-label={`Decrease ${item.name} quantity`}
                >
                  −
                </button>
                <span className="w-8 text-center tabular-nums">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => onPatch(index, { quantity: item.quantity + 1 })}
                  className="rounded border border-lore-border px-2"
                  aria-label={`Increase ${item.name} quantity`}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="rounded border border-red-900/60 px-2 text-red-400 transition-colors hover:border-red-600 hover:text-red-300"
                  aria-label={`Remove ${item.name}`}
                  title="Remove item"
                >
                  ✕
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
