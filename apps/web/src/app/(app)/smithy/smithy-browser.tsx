"use client";

import Link from "next/link";
import { useState } from "react";

import { ITEM_RARITIES, ITEM_TYPES, type ItemType } from "@app/engine";

import { trpc } from "@/lib/trpc/client";

import { SpellBrowser } from "./spell-browser";
import { CopyFromCodexButton } from "./codex-spell-copy";

type SmithyKind = "items" | "spells";

export function SmithyBrowser() {
  const [kind, setKind] = useState<SmithyKind>("items");

  return (
    <div>
      <div className="mb-6 inline-flex rounded-lg border border-lore-border p-1">
        {(["items", "spells"] as SmithyKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`rounded px-4 py-1.5 text-sm capitalize transition-colors ${
              kind === k
                ? "bg-lore-accent-dim text-lore-text"
                : "text-lore-muted hover:text-lore-text"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {kind === "items" ? <ItemsBrowser /> : <SpellBrowser />}
    </div>
  );
}

function ItemsBrowser() {
  const [typeFilter, setTypeFilter] = useState<ItemType | undefined>();
  const [forging, setForging] = useState(false);

  const list = trpc.smithy.list.useQuery(
    typeFilter ? { type: typeFilter } : undefined,
  );

  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <aside className="space-y-2">
        <div className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
          Item Type
        </div>
        <TypeChip
          active={typeFilter === undefined}
          onClick={() => setTypeFilter(undefined)}
        >
          All
        </TypeChip>
        {ITEM_TYPES.map((t) => (
          <TypeChip
            key={t}
            active={typeFilter === t}
            onClick={() => setTypeFilter(t)}
          >
            {t}
          </TypeChip>
        ))}
      </aside>

      <section>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-lore-muted">
            {list.isLoading
              ? "Loading…"
              : `${list.data?.length ?? 0} item${
                  list.data?.length === 1 ? "" : "s"
                }`}
          </span>
          <div className="flex gap-2">
            <CopyFromCodexButton />
            <button
              onClick={() => setForging((f) => !f)}
              className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
            >
              {forging ? "Cancel" : "+ Forge New"}
            </button>
          </div>
        </div>

        {forging && <ForgeItemForm onForged={() => setForging(false)} />}

        {!list.isLoading && (list.data?.length ?? 0) === 0 && !forging ? (
          <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
            Time to heat the anvil. No homebrew items yet — forge your first one.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(list.data ?? []).map((item) => (
              <li key={item.id}>
                <Link
                  href={`/smithy/${item.id}`}
                  className="flex h-full flex-col gap-2 rounded-lg border border-lore-border bg-lore-surface p-5 transition-colors hover:border-lore-accent"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display text-lg leading-tight">
                      {item.name}
                    </span>
                    {item.source === "codex" && (
                      <span className="shrink-0 rounded bg-lore-bg px-2 py-0.5 text-xs text-lore-muted">
                        Copied
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-lore-muted">
                    {item.type} · {item.rarity}
                  </span>
                  {item.properties.length > 0 && (
                    <span className="text-xs text-lore-muted">
                      {item.properties.join(", ")}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const inputClass =
  "w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent";

function ForgeItemForm({ onForged }: { onForged: () => void }) {
  const utils = trpc.useUtils();
  const create = trpc.smithy.create.useMutation({
    onSuccess: async () => {
      await utils.smithy.list.invalidate();
      onForged();
    },
  });

  const [name, setName] = useState("");
  const [type, setType] = useState<ItemType>("Weapon");
  const [rarity, setRarity] = useState<string>("Common");
  const [propertiesText, setPropertiesText] = useState("");
  const [description, setDescription] = useState("");
  const [requiresAttunement, setRequiresAttunement] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate({
      name: name.trim(),
      type,
      rarity: rarity as (typeof ITEM_RARITIES)[number],
      properties: propertiesText
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      description: description.trim(),
      requiresAttunement,
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mb-8 space-y-5 rounded-lg border border-lore-border bg-lore-surface p-6"
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
            onChange={(e) => setRarity(e.target.value)}
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

      {create.error && (
        <p className="text-sm text-red-400">{create.error.message}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
        >
          {create.isPending ? "Forging…" : "Forge item"}
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

function TypeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded border px-3 py-1.5 text-left text-sm transition-colors ${
        active
          ? "border-lore-accent bg-lore-accent-dim text-lore-text"
          : "border-lore-border text-lore-muted hover:text-lore-text"
      }`}
    >
      {children}
    </button>
  );
}
