"use client";

import { useEffect, useState } from "react";

import { trpc } from "@/lib/trpc/client";

type Note = {
  id: string;
  title: string;
  body: string;
  shared: boolean;
  updatedAt: Date | string;
};

/**
 * Notes tab (#118, CAMP-9): a campaign-scoped DM scratchpad. A list of notes on
 * the left, an editor on the right, each note DM-only or shared with players.
 * `@Entity` autolink, convert-to-hook, and pin-to-memory are deferred.
 */
export function NotesTab({ campaignId }: { campaignId: string }) {
  const utils = trpc.useUtils();
  const notes = trpc.notes.list.useQuery({ campaignId });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function refresh() {
    await utils.notes.list.invalidate({ campaignId });
  }

  const create = trpc.notes.create.useMutation({
    onSuccess: async (row) => {
      await refresh();
      if (row) setSelectedId(row.id);
    },
  });

  const list = (notes.data ?? []) as Note[];
  const selected = list.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Notes</h2>
        <button
          type="button"
          onClick={() => create.mutate({ campaignId, title: "", body: "" })}
          disabled={create.isPending}
          className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
        >
          {create.isPending ? "Adding…" : "+ New note"}
        </button>
      </div>

      {notes.isLoading ? (
        <p className="text-sm text-lore-muted">Loading notes…</p>
      ) : list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-lore-border p-8 text-center text-sm text-lore-muted">
          No notes yet. Jot down session prep, secrets, or reminders.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <ul className="flex flex-col gap-2">
            {list.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(note.id)}
                  className={`w-full rounded border bg-lore-surface p-3 text-left transition-colors ${
                    note.id === selectedId
                      ? "border-lore-accent"
                      : "border-lore-border hover:border-lore-accent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="line-clamp-1 font-medium text-lore-text">
                      {note.title.trim() || "Untitled note"}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                        note.shared
                          ? "border border-lore-accent text-lore-accent"
                          : "border border-lore-border text-lore-muted"
                      }`}
                    >
                      {note.shared ? "Shared" : "DM"}
                    </span>
                  </div>
                  {note.body.trim() && (
                    <p className="mt-1 line-clamp-2 text-xs text-lore-muted">
                      {note.body}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <NoteEditor
              key={selected.id}
              note={selected}
              onSaved={refresh}
              onDeleted={async () => {
                setSelectedId(null);
                await refresh();
              }}
            />
          ) : (
            <p className="hidden rounded-lg border border-dashed border-lore-border p-8 text-center text-sm text-lore-muted lg:block">
              Select a note to edit it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function NoteEditor({
  note,
  onSaved,
  onDeleted,
}: {
  note: Note;
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [shared, setShared] = useState(note.shared);

  // Re-seed when a different note is selected (key remount also covers this).
  useEffect(() => {
    setTitle(note.title);
    setBody(note.body);
    setShared(note.shared);
  }, [note.id, note.title, note.body, note.shared]);

  const update = trpc.notes.update.useMutation({ onSuccess: onSaved });
  const remove = trpc.notes.remove.useMutation({ onSuccess: onDeleted });

  const dirty =
    title !== note.title || body !== note.body || shared !== note.shared;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-lore-border bg-lore-surface p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title"
        maxLength={200}
        className="rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm font-medium outline-none focus:border-lore-accent"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your note…"
        rows={12}
        maxLength={20000}
        className="resize-y rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm outline-none focus:border-lore-accent"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-lore-muted">
          <input
            type="checkbox"
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
            className="accent-lore-accent"
          />
          Shared with players
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              update.mutate({ id: note.id, title, body, shared })
            }
            disabled={update.isPending || !dirty}
            className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
          >
            {update.isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => remove.mutate({ id: note.id })}
            disabled={remove.isPending}
            className="text-sm text-lore-muted transition-colors hover:text-red-400 disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </div>
    </section>
  );
}
