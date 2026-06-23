"use client";

import { recapDisplay, sessionMessageCount } from "@/lib/sessions";
import { trpc } from "@/lib/trpc/client";

type Session = {
  id: string;
  startSeq: number;
  endSeq: number;
  recap: string;
  endedAt: Date | string;
};

/**
 * Sessions tab (#151, CAMP-6): the session log + recap cards, driven by the
 * MEM-4 `sessions` API. Lists ended sessions newest-first and lets the DM end the
 * current session (records the chat span + generates/embeds a recap). The
 * per-session deep view (Transcript/Combat/Events/Loot/Media) is a later slice.
 */
export function SessionsTab({ campaignId }: { campaignId: string }) {
  const utils = trpc.useUtils();
  const sessions = trpc.sessions.list.useQuery({ campaignId });

  const end = trpc.sessions.end.useMutation({
    onSuccess: async () => {
      await utils.sessions.list.invalidate({ campaignId });
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
