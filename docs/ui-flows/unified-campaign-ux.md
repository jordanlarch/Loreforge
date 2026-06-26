# Unified Campaign UX

*Canonical IA and layout for Loreforge campaigns — **prep shell** and **play shell**. Locked via design grill (Jun 2026). Supersedes conflicting sections in `campaigns-workspace.md` and `live-play-surface.md` for navigation, tab taxonomy, map hierarchy, and prep↔play handoff. Implementation tracking: `docs/deferrals.md` §3.6 **CAMP-UX**.*

> **Reference:** Fables.gg informed the two-shell model (cohesive prep vs cohesive play). Loreforge differs on layout (map **above** chat in the **center**, not map-on-right), deterministic engine grids/tokens, global Realms library (six-item nav unchanged), and **Quests** naming (not Hooks / Quest Book).

---

## Problem statement

Today `/campaigns/[id]` (nine-tab workspace) and `/campaigns/[id]/play` (live surface) feel like two apps: context is lost on navigation, the Combat tab orphans encounters from realm stubs, World Map and play map are disconnected, and prep tabs compete with play for the campaign’s “home.”

**Goal:** Two intentional shells with a clear handoff — prep is map-first world authoring; play is map-above-chat with lightbox panels — without losing spatial or narrative context mid-session.

---

## Locked decisions (summary)

| Topic | Decision |
|---|---|
| Site nav | **Keep global Realms** (reusable library; campaigns link entities in) |
| Shells | **Two routes:** prep `/campaigns/[id]` ↔ play `/campaigns/[id]/play` |
| Play layout | Center: **`[Current \| World]` map above chat**; left nav; **collapsible right character rail** |
| Play panels | **Lightboxes** (dimmed peek ~70–85%); Esc / click-outside dismiss |
| Play nav | Play · Character · Party · **Quests** · World · Memories · Sessions (read-only) · Notes · Settings |
| Prep nav | Overview · Map · Locations · Party · **Quests** · Notes · Settings — **no Combat tab** |
| Prep landing | **Context-aware:** new/post-forge → Map; return + mid-session → Overview |
| Map model | **Hybrid (C):** overworld grid → region hex → settlement district → interior → combat overlay |
| World tab (play) | Discovered-only for players; owner **Show hidden** peek |
| POI pins | **Synced** on overworld + settlement map |
| Create on map | **Full parity:** paint region/settlement territories; place POI pins; toolbar on Map tab |
| Encounters | **Stub-scoped only**; **Test in Play** from stub detail (no global Combat tab) |
| Stub editing | Campaign owns membership/discovery/coords/notes; **Edit stub → Realms lightbox** |
| Starting location | **Scene-level** (`startingSceneId`); required before first play |
| Play gates | First play: **start scene + ≥1 PC**; **Continue** skips re-check |
| First Play Now | Start picker when no engine state; else resume |
| End session | Recap/pins **lightbox**; stay in play; optional **Back to prep** |
| Combat | **In-place** on `/play`; World tab **never locked**; all stubs have grids + tokens; combat adds **encounter overlay** |
| Invited players | **Play shell only** (v1) |
| Map zoom polish | **Current \| World tabs** for v1; scroll-wheel L0→L4 deferred (PLAY-7) |

---

## Two shells

```
┌──────────────────────── PREP ────────────────────────┐
│  /campaigns/[id]                                      │
│  Overview · Map · Locations · Party · Quests · …     │
│  Paint territories · place pins · Edit stub (LB)     │
│  [▶ Play Now]  (gated: start scene + PC)             │
└──────────────────────────┬───────────────────────────┘
                           │ Play Now / Continue
                           ▼
┌──────────────────────── PLAY ────────────────────────┐
│  /campaigns/[id]/play                                 │
│  Left nav → lightboxes                                │
│  Center: [Current|World] map → chat                     │
│  Right: collapsible character rail                    │
│  Combat = overlay on Current map (no route change)    │
└──────────────────────────────────────────────────────┘
```

### Handoff rules

| Action | Behavior |
|---|---|
| **Play Now** | Navigate to `/play`. If no engine projection: show **start scene** confirmation (campaign must already have `startingSceneId`). |
| **Continue** | Navigate to `/play`; load saved projection. No prep gate re-check. |
| **Back to prep** | From play top bar or end-session lightbox footer → `/campaigns/[id]` (Overview if mid-session flag, else Map). Does **not** end session. |
| **End session** | `sessions.end` → recap/pins lightbox → dismiss stays in play; optional Back to prep. |
| **Test in Play** | From stub detail in prep (or Realms lightbox footer): arm encounter + open `/play` at that scene. |

