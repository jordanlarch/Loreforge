# Dungeon Exploration — Locked Design (Jun 2026)

*Canonical model for dungeon structure, Live Play presentation, engine state, and generator authoring. Supersedes the per-room scene / `advance_dungeon_room` approach shipped in PR #356. Grill sessions locked 2026-06-30 (Q1–34) and 2026-07-01 (Q35–60).*

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
| 35 | Party wipe (incapacitated) | **No auto `end_encounter`** — initiative keeps cycling; downed PCs roll death saves on their turns; hostiles keep acting. Auto-end only on **hostile wipe** (existing). Bodies stay on map (Q26). Campaign-defeat narration waits until all PCs are `dead: true` or an explicit GM tool fires (see §12). |
| 36 | Death saves in exploration (L3) | **No passive ticking** outside an active encounter. Saves roll on that PC's turn in combat, or via damage-at-0-HP rules. Unconscious PCs in L3 are stable-at-risk until healing, resumed combat, or GM tool — no async bleed-out timer |
| 37 | True TPK (all PCs `dead: true`) | **Campaign over** — when every party PC reaches `dead: true`, the campaign enters a terminal defeated state. Active encounter ends; dungeon exploration commands reject; AI-GM delivers closing narration. No in-campaign recovery without a new campaign (retreat/restart = product layer) |
| 38 | TPK headcount | **Active party PCs only** — `campaign_characters` where `role = pc` and `status = active`. Companions/NPC allies and benched PCs do not count toward campaign-over |
| 39 | Tutorial TPK | **`isTutorial` bypasses Q37** — true death on an active party PC triggers **checkpoint retry** (rewind to last tutorial checkpoint or scripted beat restart), not terminal campaign defeat. Real campaigns keep Q37 |
| 40 | Move-party invoke | **Map UI + chat/LLM, one command** — primary map affordance (toolbar toggle or "Move party" mode); chat keywords and AI-GM tool call the same `move_party` engine command (§7) |
| 41 | Move-party path model | **`move_party` only: leader + follow** — designated leader (explicit pick or default controlled PC) pathfinds; other **controlled** tokens trail to adjacent cells along the leader's route. **Individual** drag/chat `move_entity` unchanged — per-PC independent paths (Q3, Q9) |
| 42 | Move-party partial failure | **Partial success** — leader advances as far as valid; each follower trails up to speed budget; blocked tokens stay put. Command accepts with summary of moved vs stuck tokens (not all-or-nothing) |
| 43 | Move-party leader | **Controlled PC default, optional override** — leader = currently controlled token unless player picks another **controlled** token before confirming destination. Followers = other controlled tokens on same floor only (Q32) |
| 44 | Move-party minimum | **Requires 2+ controlled tokens** on same floor — otherwise reject (use `move_entity`). Move-party UI hidden for invited players (single PC). Owner with split party uses `move_entity` per floor |
| 45 | Move-party chat fallback | **Direction-only keywords** — ws-server maps `move party north/south/east/west` (max distance within speed) when LLM parse fails; named destinations require LLM or map click. Map UI remains primary |
| 46 | `rooms[]` → `floors[]` bridge | **Engine runtime synthesis (DUN-2)** — when `data.floors[]` absent, derive minimal stub floor from `data.rooms[]` (one zone per room, placeholder cells, linear connections). Authored `floors[]` wins when present (DUN-7+) |
| 47 | Stub layout algorithm | **Linear eastward chain per floor** — rooms grouped by `floorIndex`; adjacent list order → east-connected zones (small rects + corridor cells); zone ids via `zoneIdForRoomIndex()` (`entry`, `zone-1`, …). Enough geometry for pathing, gating, and zone triggers until DUN-7 |
| 48 | Zone cell format | **Either `cells[]` or `rect`, normalized on load** — generator/manual prep may use `{ x, y, w, h }`; irregular zones use explicit `cells[]`; engine loader always expands to internal `cells[]` |
| 49 | `zoneId` naming | **Slug preferred, numeric fallback** — authored `floors[]` includes stable kebab slug (`grinding-hall`); stub synthesis uses `entry` / `zone-{n}`; loader rejects duplicate slugs; optional `roomIndex` links to `data.rooms[]` |
| 50 | JSON examples location | **Spec §4 abbreviated snippets + engine fixture SOT** — full samples in `packages/engine/src/fixtures/dungeon-floor-samples.json` (loader tests); spec §4 shows trimmed examples with pointer to fixture |
| 51 | Floor transitions | **One record per direction** — separate `transitions[]` entries for up/down (or each ladder end); no auto-pairing on load. Each direction has its own `fromCell` / `toCell` |
| 52 | LLM tool registration | **Per DUN phase** — ws-server exposes only tools whose engine handlers ship; spec §7 lists full target set with phase column. Prevents LLM calling unimplemented commands (Q33) |
| 53 | Tool schema SOT | **Engine types v1; generated bridge later** — `commands/types.ts` + handler reject codes are canonical; spec §7 phase-annotated summary only (no duplicated field lists). **DUN-2 wiring:** export Zod/JSON schemas from engine for ws-server LLM tool defs |
| 54 | Tool ↔ DUN phase | **Locked map** — `move_entity`/`reveal_area` shipped; `enter_dungeon`/`mark_zone_cleared` DUN-1; `use_connection`/`use_floor_transition`/`move_party` DUN-2; `hide` DUN-3; `interact_object` DUN-4; `share_scout_reveal` DUN-5 |
| 55 | Keyword fallbacks | **Movement + navigation** — direction keywords for `move_entity` + `move_party` (Q45); thin keywords for `use_connection` (`open door`, `go through`) and `use_floor_transition` (`go upstairs`, `climb ladder`). Objects/interaction = LLM or UI click |
| 56 | Failed tool → LLM | **Structured reject + optional hint** — `{ accepted: false, code, message, hint? }`; no silent auto-retry. Hints for common dungeon errors (`requiresCleared`, locked connection, etc.) so AI-GM can narrate in-fiction next steps |
| 57 | Tutorial vs DUN model | **Hybrid** — Lantern Spire uses real `floors[]`/zones for spatial truth; `TutorialRoom` ws-server driver keeps scripted beats (Brennar safety net, shade flee/reaction, Q39 checkpoint retry) as overrides on engine state |
| 58 | Tutorial Scene 4→5 | **Real engine navigation** — lower hall (floor 0) → `use_floor_transition`/stair zone → stair landing; `TutorialRoom` triggers Scene 5 narration + combat on **stair zone entry** (`TUTORIAL_SCENE_SPIRE_STAIR`). Chest beat optional, no hard gate |
| 59 | Tutorial combat start | **`TutorialRoom` scripted `start_encounter`** on stair zone entry — fixed roster + narration gate; does not depend on DUN-3 detection. Real campaigns use detection when DUN-3 ships |
| 60 | Tutorial chest beat | **Visual object + script handler** — authored `objects[]` on lower-hall zone for map token; `TutorialRoom` intercepts interact for Help/advantage pedagogy (not generic `interact_object` until DUN-4 optional migration). Does not gate stairs |

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

