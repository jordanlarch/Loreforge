"use client";

/**
 * Equipment tab (#56 schema → CHAR-7). Edits the character's `equipment` JSON
 * as a local draft and commits the whole array via `characters.update`.
 */
import { useState } from "react";

import { SmithyItemAddPicker } from "@/components/character-library-pickers";
import {
  blankEquipmentItem,
  totalWeight,
  type EquipmentItem,
} from "@/lib/character";

export function EquipmentTab({
  equipment,
  saving,
  onSave,
}: {
  equipment: EquipmentItem[];
  saving: boolean;
  onSave: (equipment: EquipmentItem[]) => void;
}) {
  const [draft, setDraft] = useState<EquipmentItem[]>(equipment);
  const [smithyOpen, setSmithyOpen] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(equipment);

  function patch(index: number, fields: Partial<EquipmentItem>) {
    setDraft((items) =>
      items.map((item, i) => (i === index ? { ...item, ...fields } : item)),
    );
  }

  function clean(items: EquipmentItem[]): EquipmentItem[] {
    // Drop empty optional fields so we don't persist blank strings.
    return items
      .filter((item) => item.name.trim().length > 0)
      .map((item) => ({
        ...item,
        name: item.name.trim(),
        slot: item.slot?.trim() || undefined,
        rarity: item.rarity?.trim() || undefined,
        description: item.description?.trim() || undefined,
      }));
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-lore-muted">
          {draft.length} item{draft.length === 1 ? "" : "s"} · {totalWeight(draft)}{" "}
          lb carried
        </p>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              type="button"
              onClick={() => setDraft(equipment)}
              className="rounded border border-lore-border px-3 py-1.5 text-sm text-lore-muted transition-colors hover:text-lore-text"
            >
              Revert
            </button>
          )}
          <button
            type="button"
            onClick={() => onSave(clean(draft))}
            disabled={!dirty || saving}
            className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
          >
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </button>
        </div>
      </div>

      {draft.length === 0 ? (
        <p className="rounded-lg border border-dashed border-lore-border p-8 text-center text-sm text-lore-muted">
          No equipment yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {draft.map((item, i) => (
            <li
              key={i}
              className="rounded-lg border border-lore-border bg-lore-surface p-4"
            >
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Name" className="min-w-[180px] flex-1">
                  <input
                    value={item.name}
                    onChange={(e) => patch(i, { name: e.target.value })}
                    placeholder="Item name"
                    className={INPUT}
                  />
                </Field>
                <Field label="Qty" className="w-16">
                  <input
                    type="number"
                    min={0}
                    value={item.quantity}
                    onChange={(e) =>
                      patch(i, { quantity: Number(e.target.value) || 0 })
                    }
                    className={`${INPUT} text-center`}
                  />
                </Field>
                <Field label="Slot" className="w-28">
                  <input
                    value={item.slot ?? ""}
                    onChange={(e) => patch(i, { slot: e.target.value })}
                    placeholder="e.g. main"
                    className={INPUT}
                  />
                </Field>
                <Field label="Rarity" className="w-28">
                  <input
                    value={item.rarity ?? ""}
                    onChange={(e) => patch(i, { rarity: e.target.value })}
                    placeholder="common"
                    className={INPUT}
                  />
                </Field>
                <Field label="Weight" className="w-20">
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={item.weight ?? ""}
                    onChange={(e) =>
                      patch(i, {
                        weight:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                    className={`${INPUT} text-center`}
                  />
                </Field>
                <label className="flex items-center gap-1.5 pb-1.5 text-sm text-lore-muted">
                  <input
                    type="checkbox"
                    checked={item.equipped}
                    onChange={(e) => patch(i, { equipped: e.target.checked })}
                  />
                  Equipped
                </label>
                <label className="flex items-center gap-1.5 pb-1.5 text-sm text-lore-muted">
                  <input
                    type="checkbox"
                    checked={item.attunement ?? false}
                    onChange={(e) => patch(i, { attunement: e.target.checked })}
                  />
                  Attuned
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((items) => items.filter((_, j) => j !== i))
                  }
                  aria-label={`Remove ${item.name || "item"}`}
                  className="ml-auto rounded px-2 py-1.5 text-lore-muted transition-colors hover:text-red-400"
                >
                  ✕
                </button>
              </div>
              <input
                value={item.description ?? ""}
                onChange={(e) => patch(i, { description: e.target.value })}
                placeholder="Description / notes (optional)"
                className={`${INPUT} mt-3 w-full`}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDraft((items) => [...items, blankEquipmentItem()])}
          className="rounded border border-dashed border-lore-border px-4 py-2 text-sm text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text"
        >
          + Add item
        </button>
        <button
          type="button"
          onClick={() => setSmithyOpen(true)}
          className="rounded border border-lore-border px-4 py-2 text-sm text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text"
        >
          Add from Smithy
        </button>
      </div>

      {smithyOpen && (
        <SmithyItemAddPicker
          existing={draft}
          onAdd={(item) => setDraft((items) => [...items, item])}
          onClose={() => setSmithyOpen(false)}
        />
      )}
    </div>
  );
}

const INPUT =
  "rounded border border-lore-border bg-lore-bg px-2 py-1.5 text-sm text-lore-text outline-none focus:border-lore-accent";

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] uppercase tracking-widest text-lore-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
