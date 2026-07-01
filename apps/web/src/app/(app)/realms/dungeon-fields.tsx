"use client";

import { useState } from "react";

import { CodexMonsterAddPicker } from "@/components/realms-dungeon-pickers";
import type { RealmFieldDescriptor } from "@/lib/realms";

const inputClass =
  "w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-lore-muted">{label}</span>
      {children}
    </label>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs text-red-400 hover:text-red-300"
    >
      Remove
    </button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-dashed border-lore-border px-3 py-1.5 text-xs text-lore-muted hover:border-lore-accent hover:text-lore-text"
    >
      {label}
    </button>
  );
}

/** Room group editor with Codex creature search (DUN-10). */
export function DungeonRoomsEditor({
  field,
  value,
  onChange,
}: {
  field: RealmFieldDescriptor;
  value: unknown;
  onChange: (value: Record<string, unknown>[]) => void;
}) {
  const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const itemLabel = field.itemLabel ?? "Room";
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  function update(next: Record<string, unknown>[]) {
    onChange(next);
  }

  function emptyRoom(): Record<string, unknown> {
    return {
      name: "",
      description: "",
      floorIndex: 0,
      encounter: "",
      encounterCodexSlug: "",
      encounterCount: 2,
      treasure: "",
    };
  }

  return (
    <Field label={field.label}>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div
            key={i}
            className="space-y-3 rounded border border-lore-border bg-lore-bg p-3"
          >
            <div className="flex justify-end">
              <RemoveButton onClick={() => update(items.filter((_, j) => j !== i))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <input
                  value={String(item.name ?? "")}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...item, name: e.target.value };
                    update(next);
                  }}
                  className={inputClass}
                />
              </Field>
              <Field label="Floor">
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={Number(item.floorIndex ?? 0)}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...item, floorIndex: Number(e.target.value) || 0 };
                    update(next);
                  }}
                  className={inputClass}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Description">
                  <textarea
                    rows={3}
                    value={String(item.description ?? "")}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = { ...item, description: e.target.value };
                      update(next);
                    }}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Encounter">
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={String(item.encounter ?? "")}
                      onChange={(e) => {
                        const next = [...items];
                        next[i] = { ...item, encounter: e.target.value };
                        update(next);
                      }}
                      placeholder="2 × Goblin"
                      className={`min-w-[200px] flex-1 ${inputClass}`}
                    />
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={Number(item.encounterCount ?? 2)}
                      onChange={(e) => {
                        const next = [...items];
                        next[i] = {
                          ...item,
                          encounterCount: Number(e.target.value) || 1,
                        };
                        update(next);
                      }}
                      className="w-20 rounded border border-lore-border bg-lore-surface px-2 py-2 text-sm"
                      aria-label="Encounter count"
                    />
                    <button
                      type="button"
                      onClick={() => setPickerIndex(i)}
                      className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-2 text-xs text-lore-text"
                    >
                      Search Codex
                    </button>
                  </div>
                  {item.encounterCodexSlug ? (
                    <p className="mt-1 text-[11px] text-lore-muted">
                      Codex: {String(item.encounterCodexSlug)}
                    </p>
                  ) : null}
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Treasure">
                  <input
                    value={String(item.treasure ?? "")}
                    onChange={(e) => {
                      const next = [...items];
                      next[i] = { ...item, treasure: e.target.value };
                      update(next);
                    }}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
          </div>
        ))}
        <AddButton label={`Add ${itemLabel}`} onClick={() => update([...items, emptyRoom()])} />
      </div>

      {pickerIndex != null ? (
        <CodexMonsterAddPicker
          onClose={() => setPickerIndex(null)}
          onPick={(monster, count) => {
            const next = [...items];
            const row = next[pickerIndex] ?? emptyRoom();
            next[pickerIndex] = {
              ...row,
              encounter: `${count} × ${monster.name}`,
              encounterCodexSlug: monster.slug,
              encounterCount: count,
            };
            update(next);
            setPickerIndex(null);
          }}
        />
      ) : null}
    </Field>
  );
}

/** Wandering monster patrol rows with Codex search (DUN-10). */
export function DungeonWanderingMonstersEditor({
  field,
  value,
  onChange,
}: {
  field: RealmFieldDescriptor;
  value: unknown;
  onChange: (value: Record<string, unknown>[]) => void;
}) {
  const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  function update(next: Record<string, unknown>[]) {
    onChange(next);
  }

  function emptyPatrol(): Record<string, unknown> {
    return { label: "", codexSlug: "", count: 1 };
  }

  return (
    <Field label={field.label}>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex flex-wrap items-end gap-2 rounded border border-lore-border bg-lore-bg p-3"
          >
            <div className="min-w-[180px] flex-1">
              <Field label="Label">
                <input
                  value={String(item.label ?? "")}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...item, label: e.target.value };
                    update(next);
                  }}
                  className={inputClass}
                />
              </Field>
            </div>
            <input
              type="number"
              min={1}
              max={20}
              value={Number(item.count ?? 1)}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...item, count: Number(e.target.value) || 1 };
                update(next);
              }}
              className="w-20 rounded border border-lore-border bg-lore-surface px-2 py-2 text-sm"
              aria-label="Patrol count"
            />
            <button
              type="button"
              onClick={() => setPickerIndex(i)}
              className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-2 text-xs text-lore-text"
            >
              Search Codex
            </button>
            {item.codexSlug ? (
              <span className="text-[11px] text-lore-muted">{String(item.codexSlug)}</span>
            ) : null}
            <RemoveButton onClick={() => update(items.filter((_, j) => j !== i))} />
          </div>
        ))}
        <AddButton
          label={`Add ${field.itemLabel ?? "Patrol"}`}
          onClick={() => update([...items, emptyPatrol()])}
        />
      </div>

      {pickerIndex != null ? (
        <CodexMonsterAddPicker
          title="Add patrol creature"
          onClose={() => setPickerIndex(null)}
          onPick={(monster, count) => {
            const next = [...items];
            const row = next[pickerIndex] ?? emptyPatrol();
            next[pickerIndex] = {
              ...row,
              label: `${count} × ${monster.name}`,
              codexSlug: monster.slug,
              count,
            };
            update(next);
            setPickerIndex(null);
          }}
        />
      ) : null}
    </Field>
  );
}
