"use client";

import Link from "next/link";
import { useState } from "react";

import { trpc } from "@/lib/trpc/client";
import {
  REALM_RELATIONSHIP_KINDS,
  REALM_TYPE_LABEL,
  REL_INVERSE_LABEL,
  REL_LABEL,
  type RealmRelationshipKind,
} from "@/lib/realms";

export function RelationshipPanel({ entityId }: { entityId: string }) {
  const utils = trpc.useUtils();
  const links = trpc.realms.links.useQuery({ entityId });
  const all = trpc.realms.list.useQuery();
  const [adding, setAdding] = useState(false);

  const candidates = (all.data ?? []).filter((e) => e.id !== entityId);

  const unlink = trpc.realms.unlink.useMutation({
    onSuccess: () => utils.realms.links.invalidate({ entityId }),
  });

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-lore-muted">
          Relationships
        </h2>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="rounded border border-lore-border px-2 py-1 text-xs text-lore-muted transition-colors hover:text-lore-text"
        >
          {adding ? "Cancel" : "+ Add link"}
        </button>
      </div>

      {adding && (
        <AddLinkForm
          entityId={entityId}
          candidates={candidates}
          onDone={() => setAdding(false)}
        />
      )}

      {links.isLoading ? (
        <p className="text-sm text-lore-muted">Loading…</p>
      ) : (links.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-lore-muted">
          No links yet. Connect this entity to others in your world.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {(links.data ?? []).map((link) => (
            <li
              key={link.id}
              className="flex items-center justify-between gap-3 rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-lore-muted">
                  {link.direction === "out"
                    ? REL_LABEL[link.kind as RealmRelationshipKind]
                    : REL_INVERSE_LABEL[link.kind as RealmRelationshipKind]}
                </span>
                <Link
                  href={`/realms/${link.other.id}`}
                  className="truncate text-lore-text hover:text-lore-accent"
                >
                  {link.other.name}
                </Link>
                <span className="shrink-0 text-xs uppercase text-lore-muted">
                  {REALM_TYPE_LABEL[link.other.type]}
                </span>
              </span>
              <button
                type="button"
                onClick={() => unlink.mutate({ id: link.id })}
                disabled={unlink.isPending}
                className="shrink-0 text-xs text-lore-muted transition-colors hover:text-red-400 disabled:opacity-50"
                aria-label="Remove link"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddLinkForm({
  entityId,
  candidates,
  onDone,
}: {
  entityId: string;
  candidates: { id: string; name: string; type: string }[];
  onDone: () => void;
}) {
  const utils = trpc.useUtils();
  const [kind, setKind] = useState<RealmRelationshipKind>("located_in");
  const [toId, setToId] = useState("");

  const link = trpc.realms.link.useMutation({
    onSuccess: async () => {
      await utils.realms.links.invalidate({ entityId });
      onDone();
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!toId) return;
    link.mutate({ fromId: entityId, toId, kind });
  }

  const selectClass =
    "rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent";

  if (candidates.length === 0) {
    return (
      <p className="mb-4 rounded border border-dashed border-lore-border p-4 text-sm text-lore-muted">
        Create another entity first — links connect two entities in your world.
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-lore-border bg-lore-surface p-4"
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-lore-muted">
          Relationship
        </span>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as RealmRelationshipKind)}
          className={selectClass}
        >
          {REALM_RELATIONSHIP_KINDS.map((k) => (
            <option key={k} value={k}>
              {REL_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs uppercase tracking-wide text-lore-muted">
          Target
        </span>
        <select
          required
          value={toId}
          onChange={(e) => setToId(e.target.value)}
          className={selectClass}
        >
          <option value="">Select an entity…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.type})
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={link.isPending || !toId}
        className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
      >
        {link.isPending ? "Linking…" : "Link"}
      </button>
      {link.error && (
        <p className="w-full text-sm text-red-400">{link.error.message}</p>
      )}
    </form>
  );
}
