"use client";

import { useState } from "react";

import { SmithyItemAddPicker } from "@/components/character-library-pickers";
import {
  SheetSearchBar,
  SheetSection,
  SheetTag,
  StubBanner,
  useSheetSearch,
} from "@/components/character-sheet/sheet-ui";
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

const COIN_LABELS: { key: keyof Currency; label: string }[] = [
  { key: "pp", label: "Platinum" },
  { key: "gp", label: "Gold" },
  { key: "ep", label: "Electrum" },
  { key: "sp", label: "Silver" },
  { key: "cp", label: "Copper" },
];

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
  const [smithyOpen, setSmithyOpen] = useState(false);
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

  function patch(index: number, fields: Partial<EquipmentItem>) {
    setDraft((items) =>
      items.map((item, i) => (i === index ? { ...item, ...fields } : item)),
    );
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

      <SheetSection
        title="Equipment"
        weight={`${totalWeight(draft.filter((i) => i.equipped)).toFixed(1)} lb`}
      >
        <ItemList items={equipped} draft={draft} onPatch={patch} showEquipToggle />
      </SheetSection>

      <div className="mt-4">
        <SheetSection title="Attunement">
          {attuned.length === 0 ? (
            <p className="text-sm text-lore-muted">No attunable items.</p>
          ) : (
            <ItemList items={attuned} draft={draft} onPatch={patch} />
          )}
        </SheetSection>
      </div>

      <div className="mt-4">
        <SheetSection
          title="Other Possessions"
          weight={`${totalWeight(draft.filter((i) => !i.equipped)).toFixed(1)} lb`}
        >
          <ItemList items={other} draft={draft} onPatch={patch} showEquipToggle />
        </SheetSection>
      </div>

      <div className="mt-4">
        <StubBanner>
          Gold-buy from SRD shop and drag-and-drop reorder ship with commerce
          slices.
        </StubBanner>
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
  showEquipToggle,
}: {
  items: EquipmentItem[];
  draft: EquipmentItem[];
  onPatch: (index: number, fields: Partial<EquipmentItem>) => void;
  showEquipToggle?: boolean;
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

        return (
          <li key={`${item.name}-${index}`} className="py-3">
            <div className="flex flex-wrap items-start gap-2">
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
                  onClick={() =>
                    onPatch(index, { quantity: Math.max(0, item.quantity - 1) })
                  }
                  className="rounded border border-lore-border px-2"
                >
                  −
                </button>
                <span className="w-8 text-center tabular-nums">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => onPatch(index, { quantity: item.quantity + 1 })}
                  className="rounded border border-lore-border px-2"
                >
                  +
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
