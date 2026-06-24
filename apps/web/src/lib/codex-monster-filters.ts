/** Preset CR buckets for Codex Monsters / Animals filter chips. */

export type CrPreset = {
  id: string;
  label: string;
  crMin: number;
  /** When omitted, no upper bound (e.g. 17+). */
  crMax?: number;
};

export const MONSTER_CR_PRESETS: CrPreset[] = [
  { id: "cr-0", label: "0", crMin: 0, crMax: 0 },
  { id: "cr-1-8", label: "1/8", crMin: 0.125, crMax: 0.125 },
  { id: "cr-1-4", label: "1/4", crMin: 0.25, crMax: 0.25 },
  { id: "cr-1-2", label: "1/2", crMin: 0.5, crMax: 0.5 },
  { id: "cr-1", label: "1", crMin: 1, crMax: 1 },
  { id: "cr-2-4", label: "2–4", crMin: 2, crMax: 4 },
  { id: "cr-5-10", label: "5–10", crMin: 5, crMax: 10 },
  { id: "cr-11-16", label: "11–16", crMin: 11, crMax: 16 },
  { id: "cr-17+", label: "17+", crMin: 17 },
];

/** Beasts tab: CR buckets that fall within the SRD animals ceiling (CR ≤ 1). */
export const ANIMAL_CR_PRESETS = MONSTER_CR_PRESETS.filter(
  (preset) => (preset.crMax ?? preset.crMin) <= 1,
);

export const SIZE_ORDER = [
  "tiny",
  "small",
  "medium",
  "large",
  "huge",
  "gargantuan",
] as const;

export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort(
    (a, b) =>
      SIZE_ORDER.indexOf(a as (typeof SIZE_ORDER)[number]) -
      SIZE_ORDER.indexOf(b as (typeof SIZE_ORDER)[number]),
  );
}

export function findCrPreset(id: string | undefined): CrPreset | undefined {
  if (!id) return undefined;
  return MONSTER_CR_PRESETS.find((preset) => preset.id === id);
}
