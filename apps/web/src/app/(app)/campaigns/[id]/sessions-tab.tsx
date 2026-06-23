"use client";

import { useState } from "react";

import { recapDisplay, sessionMessageCount } from "@/lib/sessions";
import { trpc } from "@/lib/trpc/client";

type Session = {
  id: string;
  startSeq: number;
  endSeq: number;
  recap: string;
  endedAt: Date | string;
};

/** The just-ended session shown in the post-session memory-pin step (PLAY-12). */
type EndedSession = { recap: string; pending: boolean };

/**
 * Sessions tab (#151, CAMP-6): the session log + recap cards, driven by the
 * MEM-4 `sessions` API. Lists ended sessions newest-first and lets the DM end the
 * current session (records the chat span + generates/embeds a recap). Ending a
 * session opens the memory-pin step (PLAY-12) to capture durable facts. The
 * per-session deep view (Transcript/Combat/Events/Loot/Media) is a later slice.
 */
export function SessionsTab({ campaignId }: { campaignId: string }) {
  const utils = trpc.useUtils();
  const sessions = trpc.sessions.list.useQuery({ campaignId });
  const [ended, setEnded] = useState<EndedSession | null>(null);

  const end = trpc.sessions.end.useMutation({
    onSuccess: async (res) => {
      await utils.sessions.list.invalidate({ campaignId });
      setEnded({ recap: res.session.recap ?? "", pending: res.recapPending });
    },
  });

  const list = (sessions.data ?? []) as Session[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Sessions</h2>
          <p className="mt-1 text-sm text-lore-muted">
            A log of past sessions and their AI-generated recaps.
          </p>
        </div>
        <button
          type="button"
          onClick={() => end.mutate({ campaignId })}
          disabled={end.isPending}
          className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
        >
          {end.isPending ? "Ending…" : "End current session"}
        </button>
      </div>

      {end.isError && (
        <p className="rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm text-lore-muted">
          {end.error.message}
        </p>
      )}

      {ended && (
        <PostSessionPins
          campaignId={campaignId}
          ended={ended}
          onClose={() => setEnded(null)}
        />
      )}

      {sessions.isLoading ? (
        <p className="text-sm text-lore-muted">Loading sessions…</p>
      ) : list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-lore-border p-8 text-center text-sm text-lore-muted">
          No sessions yet. End a live session to record its recap here.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((session, i) => (
            <SessionCard
              key={session.id}
              session={session}
              ordinal={list.length - i}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Memory-pin step shown right after a session ends (PLAY-12): surfaces the
 * fresh recap and lets the DM quickly capture durable facts as pinned memories
 * (MEM-8) the AI-GM will keep in mind next session. Reuses `pins.create`.
 */
function PostSessionPins({
  campaignId,
  ended,
  onClose,
}: {
  campaignId: string;
  ended: EndedSession;
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

  const recap = recapDisplay(ended.recap);

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
            ended.pending || recap.muted
              ? "italic text-lore-muted"
              : "text-lore-text"
          }`}
        >
          {ended.pending && !ended.recap
            ? "The recap is being generated…"
            : recap.text}
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

function SessionCard({
  session,
  ordinal,
}: {
  session: Session;
  ordinal: number;
}) {
  const recap = recapDisplay(session.recap);
  const messages = sessionMessageCount(session.startSeq, session.endSeq);
  const ended = new Date(session.endedAt);

  return (
    <li className="rounded-lg border border-lore-border bg-lore-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg text-lore-text">
          Session {ordinal}
        </h3>
        <span className="text-xs text-lore-muted">
          {ended.toLocaleString()} · {messages}{" "}
          {messages === 1 ? "message" : "messages"}
        </span>
      </div>
      <p
        className={`mt-2 whitespace-pre-wrap text-sm ${
          recap.muted ? "italic text-lore-muted" : "text-lore-text"
        }`}
      >
        {recap.text}
      </p>
    </li>
  );
}
