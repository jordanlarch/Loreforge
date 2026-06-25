"use client";

import Link from "next/link";
import { useState } from "react";

import {
  HOOK_STATUS_LABEL,
  isHookStatus,
} from "@/lib/campaign-hooks";
import {
  computeSessionStats,
  filterTranscriptMessages,
  formatSessionDuration,
  hooksTouchedInSession,
  isRecapPending,
  recapDisplay,
  sessionMessageCount,
  TRANSCRIPT_FILTER_LABEL,
  TRANSCRIPT_FILTERS,
  type TranscriptFilter,
} from "@/lib/sessions";
import { trpc } from "@/lib/trpc/client";

import {
  PostSessionPins,
  type EndedSessionState,
} from "./post-session-pins";

type Session = {
  id: string;
  startSeq: number;
  endSeq: number;
  recap: string;
  startedAt: Date | string;
  endedAt: Date | string;
};

const DETAIL_TABS = [
  "Recap",
  "Transcript",
  "Combat",
  "Events",
  "Stats",
  "Loot",
  "Media",
] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

/**
 * Sessions tab (#151, CAMP-6): session log + recap cards + per-session deep view
 * (Recap / Transcript / Combat / Events / Stats). Ending a session opens the
 * memory-pin step (PLAY-12).
 */
