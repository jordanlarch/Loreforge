/**
 * Authored encounter map presets (CAMP-8 tracer).
 *
 * Run Now seeds foes/party onto one of these layouts via
 * {@link buildPartyBattleCommands}. Custom per-cell placement is deferred.
 */
import type { GridPosition } from "../entities/types";

export type EncounterMapPresetId = "ambush" | "arena" | "corridor";

export type EncounterMapDef = {
  id: EncounterMapPresetId;
  label: string;
  width: number;
  height: number;
  blockedCells: GridPosition[];
  description: string;
};

const AMBUSH_WALLS: GridPosition[] = [
  { x: 6, y: 2 },
  { x: 6, y: 3 },
  { x: 6, y: 7 },
  { x: 6, y: 8 },
];

const CORRIDOR_WALLS: GridPosition[] = [
  { x: 2, y: 0 },
  { x: 2, y: 1 },
  { x: 2, y: 2 },
  { x: 2, y: 3 },
  { x: 2, y: 4 },
  { x: 2, y: 5 },
  { x: 13, y: 0 },
  { x: 13, y: 1 },
  { x: 13, y: 2 },
  { x: 13, y: 3 },
  { x: 13, y: 4 },
  { x: 13, y: 5 },
];

export const ENCOUNTER_MAP_PRESETS: Record<
  EncounterMapPresetId,
  EncounterMapDef
> = {
  ambush: {
    id: "ambush",
    label: "Road ambush",
    width: 12,
    height: 10,
    blockedCells: AMBUSH_WALLS,
    description: "A muddy stretch of road with cairn cover — the default layout.",
  },
  arena: {
    id: "arena",
    label: "Open arena",
    width: 14,
    height: 14,
    blockedCells: [],
    description: "A clear fighting pit with no obstacles.",
  },
  corridor: {
    id: "corridor",
    label: "Narrow corridor",
    width: 16,
    height: 6,
    blockedCells: CORRIDOR_WALLS,
    description: "A tight hall — melee-focused, little room to flank.",
  },
};

export const ENCOUNTER_MAP_PRESET_LIST = Object.values(ENCOUNTER_MAP_PRESETS);

export function resolveEncounterMap(
  presetId: string | null | undefined,
): EncounterMapDef {
  if (presetId && presetId in ENCOUNTER_MAP_PRESETS) {
    return ENCOUNTER_MAP_PRESETS[presetId as EncounterMapPresetId];
  }
  return ENCOUNTER_MAP_PRESETS.ambush;
}