**JSON examples:** abbreviated below; full copy-paste samples in `packages/engine/src/fixtures/dungeon-floor-samples.json` (loader test SOT, Q50).

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

All mechanics via engine commands; LLM narrates results only. Schemas: `packages/engine/src/commands/types.ts` (SOT); Zod/JSON export at DUN-2 ws-server wiring (Q53). Register with LLM **per shipped DUN phase** (Q52). Failed calls return `{ accepted: false, code, message, hint? }` (Q56).

| Tool / command | Phase | Purpose |
|----------------|-------|---------|
| `move_entity` | Shipped | Drag + chat path destination |
| `reveal_area` | Shipped | GM fog reveal (existing) |
| `enter_dungeon` | DUN-1 | Threshold airlock (first entry) |
| `mark_zone_cleared` | DUN-1 | GM override |
| `use_connection` | DUN-2 | Door/corridor between zones |
| `use_floor_transition` | DUN-2 | Stairs / ladder (single PC) |
| `move_party` | DUN-2 | Leader + follow group move (Q40–45) |
| `hide` | DUN-3 | Hide action → Stealth → `invisible` |
| `interact_object` | DUN-4 | `{ objectId, noise? }` — rolls if `quiet` + sentinels |
| `share_scout_reveal` | DUN-5 | Copy per-PC fog to party |

**Chat keyword fallbacks** (when LLM parse fails — Q55): movement directions (`move_entity`, `move_party`); navigation (`open door`, `go through`, `go upstairs`, `climb ladder`). UI map controls remain primary.

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
| **DUN-2 — Zones + connections** | Parse/load `zones[]` (minimal from `rooms[]`); connection gating; position-derived zone | Engine tests + dungeon enter prod smoke | **Done (Jul 2026)** — `dungeon/layout`, `use_connection`, `use_floor_transition`, `DungeonLayoutSet`, move zone visits |
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

## 12. Grill appendix — Jul 2026 (DUN-2+ prep)

