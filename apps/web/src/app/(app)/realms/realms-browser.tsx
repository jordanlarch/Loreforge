"use client";

import Link from "next/link";
import { useState } from "react";

import { trpc } from "@/lib/trpc/client";
import {
  REALM_ENTITY_TYPES,
  REALM_TYPE_LABEL,
  REALM_TYPE_LABEL_PLURAL,
  type RealmEntityType,
} from "@/lib/realms";

import { EntityForm } from "./entity-form";
import { GenerateForm } from "./generate-form";
import { GraphView } from "./graph-view";

type ViewMode = "grid" | "list" | "graph";

export function RealmsBrowser() {
  const [typeFilter, setTypeFilter] = useState<RealmEntityType | undefined>();
  const [view, setView] = useState<ViewMode>("grid");
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [createType, setCreateType] = useState<RealmEntityType>("npc");

  const counts = trpc.realms.counts.useQuery();
  const list = trpc.realms.list.useQuery(
    typeFilter ? { type: typeFilter } : undefined,
  );

  function startCreating() {
    setGenerating(false);
    setCreateType(typeFilter ?? "npc");
    setCreating(true);
  }

  function startGenerating() {
    setCreating(false);
    setGenerating(true);
  }

  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <aside className="space-y-1.5">
        <div className="mb-2 text-xs uppercase tracking-wide text-lore-muted">
          Type
        </div>
        <TypeChip
          active={typeFilter === undefined}
          onClick={() => setTypeFilter(undefined)}
          count={counts.data?.all}
        >
          All
        </TypeChip>
        {REALM_ENTITY_TYPES.map((t) => (
          <TypeChip
            key={t}
            active={typeFilter === t}
            onClick={() => setTypeFilter(t)}
            count={counts.data?.byType[t]}
          >
            {REALM_TYPE_LABEL_PLURAL[t]}
          </TypeChip>
        ))}
      </aside>

      <section>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-lore-muted">
            {view === "graph"
              ? "World graph"
              : list.isLoading
                ? "Loading…"
                : `${list.data?.length ?? 0} ${
                    typeFilter
                      ? REALM_TYPE_LABEL_PLURAL[typeFilter].toLowerCase()
                      : "entit" + (list.data?.length === 1 ? "y" : "ies")
                  }`}
          </span>

          <div className="flex items-center gap-3">
            <ViewToggle view={view} onChange={setView} />
            <button
              onClick={() =>
                generating ? setGenerating(false) : startGenerating()
              }
              className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
            >
              {generating ? "Cancel" : "✨ Generate"}
            </button>
            <button
              onClick={() => (creating ? setCreating(false) : startCreating())}
              className="rounded border border-lore-border px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
            >
              {creating ? "Cancel" : "+ New"}
            </button>
          </div>
        </div>

        {generating && (
          <div className="mb-8">
            <GenerateForm
              key={typeFilter ?? "npc"}
              defaultType={typeFilter ?? "npc"}
              onCancel={() => setGenerating(false)}
            />
          </div>
        )}

        {creating && (
          <div className="mb-8 space-y-3">
            <label className="flex items-center gap-2 text-sm text-lore-muted">
              <span className="text-xs uppercase tracking-wide">Type</span>
              <select
                value={createType}
                onChange={(e) =>
                  setCreateType(e.target.value as RealmEntityType)
                }
                className="rounded border border-lore-border bg-lore-surface px-3 py-1.5 text-sm text-lore-text outline-none focus:border-lore-accent"
              >
                {REALM_ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {REALM_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <EntityForm
              key={createType}
              mode="create"
              type={createType}
              onDone={() => setCreating(false)}
            />
          </div>
        )}

        {view === "graph" ? (
          <GraphView />
        ) : !list.isLoading &&
          (list.data?.length ?? 0) === 0 &&
          !creating &&
          !generating ? (
          <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
            No entities here yet. Create your first one to begin populating your
            world.
          </div>
        ) : view === "grid" ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(list.data ?? []).map((e) => (
              <li key={e.id}>
                <EntityCard entity={e} />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-lore-border rounded-lg border border-lore-border">
            {(list.data ?? []).map((e) => (
              <li key={e.id}>
                <EntityRow entity={e} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type EntityListItem = {
  id: string;
  type: RealmEntityType;
  name: string;
  summary: string;
  isStub: boolean;
};

function EntityCard({ entity }: { entity: EntityListItem }) {
  return (
    <Link
      href={`/realms/${entity.id}`}
      className={`flex h-full flex-col gap-2 rounded-lg border bg-lore-surface p-5 transition-colors hover:border-lore-accent ${
        entity.isStub
          ? "border-dashed border-lore-border"
          : "border-lore-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-display text-lg leading-tight">
          {entity.name}
        </span>
        {entity.isStub && <StubBadge />}
      </div>
      <span className="text-xs uppercase tracking-wide text-lore-muted">
        {REALM_TYPE_LABEL[entity.type]}
      </span>
      {entity.summary && (
        <span className="line-clamp-3 text-sm text-lore-muted">
          {entity.summary}
        </span>
      )}
    </Link>
  );
}

function EntityRow({ entity }: { entity: EntityListItem }) {
  return (
    <Link
      href={`/realms/${entity.id}`}
      className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-lore-surface"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-base">{entity.name}</span>
          {entity.isStub && <StubBadge />}
        </div>
        {entity.summary && (
          <span className="block truncate text-sm text-lore-muted">
            {entity.summary}
          </span>
        )}
      </div>
      <span className="shrink-0 text-xs uppercase tracking-wide text-lore-muted">
        {REALM_TYPE_LABEL[entity.type]}
      </span>
    </Link>
  );
}

function StubBadge() {
  return (
    <span
      title="A placeholder awaiting generator expansion."
      className="shrink-0 rounded bg-lore-bg px-2 py-0.5 text-xs text-lore-muted"
    >
      Stub
    </span>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-lore-border p-1">
      {(["grid", "list", "graph"] as ViewMode[]).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded px-3 py-1 text-sm capitalize transition-colors ${
            view === v
              ? "bg-lore-accent-dim text-lore-text"
              : "text-lore-muted hover:text-lore-text"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function TypeChip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded border px-3 py-1.5 text-left text-sm transition-colors ${
        active
          ? "border-lore-accent bg-lore-accent-dim text-lore-text"
          : "border-lore-border text-lore-muted hover:text-lore-text"
      }`}
    >
      <span>{children}</span>
      {count !== undefined && (
        <span className="ml-2 tabular-nums text-xs text-lore-muted">
          {count}
        </span>
      )}
    </button>
  );
}
