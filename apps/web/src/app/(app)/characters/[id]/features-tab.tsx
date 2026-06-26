"use client";

import { useState } from "react";

import { featureStubsForLevel, type ClassLevel } from "@app/engine";

import {
  ResourceBoxes,
  SheetSearchBar,
  SheetSection,
  StubBanner,
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

const RESOURCE_FEATURES: Record<string, number> = {
  "Second Wind": 1,
  "Action Surge": 1,
  "Fighting Spirit": 3,
};

export function FeaturesTab({
  species,
  background,
  classes,
  meta,
  onPatchMeta,
}: {
  species: string;
  background: string;
  classes: ClassLevel[];
  meta: CharacterSheetMeta;
  onPatchMeta: (patch: Partial<CharacterSheetMeta>) => void;
}) {
  const [search, setSearch] = useState("");

  const classFeatures: FeatureRow[] = [];
  for (const cl of classes) {
    for (let level = 1; level <= cl.level; level++) {
      for (const label of featureStubsForLevel(cl.class, level)) {
        classFeatures.push({
          id: `${cl.class}-${level}-${label}`,
          name: label,
          source: `${cl.class} ${level}`,
          description: `Full ${label} rules load from SRD feature ingest.`,
          uses: RESOURCE_FEATURES[label.split(" / ")[0] ?? label],
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

  return (
    <div>
      <SheetSearchBar value={search} onChange={setSearch} />
      <StubBanner>
        Feature descriptions and &ldquo;Use&rdquo; actions connect to the engine when
        class-feature ingest ships. Resource boxes track manual uses today.
      </StubBanner>

      <SheetSection title="Species Traits">
        <FeatureList
          rows={filtered.filter((r) => r.id.startsWith("species"))}
          resourceUses={resourceUses}
          onToggleResource={toggleResource}
        />
      </SheetSection>

      <div className="mt-4">
        <SheetSection title="Class Features">
          <FeatureList
            rows={filtered.filter((r) => !r.id.startsWith("species") && !r.id.startsWith("background"))}
            resourceUses={resourceUses}
            onToggleResource={toggleResource}
          />
        </SheetSection>
      </div>

      <div className="mt-4">
        <SheetSection title="Background">
          <FeatureList
            rows={filtered.filter((r) => r.id.startsWith("background"))}
            resourceUses={resourceUses}
            onToggleResource={toggleResource}
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
}: {
  rows: FeatureRow[];
  resourceUses: Record<string, boolean[]>;
  onToggleResource: (id: string, index: number, total: number) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-lore-muted">None yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li
          key={row.id}
          className="rounded border border-lore-border px-3 py-2 text-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium">{row.name}</div>
              <div className="text-xs text-lore-accent">{row.source}</div>
            </div>
            {row.uses != null && row.uses > 0 && (
              <ResourceBoxes
                total={row.uses}
                used={resourceUses[row.id] ?? Array.from({ length: row.uses }, () => false)}
                onToggle={(i) => onToggleResource(row.id, i, row.uses!)}
              />
            )}
          </div>
          <p className="mt-1 text-xs text-lore-muted">{row.description}</p>
        </li>
      ))}
    </ul>
  );
}