Continued edge-case locks after DUN-1 ship. Do not re-litigate Q1–34.

### 12.1 TPK & death saves

| # | Topic | Decision |
|---|--------|----------|
| 35 | All party incapacitated mid-encounter | **Combat continues** — no auto `end_encounter`. Death saves on each downed PC's turn; hostiles act normally. Auto-end unchanged: hostile wipe only. |
| 36 | Death saves in exploration (L3) | **No passive auto-tick** — saves only during active encounter turns or damage-at-0-HP. Prevents async bleed-out across split floors / offline players. |
| 37 | True TPK (all PCs `dead: true`) | **Campaign over** — terminal defeated state; auto `end_encounter` if active; reject further dungeon/mechanics commands; AI-GM closing beat. Restart = new campaign (product layer). |
| 38 | TPK headcount | **Active party PCs only** (`role = pc`, `status = active`). Companions and benched PCs excluded. |
| 39 | Tutorial TPK | **`isTutorial` bypasses Q37** — checkpoint retry UI; campaign stays alive. Normal flow still guarded by scripted companion rescue. |

### 12.2 `move-party` UX

| # | Topic | Decision |
|---|--------|----------|
| 40 | Invoke | **Map UI + chat/LLM** share one `move_party` command. Map mode is primary; chat/AI-GM is fallback. |
| 41 | Path model | **`move_party` only:** leader pathfinds; followers trail adjacent along leader route. Individual `move_entity` stays independent per-PC. |
| 42 | Partial failure | **Partial success** — move who can; stuck tokens stay; summary lists moved vs blocked. |
| 43 | Leader pick | **Controlled PC default; optional override** before confirm. Followers = other controlled tokens on same floor (Q32). |
| 44 | Minimum tokens | **2+ controlled on same floor** or reject / hide UI. Invited players use `move_entity` only. |
| 45 | Chat fallback | **Direction-only keywords** (`move party north`, etc.) when LLM fails; named destinations = LLM or map. |

### 12.3 Canonical `data.floors[]` JSON

| # | Topic | Decision |
|---|--------|----------|
| 46 | `rooms[]` bridge | **Runtime synthesis** when `floors[]` absent — stub floor from rooms list; authored `floors[]` overrides. |
| 47 | Stub layout | **Linear eastward chain** per `floorIndex`; small zone rects + corridor connections; `entry` / `zone-{n}` ids. |
| 48 | Zone cells | **Accept `cells[]` or `rect`** — loader normalizes to internal `cells[]`. |
| 49 | `zoneId` | **Slug when authored; `entry` / `zone-{n}` stub fallback**; reject duplicates; optional `roomIndex`. |
| 50 | JSON examples | **§4 snippets + engine fixture SOT** (`dungeon-floor-samples.json` for loader tests). |
| 51 | Floor transitions | **One record per direction** — no auto-pairing; each stair/ladder end explicit. |

### 12.4 AI-GM tool call list

| # | Topic | Decision |
|---|--------|----------|
| 52 | LLM registration | **Per DUN phase** — register only shipped handlers; §7 annotated with phase column. |
| 53 | Schema SOT | **Engine types v1**; Zod/JSON export for ws-server at DUN-2 wiring. |
| 54 | Tool ↔ DUN phase | See §7 table — DUN-1/2/3/4/5 split as proposed. |
| 55 | Keyword fallbacks | **Movement + navigation** keywords; objects/interaction LLM or UI. |
| 56 | Failed tool → LLM | **Reject + optional `hint`**; no silent retry. |

### 12.5 Tutorial dungeon compatibility

| # | Topic | Decision |
|---|--------|----------|
| 57 | Tutorial vs DUN model | **Hybrid** — real `floors[]`/zones for Lantern Spire spatial truth; `TutorialRoom` driver keeps scripted beats (Brennar safety net, shade flee/reaction, Q39 checkpoint retry) as ws-server overrides |
| 58 | Scene 4→5 transition | **Real navigation** — floor 0 lower hall → stair transition/zone → stair landing; combat triggers on stair zone entry (`TUTORIAL_SCENE_SPIRE_STAIR`). Chest optional, no progression gate |
| 59 | Scene 5 combat start | **`TutorialRoom` scripted `start_encounter`** on stair zone entry; no DUN-3 detection dependency |
| 60 | Chest beat | **Authored map object + driver intercept** — Help/advantage tutorial flow; optional; no stair gate |

---

*Last locked: 2026-07-01 (grill session with Jordan — Q35–60). Phase 1 complete; proceed to DUN-2.*
