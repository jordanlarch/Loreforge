"use client";

import { useState } from "react";

import {
  ITEM_RARITIES,
  ITEM_TYPES,
  type ItemRarity,
  type ItemSource,
  type ItemType,
} from "@app/engine";

import { trpc } from "@/lib/trpc/client";

const inputClass =
  "w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent";

export type SmithyItemFormInitial = {
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  properties: string[];
  description: string;
  requiresAttunement: boolean;
  source: ItemSource;
  copiedFromSlug?: string | null;
};

export function SmithyItemForm({
  mode,
  itemId,
  initial,
  onDone,
  onCancel,
  className,
}: {
  mode: "create" | "edit";
  itemId?: string;
  initial?: SmithyItemFormInitial;
  onDone: () => void;
  onCancel?: () => void;
  className?: string;
}) {
  const utils = trpc.useUtils();
  const create = trpc.smithy.create.useMutation({
    onSuccess: async () => {
      await utils.smithy.list.invalidate();
      onDone();
    },
  });
  const update = trpc.smithy.update.useMutation({
    onSuccess: async (row) => {
      await Promise.all([
        utils.smithy.list.invalidate(),
        utils.smithy.get.invalidate({ id: row.id }),
      ]);
      onDone();
    },
  });

  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<ItemType>(initial?.type ?? "Weapon");
  const [rarity, setRarity] = useState<ItemRarity>(initial?.rarity ?? "Common");
  const [propertiesText, setPropertiesText] = useState(
    initial?.properties.join(", ") ?? "",
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [requiresAttunement, setRequiresAttunement] = useState(
    initial?.requiresAttunement ?? false,
  );

  const pending = create.isPending || update.isPending;
  const error = create.error ?? update.error;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      type,
      rarity,
      properties: propertiesText
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      description: description.trim(),
      requiresAttunement,
    };
    if (mode === "edit" && itemId) {
      update.mutate({
        id: itemId,
        ...payload,
        source: initial?.source ?? "original",
        copiedFromSlug: initial?.copiedFromSlug ?? undefined,
      });
      return;
    }
    create.mutate(payload);
  }

  return (
    <form
      onSubmit={submit}
      className={`space-y-5 rounded-lg border border-lore-border bg-lore-surface p-6 ${className ?? ""}`}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ItemType)}
            className={inputClass}
          >
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Rarity">
          <select
            value={rarity}
            onChange={(e) => setRarity(e.target.value as ItemRarity)}
            className={inputClass}
          >
            {ITEM_RARITIES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Properties (comma-separated)">
        <input
          value={propertiesText}
          onChange={(e) => setPropertiesText(e.target.value)}
          placeholder="Heavy, Two-Handed, Special"
          className={inputClass}
        />
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="A greataxe wreathed in rolling thunder…"
          className={inputClass}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-lore-muted">
        <input
          type="checkbox"
          checked={requiresAttunement}
          onChange={(e) => setRequiresAttunement(e.target.checked)}
          className="accent-lore-accent"
        />
        Requires attunement
      </label>

      {error ? <p className="text-sm text-red-400">{error.message}</p> : null}

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-lore-border px-4 py-2 text-sm text-lore-muted hover:text-lore-text"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
        >
          {pending
            ? mode === "edit"
              ? "Saving…"
              : "Forging…"
            : mode === "edit"
              ? "Save changes"
              : "Forge item"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
