# Hazard / trap / poison / disease data model — grill backlog (DATA-1b)

**Status:** Engine discriminated union shipped (`packages/engine/src/content/hazard-definitions.ts`). Ingest, Codex UI, Smithy copy, map tokens, and campaign-builder hooks are **not** shipped.

## Why grill sessions

The SRD 5.2 PDF lists traps, poisons, diseases, and environmental hazards as separate appendix sections with per-entry fields that do not share one flat shape. Loreforge needs locked decisions on:

1. **Source of truth** — Codex advanced-rules prose only vs normalized rows vs hybrid (prose + structured overlay).
2. **Identity** — slug from PDF name vs engine `hazardDefinitionId(name)`.
3. **Engine resolution** — when hazards become `EffectTemplate` / damage commands vs narrative-only until ENG-4.
4. **Map / campaign** — trap as scene attribute vs encounter object vs Realms entity stub.

## Proposed grill order (one session each)

| Session | PDF section | Open questions |
|---|---|---|
| **GRILL-TRAP** | Traps | Trigger vs detection vs disable DCs; one-shot vs reset; link to dungeon generator scenes |
| **GRILL-POISON** | Poisons | Delivery type enum; repeat cadence; antidote items; Smithy consumable overlap (DATA-1d) |
| **GRILL-DISEASE** | Diseases | Progression stages; contagion rules; long-rest recovery vs save chains |
| **GRILL-ENV** | Environmental effects | Area/duration/repeat; overlap with spell areas; map hazard layers |

## Current engine shapes (validation only)

- `TrapDefinition` — `trigger`, `detectionDc`, `disableDc`, `save`, `damage`, `conditions`
- `PoisonDefinition` — `poisonType` (`contact` \| `ingested` \| `inhaled` \| `injury`), `save`, `damage`, `repeat`
- `DiseaseDefinition` — `contagion`, `save`, `effects[]`, `recovery`
- `EnvironmentalHazardDefinition` — `area`, `duration`, `save`, `damage`, `repeat`

## Out of scope until grill + ingest

- Codex browse/filter for hazards
- Copy hazard → Smithy
- Live Play / engine apply on failed save
- World map hazard placement (CAMP-7 adjacency)

## Related deferrals

- **DATA-1c** — monsters (separate grill: stat block actions, legendary, lair)
- **DATA-1d** — consumables without weapon shape (acid vial, alchemist's fire)