---

## Prep shell (`/campaigns/[id]`)

### Navigation (7 tabs)

| Tab | Slug | Purpose |
|---|---|---|
| Overview | `overview` | Dashboard: party, last recap, mid-session banner, quick stats, Play Now |
| Map | `map` | Campaign overworld canvas + edit toolbar (replaces old **World Map** tab) |
| Locations | `locations` | Filterable grid/list of linked stubs (replaces old **World** tab IA) |
| Party | `party` | Roster, add character, companions, bench |
| Quests | `quests` | Kanban / list (`?tab=hooks` redirects here) |
| Notes | `notes` | Campaign notes |
| Settings | `settings` | GM persona, play mode, art lock, invites, starting scene, danger zone |

**Removed from prep nav:** Combat (encounters live on stubs), Sessions (history lives in play nav read-only; Overview shows last recap only).

### Default landing (context-aware)

| Condition | Land on |
|---|---|
| First open after Quick Forge / Guided Setup / Empty World | **Map** |
| Return visit + active mid-session projection | **Overview** (Continue banner) |
| Return visit, no mid-session | **Map** |

### Map tab (prep)

Primary spatial authoring surface.

**Overworld canvas:** one square grid per campaign (continental view). Art: campaign style-locked cartographic layer + procedural territory tints (see `docs/data-sources.md` §2).

**Territory painting (not pins):**

| Entity type | On overworld map |
|---|---|
| **Region** | Contiguous **cell selection** (aggregate territory) |
| **Settlement** | Cell selection **inside parent region** |
| **POI** (building, tavern, shop, dungeon, NPC) | **Pin** on overworld (within settlement territory when applicable) |

**Toolbar (create-on-map parity):**

- Select / pan
- Paint region territory
- Paint settlement territory (requires parent region)
- Place POI pin → pick type → name → quick-generate or link existing
- Move pin / adjust territory
- Delete / unlink (campaign membership, not global Realms delete)

**Create from Locations tab** and **Create on Map** produce the same entities; map coordinates sync both ways.

### Locations tab (prep)

Single grid/list with type filters (Regions, Settlements, Buildings, Taverns, Shops, Dungeons, Factions, NPCs). Same discovery overlays as today’s World tab (Hidden / Known / Partial).

Per-card actions:

- **Open** → summary inline or lightbox
- **Edit stub** → **Realms detail lightbox** (structural content edits persist to global Realms entity)
- **Set as campaign start** → sets `startingSceneId` (entry scene for that stub)
- **Add from Realms** → picker of unlinked library entities
- **Generate** → generator pre-bound to campaign
- **Reveal / Hide** → discovery toggle
- **Test in Play** (stub has encounter) → play shell at scene

### Campaign vs Realms data split

| Field | Owner |
|---|---|
| Entity name, description, rooms, NPCs, encounters on stub | **Realms** (edited via lightbox) |
| Campaign membership (`campaign_world_entities`) | **Campaign** |
| Discovery state | **Campaign** |
| Overworld pin + settlement map pin (synced) | **Campaign** |
| Territory cell selections (region/settlement) | **Campaign** (geometry may reference Realms map seeds) |
| Accepted quest instances | **Campaign** |
| Campaign-only GM notes on stub | **Campaign** |
| `startingSceneId` | **Campaign** |

### Play readiness gates (prep)

Before **first** Play Now:

