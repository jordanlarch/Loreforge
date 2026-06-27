"use client";

export const FAVORED_TERRAINS = [
  "Arctic",
  "Coast",
  "Desert",
  "Forest",
  "Grassland",
  "Mountain",
  "Swamp",
  "Underdark",
] as const;

export const FAVORED_ENEMY_TYPES = [
  "Aberrations",
  "Beasts",
  "Celestials",
  "Constructs",
  "Dragons",
  "Elementals",
  "Fey",
  "Fiends",
  "Giants",
  "Monstrosities",
  "Oozes",
  "Plants",
  "Undead",
  "Two Humanoid races",
] as const;

export function FeatureChoicePicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="mt-4">
      <h3 className="text-xs uppercase tracking-wide text-lore-muted">
        {label}
      </h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-full border px-3 py-1 text-xs ${
              value === opt
                ? "border-lore-accent bg-lore-accent-dim"
                : "border-lore-border text-lore-muted hover:text-lore-text"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RangerFeatureChoices({
  choices,
  onChange,
}: {
  choices: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  return (
    <>
      <FeatureChoicePicker
        label="Favored Enemy"
        options={FAVORED_ENEMY_TYPES}
        value={choices["Favored Enemy"] ?? ""}
        onChange={(v) =>
          onChange({ ...choices, "Favored Enemy": v })
        }
      />
      <FeatureChoicePicker
        label="Natural Explorer — favored terrain"
        options={FAVORED_TERRAINS}
        value={choices["Natural Explorer"] ?? ""}
        onChange={(v) =>
          onChange({ ...choices, "Natural Explorer": v })
        }
      />
    </>
  );
}

export function rangerFeatureChoicesComplete(
  choices: Record<string, string>,
): boolean {
  return Boolean(
    choices["Favored Enemy"]?.trim() && choices["Natural Explorer"]?.trim(),
  );
}
