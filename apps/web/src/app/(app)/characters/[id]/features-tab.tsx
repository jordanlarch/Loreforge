"use client";

import { useState } from "react";

import {
  classFeaturesForLevel,
  featureResourceKey,
  remainingFeatureUses,
  spendFeatureUse,
  type ClassLevel,
} from "@app/engine";

import {
  ResourceBoxes,
  SheetSearchBar,
  SheetSection,
  useSheetSearch,
} from "@/components/character-sheet/sheet-ui";
import type { CharacterSheetMeta } from "@/lib/character-sheet-storage";

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
  onFeatureUse,
}: {
  species: string;
  background: string;
  classes: ClassLevel[];
  meta: CharacterSheetMeta;
  onPatchMeta: (patch: Partial<CharacterSheetMeta>) => void;
  /** Live Play: post feature use to campaign chat. */
  onFeatureUse?: (featureName: string) => void;
}) {
  const [search, setSearch] = useState("");

  const classFeatures: FeatureRow[] = [];
  for (const cl of classes) {
    for (let level = 1; level <= cl.level; level++) {
      for (const f of classFeaturesForLevel(cl.class, level)) {
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
          id: "species-darkvision",
          name: "Species traits",
          source: species,
          description: `${species} racial traits from the Codex — stub until species ingest wires traits.`,
        },
      ]
    : [];

  const backgroundFeatures: FeatureRow[] = background
    ? [
        {
          id: "background-feature",
          name: "Background feature",
          source: background,
          description: `Feature granted by ${background} background.`,
        },
      ]
    : [];

  const all = [...speciesTraits, ...classFeatures, ...backgroundFeatures];
  const filtered = useSheetSearch(all, search, (f) => `${f.name} ${f.source}`);

  const resourceUses = meta.resourceUses ?? {};

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

  return (
    <div>
      <SheetSearchBar value={search} onChange={setSearch} />

      <SheetSection title="Species Traits">
        <FeatureList
          rows={filtered.filter((r) => r.id.startsWith("species"))}
          resourceUses={resourceUses}
          onToggleResource={toggleResource}
          onUseFeature={useFeature}
        />
      </SheetSection>

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
          <FeatureList
            rows={filtered.filter((r) => r.id.startsWith("background"))}
            resourceUses={resourceUses}
            onToggleResource={toggleResource}
            onUseFeature={useFeature}
          />
        </SheetSection>
      </div>

      <div className="mt-4">
        <SheetSection title="Feats">
          <p className="text-sm text-lore-muted">No feats recorded.</p>
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
