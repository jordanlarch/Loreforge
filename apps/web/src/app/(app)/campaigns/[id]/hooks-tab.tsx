"use client";

import Link from "next/link";
import { useState } from "react";

import {
  HOOK_STATUSES,
  HOOK_STATUS_LABEL,
  groupHooksByStatus,
  type HookStatus,
} from "@/lib/campaign-hooks";
import { trpc } from "@/lib/trpc/client";

type Hook = {
  id: string;
  title: string;
  summary: string;
  status: string;
  sourceEntityId: string | null;
};

/**
 * Hooks tab (#59, Q7): a five-column Kanban over the campaign's plot hooks with
 * drag-to-restage, a detail panel, an author-a-hook form, and the
 * accept-from-Realms lifecycle that promotes a Realms-embedded hook into a
 * first-class campaign hook.
 */
export function HooksTab({ campaignId }: { campaignId: string }) {
  const utils = trpc.useUtils();
  const hooks = trpc.hooks.list.useQuery({ campaignId });

  const [dragId, setDragId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function refresh() {
    await utils.hooks.list.invalidate({ campaignId });
  }

  const setStatus = trpc.hooks.setStatus.useMutation({ onSuccess: refresh });
  const remove = trpc.hooks.remove.useMutation({
    onSuccess: async () => {
      setSelectedId(null);
      await refresh();
    },
  });

  const list = (hooks.data ?? []) as Hook[];
  const grouped = groupHooksByStatus(list);
  const selected = list.find((h) => h.id === selectedId) ?? null;

  function onDrop(status: HookStatus) {
    if (dragId) {
      const hook = list.find((h) => h.id === dragId);
      if (hook && hook.status !== status) {
        setStatus.mutate({ id: dragId, status });
      }
    }
    setDragId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Plot Hooks</h2>
      </div>

      <NewHookForm campaignId={campaignId} onCreated={refresh} />
      <AcceptFromRealms campaignId={campaignId} onAccepted={refresh} />

      {hooks.isLoading ? (
        <p className="text-sm text-lore-muted">Loading hooks…</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-5">
          {HOOK_STATUSES.map((status) => (
            <div
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(status)}
              className="flex min-h-[120px] flex-col gap-2 rounded-lg border border-lore-border bg-lore-bg/40 p-2"
            >
              <div className="flex items-center justify-between px-1 text-xs uppercase tracking-widest text-lore-muted">
                <span>{HOOK_STATUS_LABEL[status]}</span>
                <span>{grouped[status].length}</span>
              </div>
              {grouped[status].map((hook) => (
                <button
                  key={hook.id}
                  type="button"
                  draggable
                  onDragStart={() => setDragId(hook.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => setSelectedId(hook.id)}
                  className={`cursor-grab rounded border bg-lore-surface p-2 text-left text-sm transition-colors active:cursor-grabbing ${
                    hook.id === selectedId
                      ? "border-lore-accent"
                      : "border-lore-border hover:border-lore-accent"
                  }`}
                >
                  <span className="line-clamp-2 font-medium text-lore-text">
                    {hook.title}
                  </span>
                  {hook.sourceEntityId && (
                    <span className="mt-1 block text-[10px] uppercase tracking-wide text-lore-muted">
                      from Realms
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <HookDetail
          hook={selected}
          statusBusy={setStatus.isPending}
          onSetStatus={(status) =>
            setStatus.mutate({ id: selected.id, status })
          }
          onRemove={() => remove.mutate({ id: selected.id })}
          removing={remove.isPending}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function NewHookForm({
  campaignId,
  onCreated,
}: {
  campaignId: string;
  onCreated: () => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const create = trpc.hooks.create.useMutation({
    onSuccess: async () => {
      setTitle("");
      setSummary("");
      await onCreated();
    },
  });

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length === 0) return;
    create.mutate({ campaignId, title: trimmed, summary });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-wrap items-start gap-2 rounded-lg border border-lore-border bg-lore-surface p-3"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New hook title"
        maxLength={200}
        className="min-w-[12rem] flex-1 rounded border border-lore-border bg-lore-bg px-3 py-1.5 text-sm outline-none focus:border-lore-accent"
      />
      <input
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="One-line summary (optional)"
        maxLength={2000}
        className="min-w-[12rem] flex-1 rounded border border-lore-border bg-lore-bg px-3 py-1.5 text-sm outline-none focus:border-lore-accent"
      />
      <button
        type="submit"
        disabled={create.isPending || title.trim().length === 0}
        className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
      >
        {create.isPending ? "Adding…" : "Add hook"}
      </button>
    </form>
  );
}

function AcceptFromRealms({
  campaignId,
  onAccepted,
}: {
  campaignId: string;
  onAccepted: () => Promise<void>;
}) {
  const entities = trpc.realms.list.useQuery();
  const [entityId, setEntityId] = useState("");

  const accept = trpc.hooks.acceptFromRealms.useMutation({
    onSuccess: onAccepted,
  });

  const withHooks = (entities.data ?? [])
    .map((e) => ({
      id: e.id,
      name: e.name,
      hooks: Array.isArray((e.data as Record<string, unknown>)?.hooks)
        ? ((e.data as Record<string, unknown>).hooks as unknown[]).filter(
            (h): h is string => typeof h === "string" && h.trim().length > 0,
          )
        : [],
    }))
    .filter((e) => e.hooks.length > 0);

  const selectedEntity = withHooks.find((e) => e.id === entityId) ?? null;

  if (withHooks.length === 0) return null;

  return (
    <div className="rounded-lg border border-lore-border bg-lore-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-lore-muted">
          Accept from Realms
        </span>
        <select
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          className="rounded border border-lore-border bg-lore-bg px-3 py-1.5 text-sm outline-none focus:border-lore-accent"
        >
          <option value="">Pick an entity with hooks…</option>
          {withHooks.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.hooks.length})
            </option>
          ))}
        </select>
      </div>
      {selectedEntity && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {selectedEntity.hooks.map((hook, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-lore-muted">{hook}</span>
              <button
                type="button"
                onClick={() =>
                  accept.mutate({
                    campaignId,
                    entityId: selectedEntity.id,
                    title: hook.slice(0, 200),
                    summary: hook,
                  })
                }
                disabled={accept.isPending}
                className="shrink-0 rounded border border-lore-accent px-2 py-1 text-xs text-lore-accent transition-colors hover:bg-lore-accent-dim disabled:opacity-40"
              >
                Accept →
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HookDetail({
  hook,
  statusBusy,
  onSetStatus,
  onRemove,
  removing,
  onClose,
}: {
  hook: Hook;
  statusBusy: boolean;
  onSetStatus: (status: HookStatus) => void;
  onRemove: () => void;
  removing: boolean;
  onClose: () => void;
}) {
  return (
    <section className="rounded-lg border border-lore-accent/50 bg-lore-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl">{hook.title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-lore-muted hover:text-lore-text"
        >
          Close
        </button>
      </div>
      {hook.summary && (
        <p className="mt-2 text-sm text-lore-muted">{hook.summary}</p>
      )}
      {hook.sourceEntityId && (
        <p className="mt-2 text-sm">
          <Link
            href={`/realms/${hook.sourceEntityId}`}
            className="text-lore-accent hover:underline"
          >
            Open linked entity →
          </Link>
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-lore-muted">
          Move to
        </span>
        {HOOK_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onSetStatus(status)}
            disabled={statusBusy || hook.status === status}
            className={`rounded border px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
              hook.status === status
                ? "border-lore-accent text-lore-accent"
                : "border-lore-border text-lore-muted hover:text-lore-text"
            }`}
          >
            {HOOK_STATUS_LABEL[status]}
          </button>
        ))}
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="ml-auto text-sm text-lore-muted transition-colors hover:text-red-400 disabled:opacity-40"
        >
          Delete
        </button>
      </div>
    </section>
  );
}
