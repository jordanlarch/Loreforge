"use client";

import { useMemo, useState } from "react";

import {
  classFeaturesForLevel,
  featureResourceKey,
  fightingStyleDescription,
  fightingStylePickLevel,
  formatAsiLabel,
  remainingFeatureUses,
  subclassPickLevel,
  type ClassLevel,
} from "@app/engine";

import { useFightingStyleFeats } from "@/components/character-creation/class-choice-pickers";

import { traitDescription } from "@app/db/traits";

import {
  ResourceBoxes,
  SheetSearchBar,
  SheetSection,
  useSheetSearch,
} from "@/components/character-sheet/sheet-ui";
import { formatFeatType } from "@/lib/codex-background-feat-display";
import type { CharacterSheetMeta } from "@/lib/character-sheet-storage";
import { trpc } from "@/lib/trpc/client";

type FeatureRow = {
  id: string;
  name: string;
  source: string;
  description: string;
  uses?: number;
};

function isSubclassFeatureStub(f: { name: string }): boolean {
  return (
    f.name.includes("Archetype") ||
    f.name.includes("College") ||
    f.name.includes("Domain") ||
    f.name.includes("Tradition") ||
    f.name.includes("Path") ||
    f.name.includes("Oath") ||
    f.name.includes("Origin") ||
    f.name.includes("Patron")
  );
}

