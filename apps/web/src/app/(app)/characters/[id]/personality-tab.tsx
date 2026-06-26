"use client";

import {
  mergeNotes,
  parseNotes,
  type PersonalityFields,
} from "@/lib/personality";

function Field({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder: string;
  onCommit: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
        {label}
      </span>
      <textarea
        defaultValue={value}
        placeholder={placeholder}
        rows={2}
        onBlur={(e) => {
          const next = e.target.value.trim();
          if (next !== value) onCommit(next);
        }}
        className="w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
      />
    </label>
  );
}

export function PersonalityTab({
  notes,
  saving,
  onSave,
}: {
  notes: string;
  saving: boolean;
  onSave: (notes: string) => void;
}) {
  const { backstory, personality } = parseNotes(notes);

  function patch(partial: Partial<PersonalityFields>) {
    onSave(mergeNotes(backstory, { ...personality, ...partial }));
  }

  function patchBackstory(next: string) {
    onSave(mergeNotes(next, personality));
  }

  return (
    <div className="space-y-6">
      {saving && <p className="text-xs text-lore-muted">Saving…</p>}
      <Field
        label="Personality traits"
        value={personality.traits}
        placeholder="Two personality traits…"
        onCommit={(traits) => patch({ traits })}
      />
      <Field
        label="Ideals"
        value={personality.ideals}
        placeholder="What drives your character?"
        onCommit={(ideals) => patch({ ideals })}
      />
      <Field
        label="Bonds"
        value={personality.bonds}
        placeholder="Important people, places, or loyalties…"
        onCommit={(bonds) => patch({ bonds })}
      />
      <Field
        label="Flaws"
        value={personality.flaws}
        placeholder="A vice, fear, or weakness…"
        onCommit={(flaws) => patch({ flaws })}
      />
      <label className="block">
        <span className="mb-1 block text-xs uppercase tracking-wide text-lore-muted">
          Backstory
        </span>
        <textarea
          defaultValue={backstory}
          placeholder="Where they came from, what they want…"
          rows={6}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next !== backstory) patchBackstory(next);
          }}
          className="w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm outline-none focus:border-lore-accent"
        />
      </label>
    </div>
  );
}
