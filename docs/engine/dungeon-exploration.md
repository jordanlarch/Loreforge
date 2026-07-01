# Dungeon Exploration — Locked Design (Jun 2026)

*Canonical model for dungeon structure, Live Play presentation, engine state, and generator authoring. Supersedes the per-room scene / `advance_dungeon_room` approach shipped in PR #356. Grill session locked 2026-06-30.*

**Related:** `docs/ui-flows/unified-campaign-ux.md` (L3 interior / L4 combat overlay), `docs/generators/forms-and-pages.md` (Generator 6 — Dungeon), `docs/quests.md`, `docs/deferrals.md` (`RUNG-4`, `GENR-5`).

---

## 1. Elevator pitch

A **dungeon** is a Realms POI with one or more **floors**. Each floor is a **single explorable scene** — a Dyson-style cell grid with walls, zones (rooms), connections (doors/corridors), patrols, traps, and objects.

**Players move their own tokens** (drag or chat → engine tool calls). There is **no party quorum** and **no engine teleport** on “room advance.” Encounters, traps, and quests fire **per creature** using **detection** (hidden/invisible vs sentinel Perception).

Combat is **L4 overlay on the same floor grid** — not a separate battle map.

---

## 2. Locked decisions

### 2.1 Core structure

| # | Topic | Decision |
|---|--------|----------|
| 1 | Player view | **One map per floor** — full layout; free exploration movement |
| 2 | Rooms | **Zones + gated connections** on the floor grid |
| 3 | Movement | **Independent per PC** — no quorum; optional **move-party** convenience (same floor, controlled tokens only) |
| 4 | Floor changes | **Linked transition** (stairs, etc.) + **explicit action** (click or chat); spawn at linked arrival cell on target floor |
| 5 | First entry | **Threshold airlock** — party confirm once → floor scene; **per-PC first cross** gets lighter beat; stragglers enter via travel + entrance connection |
| 6 | Cleared | **Visited ≠ cleared** — structured completion + GM override; **cleared stays cleared** (no repopulation) |
| 7 | Fog | **Visited zones party-shared**; **cell fog per-PC** until enter or scout report / GM reveal |
| 8 | Combat | **Same grid, L4 overlay**; optional zone crop; manual zoom-out OK |
| 9 | Movement rules | **Path-on-release** within speed budget; chat + drag share engine validation |
| 10 | Engine state | **Position-derived** location; event-sourced visited/cleared/doors/objects/fog — **not** `currentRoomIndex` authority |
| 11 | Authoring | Generator emits `data.floors[]`; fallback until Dyson ships; **prep-only manual map edit** later |
| 12 | Manual edit | Walls, zones, doors, objects, fog paint in Realms (prep); in-play edit deferred |
| 13 | NPCs & quests | **Zone-scoped refs** (`zoneId`, `on_enter_zone`); room sub-entities (GENR-5) later |
| 14 | RUNG-4 on main | **Surgical refactor** — see §6 |

### 2.2 Detection & triggers (replaces quorum)

| # | Topic | Decision |
|---|--------|----------|
| 16 | Detection | **`hidden` / `invisible`** skips auto-detection; else **passive Perception vs Stealth** on zone entry; `CreatureDetected` / `CreatureUndetected` events |
| 17 | Trickle-in | **Per-token detection**; encounter roster = detected at trigger; optional **`alertZoneOnDetection`** on authored zones |
| 18 | Wandering | **Authored patrol routes** + waypoint movement on timer; detection when patrol and PC share zone/LoS corridor |
| 19 | Patrol visibility | Tokens in **fog-revealed cells**, neutral disposition until detection |
| 20 | Traps | **`cell` \| `connection` \| `zone`** scope; **per-token** trigger |
| 21 | Split floors | **Per-PC `sceneId`**; **all occupied floors sim active**; map follows controlled PC |
| 23 | Hide breaks | **SRD condition rules**; alert zone re-check; adjacent combat +modifier to sentinel passive |
| 24 | Combat start | Roster = **detected in zone + hostiles**; **late join** on zone entry; hidden off roster until act |
| 25 | Quest steps | **`completionKind`** (`enter_zone`, `discover_zone`, `interact`, `defeat_encounter`, `talk_npc`, `detected_in_zone`); **`interact.noise`**: `silent` \| `quiet` \| `loud` — stealthy loot valid (SRD-adjudicated) |
| 26 | Downed PCs | **Stay on map**; patrols auto-detect helpless visible targets |
| 27 | Loot | **Map object state** canonical; taker inventory; delivery steps check holder |
| 28 | Fog detail | See #7 |
| 29 | Environment | **Zone-scoped** when authored; **floor ambient** fallback; optional connection hazards |
| 30 | Rest | **Individual rest** anywhere; **`restAllowed`** zones suppress patrol detection; non-safe rest = higher stationary detection |
| 32 | Multiplayer | Invited = own PC; owner switches party PCs; move-party = controlled only |
| 33 | AI-GM | **LLM proposes tools, engine disposes** — fail-closed on state |
| 34 | Session load | Event projection restores exploration state; **patrols reset to waypoints** v1 |

