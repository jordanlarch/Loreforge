/**
 * Sessions tab helpers (CAMP-6, #151) — pure display logic over the MEM-4
 * `sessions` API, kept browser-safe and unit-testable so the cards stay thin.
 */

/** How long after end-session we poll for an async (Trigger.dev) recap. */
export const RECAP_PENDING_MS = 5 * 60 * 1000;

/** Number of chat messages a session covers (its `[startSeq, endSeq)` span). */
export function sessionMessageCount(startSeq: number, endSeq: number): number {
  return Math.max(0, endSeq - startSeq);
}

/** Elapsed time between session start and end (ms), floored at zero. */
export function sessionDurationMs(
  startedAt: Date | string,
  endedAt: Date | string,
): number {
  return Math.max(
    0,
    new Date(endedAt).getTime() - new Date(startedAt).getTime(),
  );
}

/** Human-readable session length for cards and detail headers. */
export function formatSessionDuration(
  startedAt: Date | string,
  endedAt: Date | string,
): string {
  const totalMinutes = Math.floor(sessionDurationMs(startedAt, endedAt) / 60_000);
  if (totalMinutes < 1) return "<1m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** True when a session row is still waiting on a durable recap job. */
export function isRecapPending(
  recap: string,
  endedAt: Date | string,
  now = Date.now(),
): boolean {
  if (recap.trim()) return false;
  return now - new Date(endedAt).getTime() < RECAP_PENDING_MS;
}

export type RecapDisplay = {
  text: string;
  /** True when there's no real recap (render muted / placeholder styling). */
  muted: boolean;
};

export type RecapDisplayOptions = {
  /** Async recap job still in flight (Trigger.dev). */
  pending?: boolean;
};

/**
 * What to show for a session's recap: the recap text, or a muted placeholder
 * when none was generated (AI generation unconfigured, or generation failed —
 * the session is still recorded). MEM-4 leaves `recap` empty in that case.
 */
export function recapDisplay(
  recap: string,
  opts?: RecapDisplayOptions,
): RecapDisplay {
  const text = recap.trim();
  if (text) return { text, muted: false };
  if (opts?.pending) {
    return { text: "Generating recap…", muted: true };
  }
  return {
    text: "No recap was generated for this session.",
    muted: true,
  };
}

export type SessionMessage = {
  kind: string;
  author: string;
  text: string;
};

export type TranscriptFilter = "all" | "gm" | "player" | "rolls" | "events" | "ooc";

export const TRANSCRIPT_FILTERS: readonly TranscriptFilter[] = [
  "all",
  "gm",
  "player",
  "rolls",
  "events",
  "ooc",
];

export const TRANSCRIPT_FILTER_LABEL: Record<TranscriptFilter, string> = {
  all: "All",
  gm: "GM",
  player: "Player",
  rolls: "Dice",
  events: "Events",
  ooc: "OOC",
};

/** Filter transcript rows for the Transcript tab (CAMP-6). */
export function filterTranscriptMessages(
  messages: readonly SessionMessage[],
  filter: TranscriptFilter,
): SessionMessage[] {
  if (filter === "all") return [...messages];
  if (filter === "gm") return messages.filter((m) => m.kind === "gm");
  if (filter === "player") return messages.filter((m) => m.kind === "player");
  if (filter === "rolls") return messages.filter((m) => m.kind === "roll");
  if (filter === "events") return messages.filter((m) => m.kind === "event");
  return messages.filter((m) => m.kind === "ooc");
}

export type SessionStats = {
  messages: number;
  narrative: number;
  events: number;
  combat: number;
  rolls: number;
  attacks: number;
  spells: number;
};

/** Aggregate counts for the Stats tab from a session's chat span. */
export function computeSessionStats(
  messages: readonly SessionMessage[],
): SessionStats {
  const narrative = messages.filter(
    (m) => m.kind === "player" || m.kind === "gm" || m.kind === "ooc",
  );
  const events = messages.filter((m) => m.kind === "event");
  const rolls = messages.filter((m) => m.kind === "roll");
  const combat = [...events, ...rolls];
  const attacks = combat.filter((m) =>
    m.text.toLowerCase().includes("attack"),
  );
  const spells = combat.filter((m) => m.text.toLowerCase().includes("cast"));
  return {
    messages: messages.length,
    narrative: narrative.length,
    events: events.length,
    combat: combat.length,
    rolls: rolls.length,
    attacks: attacks.length,
    spells: spells.length,
  };
}

export type HookSessionRef = {
  id: string;
  title: string;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

/**
 * Plot hooks whose lifecycle changed during a session window (CAMP-6 tracer —
 * approximate until explicit hook↔session links exist).
 */
export function hooksTouchedInSession(
  hooks: readonly HookSessionRef[],
  startedAt: Date | string,
  endedAt: Date | string,
): HookSessionRef[] {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  return hooks.filter((hook) => {
    const created = new Date(hook.createdAt).getTime();
    const updated = new Date(hook.updatedAt).getTime();
    return (
      (created >= start && created <= end) ||
      (updated >= start && updated <= end)
    );
  });
}
