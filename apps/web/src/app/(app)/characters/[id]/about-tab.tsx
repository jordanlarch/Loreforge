"use client";

import type { ReactNode } from "react";

import {
  EMPTY_CHARACTERISTICS,
  type CharacterSheetMeta,
  type PersonalityFields,
} from "@/lib/character-sheet-storage";

const ALIGNMENTS = [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "True Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
];

const SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];

export function AboutTab({
  background,
  personality,
  meta,
  onPatchPersonality,
  onPatchMeta,
}: {
  background: string;
  personality: PersonalityFields;
  meta: CharacterSheetMeta;
  onPatchPersonality: (patch: Partial<PersonalityFields>) => void;
  onPatchMeta: (patch: Partial<CharacterSheetMeta>) => void;
}) {
  const chars = { ...EMPTY_CHARACTERISTICS, ...meta.characteristics };

  return (
    <div className="space-y-6">
      <SheetBlock title="Background">
        <Field label="Name" value={background} readOnly />
        <label className="mt-3 block">
          <span className="text-xs uppercase text-lore-muted">Description</span>
          <textarea
            defaultValue={meta.backgroundDescription ?? ""}
            rows={4}
            onBlur={(e) =>
              onPatchMeta({ backgroundDescription: e.target.value.trim() })
            }
            className="mt-1 w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm"
          />
        </label>
      </SheetBlock>

      <SheetBlock title="Characteristics">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField
            label="Alignment"
            value={chars.alignment}
            options={ALIGNMENTS}
            onCommit={(alignment) =>
              onPatchMeta({ characteristics: { ...chars, alignment } })
            }
          />
          <TextField
            label="Gender"
            value={chars.gender}
            onCommit={(gender) =>
              onPatchMeta({ characteristics: { ...chars, gender } })
            }
          />
          <TextField
            label="Eye color"
            value={chars.eyeColor}
            onCommit={(eyeColor) =>
              onPatchMeta({ characteristics: { ...chars, eyeColor } })
            }
          />
          <SelectField
            label="Size"
            value={chars.size}
            options={SIZES}
            onCommit={(size) =>
              onPatchMeta({ characteristics: { ...chars, size } })
            }
          />
          <TextField
            label="Height"
            value={chars.height}
            onCommit={(height) =>
              onPatchMeta({ characteristics: { ...chars, height } })
            }
          />
          <TextField
            label="Faith"
            value={chars.faith}
            onCommit={(faith) =>
              onPatchMeta({ characteristics: { ...chars, faith } })
            }
          />
          <TextField
            label="Hair"
            value={chars.hairColor}
            onCommit={(hairColor) =>
              onPatchMeta({ characteristics: { ...chars, hairColor } })
            }
          />
          <TextField
            label="Skin"
            value={chars.skinColor}
            onCommit={(skinColor) =>
              onPatchMeta({ characteristics: { ...chars, skinColor } })
            }
          />
          <TextField
            label="Age"
            value={chars.age}
            onCommit={(age) =>
              onPatchMeta({ characteristics: { ...chars, age } })
            }
          />
          <TextField
            label="Weight"
            value={chars.weight}
            onCommit={(weight) =>
              onPatchMeta({ characteristics: { ...chars, weight } })
            }
          />
        </div>
      </SheetBlock>

      {(
        [
          ["Personality traits", "traits"],
          ["Ideals", "ideals"],
          ["Bonds", "bonds"],
          ["Flaws", "flaws"],
        ] as const
      ).map(([label, key]) => (
        <SheetBlock key={key} title={label}>
          <textarea
            defaultValue={personality[key]}
            rows={2}
            onBlur={(e) => onPatchPersonality({ [key]: e.target.value.trim() })}
            className="w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm"
          />
        </SheetBlock>
      ))}

      <SheetBlock title="Appearance">
        <textarea
          defaultValue={meta.appearance ?? ""}
          placeholder="Your appearance is unclear…"
          rows={3}
          onBlur={(e) => onPatchMeta({ appearance: e.target.value.trim() })}
          className="w-full rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm"
        />
      </SheetBlock>
    </div>
  );
}

function SheetBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-lore-border bg-lore-surface p-4">
      <h3 className="mb-3 font-display text-xs uppercase tracking-widest text-lore-accent">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  readOnly,
}: {
  label: string;
  value: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs uppercase text-lore-muted">{label}</span>
      <input
        defaultValue={value}
        readOnly={readOnly}
        className="mt-1 w-full rounded border border-lore-border bg-lore-bg px-3 py-2"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
}) {
  return (
    <label className="block text-xs">
      <span className="uppercase text-lore-muted">{label}</span>
      <input
        defaultValue={value}
        onBlur={(e) => {
          const next = e.target.value.trim();
          if (next !== value) onCommit(next);
        }}
        className="mt-1 w-full rounded border border-lore-border bg-lore-bg px-2 py-1.5 text-sm"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onCommit,
}: {
  label: string;
  value: string;
  options: string[];
  onCommit: (v: string) => void;
}) {
  return (
    <label className="block text-xs">
      <span className="uppercase text-lore-muted">{label}</span>
      <select
        defaultValue={value || options[0]}
        onChange={(e) => onCommit(e.target.value)}
        className="mt-1 w-full rounded border border-lore-border bg-lore-bg px-2 py-1.5 text-sm"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