---

## 3. Spatial model

```
Dungeon (Realms entity)
└── floors[]                    ← one scene per floor
    ├── map { width, height, walls/blockedCells }
    ├── zones[]                 ← rooms (bounded cells)
    │   ├── connections[]       ← doors/corridors to other zones
    │   ├── encounters, traps, objects, NPC refs
    │   └── ambient overrides
    ├── transitions[]           ← floor ↔ floor (linked arrival cells)
    ├── patrolRoutes[]
    └── ambientEffects[]        ← floor-wide fallback
```

**Scene id:** `scene:realm:{dungeonEntityId}:floor:{floorIndex}`

**Not used:** `scene:realm:{id}:room:{n}` (PR #356 — remove).

---

## 4. Authoring schema (canonical target)

Generator should emit this shape; v1 play accepts **partial** floors (entrance + minimal grid) until Dyson pipeline ships.

```typescript
type DungeonFloorData = {
  index: number;
  name: string; // "Ground Level", "Floor 2"
  map: {
    width: number;
    height: number;
    blockedCells: { x: number; y: number }[];
  };
  entrance?: { x: number; y: number }; // threshold spawn
  ambientEffectSlugs?: string[];
  zones: DungeonZoneData[];
  transitions: FloorTransitionData[];
  patrolRoutes: PatrolRouteData[];
};

type DungeonZoneData = {
  zoneId: string; // stable slug, e.g. "ossuary"
  roomIndex?: number; // link to data.rooms[] list entry until room sub-entities exist
  name: string;
  cells: { x: number; y: number }[]; // or rect: { x, y, w, h }
  encounter?: EncounterRef;
  alertZoneOnDetection?: boolean;
  restAllowed?: boolean;
  environmentalEffectSlugs?: string[];
  connections: ZoneConnectionData[];
  traps?: TrapData[];
  objects?: MapObjectData[];
  npcPlacements?: { npcEntityId: string; cell?: { x: number; y: number } }[];
};

type ZoneConnectionData = {
  connectionId: string;
  toZoneId: string;
  /** Cells on this zone side (door/threshold). */
  fromCells: { x: number; y: number }[];
  toCells: { x: number; y: number }[]; // on adjacent zone
  locked?: boolean;
  requiresCleared?: string[]; // zoneIds
  traps?: TrapData[];
};

type FloorTransitionData = {
  transitionId: string;
  toFloorIndex: number;
  fromCell: { x: number; y: number };
  toCell: { x: number; y: number }; // on target floor
};

type PatrolRouteData = {
  patrolId: string;
  creatureTemplateRef: string;
  waypoints: { x: number; y: number }[];
  /** ms between steps, or ticks — TBD in implementation */
  intervalMs?: number;
};

type MapObjectData = {
  objectId: string;
  kind: "loot" | "interactable" | "door" | "altars" | string;
  cell: { x: number; y: number };
  noise?: "silent" | "quiet" | "loud";
  questRef?: { templateId: string; stepId: string };
};
```

**Bridge from today:** `data.rooms[]` (name, encounter, summary, optional `floor`) maps to zones when layout is generated; `floor` / `floorIndex` / `depth` → `floorIndex` (0-based).

---

## 5. Engine events (target)

| Event | When |
|--------|------|
| `DungeonThresholdOpened` | First party confirm at dungeon POI |
| `DungeonFloorEntered` | PC uses entrance / floor transition (per PC) |
| `ZoneVisited` | PC enters zone (any visit) — party-shared zone id |
| `ZoneDiscovered` | PC reveals zone cells (per-PC fog) |
| `CreatureDetected` / `CreatureUndetected` | Sentinel vs PC stealth |
| `ZoneAlerted` | `alertZoneOnDetection` fired |
| `EncounterStarted` | Detection + authored encounter (same scene) |
| `ZoneCleared` | Structured completion or GM tool |
| `ConnectionOpened` | Door/unlock condition met |
| `ObjectTaken` | Interact success (`takenByEntityId`) |
| `ScoutRevealShared` | Scout report copies fog to party |
| `PatrolMoved` | Patrol tick (optional event; may be projection-only) |

**Remove / replace:** `DungeonRoomEntered` with zone-centric payloads; drop `advance_dungeon_room` command entirely.

---

## 6. PR #356 — surgical refactor

### Remove or stop using

- `advance_dungeon_room` command
- **`currentRoomIndex` as authority** (derive zone from position + projection)
- **Auto `EntityRelocated`** on room/floor change (except: threshold spawn, floor transition arrival, explicit GM/dev seed)
- Per-room scene ids `:room:{n}`
- “Clear room then advance to next index in order” flow

### Keep (adapt to this spec)

- **Floor-scene id** shape (`:floor:{n}` not `:room:{n}`)
- **`mark_dungeon_room_cleared`** → rename/generalize to **`mark_zone_cleared`** (zoneId)
- Entry-room **encounter promotion** (GENR-5) — trigger on **detection + zone encounter**, not index 0 teleport
- Combat victory → cleared zone hook (ws-server GM line)
- **`enter_dungeon`** / threshold flow (replace `enter_dungeon_room` semantics)

---

## 7. AI-GM tool surface (fail-closed)

All mechanics via engine commands; LLM narrates results only.

| Tool / command | Purpose |
|----------------|---------|
| `move_entity` | Drag + chat path destination |
| `hide` | Hide action → Stealth → `invisible` |
| `interact_object` | `{ objectId, noise? }` — rolls if `quiet` + sentinels |
| `use_connection` | Door/corridor between zones |
| `use_floor_transition` | Stairs / ladder (single PC) |
| `share_scout_reveal` | Copy per-PC fog to party |
| `confirm_dungeon_threshold` | First entry airlock |
| `mark_zone_cleared` | GM override |
| `reveal_area` | GM fog reveal (existing target) |

Chat keywords + UI buttons are fallbacks when LLM parse fails.

---

## 8. Live Play presentation

| Mode | Map | Chrome |
|------|-----|--------|
| **Exploration (L3)** | Floor grid, fog, patrol tokens (revealed cells), object tokens | No initiative; per-PC drag/chat move; optional move-party |
| **Combat (L4)** | **Same grid** + overlay | Initiative strip, turn bar, targeting — same as today |

**Map view:** follows **controlled PC's floor** (`sceneId`). Party rail shows `Name · Floor N`.

**Grid:** L3 and L4 use the **same cell grid** (5 ft cells). L4 adds turn economy — not a separate geometry layer.

---

## 9. Implementation phasing

| Phase | Scope | Verify |
|-------|--------|--------|
| **DUN-1 — Refactor + doc** | Remove advance/teleport model; floor scenes; threshold enter; zone visited projection stub; update tests | Engine CI | **Done (Jun 2026)** — `enter_dungeon`, `mark_zone_cleared`, `DungeonThresholdOpened` / `ZoneVisited` / `ZoneCleared`; legacy PR #356 event replay; no `advance_dungeon_room` |
| **DUN-2 — Zones + connections** | Parse/load `zones[]` (minimal from `rooms[]`); connection gating; position-derived zone | Engine tests + dungeon enter prod smoke |
| **DUN-3 — Detection** | `CreatureDetected`, hidden/invisible, encounter start roster rules | Engine + unit tests |
| **DUN-4 — Quest + objects** | `completionKind`, `interact.noise`, object state, `on_enter_zone` | Engine quest tests |
| **DUN-5 — Fog + scout** | Per-PC cell fog, visited zones shared, scout report | Live Play prod (1 campaign) |
| **DUN-6 — Patrols** | Routes, timer, fog-gated render, session reset on load | Engine + ws-server |
| **DUN-7 — Generator layout** | GENR-5 emits `floors[]` geometry from Dyson pipeline | Generator sample + enter in play |
| **DUN-8 — Manual map edit** | Prep Realms editor: walls, zones, doors, objects, fog (REALM-5 / PLAY-7) | Realms prep verify |

Do not start **DUN-7** until **DUN-1–3** are green — otherwise layout work attaches to the wrong runtime.

---

## 10. Explicit non-goals (v1)

- Party quorum gates
- Engine-driven party teleport between rooms
- Repopulation of cleared zones on rest
- In-play map edit during multiplayer
- Mid-route patrol persistence across session reload (defer)
- Room sub-entity Realms pages (GENR-5 — after zone model stable)
- Drag-body / carry unconscious ally (defer)

---

## 11. Open items (minor — not blocking DUN-1)

- Exact **`listenForAdjacentCombat`** passive modifier (+2 default?)
- Patrol tick rate vs in-game time
- Line-of-sight corridor segment math for patrol detection (zone-only vs segment LoS)
- Align **`hidden`** vs engine’s current Hide → **`invisible`** tracer

---

*Last locked: 2026-06-30 (grill session with Jordan).*
