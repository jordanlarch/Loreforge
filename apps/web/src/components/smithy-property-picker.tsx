"use client";

import {
  SRD_WEAPON_MASTERIES,
  SRD_WEAPON_PROPERTIES,
  type CatalogPropertyEntry,
} from "@app/engine";

const checkboxClass = "accent-lore-accent";

function PropertyCheckbox({
  entry,
  checked,
  onChange,
}: {
  entry: CatalogPropertyEntry;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded border border-lore-border/60 bg-lore-bg/40 p-2 text-sm hover:border-lore-accent/50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`mt-0.5 ${checkboxClass}`}
      />
      <span>
        <span className="font-medium text-lore-text">{entry.name}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-lore-muted">
          {entry.description}
        </span>
      </span>
    </label>
  );
}

export function SmithyPropertyPicker({
  propertyKeys,
  masteryKey,
  onPropertyKeysChange,
  onMasteryKeyChange,
}: {
  propertyKeys: readonly string[];
  masteryKey: string | null;
  onPropertyKeysChange: (keys: string[]) => void;
  onMasteryKeyChange: (key: string | null) => void;
}) {
  const selected = new Set(propertyKeys);

  function toggleProperty(key: string, on: boolean) {
    const next = new Set(propertyKeys);
    if (on) next.add(key);
    else next.delete(key);
    onPropertyKeysChange([...next]);
  }

  return (
    <section className="space-y-4 rounded border border-lore-border/70 p-4">
      <div>
        <h3 className="text-xs uppercase tracking-widest text-lore-muted">
          Weapon properties
        </h3>
        <p className="mt-1 text-xs text-lore-muted">
          SRD 5.2 properties from the Codex catalog. Stored as structured{" "}
          <code className="text-lore-accent">propertyDetails</code> on the item
          definition.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {SRD_WEAPON_PROPERTIES.map((entry) => (
          <PropertyCheckbox
            key={entry.key}
            entry={entry}
            checked={selected.has(entry.key)}
            onChange={(on) => toggleProperty(entry.key, on)}
          />
        ))}
      </div>

      <div>
        <h4 className="text-xs uppercase tracking-widest text-lore-muted">
          Weapon mastery (optional)
        </h4>
        <p className="mt-1 text-xs text-lore-muted">
          2024 SRD — one mastery per weapon.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-lore-muted">
            <input
              type="radio"
              name="weapon-mastery"
              checked={masteryKey === null}
              onChange={() => onMasteryKeyChange(null)}
              className={checkboxClass}
            />
            None
          </label>
          {SRD_WEAPON_MASTERIES.map((entry) => (
            <label
              key={entry.key}
              className="flex cursor-pointer items-start gap-2 rounded border border-lore-border/60 bg-lore-bg/40 p-2 text-sm hover:border-lore-accent/50"
            >
              <input
                type="radio"
                name="weapon-mastery"
                checked={masteryKey === entry.key}
                onChange={() => onMasteryKeyChange(entry.key)}
                className={`mt-0.5 ${checkboxClass}`}
              />
              <span>
                <span className="font-medium text-lore-text">{entry.name}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-lore-muted">
                  {entry.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
