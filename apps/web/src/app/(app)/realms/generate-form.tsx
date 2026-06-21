"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { trpc } from "@/lib/trpc/client";
import {
  REALM_ENTITY_TYPES,
  REALM_TYPE_LABEL,
  isCascadeParent,
  type RealmEntityType,
} from "@/lib/realms";

const inputClass =
  "w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent";

/**
 * Compact "Generate with AI" form (D5/D10). On success the new entity is
 * created server-side and we navigate straight to its inline-editable detail
 * page. NPC-specific hints appear only for NPCs; the tracer focuses on NPC but
 * the form is type-aware for the generators that follow.
 */
export function GenerateForm({
  defaultType = "npc",
  onCancel,
}: {
  defaultType?: RealmEntityType;
  onCancel: () => void;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const status = trpc.realms.generatorStatus.useQuery();

  const [type, setType] = useState<RealmEntityType>(defaultType);
  const [concept, setConcept] = useState("");
  const [role, setRole] = useState("");
  const [level, setLevel] = useState<number | "">("");
  const [background, setBackground] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);

  async function navigateTo(entityId: string) {
    await Promise.all([
      utils.realms.list.invalidate(),
      utils.realms.counts.invalidate(),
    ]);
    router.push(`/realms/${entityId}`);
  }

  const generate = trpc.realms.generate.useMutation({
    onSuccess: (result) => navigateTo(result.entity.id),
  });
  const generateAsync = trpc.realms.generateCascadeAsync.useMutation({
    onSuccess: (result) => setRunId(result.runId),
  });

  const configured = status.data?.configured ?? true;
  const backgroundAvailable =
    Boolean(status.data?.background) && isCascadeParent(type);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!concept.trim()) return;
    const hints =
      type === "npc"
        ? {
            role: role.trim() || undefined,
            level: typeof level === "number" ? level : undefined,
          }
        : undefined;
    const args = { type, concept: concept.trim(), hints };
    if (background && backgroundAvailable) {
      generateAsync.mutate(args);
    } else {
      generate.mutate(args);
    }
  }

  if (runId) {
    return <CascadeProgress runId={runId} onDone={navigateTo} />;
  }

  const pending = generate.isPending || generateAsync.isPending;
  const error = generate.error ?? generateAsync.error;

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-lg border border-lore-accent/40 bg-lore-surface p-6"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lore-accent">✨</span>
          <h3 className="font-display text-lg">Generate with AI</h3>
        </div>
        <Link
          href={`/realms/generate/${type}`}
          className="text-sm text-lore-muted transition-colors hover:text-lore-text"
        >
          Advanced Form →
        </Link>
      </div>

      {!configured && (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          AI generation isn&apos;t configured yet. Set{" "}
          <code>ANTHROPIC_API_KEY</code> to enable generators.
        </p>
      )}

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
          Type
        </span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as RealmEntityType)}
          className={inputClass}
        >
          {REALM_ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {REALM_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
          Concept
        </span>
        <textarea
          required
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          rows={3}
          placeholder={
            type === "npc"
              ? "A grizzled dwarven blacksmith haunted by a war he can't forget…"
              : "Describe what you want the AI to forge…"
          }
          className={inputClass}
        />
      </label>

      {type === "npc" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
              Role (optional)
            </span>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Blacksmith, Captain…"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
              Suggested level (optional)
            </span>
            <input
              type="number"
              min={1}
              max={20}
              value={level}
              onChange={(e) => {
                const v = Number.parseInt(e.target.value, 10);
                setLevel(Number.isNaN(v) ? "" : v);
              }}
              placeholder="e.g. 5"
              className={inputClass}
            />
          </label>
        </div>
      )}

      {backgroundAvailable && (
        <label className="flex items-center gap-2 text-sm text-lore-muted">
          <input
            type="checkbox"
            checked={background}
            onChange={(e) => setBackground(e.target.checked)}
            className="accent-lore-accent"
          />
          Run in background (durable cascade) — generates child stubs too
        </label>
      )}

      {error && <p className="text-sm text-red-400">{error.message}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-lore-border px-4 py-2 text-sm text-lore-muted transition-colors hover:text-lore-text"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !concept.trim()}
          className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
        >
          {pending ? "Forging…" : `⚒ Generate ${REALM_TYPE_LABEL[type]}`}
        </button>
      </div>
    </form>
  );
}

/** Polls a durable cascade run and navigates to the new entity when done. */
export function CascadeProgress({
  runId,
  onDone,
}: {
  runId: string;
  onDone: (entityId: string) => void;
}) {
  const run = trpc.realms.cascadeRun.useQuery(
    { runId },
    {
      refetchInterval: (query) =>
        query.state.data && query.state.data.status !== "pending"
          ? false
          : 1500,
    },
  );

  const status = run.data?.status ?? "pending";
  const entityId = run.data?.entityId ?? null;

  useEffect(() => {
    if (status === "completed" && entityId) onDone(entityId);
  }, [status, entityId, onDone]);

  return (
    <div className="space-y-3 rounded-lg border border-lore-accent/40 bg-lore-surface p-6">
      <div className="flex items-center gap-2">
        <span className="text-lore-accent">✨</span>
        <h3 className="font-display text-lg">Forging your world…</h3>
      </div>
      {status === "failed" ? (
        <p className="text-sm text-red-400">
          {run.data?.error ?? "Generation failed. Please try again."}
        </p>
      ) : status === "completed" ? (
        <p className="text-sm text-lore-muted">Done — opening your entity…</p>
      ) : (
        <p className="text-sm text-lore-muted">
          Generating the entity and its child stubs. This can take a moment.
        </p>
      )}
    </div>
  );
}
