"use client";

import { useState } from "react";

import { trpc } from "@/lib/trpc/client";

/** The just-ended session shown in the post-session memory-pin step (PLAY-12). */
export type EndedSessionState = { recap: string; pending: boolean };

/**
 * Memory-pin step after ending a session (PLAY-12): surfaces the fresh recap
 * and lets the DM capture durable facts as pinned memories (MEM-8).
 */
export function PostSessionPins({
  campaignId,
  ended,
  onClose,
}: {
  campaignId: string;
  ended: EndedSessionState;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [content, setContent] = useState("");
  const [pinned, setPinned] = useState<string[]>([]);

  const pin = trpc.pins.create.useMutation({
    onSuccess: async (row) => {
      if (row) setPinned((prev) => [row.content, ...prev]);
      setContent("");
      await utils.pins.list.invalidate({ campaignId });
    },
  });

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = content.trim();
    if (trimmed.length === 0) return;
    pin.mutate({ campaignId, content: trimmed });
  }

  const recap = ended.recap.trim();

  return (
    <section className="rounded-lg border border-lore-accent bg-lore-accent-dim p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-lore-text">Session ended</h3>
          <p className="mt-1 text-sm text-lore-muted">
            Pin any key facts the AI-GM should keep in mind next session.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded border border-lore-border px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
        >
          Done
        </button>
      </div>

      <div className="mt-3 rounded border border-lore-border bg-lore-bg p-3">
        <span className="text-xs uppercase tracking-widest text-lore-muted">
          Recap
        </span>
        <p
          className={`mt-1 whitespace-pre-wrap text-sm ${
            ended.pending || !recap
              ? "italic text-lore-muted"
              : "text-lore-text"
          }`}
        >
          {ended.pending && !recap
            ? "The recap is being generated…"
            : recap || "No recap was generated for this session."}
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
          placeholder="e.g. The party swore an oath to the Ashen Hand."
          className="min-w-0 flex-1 rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm outline-none focus:border-lore-accent"
        />
        <button
          type="submit"
          disabled={pin.isPending || content.trim().length === 0}
          className="shrink-0 rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
        >
          {pin.isPending ? "Pinning…" : "📌 Pin fact"}
        </button>
      </form>
      {pin.error && (
        <p className="mt-2 text-sm text-red-400">{pin.error.message}</p>
      )}

      {pinned.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {pinned.map((text, idx) => (
            <li key={idx} className="text-sm text-lore-text">
              📌 {text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