export function FeaturesTab({
  characterId,
  species,
  background,
  classes,
  meta,
  onPatchMeta,
  onUpdateClasses,
  onFeatureUse,
  onFeatureResult,
}: {
  characterId: string;
  species: string;
  background: string;
  classes: ClassLevel[];
  meta: CharacterSheetMeta;
  onPatchMeta: (patch: Partial<CharacterSheetMeta>) => void;
  onUpdateClasses?: (classes: ClassLevel[]) => void;
  onFeatureUse?: (featureName: string) => void;
  onFeatureResult?: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [bardicTarget, setBardicTarget] = useState<string>("");
  const utils = trpc.useUtils();
  const useFeatureMut = trpc.characters.useFeature.useMutation({
    onSuccess: (data) => {
      onFeatureResult?.(data.message);
      void utils.characters.get.invalidate({ id: characterId });
    },
  });
  const bgQuery = trpc.codex.getBackgroundByName.useQuery(
    { name: background },
    { enabled: background.trim().length > 0 },
  );
  const speciesQuery = trpc.codex.getSpeciesByName.useQuery(
    { name: species },
    { enabled: species.trim().length > 0 },
  );
  const subclassCatalog = trpc.codex.listSubclasses.useQuery(undefined);
  const { options: fightingStyleOptions, loading: fightingStylesLoading } =
    useFightingStyleFeats();

  function findSubclass(className: string, subclassName: string | undefined) {
    if (!subclassName?.trim() || !subclassCatalog.data) return undefined;
    return subclassCatalog.data.find(
      (s) => s.className === className && s.name === subclassName,
    );
  }

  const featNames = useMemo(
    () => [...new Set((meta.feats ?? []).map((f) => f.trim()).filter(Boolean))],
    [meta.feats],
  );
  const featsQuery = trpc.codex.getFeatsByNames.useQuery(
    { names: featNames },
    { enabled: featNames.length > 0 },
  );

  const subclassFeatureRows: FeatureRow[] = [];
  for (const cl of classes) {
    if (!cl.subclass?.trim()) continue;
    const entry = findSubclass(cl.class, cl.subclass);
    if (!entry?.features?.length) continue;
    for (const [i, f] of entry.features.entries()) {
      if (f.level > cl.level) continue;
      subclassFeatureRows.push({
        id: `subclass-${cl.class}-${f.level}-${i}-${f.name}`,
        name: f.name,
        source: `${cl.subclass} ${f.level}`,
        description: f.description,
      });
    }
  }

  const classFeatures: FeatureRow[] = [];
  for (const cl of classes) {
    const catalogEntry = cl.subclass
      ? findSubclass(cl.class, cl.subclass)
      : undefined;
    const hasExpandedSubclass =
      Boolean(catalogEntry?.features?.length) && Boolean(cl.subclass);

    for (let level = 1; level <= cl.level; level++) {
      for (const f of classFeaturesForLevel(cl.class, level)) {
        if (f.name === "Fighting Style") {
          const style = meta.fightingStyles?.[cl.class];
          classFeatures.push({
            id: featureResourceKey(cl.class, level, f.id),
            name: style ? `Fighting Style: ${style}` : f.name,
            source: `${cl.class} ${level}`,
            description: style
              ? `${fightingStyleDescription(style) ?? f.description} Selected: ${style}.`
              : f.description,
          });
          continue;
        }
        if (isSubclassFeatureStub(f)) {
          if (hasExpandedSubclass) continue;
          const catalogMatch = findSubclass(cl.class, cl.subclass);
          classFeatures.push({
            id: featureResourceKey(cl.class, level, f.id),
            name: cl.subclass ?? f.name,
            source: `${cl.class} ${level}`,
            description: catalogMatch?.description
              ? catalogMatch.description
              : cl.subclass
                ? `${f.description} Selected: ${cl.subclass}.`
                : f.description,
          });
          continue;
        }
        classFeatures.push({
          id: featureResourceKey(cl.class, level, f.id),
          name: f.name,
          source: `${cl.class} ${level}`,
          description: meta.featureChoices?.[f.name]
            ? `${f.description} Selected: ${meta.featureChoices[f.name]}.`
            : f.description,
          uses: f.uses,
        });
      }
    }
  }

  const speciesTraits: FeatureRow[] = speciesQuery.data
    ? speciesQuery.data.traits.map((trait, i) => ({
        id: `species-trait-${i}-${trait}`,
        name: trait,
        source: species,
        description:
          traitDescription(trait) ??
          `${trait} — see the Codex for full rules text.`,
      }))
    : species
      ? [
          {
            id: "species-traits",
            name: "Species traits",
            source: species,
            description: `${species} racial traits from the Codex.`,
          },
        ]
      : [];

  const backgroundFeatures: FeatureRow[] = [];
  if (bgQuery.data) {
    for (const skill of bgQuery.data.skillProficiencies) {
      backgroundFeatures.push({
        id: `background-skill-${skill}`,
        name: `Skill proficiency: ${skill}`,
        source: background,
        description: `You are proficient in ${skill} from your background.`,
      });
    }
    for (const tool of bgQuery.data.toolProficiencies) {
      backgroundFeatures.push({
        id: `background-tool-${tool}`,
        name: `Tool proficiency: ${tool}`,
        source: background,
        description: `You are proficient with ${tool} from your background.`,
      });
    }
    if (bgQuery.data.originFeat) {
      backgroundFeatures.push({
        id: "background-origin-feat",
        name: bgQuery.data.originFeat.name,
        source: `${background} · Origin feat`,
        description:
          bgQuery.data.originFeat.description ||
          "Origin feat granted by your background.",
      });
    } else if (bgQuery.data.originFeatName) {
      backgroundFeatures.push({
        id: "background-origin-feat",
        name: bgQuery.data.originFeatName,
        source: `${background} · Origin feat`,
        description: "Origin feat granted by your background.",
      });
    }
    for (const [i, entry] of bgQuery.data.featureEntries.entries()) {
      backgroundFeatures.push({
        id: `background-feature-${i}`,
        name: entry.name,
        source: background,
        description: entry.description,
      });
    }
  }

  const asiRows: FeatureRow[] = (meta.levelHistory ?? [])
    .filter((entry) => entry.asi)
    .map((entry, i) => ({
      id: `asi-${i}-${entry.at}`,
      name: "Ability Score Improvement",
      source: `Level ${entry.totalLevel} · ${entry.classGain}`,
      description: formatAsiLabel(entry.asi!),
    }));

  const featRows: FeatureRow[] = featNames.map((name, i) => {
    const codex = featsQuery.data?.find(
      (f) => f.name.toLowerCase() === name.toLowerCase(),
    );
    return {
      id: `feat-${i}-${name}`,
      name,
      source: codex?.featType ? formatFeatType(codex.featType) : "Feat",
      description:
        codex?.description ||
        "Recorded on your character sheet. Mechanical benefits apply where wired.",
    };
  });

  const featAndAsiRows = [...asiRows, ...featRows];

  const all = [
    ...speciesTraits,
    ...classFeatures,
    ...subclassFeatureRows,
    ...backgroundFeatures,
  ];
  const filtered = useSheetSearch(all, search, (f) => `${f.name} ${f.source}`);

  const resourceUses = meta.resourceUses ?? {};

  function toggleResource(id: string, index: number, total: number) {
    const current = resourceUses[id] ?? Array.from({ length: total }, () => false);
    const next = [...current];
    next[index] = !next[index];
    onPatchMeta({ resourceUses: { ...resourceUses, [id]: next } });
  }

  function useFeature(
    row: FeatureRow,
    opts?: {
      monkFocusSpend?: "flurry" | "patient_defense" | "step_of_wind";
      beneficiaryId?: string;
    },
  ) {
    if (!row.uses || row.uses <= 0) return;
    const remaining = remainingFeatureUses(resourceUses[row.id], row.uses);
    if (remaining <= 0) return;
    const spentCount = row.uses - remaining;
    useFeatureMut.mutate({
      id: characterId,
      featureKey: row.id,
      useIndex: spentCount,
      monkFocusSpend: opts?.monkFocusSpend,
      beneficiaryId: opts?.beneficiaryId,
    });
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

      {classes.map((cl) => {
        if (fightingStylePickLevel(cl.class) == null || cl.level < fightingStylePickLevel(cl.class)!) {
          return null;
        }
        return (
          <SheetSection key={`style-${cl.class}`} title={`${cl.class} Fighting Style`}>
            {fightingStylesLoading ? (
              <p className="text-sm text-lore-muted">Loading fighting styles…</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {fightingStyleOptions.map((style) => (
                  <ChoiceChip
                    key={style.name}
                    label={style.name}
                    selected={meta.fightingStyles?.[cl.class] === style.name}
                    tooltip={
                      style.description ||
                      fightingStyleDescription(style.name)
                    }
                    onClick={() => setFightingStyle(cl.class, style.name)}
                  />
                ))}
              </div>
            )}
          </SheetSection>
        );
      })}

      {classes.map((cl) => {
        const pick = subclassPickLevel(cl.class);
        const catalogOptions =
          subclassCatalog.data?.filter((s) => s.className === cl.class) ?? [];
        if (!pick || cl.level < pick) return null;
        return (
          <div key={cl.class} className="mt-4">
            <SheetSection title={`${cl.class} subclass`}>
              {subclassCatalog.isLoading ? (
                <p className="text-sm text-lore-muted">Loading subclasses…</p>
              ) : catalogOptions.length === 0 ? (
                <p className="text-sm text-lore-muted">
                  No Codex subclasses found for {cl.class}.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {catalogOptions.map((sub) => (
                    <ChoiceChip
                      key={sub.slug}
                      label={sub.name}
                      selected={cl.subclass === sub.name}
                      tooltip={sub.description}
                      disabled={!onUpdateClasses}
                      onClick={() => setSubclass(cl.class, sub.name)}
                    />
                  ))}
                </div>
              )}
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
            bardicTarget={bardicTarget}
            onBardicTarget={setBardicTarget}
            selfCharacterId={characterId}
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
        <SheetSection title="Feats & ASI">
          {featAndAsiRows.length === 0 ? (
            <p className="text-sm text-lore-muted">No feats or ASI recorded.</p>
          ) : (
            <FeatureList
              rows={featAndAsiRows}
              resourceUses={resourceUses}
              onToggleResource={toggleResource}
              onUseFeature={useFeature}
            />
          )}
        </SheetSection>
      </div>

      {useFeatureMut.error && (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {useFeatureMut.error.message}
        </p>
      )}

      {(meta.levelHistory?.length ?? 0) > 0 && (
        <div className="mt-4">
          <SheetSection title="Level History">
            <ul className="space-y-2 text-sm">
              {[...(meta.levelHistory ?? [])]
                .reverse()
                .slice(0, 10)
                .map((entry, i) => (
                  <li
                    key={`${entry.at}-${i}`}
                    className="rounded border border-lore-border px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        Level {entry.totalLevel} — {entry.classGain}
                      </span>
                      <span className="text-xs text-lore-muted">
                        {new Date(entry.at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-lore-muted">
                      +{entry.hpGain} HP
                      {entry.subclass ? ` · ${entry.subclass}` : ""}
                      {entry.asi
                        ? ` · ASI: ${formatAsiLabel(entry.asi)}`
                        : entry.feat
                          ? ` · Feat: ${entry.feat}`
                          : ""}
                    </p>
                  </li>
                ))}
            </ul>
          </SheetSection>
        </div>
      )}
    </div>
  );
}

function ChoiceChip({
  label,
  selected,
  tooltip,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  tooltip?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`rounded-full border px-3 py-1 text-xs disabled:opacity-50 ${
          selected
            ? "border-lore-accent bg-lore-accent-dim"
            : "border-lore-border text-lore-muted"
        }`}
      >
        {label}
      </button>
      {tooltip?.trim() && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-lg border border-lore-border bg-lore-surface px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed text-lore-muted shadow-lg group-hover:block group-focus-within:block"
        >
          <span className="mb-0.5 block font-medium text-lore-text">{label}</span>
          {tooltip}
        </span>
      )}
    </span>
  );
}

function FeatureList({
  rows,
  resourceUses,
  onToggleResource,
  onUseFeature,
  bardicTarget,
  onBardicTarget,
  selfCharacterId,
}: {
  rows: FeatureRow[];
  resourceUses: Record<string, boolean[]>;
  onToggleResource: (id: string, index: number, total: number) => void;
  onUseFeature: (
    row: FeatureRow,
    opts?: {
      monkFocusSpend?: "flurry" | "patient_defense" | "step_of_wind";
      beneficiaryId?: string;
    },
  ) => void;
  bardicTarget?: string;
  onBardicTarget?: (target: string) => void;
  selfCharacterId?: string;
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

        const isMonkFocus = row.id.includes("monk-s-focus");
        const isBardic = row.id.includes("bardic-inspiration");

        return (
          <li
            key={row.id}
            className="rounded border border-lore-border px-3 py-2 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">
                  <FeatureHint title={row.name} body={row.description} />
                </div>
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
                    {isMonkFocus ? (
                      <div className="flex flex-wrap gap-1">
                        {(
                          [
                            ["patient_defense", "Patient Defense"],
                            ["step_of_wind", "Step of Wind"],
                            ["flurry", "Flurry"],
                          ] as const
                        ).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            disabled={remaining <= 0}
                            onClick={() =>
                              onUseFeature(row, { monkFocusSpend: mode })
                            }
                            className="rounded border border-lore-accent bg-lore-accent-dim px-2 py-0.5 text-xs text-lore-text disabled:opacity-40"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : isBardic ? (
                      <div className="flex flex-wrap items-center gap-1">
                        <input
                          type="text"
                          value={bardicTarget ?? selfCharacterId ?? ""}
                          onChange={(e) => onBardicTarget?.(e.target.value)}
                          placeholder="Ally character id"
                          className="w-28 rounded border border-lore-border bg-lore-surface px-2 py-0.5 text-xs"
                          aria-label="Bardic Inspiration ally"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            onUseFeature(row, {
                              beneficiaryId:
                                bardicTarget?.trim() || selfCharacterId,
                            })
                          }
                          disabled={remaining <= 0}
                          className="rounded border border-lore-accent bg-lore-accent-dim px-2 py-0.5 text-xs text-lore-text disabled:opacity-40"
                        >
                          Grant
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUseFeature(row)}
                        disabled={remaining <= 0}
                        className="rounded border border-lore-accent bg-lore-accent-dim px-2 py-0.5 text-xs text-lore-text disabled:opacity-40"
                      >
                        Use
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-lore-muted">{row.description}</p>
          </li>
        );
      })}
    </ul>
  );
}

function FeatureHint({ title, body }: { title: string; body: string }) {
  if (!body.trim()) return <span>{title}</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <span>{title}</span>
      <span className="group relative inline-flex">
        <button
          type="button"
          className="flex h-4 w-4 items-center justify-center rounded-full border border-lore-border text-[10px] leading-none text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text"
          aria-label={`About ${title}`}
        >
          ?
        </button>
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-lg border border-lore-border bg-lore-surface px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed text-lore-muted shadow-lg group-hover:block group-focus-within:block"
        >
          <span className="mb-0.5 block font-medium text-lore-text">{title}</span>
          {body}
        </span>
      </span>
    </span>
  );
}
