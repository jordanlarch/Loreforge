"use client";

import { useState } from "react";

import {
  classFeaturesForLevel,
  featureResourceKey,
  FIGHTING_STYLES,
  fightingStylePickLevel,
  remainingFeatureUses,
  spendFeatureUse,
  subclassOptionsFor,
  subclassPickLevel,
  type ClassLevel,
} from "@app/engine";

import {
  ResourceBoxes,
  SheetSearchBar,
  SheetSection,
  useSheetSearch,
} from "@/components/character-sheet/sheet-ui";
import type { CharacterSheetMeta } from "@/lib/character-sheet-storage";
import { trpc } from "@/lib/trpc/client";

type FeatureRow = {
  id: string;
  name: string;
  source: string;
  description: string;
  uses?: number;
};

export function FeaturesTab({
  species,
  background,
  classes,
  meta,
  onPatchMeta,
  onUpdateClasses,
  onFeatureUse,
}: {
  species: string;
  background: string;
  classes: ClassLevel[];
  meta: CharacterSheetMeta;
  onPatchMeta: (patch: Partial<CharacterSheetMeta>) => void;
  onUpdateClasses?: (classes: ClassLevel[]) => void;
  onFeatureUse?: (featureName: string) => void;
}) {
  const [search, setSearch] = useState("");
  const bgQuery = trpc.codex.getBackgroundByName.useQuery(
    { name: background },
    { enabled: background.trim().length > 0 },
  );

  const classFeatures: FeatureRow[] = [];
  for (const cl of classes) {
    for (let level = 1; level <= cl.level; level++) {
      for (const f of classFeaturesForLevel(cl.class, level)) {
        if (f.name === "Fighting Style") {
          const style = meta.fightingStyles?.[cl.class];
          classFeatures.push({
            id: featureResourceKey(cl.class, level, f.id),
            name: style ? `Fighting Style: ${style}` : f.name,
            source: `${cl.class} ${level}`,
            description: style
              ? `${f.description} Selected: ${style}.`
              : f.description,
          });
          continue;
        }
        if (
          f.name.includes("Archetype") ||
          f.name.includes("College") ||
          f.name.includes("Domain") ||
          f.name.includes("Tradition") ||
          f.name.includes("Path") ||
          f.name.includes("Oath") ||
          f.name.includes("Origin") ||
          f.name.includes("Patron")
        ) {
          classFeatures.push({
            id: featureResourceKey(cl.class, level, f.id),
            name: cl.subclass ?? f.name,
            source: `${cl.class} ${level}`,
            description: cl.subclass
              ? `${f.description} Selected: ${cl.subclass}.`
              : f.description,
          });
          continue;
        }
        classFeatures.push({
          id: featureResourceKey(cl.class, level, f.id),
          name: f.name,
          source: `${cl.class} ${level}`,
          description: f.description,
          uses: f.uses,
        });
      }
    }
  }

  const speciesTraits: FeatureRow[] = species
    ? [
        {
          id: "species-traits",
          name: "Species traits",
          source: species,
          description: `${species} racial traits from the Codex.`,
        },
      ]
    : [];

  const backgroundFeatures: FeatureRow[] =
    bgQuery.data?.featureEntries.map((entry, i) => ({
      id: `background-${i}`,
      name: entry.name,
      source: background,
      description: entry.description,
    })) ?? [];

  const featRows: FeatureRow[] = (meta.feats ?? []).map((name, i) => ({
    id: `feat-${i}`,
    name,
    source: "Feat",
    description: "Recorded on your character sheet. Mechanical benefits apply where wired.",
  }));

  const all = [...speciesTraits, ...classFeatures, ...backgroundFeatures];
  const filtered = useSheetSearch(all, search, (f) => `${f.name} ${f.source}`);

  const resourceUses = meta.resourceUses ?? {};
  const primary = classes[0];

  function toggleResource(id: string, index: number, total: number) {
    const current = resourceUses[id] ?? Array.from({ length: total }, () => false);
    const next = [...current];
    next[index] = !next[index];
    onPatchMeta({ resourceUses: { ...resourceUses, [id]: next } });
  }

  function useFeature(row: FeatureRow) {
    if (!row.uses || row.uses <= 0) return;
    const spent = spendFeatureUse(resourceUses[row.id], row.uses);
    if (!spent) return;
    onPatchMeta({ resourceUses: { ...resourceUses, [row.id]: spent } });
    onFeatureUse?.(row.name);
  }

  function setFightingStyle(className: string, style: string) {
    onPatchMeta({
      fightingStyles: { ...meta.fightingStyles, [className]: style },
    });
  }

  function setSubclass(className: string, subclass: string) {
    if (!onUpdateClasses) return;
    onUpdateClasses(
      classes.map((c) => (c.class === className ? { ...c, subclass } : c)),
    );
  }

  return (
    <div>
      <SheetSearchBar value={search} onChange={setSearch} />

      {primary && fightingStylePickLevel(primary.class) != null && (
        <SheetSection title="Fighting Style">
          <div className="flex flex-wrap gap-2">
            {FIGHTING_STYLES.map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => setFightingStyle(primary.class, style)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  meta.fightingStyles?.[primary.class] === style
                    ? "border-lore-accent bg-lore-accent-dim"
                    : "border-lore-border text-lore-muted"
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </SheetSection>
      )}

      {classes.map((cl) => {
        const pick = subclassPickLevel(cl.class);
        const options = subclassOptionsFor(cl.class);
        if (!pick || cl.level < pick || options.length === 0) return null;
        return (
          <div key={cl.class} className="mt-4">
            <SheetSection title={`${cl.class} subclass`}>
              <div className="flex flex-wrap gap-2">
                {options.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSubclass(cl.class, sub)}
                    disabled={!onUpdateClasses}
                    className={`rounded border px-3 py-1.5 text-xs disabled:opacity-50 ${
                      cl.subclass === sub
                        ? "border-lore-accent bg-lore-accent-dim"
                        : "border-lore-border text-lore-muted"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </SheetSection>
          </div>
        );
      })}

      <div className="mt-4">
        <SheetSection title="Species Traits">
          <FeatureList
            rows={filtered.filter((r) => r.id.startsWith("species"))}
            resourceUses={resourceUses}
            onToggleResource={toggleResource}
            onUseFeature={useFeature}
          />
        </SheetSection>
      </div>

      <div className="mt-4">
        <SheetSection title="Class Features">
          <FeatureList
            rows={filtered.filter(
              (r) =>
                !r.id.startsWith("species") && !r.id.startsWith("background"),
            )}
            resourceUses={resourceUses}
            onToggleResource={toggleResource}
            onUseFeature={useFeature}
          />
        </SheetSection>
      </div>

      <div className="mt-4">
        <SheetSection title="Background">
          {bgQuery.isLoading && background ? (
            <p className="text-sm text-lore-muted">Loading background…</p>
          ) : (
            <FeatureList
              rows={filtered.filter((r) => r.id.startsWith("background"))}
              resourceUses={resourceUses}
              onToggleResource={toggleResource}
              onUseFeature={useFeature}
            />
          )}
        </SheetSection>
      </div>

      <div className="mt-4">
        <SheetSection title="Feats">
          {featRows.length === 0 ? (
            <p className="text-sm text-lore-muted">No feats recorded.</p>
          ) : (
            <FeatureList
              rows={featRows}
              resourceUses={resourceUses}
              onToggleResource={toggleResource}
              onUseFeature={useFeature}
            />
          )}
        </SheetSection>
      </div>
    </div>
  );
}

function FeatureList({
  rows,
  resourceUses,
  onToggleResource,
  onUseFeature,
}: {
  rows: FeatureRow[];
  resourceUses: Record<string, boolean[]>;
  onToggleResource: (id: string, index: number, total: number) => void;
  onUseFeature: (row: FeatureRow) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-lore-muted">None yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const hasUses = row.uses != null && row.uses > 0;
        const remaining = hasUses
          ? remainingFeatureUses(resourceUses[row.id], row.uses!)
          : 0;

        return (
          <li
            key={row.id}
            className="rounded border border-lore-border px-3 py-2 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">{row.name}</div>
                <div className="text-xs text-lore-accent">{row.source}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {hasUses && (
                  <>
                    <ResourceBoxes
                      total={row.uses!}
                      used={
                        resourceUses[row.id] ??
                        Array.from({ length: row.uses! }, () => false)
                      }
                      onToggle={(i) =>
                        onToggleResource(row.id, i, row.uses!)
                      }
                    />
                    <button
                      type="button"
                      onClick={() => onUseFeature(row)}
                      disabled={remaining <= 0}
                      className="rounded border border-lore-accent bg-lore-accent-dim px-2 py-0.5 text-xs text-lore-text disabled:opacity-40"
                    >
                      Use
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="mt-1 text-xs text-lore-muted">{row.description}</p>
          </li>
        );
      })}
    </ul>
  );
}
