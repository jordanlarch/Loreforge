"use client";

import { useEffect, useRef, useState } from "react";

import {
  DEFAULT_INPUT_MODE,
  INPUT_MODES,
  classifyComposerInput,
  modeLabel,
  type ChatEntry,
  type InputModeId,
} from "@/lib/live-chat";

/**
 * Live-play narrative chat zone (#57): the scrolling GM/player/engine log plus
 * the moded input bar. Entries come from the server-authoritative chat array on
 * the shared Yjs doc, so two tabs see the same conversation. Sending ships raw
 * text + mode over the stateless channel; the server stamps and broadcasts.
 */
export function ChatZone({
  entries,
  onSend,
}: {
  entries: ChatEntry[];
  onSend: (text: string, mode?: string) => void;
}) {
  const [mode, setMode] = useState<InputModeId>(DEFAULT_INPUT_MODE);
  const [text, setText] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  const intent = classifyComposerInput(text);

  function submit() {
    if (intent.kind === "empty") return;
    // Slash/OOC carry their own semantics; only prose uses the mode toggle.
    onSend(text.trim(), intent.kind === "message" ? mode : undefined);
    setText("");
  }

  return (
    <div className="flex h-full min-h-[24rem] flex-col rounded-lg border border-lore-border bg-lore-surface">
      <h2 className="border-b border-lore-border px-4 py-2 text-xs uppercase tracking-wide text-lore-muted">
        Narrative
      </h2>

      <div
        ref={logRef}
        className="flex-1 space-y-2 overflow-y-auto px-4 py-3"
        aria-live="polite"
      >
        {entries.length === 0 ? (
          <p className="text-sm text-lore-muted">
            The tale begins. Speak, act, or{" "}
            <code className="text-lore-accent">/roll 1d20</code> to get going.
          </p>
        ) : (
          entries.map((entry) => <ChatRow key={entry.id} entry={entry} />)
        )}
      </div>

      <Composer
        mode={mode}
        setMode={setMode}
        text={text}
        setText={setText}
        onSubmit={submit}
        intent={intent.kind}
      />
    </div>
  );
}

function ChatRow({ entry }: { entry: ChatEntry }) {
  if (entry.kind === "roll" && entry.dice) {
    return (
      <div className="flex items-center gap-2 rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm">
        <span aria-hidden>🎲</span>
        <span className="text-lore-muted">{entry.author} rolls</span>
        <span className="font-mono text-lore-text">{entry.dice.notation}</span>
        <span className="text-lore-muted">
          [{entry.dice.rolls.join(", ")}]
          {entry.dice.modifier ? (
            <> {entry.dice.modifier > 0 ? "+" : ""}{entry.dice.modifier}</>
          ) : null}
        </span>
        <span className="ml-auto rounded bg-lore-accent-dim px-2 py-0.5 font-semibold text-lore-text">
          {entry.dice.total}
        </span>
      </div>
    );
  }

  if (entry.kind === "event") {
    return (
      <p className="text-center text-xs italic text-lore-muted">{entry.text}</p>
    );
  }

  if (entry.kind === "ooc") {
    return (
      <p className="text-sm text-lore-muted">
        <span className="text-xs uppercase tracking-wide">OOC</span> ({entry.text}
        )
      </p>
    );
  }

  const isGm = entry.kind === "gm";
  const label = modeLabel(entry.mode);
  return (
    <div className="text-sm">
      <span
        className={`mr-2 font-semibold ${isGm ? "text-lore-accent" : "text-lore-text"}`}
      >
        {entry.author}
        {label ? (
          <span className="ml-1 text-xs font-normal text-lore-muted">
            · {label}
          </span>
        ) : null}
      </span>
      <span className={isGm ? "text-lore-muted" : "text-lore-text"}>
        {entry.text}
      </span>
      {entry.mentions && entry.mentions.length > 0 ? (
        <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
          {entry.mentions.map((name) => (
            <EntityChip key={name} name={name} />
          ))}
        </span>
      ) : null}
    </div>
  );
}

/** A referenced world entity rendered as an @Entity chip in narration (#96). */
function EntityChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center rounded border border-lore-accent/40 bg-lore-accent-dim px-1.5 py-0.5 text-xs text-lore-accent">
      @{name}
    </span>
  );
}

function Composer({
  mode,
  setMode,
  text,
  setText,
  onSubmit,
  intent,
}: {
  mode: InputModeId;
  setMode: (m: InputModeId) => void;
  text: string;
  setText: (t: string) => void;
  onSubmit: () => void;
  intent: ReturnType<typeof classifyComposerInput>["kind"];
}) {
  const modeDisabled = intent === "slash" || intent === "ooc";
  return (
    <div className="border-t border-lore-border p-3">
      <div className="mb-2 flex flex-wrap gap-1">
        {INPUT_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            disabled={modeDisabled}
            className={`rounded border px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
              mode === m.id && !modeDisabled
                ? "border-lore-accent text-lore-accent"
                : "border-lore-border text-lore-muted hover:text-lore-text"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          rows={2}
          placeholder={
            modeDisabled
              ? intent === "slash"
                ? "Slash command — e.g. /roll 2d6+1"
                : "Out-of-character aside…"
              : `${modeLabel(mode)}…  (Enter to send, Shift+Enter for a new line)`
          }
          className="min-h-[2.5rem] flex-1 resize-none rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm outline-none focus:border-lore-accent"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={intent === "empty"}
          className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
