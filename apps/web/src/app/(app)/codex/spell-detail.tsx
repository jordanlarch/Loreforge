"use client";

import { useEffect } from "react";

import { trpc } from "@/lib/trpc/client";

type RawSpell = Record<string, unknown>;

function str(raw: RawSpell, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return value ? "Yes" : "No";
  }
  return null;
}

/** Open5e desc fields can be a string or an array of paragraphs. */
function description(raw: RawSpell): string[] {
  const desc = raw.desc ?? raw.description;
  if (Array.isArray(desc)) return desc.filter((d): d is string => typeof d === "string");
  if (typeof desc === "string") return desc.split(/\n\n+/);
  return [];
}

export function SpellDetail({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const spell = trpc.codex.getSpell.useQuery({ slug });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const raw = (spell.data?.raw ?? {}) as RawSpell;
  const meta = (
    [
      ["Casting Time", str(raw, "casting_time")],
      ["Range", str(raw, "range_text", "range")],
      ["Duration", str(raw, "duration")],
      ["Components", str(raw, "components")],
      ["Concentration", str(raw, "concentration")],
      ["Ritual", str(raw, "ritual")],
      ["Material", str(raw, "material")],
    ] as Array<[string, string | null]>
  ).filter(([, v]) => v != null);

  const paragraphs = description(raw);
  const higher = str(raw, "higher_level");

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-black/60"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="h-full w-full max-w-lg overflow-y-auto border-l border-lore-border bg-lore-bg p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">
              {spell.data?.name ?? "…"}
            </h2>
            <p className="mt-1 text-sm capitalize text-lore-muted">
              {[
                spell.data?.level === "0"
                  ? "Cantrip"
                  : spell.data?.level != null
                    ? `Level ${spell.data.level}`
                    : null,
                spell.data?.school,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded border border-lore-border px-2 py-1 text-sm text-lore-muted hover:text-lore-text"
          >
            Close
          </button>
        </div>

        {spell.isLoading && <p className="text-lore-muted">Loading…</p>}

        {meta.length > 0 && (
          <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-lore-border bg-lore-surface p-4 text-sm">
            {meta.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide text-lore-muted">
                  {label}
                </dt>
                <dd className="mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="space-y-3 text-sm leading-relaxed">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {higher && (
            <p>
              <span className="font-semibold">At Higher Levels. </span>
              {higher}
            </p>
          )}
          {!spell.isLoading && paragraphs.length === 0 && (
            <p className="text-lore-muted">
              No description available in the ingested SRD record.
            </p>
          )}
        </div>

        <p className="mt-6 border-t border-lore-border pt-4 text-xs text-lore-muted">
          Source: {spell.data?.source ?? "open5e"} · SRD 5.2 reference
        </p>
      </div>
    </div>
  );
}
