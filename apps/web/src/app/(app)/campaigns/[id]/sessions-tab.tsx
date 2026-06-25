"use client";

import { useState } from "react";

import { isRecapPending, recapDisplay, sessionMessageCount } from "@/lib/sessions";
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
  endedAt: Date | string;
};

const DETAIL_TABS = ["Recap", "Transcript", "Combat", "Stats", "Loot", "Media"] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

/**
 * Sessions tab (#151, CAMP-6): session log + recap cards + per-session deep view
 * (Recap / Transcript / Combat). Ending a session opens the memory-pin step
 * (PLAY-12).
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
            {ended.toLocaleString()} · {messages}{" "}
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
  const [tab, setTab] = useState<DetailTab>("Recap");
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
  const recap = recapDisplay(session.recap, {
    pending: isRecapPending(session.recap, session.endedAt),
  });
  const narrative = messages.filter(
    (m) => m.kind === "player" || m.kind === "gm" || m.kind === "ooc",
  );
  const combat = messages.filter(
    (m) => m.kind === "event" || m.kind === "roll",
  );
  const rolls = messages.filter((m) => m.kind === "roll");
  const attacks = combat.filter((m) =>
    m.text.toLowerCase().includes("attack"),
  );
  const spells = combat.filter((m) => m.text.toLowerCase().includes("cast"));

  return (
    <section className="rounded-lg border border-lore-border bg-lore-surface p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
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
        <p
          className={`whitespace-pre-wrap text-sm ${
            recap.muted ? "italic text-lore-muted" : "text-lore-text"
          }`}
        >
          {recap.text}
        </p>
      )}

      {tab === "Transcript" && (
        <TranscriptList
          rows={narrative}
          empty="No player or GM messages in this session span."
        />
      )}

      {tab === "Combat" && (
        <TranscriptList
          rows={combat}
          empty="No engine events or rolls recorded for this session."
        />
      )}

      {tab === "Stats" && (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Messages" value={messages.length} />
          <Stat label="Narrative lines" value={narrative.length} />
          <Stat label="Combat events" value={combat.length} />
          <Stat label="Dice rolls" value={rolls.length} />
          <Stat label="Attacks logged" value={attacks.length} />
          <Stat label="Spell casts" value={spells.length} />
        </dl>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-lore-border bg-lore-bg px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-lore-muted">{label}</dt>
      <dd className="font-display text-xl text-lore-text">{value}</dd>
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
            {row.kind === "gm" ? "GM" : row.kind === "player" ? row.author : row.kind}
          </span>
          <p className="mt-0.5 whitespace-pre-wrap text-lore-text">{row.text}</p>
        </li>
      ))}
    </ul>
  );
}
