"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  HOOK_STATUSES,
  HOOK_STATUS_LABEL,
  groupHooksByStatus,
  isHookStatus,
  pendingRealmHooks,
  sessionIndexForDate,
  type HookStatus,
  type PendingRealmHook,
} from "@/lib/campaign-hooks";
import { trpc } from "@/lib/trpc/client";

type Hook = {
  id: string;
  title: string;
  summary: string;
  status: string;
  sourceEntityId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type HooksView = "kanban" | "timeline";

/**
 * Hooks tab (#59, Q7): a five-column Kanban over the campaign's plot hooks with
 * drag-to-restage, campaign-scoped Realms suggested feed, detail editing, and a
 * session-axis timeline tracer (CAMP-5).
 */
export function HooksTab({ campaignId }: { campaignId: string }) {
  const utils = trpc.useUtils();
  const hooks = trpc.hooks.list.useQuery({ campaignId });
  const world = trpc.campaigns.world.useQuery({ campaignId });
  const entities = trpc.realms.list.useQuery();
  const sessions = trpc.sessions.list.useQuery({ campaignId });

  const [view, setView] = useState<HooksView>("kanban");
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
  const accept = trpc.hooks.acceptFromRealms.useMutation({ onSuccess: refresh });

  const list = (hooks.data ?? []) as Hook[];
  const grouped = groupHooksByStatus(list);
  const selected = list.find((h) => h.id === selectedId) ?? null;

  const suggestedFromRealms = useMemo(
    () =>
      pendingRealmHooks({
        worldEntityIds: (world.data ?? []).map((row) => row.id),
        entities: (entities.data ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          data: row.data,
        })),
        accepted: list,
      }),
    [world.data, entities.data, list],
  );

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
        <div className="flex rounded border border-lore-border text-sm">
          <ViewToggle
            active={view === "kanban"}
            onClick={() => setView("kanban")}
            label="Kanban"
          />
          <ViewToggle
            active={view === "timeline"}
            onClick={() => setView("timeline")}
            label="Timeline"
          />
        </div>
      </div>

      <NewHookForm campaignId={campaignId} onCreated={refresh} />

      {hooks.isLoading ? (
        <p className="text-sm text-lore-muted">Loading hooks…</p>
      ) : view === "kanban" ? (
        <div className="grid gap-3 lg:grid-cols-5">
          {HOOK_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              hooks={grouped[status]}
              pending={
                status === "suggested" ? suggestedFromRealms : undefined
              }
              selectedId={selectedId}
              dragId={dragId}
              onSelect={setSelectedId}
              onDragStart={setDragId}
              onDragEnd={() => setDragId(null)}
              onDrop={onDrop}
              onAccept={(pending) =>
                accept.mutate({
                  campaignId,
                  entityId: pending.entityId,
                  title: pending.title,
                  summary: pending.summary,
                  templateId: pending.templateId,
                })
              }
              acceptBusy={accept.isPending}
            />
          ))}
        </div>
      ) : (
        <HookTimeline
          hooks={list}
          sessions={sessions.data ?? []}
          onSelect={setSelectedId}
          selectedId={selectedId}
        />
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
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function ViewToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 transition-colors ${
        active
          ? "bg-lore-accent-dim text-lore-text"
          : "text-lore-muted hover:text-lore-text"
      }`}
    >
      {label}
    </button>
  );
}

function KanbanColumn({
  status,
  hooks,
  pending,
  selectedId,
  dragId,
  onSelect,
  onDragStart,
  onDragEnd,
  onDrop,
  onAccept,
  acceptBusy,
}: {
  status: HookStatus;
  hooks: Hook[];
  pending?: PendingRealmHook[];
  selectedId: string | null;
  dragId: string | null;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (status: HookStatus) => void;
  onAccept: (hook: PendingRealmHook) => void;
  acceptBusy: boolean;
}) {
  const pendingCount = pending?.length ?? 0;

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(status)}
      className="flex min-h-[120px] flex-col gap-2 rounded-lg border border-lore-border bg-lore-bg/40 p-2"
    >
      <div className="flex items-center justify-between px-1 text-xs uppercase tracking-widest text-lore-muted">
        <span>{HOOK_STATUS_LABEL[status]}</span>
        <span>{hooks.length + pendingCount}</span>
      </div>

      {pending?.map((hook) => (
        <div
          key={`${hook.entityId}:${hook.title}`}
          className="rounded border border-dashed border-lore-border bg-lore-surface/60 p-2 text-left text-sm"
        >
          <span className="line-clamp-2 font-medium text-lore-text">
            {hook.title}
          </span>
          <span className="mt-1 block text-[10px] uppercase tracking-wide text-lore-muted">
            {hook.entityName} · Realms
          </span>
          <button
            type="button"
            onClick={() => onAccept(hook)}
            disabled={acceptBusy}
            className="mt-2 rounded border border-lore-accent px-2 py-1 text-xs text-lore-accent transition-colors hover:bg-lore-accent-dim disabled:opacity-40"
          >
            Accept → Open
          </button>
        </div>
      ))}

      {hooks.map((hook) => (
        <button
          key={hook.id}
          type="button"
          draggable
          onDragStart={() => onDragStart(hook.id)}
          onDragEnd={onDragEnd}
          onClick={() => onSelect(hook.id)}
          className={`cursor-grab rounded border bg-lore-surface p-2 text-left text-sm transition-colors active:cursor-grabbing ${
            hook.id === selectedId
              ? "border-lore-accent"
              : "border-lore-border hover:border-lore-accent"
          } ${hook.id === dragId ? "opacity-60" : ""}`}
        >
          <span className="line-clamp-2 font-medium text-lore-text">
            {hook.title}
          </span>
          {hook.summary && (
            <span className="mt-1 line-clamp-2 block text-xs text-lore-muted">
              {hook.summary}
            </span>
          )}
          {hook.sourceEntityId && (
            <span className="mt-1 block text-[10px] uppercase tracking-wide text-lore-muted">
              from Realms
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function HookTimeline({
  hooks,
  sessions,
  onSelect,
  selectedId,
}: {
  hooks: Hook[];
  sessions: { id: string; endedAt: Date | string }[];
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  const sortedSessions = useMemo(
    () =>
      [...sessions].sort(
        (a, b) =>
          new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime(),
      ),
    [sessions],
  );

  if (hooks.length === 0) {
    return (
      <p className="text-sm text-lore-muted">
        No hooks yet — add one or accept a Realms hook from the Kanban view.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-lore-border bg-lore-surface">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-lore-border text-left text-xs uppercase tracking-widest text-lore-muted">
            <th className="px-4 py-3">Hook</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Started</th>
            <th className="px-4 py-3">Last change</th>
            {sortedSessions.map((session, index) => (
              <th key={session.id} className="px-2 py-3 text-center">
                S{index + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hooks.map((hook) => {
            const startSession = sessionIndexForDate(
              sortedSessions,
              hook.createdAt,
            );
            const endSession = sessionIndexForDate(
              sortedSessions,
              hook.updatedAt,
            );
            return (
              <tr
                key={hook.id}
                onClick={() => onSelect(hook.id)}
                className={`cursor-pointer border-b border-lore-border/60 transition-colors hover:bg-lore-bg/40 ${
                  hook.id === selectedId ? "bg-lore-accent-dim/30" : ""
                }`}
              >
                <td className="px-4 py-3 font-medium text-lore-text">
                  {hook.title}
                </td>
                <td className="px-4 py-3 text-lore-muted">
                  {isHookStatus(hook.status)
                    ? HOOK_STATUS_LABEL[hook.status]
                    : hook.status}
                </td>
                <td className="px-4 py-3 text-lore-muted">
                  {startSession ? `Session ${startSession}` : "—"}
                </td>
                <td className="px-4 py-3 text-lore-muted">
                  {endSession ? `Session ${endSession}` : "—"}
                </td>
                {sortedSessions.map((_, index) => {
                  const sessionNum = index + 1;
                  const inSpan =
                    startSession !== null &&
                    endSession !== null &&
                    sessionNum >= Math.min(startSession, endSession) &&
                    sessionNum <= Math.max(startSession, endSession);
                  return (
                    <td key={index} className="px-2 py-3 text-center">
                      {inSpan ? (
                        <span
                          className="inline-block h-2 w-2 rounded-full bg-lore-accent"
                          aria-hidden
                        />
                      ) : (
                        <span className="text-lore-border">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {sortedSessions.length === 0 && (
        <p className="border-t border-lore-border px-4 py-3 text-xs text-lore-muted">
          End a live session to populate the session axis.
        </p>
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
    create.mutate({ campaignId, title: trimmed, summary, status: "open" });
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

function HookDetail({
  hook,
  statusBusy,
  onSetStatus,
  onRemove,
  removing,
  onClose,
  onSaved,
}: {
  hook: Hook;
  statusBusy: boolean;
  onSetStatus: (status: HookStatus) => void;
  onRemove: () => void;
  removing: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(hook.title);
  const [summary, setSummary] = useState(hook.summary);

  const update = trpc.hooks.update.useMutation({
    onSuccess: async () => {
      setEditing(false);
      await onSaved();
    },
  });

  function onSave(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length === 0) return;
    update.mutate({ id: hook.id, title: trimmed, summary });
  }

  return (
    <section className="rounded-lg border border-lore-accent/50 bg-lore-surface p-5">
      <div className="flex items-start justify-between gap-3">
        {editing ? (
          <form onSubmit={onSave} className="min-w-0 flex-1 space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="w-full rounded border border-lore-border bg-lore-bg px-3 py-2 font-display text-xl outline-none focus:border-lore-accent"
            />
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Summary…"
              className="w-full rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm outline-none focus:border-lore-accent"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={update.isPending || title.trim().length === 0}
                className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm disabled:opacity-40"
              >
                {update.isPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTitle(hook.title);
                  setSummary(hook.summary);
                  setEditing(false);
                }}
                className="rounded border border-lore-border px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              {update.error && (
                <span className="text-sm text-red-400">{update.error.message}</span>
              )}
            </div>
          </form>
        ) : (
          <>
            <div className="min-w-0">
              <h3 className="font-display text-xl">{hook.title}</h3>
              {hook.summary && (
                <p className="mt-2 text-sm text-lore-muted">{hook.summary}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-sm text-lore-muted hover:text-lore-text"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-lore-muted hover:text-lore-text"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>

      {!editing && hook.sourceEntityId && (
        <p className="mt-2 text-sm">
          <Link
            href={`/realms/${hook.sourceEntityId}`}
            className="text-lore-accent hover:underline"
          >
            Open linked entity →
          </Link>
        </p>
      )}

      {!editing && (
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
      )}
    </section>
  );
}