1. **`startingSceneId`** set (scene-level: entity + entry scene / room)
2. **≥1 active PC** in party (existing party prompt flow, #229)

**Continue** and subsequent Play Now with existing engine state skip these checks.

---

## Play shell (`/campaigns/[id]/play`)

### Layout (desktop)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR — breadcrumb · campaign · scene · Live/Async · clock · tools       │
├──────┬─────────────────────────────────────────────────────────┬───────────┤
│      │  MAP ZONE — tabs: [ Current | World ]                    │ CHARACTER │
│ LEFT │  ─────────────────────────────────────────────────────  │ RAIL      │
│ NAV  │  (grid + tokens always; combat overlay when encounter)   │ (collapse │
│      ├─────────────────────────────────────────────────────────┤  ◀ toggle) │
│      │  [ Initiative strip — combat only, above map ]           │ HP AC     │
│      ├─────────────────────────────────────────────────────────┤ stats     │
│      │  [ Turn bar — combat only, between map and chat ]        │ sheet peek│
│      ├─────────────────────────────────────────────────────────┤           │
│      │  CHAT / NARRATIVE + composer                             │           │
└──────┴─────────────────────────────────────────────────────────┴───────────┘
```

**Center column:** map **above** chat (user preference; not Fables right-rail map).

**Right character rail:** ~240–280px expanded; **collapsible** via chevron — collapsed state gives map+chat full width minus left nav. Persists preference per campaign (localStorage or user pref). During combat, rail may default collapsed if turn bar needs space; user can expand.

**Left nav:** icon + label strip; opens **lightboxes** (dimmed peek, ~70–85% viewport).

### Left nav items

| Item | Lightbox content |
|---|---|
| **Play** | Closes any lightbox; restores full center stack (home) |
| **Character** | Active PC sheet (read/write per permissions) |
| **Party** | Roster chips, invite status, bench |
| **Quests** | Kanban / list (campaign quest instances; same data as prep Quests tab) |
| **World** | Discovered stubs browse; **Enter location** / travel hints |
| **Memories** | Pinned facts, rolling summary snippets (memory tier UI) |
| **Sessions** | Read-only session log, recaps, transcripts (no End session here — top bar) |
| **Notes** | Shared + DM-only notes per permissions |
| **Settings** | Play-relevant subset (pacing, TTS when shipped); link to full prep Settings for owner |

**Naming:** always **Quests**, never Hooks or Quest Book.

### Center map: Current | World tabs

| Tab | Shows |
|---|---|
| **Current** | Active engine scene at appropriate depth: region hex, settlement district, interior floor plan, or tactical grid. **Party + ambient NPC tokens always on grid.** |
| **World** | Campaign **overworld grid**: region/settlement territories + synced POI pins. Discovery-filtered. Owner: **Show hidden** toggle (dimmed ghost stubs). **Available during combat** — view-only peek; does not change `currentSceneId`. |

**v1 navigation between depths:** selecting a territory or pin on World → **Enter** / travel (chat or click) switches **Current** to that scene. Scroll-wheel L0→L4 zoom deferred; tab + Enter replaces it for v1.

### Exploration vs combat (same grid)

All explorable stubs render a **grid and tokens** in exploration mode. Entering combat does **not** navigate away or swap routes.

| Mode | Adds |
|---|---|
| **Exploration** | Free movement/speak on Current map; movement may be permissive or scene-bound per engine rules |
| **Combat (encounter overlay)** | Initiative strip above map; turn bar between map and chat; action economy; movement radius + target/AoE pickers; reaction prompts; hostile disposition on tokens |

World tab remains usable during combat.

### End session

1. Top bar **End session** → `sessions.end`
2. **Lightbox:** auto-recap + memory pin form (`PostSessionPins` pattern)
3. **Done** → dismiss; user stays in play shell
4. Footer **Back to prep** → `/campaigns/[id]` (optional)

---

## Spatial hierarchy (map model)

Hybrid model aligned with generators and art pipeline (`docs/data-sources.md` §2).

| Level | Name | Geometry | Art source | Play tab |
|---|---|---|---|---|
| L0 | Campaign overworld | Square grid; region + settlement **territories** | Campaign cartographic layer | **World** |
| L1 | Region wilderness | Hex grid (generator) | Per-region procedural hex | **Current** when party in region |
| L2 | Settlement | District / street map | Watabou-style settlement map | **Current** when party in settlement |
| L3 | Interior | Building / tavern / shop / dungeon room grid | Per-entity floor plan / Dyson | **Current** when inside POI |
| L4 | Combat overlay | 5ft tactical layer on L1–L3 scene | Same geometry + grid overlay | **Current** (encounter active) |

### POI pin sync (dual placement)

POI stubs (building, tavern, shop, dungeon, NPC) have coordinates on:

1. **Overworld** — strategic pin inside settlement territory (or region for wilderness POIs)
2. **Settlement map** — district pin when settlement has a district map

Editing either updates both (campaign coordinate layer). Region-only POIs (roadside dungeon, wilderness shrine) pin on **region hex map** instead of overworld settlement territory.

### Encounters (stub-scoped)

| Stub type | Encounter authoring |
|---|---|
| Region | Travel / random encounter tables |
| Settlement | District hazards, patrol tables |
| Dungeon | Per-room monsters (GENR-5) |
| Tavern / shop / building | Static NPCs; combat rare, scene-driven |
| Campaign edge | No global Combat tab; **Test in Play** on stub only |

Encounters require `sourceEntityId`. Battle map derives from stub scene (not orphan presets except empty-world fallback).

---

## Multiplayer (v1)

| Role | Prep shell | Play shell |
|---|---|---|
| Campaign owner | Full | Full + Show hidden on World |
| Invited player | **No access** | Play nav only; World = discovered stubs; no Realms edit lightbox |

Co-GM role and read-only prep deferred (CAMP-14).

---

## Relationship to existing docs

| Document | Status |
|---|---|
| **`unified-campaign-ux.md` (this file)** | **Canonical** for prep/play IA, layout, map hierarchy, handoff |
| `campaigns-workspace.md` | Historical detail for list/create flows; **superseded** for tab bar (9→7), Combat tab, World Map tab, and “Start Live Session” as primary home |
| `live-play-surface.md` | **Superseded** for entry points, five-zone right-rail map layout, and “breadcrumb returns to workspace” as primary context pattern; still useful for combat mechanics, chat modes, pacing |
| `realms-library.md` | Unchanged — global library; opened from prep via lightbox |
| `docs/quests.md` | Unchanged — Quests naming and model |
| `docs/00-consolidated-plan.md` | Six-item nav unchanged; Realms ↔ Live Play section aligned with this spec |

---

## Implementation phasing (suggested)

| Phase | Scope |
|---|---|
| **UX-1** | Play shell layout refactor: center map above chat, Current \| World tabs, collapsible right rail, lightbox nav — **shipped** |
| **UX-2** | Prep shell tab merge: Map + Locations, remove Combat tab from nav, redirect old `?tab=map|world|combat` — **shipped** |
| **UX-3** | Overworld grid + territory painting (CAMP-7 evolution) — **shipped** |
| **UX-4** | POI dual-coordinate sync; stub encounter authoring UI; Test in Play — **shipped** |
| **UX-5** | `startingSceneId` gate + Settings; end-session lightbox stays in play |
| **UX-6** | Realms edit lightbox from prep; player-only play access hardening |
| **UX-7** | Scroll L0→L4 polish (PLAY-7) when UX-1–4 stable |

---

## Wireframe — play shell (ASCII)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ← Prep   🜂 Curse of Strahd · Day 3        ⚡ Async · You only    🎚 🔊 …  │
├──────┬─────────────────────────────────────────────────────────┬───────────┤
│  ▶   │  [ Current | World ]                    party chips → │ ◀ │ Thorin │
│  👤  │  ┌─────────────────────────────────────────────────┐  │   │ 34/34  │
│  👥  │  │  MAP (grid, tokens, fog, zoom controls)         │  │   │ AC 16  │
│  📜  │  └─────────────────────────────────────────────────┘  │   │ [Sheet]│
│  🌍  │  ┌─ Turn bar (combat only) ─────────────────────────┐  │           │
│  🧠  │  │ Attack · Ready · Cast · End turn                 │  │           │
│  📖  │  └─────────────────────────────────────────────────┘  │           │
│  📝  │  ┌─ Narrative ─────────────────────────────────────┐  │           │
│  ⚙   │  │ GM / player / dice / engine rows               │  │           │
│      │  │ [ Speak…                          ] [ Send]     │  │           │
│      │  └─────────────────────────────────────────────────┘  │           │
└──────┴─────────────────────────────────────────────────────────┴───────────┘
        ↑ lightbox overlays center when Party / Quests / … opened (dimmed peek)
```

---

## Wireframe — prep Map tab (ASCII)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ← Campaigns   Curse of Strahd                          [ ▶ Play Now ]      │
│ [Overview] [Map] [Locations] [Party] [Quests] [Notes] [Settings]           │
├────────────────────────────────────────────────────────────────────────────┤
│  Campaign overworld                                    [ + Add from Realms ]│
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ ░░ Region: Frozen Marches ████████████                               │  │
│  │     ░ Settlement: Northshore ████  📍 Tavern  📍 Dungeon           │  │
│  │ ░░ Region: Sinking Mire ████████████████                            │  │
│  │     ░ Settlement: Lowgate Cross ██████  📍 📍                        │  │
│  │                    [ party token at last saved position ]            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  [ select ] [ pan ] [ paint region ] [ paint settlement ] [ pin ] [ 🗑 ]   │
└────────────────────────────────────────────────────────────────────────────┘
```

---

*Grilled and locked Jun 2026. Next engineering slice: see **CAMP-UX** in `docs/deferrals.md`.*
