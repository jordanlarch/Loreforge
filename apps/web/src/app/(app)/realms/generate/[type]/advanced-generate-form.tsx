"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { trpc } from "@/lib/trpc/client";
import {
  REALM_FIELDS,
  REALM_TYPE_LABEL,
  isCascadeParent,
  type RealmEntityType,
  type RealmFieldDescriptor,
} from "@/lib/realms";

import { CascadeProgress } from "../../generate-form";

const inputClass =
  "w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent";

const SURPRISE_CONCEPTS = [
  "an isolated frontier outpost clinging to the edge of a haunted wood",
  "a once-grand institution now fallen to corruption and quiet rot",
  "a vibrant crossroads where three uneasy cultures mingle",
  "a place still scarred by an old catastrophe no one will name",
  "a hidden refuge for those fleeing a distant, grinding war",
  "a site of pilgrimage tangled up with profiteers and zealots",
  "a prosperous facade hiding a desperate, dangerous secret",
];

/** Advanced Form input fields per type (data-driven). NPC is mechanical, so it
 * exposes guidance inputs rather than its full stat block (use the manual form
 * for that); the other seven reuse their descriptive field descriptors. */
function advancedFieldsFor(
  type: RealmEntityType,
): readonly RealmFieldDescriptor[] {
  if (type === "npc") {
    return [
      { key: "species", label: "Species", kind: "text", placeholder: "Human, Dwarf…" },
      { key: "role", label: "Role", kind: "text", placeholder: "Blacksmith, Captain…" },
      { key: "alignment", label: "Alignment", kind: "text", placeholder: "Neutral Good" },
      { key: "level", label: "Suggested level", kind: "number", min: 1, max: 20 },
    ];
  }
  return REALM_FIELDS[type];
}

export function AdvancedGenerateForm({ type }: { type: RealmEntityType }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const status = trpc.realms.generatorStatus.useQuery();
  const fields = advancedFieldsFor(type);

  const [concept, setConcept] = useState("");
  const [values, setValues] = useState<Record<string, string | number>>({});
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

  function setField(key: string, value: string | number | "") {
    setValues((prev) => {
      const next = { ...prev };
      if (value === "") delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function buildPayload() {
    const set: Record<string, string | number> = {};
    for (const f of fields) {
      const v = values[f.key];
      if (v === undefined || v === "") continue;
      set[f.key] = v;
    }
    if (type === "npc") {
      const hints = {
        species: typeof set.species === "string" ? set.species : undefined,
        role: typeof set.role === "string" ? set.role : undefined,
        level: typeof set.level === "number" ? set.level : undefined,
      };
      const seed: Record<string, string | number> = {};
      for (const key of ["species", "role", "alignment"] as const) {
        const v = set[key];
        if (v !== undefined) seed[key] = v;
      }
      return {
        type,
        concept: concept.trim(),
        hints,
        seed: Object.keys(seed).length > 0 ? seed : undefined,
      };
    }
    return {
      type,
      concept: concept.trim(),
      seed: Object.keys(set).length > 0 ? set : undefined,
    };
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!concept.trim()) return;
    const payload = buildPayload();
    if (background && backgroundAvailable) generateAsync.mutate(payload);
    else generate.mutate(payload);
  }

  function surpriseMe() {
    const pick =
      SURPRISE_CONCEPTS[Math.floor(Math.random() * SURPRISE_CONCEPTS.length)]!;
    setConcept(`A ${REALM_TYPE_LABEL[type].toLowerCase()}: ${pick}`);
    setValues((prev) => {
      const next = { ...prev };
      for (const f of fields) {
        if (f.kind === "select" && f.options && f.options.length > 0) {
          next[f.key] =
            f.options[Math.floor(Math.random() * f.options.length)]!;
        }
      }
      return next;
    });
  }

  if (runId) return <CascadeProgress runId={runId} onDone={navigateTo} />;

  const pending = generate.isPending || generateAsync.isPending;
  const error = generate.error ?? generateAsync.error;

  return (
    <form onSubmit={submit} className="mt-6 space-y-6">
      {!configured && (
        <p className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          AI generation isn&apos;t configured yet. Set{" "}
          <code>ANTHROPIC_API_KEY</code> to enable generators.
        </p>
      )}

      <section className="space-y-4 rounded-lg border border-lore-border bg-lore-surface p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs uppercase tracking-widest text-lore-muted">
            Concept
          </h2>
          <button
            type="button"
            onClick={surpriseMe}
            className="rounded border border-lore-border px-3 py-1 text-sm text-lore-muted transition-colors hover:text-lore-text"
          >
            🎲 Surprise Me
          </button>
        </div>
        <textarea
          required
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          rows={3}
          placeholder={`Describe the ${REALM_TYPE_LABEL[type].toLowerCase()} you want to forge…`}
          className={inputClass}
        />
      </section>

      <section className="space-y-4 rounded-lg border border-lore-border bg-lore-surface p-6">
        <h2 className="text-xs uppercase tracking-widest text-lore-muted">
          {type === "npc" ? "Guidance (optional)" : "Preferred details (optional)"}
        </h2>
        <p className="text-xs text-lore-muted">
          Anything you set here is honored exactly; the AI fills in the rest.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div
              key={field.key}
              className={field.kind === "textarea" ? "sm:col-span-2" : ""}
            >
              <AdvancedField
                field={field}
                value={values[field.key]}
                onChange={(v) => setField(field.key, v)}
              />
            </div>
          ))}
        </div>
      </section>

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

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || !concept.trim()}
          className="rounded border border-lore-accent bg-lore-accent-dim px-5 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
        >
          {pending ? "Forging…" : `⚒ Generate ${REALM_TYPE_LABEL[type]}`}
        </button>
      </div>
    </form>
  );
}

function AdvancedField({
  field,
  value,
  onChange,
}: {
  field: RealmFieldDescriptor;
  value: string | number | undefined;
  onChange: (value: string | number | "") => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
        {field.label}
      </span>
      {field.kind === "select" ? (
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">Any</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : field.kind === "number" ? (
        <input
          type="number"
          min={field.min}
          max={field.max}
          value={value === undefined ? "" : Number(value)}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10);
            onChange(Number.isNaN(n) ? "" : n);
          }}
          placeholder="Any"
          className={inputClass}
        />
      ) : field.kind === "textarea" ? (
        <textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={field.placeholder}
          className={inputClass}
        />
      ) : (
        <input
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}
    </label>
  );
}