export function SessionsTab({ campaignId }: { campaignId: string }) {
  const utils = trpc.useUtils();
  const sessions = trpc.sessions.list.useQuery(
    { campaignId },
    {
      refetchInterval: (query) => {
        const rows = (query.state.data ?? []) as Session[];
        return rows.some((s) => isRecapPending(s.recap, s.endedAt)) ? 2000 : false;
      },
    },
  );
  const [ended, setEnded] = useState<EndedSessionState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const end = trpc.sessions.end.useMutation({
    onSuccess: async (res) => {
      await utils.sessions.list.invalidate({ campaignId });
      setEnded({
        sessionId: res.session.id,
        recap: res.session.recap ?? "",
        pending: res.recapPending,
      });
      setSelectedId(res.session.id);
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
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/campaigns/${campaignId}/play`}
            className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent"
          >
            ▶ Start Live Session
          </Link>
          <button
            type="button"
            onClick={() => end.mutate({ campaignId })}
            disabled={end.isPending}
            className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
          >
            {end.isPending ? "Ending…" : "End current session"}
          </button>
        </div>
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <ul className="flex flex-col gap-3">
            {list.map((session, i) => (
              <SessionCard
                key={session.id}
                session={session}
                ordinal={list.length - i}
                selected={selectedId === session.id}
                onSelect={() =>
                  setSelectedId((prev) =>
                    prev === session.id ? null : session.id,
                  )
                }
              />
            ))}
          </ul>
          {selectedId ? (
            <SessionDetail campaignId={campaignId} sessionId={selectedId} />
          ) : (
            <p className="hidden rounded-lg border border-dashed border-lore-border p-8 text-center text-sm text-lore-muted lg:block">
              Select a session to view its recap and transcript.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SessionCard({
  session,
  ordinal,
  selected,
  onSelect,
}: {
  session: Session;
  ordinal: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const recap = recapDisplay(session.recap, {
    pending: isRecapPending(session.recap, session.endedAt),
  });
  const messages = sessionMessageCount(session.startSeq, session.endSeq);
  const duration = formatSessionDuration(session.startedAt, session.endedAt);
  const ended = new Date(session.endedAt);

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full rounded-lg border p-4 text-left transition-colors ${
          selected
            ? "border-lore-accent bg-lore-accent-dim"
            : "border-lore-border bg-lore-surface hover:border-lore-accent/60"
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-lg text-lore-text">
            Session {ordinal}
          </h3>
          <span className="text-xs text-lore-muted">
            {ended.toLocaleString()} · {duration} · {messages}{" "}
            {messages === 1 ? "message" : "messages"}
          </span>
        </div>
        <p
          className={`mt-2 line-clamp-3 whitespace-pre-wrap text-sm ${
            recap.muted ? "italic text-lore-muted" : "text-lore-text"
          }`}
        >
          {recap.text}
        </p>
      </button>
    </li>
  );
}

function SessionDetail({
  campaignId,
  sessionId,
}: {
  campaignId: string;
  sessionId: string;
}) {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<DetailTab>("Recap");
  const [transcriptFilter, setTranscriptFilter] =
    useState<TranscriptFilter>("all");
  const [editingRecap, setEditingRecap] = useState(false);
  const [recapDraft, setRecapDraft] = useState("");

  const detail = trpc.sessions.get.useQuery(
    { campaignId, sessionId },
    {
      refetchInterval: (query) => {
        const session = query.state.data?.session;
        if (!session) return false;
        return isRecapPending(session.recap ?? "", session.endedAt) ? 2000 : false;
      },
    },
  );
  const hooks = trpc.hooks.list.useQuery({ campaignId });

  const updateRecap = trpc.sessions.updateRecap.useMutation({
    onSuccess: async () => {
      setEditingRecap(false);
      await Promise.all([
        utils.sessions.get.invalidate({ campaignId, sessionId }),
        utils.sessions.list.invalidate({ campaignId }),
      ]);
    },
  });
  const pinRecap = trpc.pins.create.useMutation({
    onSuccess: () => utils.pins.list.invalidate({ campaignId }),
  });

  if (detail.isLoading) {
    return (
      <p className="text-sm text-lore-muted lg:sticky lg:top-4">
        Loading session…
      </p>
    );
  }
  if (!detail.data) {
    return (
      <p className="text-sm text-lore-muted lg:sticky lg:top-4">
        Session not found.
      </p>
    );
  }

  const { session, messages } = detail.data;
  const recapPending = isRecapPending(session.recap ?? "", session.endedAt);
  const recap = recapDisplay(session.recap, { pending: recapPending });
  const duration = formatSessionDuration(session.startedAt, session.endedAt);
  const stats = computeSessionStats(messages);
  const engineEvents = messages.filter((m) => m.kind === "event");
  const combat = messages.filter(
    (m) => m.kind === "event" || m.kind === "roll",
  );
  const filteredTranscript = filterTranscriptMessages(
    messages,
    transcriptFilter,
  );
  const touchedHooks = hooksTouchedInSession(
    hooks.data ?? [],
    session.startedAt,
    session.endedAt,
  );

  function startEditRecap() {
    setRecapDraft(session.recap ?? "");
    setEditingRecap(true);
  }

  function onSaveRecap(event: React.FormEvent) {
    event.preventDefault();
    updateRecap.mutate({
      campaignId,
      sessionId,
      recap: recapDraft,
    });
  }

  function onPinRecap() {
    const text = (session.recap ?? "").trim();
    if (text.length === 0) return;
    pinRecap.mutate({ campaignId, content: text.slice(0, 2000) });
  }

  return (
    <section className="rounded-lg border border-lore-border bg-lore-surface p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-lore-muted">
          {new Date(session.endedAt).toLocaleString()} · {duration}
        </p>
        <Link
          href={`/campaigns/${campaignId}/play`}
          className="text-xs text-lore-accent hover:underline"
        >
          Continue in Live Play →
        </Link>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {DETAIL_TABS.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(label)}
            className={`rounded border px-3 py-1 text-xs transition-colors ${
              tab === label
                ? "border-lore-accent bg-lore-accent-dim text-lore-text"
                : "border-lore-border text-lore-muted hover:text-lore-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "Recap" && (
        <div className="flex flex-col gap-3">
          {editingRecap ? (
            <form onSubmit={onSaveRecap} className="flex flex-col gap-2">
              <textarea
                value={recapDraft}
                onChange={(e) => setRecapDraft(e.target.value)}
                maxLength={8000}
                rows={8}
                className="w-full rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm outline-none focus:border-lore-accent"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={updateRecap.isPending}
                  className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm disabled:opacity-40"
                >
                  {updateRecap.isPending ? "Saving…" : "Save recap"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRecap(false)}
                  className="rounded border border-lore-border px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </div>
              {updateRecap.error && (
                <p className="text-sm text-red-400">{updateRecap.error.message}</p>
              )}
            </form>
          ) : (
            <>
              <p
                className={`whitespace-pre-wrap text-sm ${
                  recap.muted ? "italic text-lore-muted" : "text-lore-text"
                }`}
              >
                {recap.text}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={startEditRecap}
                  disabled={recapPending}
                  className="rounded border border-lore-border px-3 py-1.5 text-xs transition-colors hover:border-lore-accent disabled:opacity-40"
                >
                  Edit recap
                </button>
                <button
                  type="button"
                  onClick={onPinRecap}
                  disabled={
                    pinRecap.isPending || !(session.recap ?? "").trim()
                  }
                  className="rounded border border-lore-accent px-3 py-1.5 text-xs text-lore-accent transition-colors hover:bg-lore-accent-dim disabled:opacity-40"
                >
                  {pinRecap.isPending ? "Pinning…" : "📌 Pin recap to memory"}
                </button>
                {pinRecap.isSuccess && (
                  <span className="self-center text-xs text-lore-muted">
                    Pinned.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "Transcript" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {TRANSCRIPT_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setTranscriptFilter(filter)}
                className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide transition-colors ${
                  transcriptFilter === filter
                    ? "border-lore-accent text-lore-accent"
                    : "border-lore-border text-lore-muted hover:text-lore-text"
                }`}
              >
                {TRANSCRIPT_FILTER_LABEL[filter]}
              </button>
            ))}
          </div>
          <TranscriptList
            rows={filteredTranscript}
            empty="No messages match this filter."
          />
        </div>
      )}

      {tab === "Combat" && (
        <TranscriptList
          rows={combat}
          empty="No engine events or rolls recorded for this session."
        />
      )}

      {tab === "Events" && (
        <TranscriptList
          rows={engineEvents}
          empty="No engine events recorded for this session."
        />
      )}

      {tab === "Stats" && (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="Messages" value={stats.messages} />
            <Stat label="Narrative lines" value={stats.narrative} />
            <Stat label="Engine events" value={stats.events} />
            <Stat label="Combat rows" value={stats.combat} />
            <Stat label="Dice rolls" value={stats.rolls} />
            <Stat label="Attacks logged" value={stats.attacks} />
            <Stat label="Spell casts" value={stats.spells} />
            <Stat label="Duration" value={duration} text />
          </dl>
          <div>
            <h4 className="text-xs uppercase tracking-widest text-lore-muted">
              Hooks touched
            </h4>
            {touchedHooks.length === 0 ? (
              <p className="mt-2 text-sm text-lore-muted">
                No plot hooks were created or updated during this session window.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {touchedHooks.map((hook) => (
                  <li
                    key={hook.id}
                    className="rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm"
                  >
                    <span className="text-lore-text">{hook.title}</span>
                    <span className="ml-2 text-xs text-lore-muted">
                      {isHookStatus(hook.status)
                        ? HOOK_STATUS_LABEL[hook.status]
                        : hook.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "Loot" && (
        <p className="text-sm text-lore-muted">
          Loot tracking is not wired yet — session chat mentions of treasure and
          inventory changes will surface here in a later pass. For now, search the
          transcript for item names or check character sheets after the session.
        </p>
      )}

      {tab === "Media" && (
        <p className="text-sm text-lore-muted">
          Session media (maps, portraits, uploaded images) is deferred to v1.5.
          Recaps and transcripts are the canonical record for this session.
        </p>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  text,
}: {
  label: string;
  value: number | string;
  text?: boolean;
}) {
  return (
    <div className="rounded border border-lore-border bg-lore-bg px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-lore-muted">{label}</dt>
      <dd
        className={
          text
            ? "mt-0.5 text-sm text-lore-text"
            : "font-display text-xl text-lore-text"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function TranscriptList({
  rows,
  empty,
}: {
  rows: { author: string; text: string; kind: string }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm italic text-lore-muted">{empty}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <li
          key={i}
          className="rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm"
        >
          <span className="text-xs uppercase tracking-wide text-lore-muted">
            {row.kind === "gm"
              ? "GM"
              : row.kind === "player"
                ? row.author
                : row.kind}
          </span>
          <p className="mt-0.5 whitespace-pre-wrap text-lore-text">{row.text}</p>
        </li>
      ))}
    </ul>
  );
}
