# Realms Page Flow

*The dedicated worldbuilding library at `/realms` — the third pillar alongside Codex and Smithy. Houses every worldbuilding entity (Regions, Settlements, Buildings, Taverns, Shops, Dungeons, Factions, NPCs) as first-class, cross-linked, reusable assets. Mirrors the visual language and component patterns of Codex/Smithy for instant muscle memory, with two original layers: a relationship Graph view and rich detail pages that reuse the Character View / Inline Editing patterns. Dark-fantasy theme, anvil/forge motif extended with cartography accents (compass roses, map seals, faction crests).*

## Entry Points

- **Top nav** (site-wide): `[Logo] 5E SRD Adventure  Home  Characters  Campaigns  Codex  Smithy  Realms (active, glowing compass icon)  [Global Search]  [🔔]  [Avatar]`
- **Quick-Jump Links from other surfaces:**
  - From Campaign workspace → World tab → "Browse Realms" (pre-filtered to type)
  - From Codex → any Region/Faction/etc. inspiration → "Forge a Realm based on this"
  - From Smithy → any homebrew item used in a generated Shop → "View Source Shop in Realms"
  - From Character View → "Link Character to a Faction / Settlement"
- **Global Search Bar**: typing "the frozen marches", "barnaby", "thieves' guild" instantly shows mixed results from Realms + Codex + Smithy + Characters, each badged.
- **Deep Links**: `/realms/regions/the-frozen-marches`, `/realms/npcs/thrain-ironbrand`, `/realms?search=tavern&style=coastal` (all bookmarkable & shareable).
- **From AI-GM during play**: When the AI silently auto-creates a stub (per cascading rules), a chip appears in chat: "🆕 Forged: *The Hearth and Hemlock* — [View in Realms]"

## Persistent Page Layout (Same on Every Realms Screen)

- **Hero Banner** (subtle, fixed height, cartography-themed):
  > "The Realms — Your Living World"
  > Quick-jump pill navigation: *All • Regions • Settlements • Buildings • Taverns • Shops • Dungeons • Factions • NPCs*
  > Prominent pill: **"🕸 Open World Graph →"** (full-screen relationship explorer)
  > Stats strip: *47 entities • 12 stubs ready to expand • 3 used in active campaigns*

- **Left Sidebar** (desktop: sticky, collapsible; mobile: horizontal scroll pills at top):
  ```
  REALMS
  ─────────────────────
  🌍  All Realms     (47)
  ─────────────────────
  🏔  Regions         (4)
  🏘  Settlements     (12)
  🏛  Buildings        (7)
  🍺  Taverns          (5)
  🛒  Shops            (6)
  🗝  Dungeons         (3)
  ⚔  Factions         (8)
  👤  NPCs           (47)
  ─────────────────────
  🕸  World Graph
  ⚒  Bulk Forge…
  ```

- **Main Content Area** (dynamic — updates on tab change, search, filter):
  - Top strip: **Quick Generate Bar** for the current entity type (always-visible 4-9 field form + "Quick Generate" button — char-gen.com pattern)
  - Below: search field + filters + view toggle (`Grid | List | Graph`)
  - Below: results — masonry grid (default), table list, or graph canvas

- **Right Pane** (desktop only, toggleable, collapses to icon strip):
  - **Recently Forged** (mixed types, most recent 8)
  - **Used in Campaigns** (entities currently linked into any of your campaigns)
  - **Quick Cascade** — "Expand 12 stubs in batch"
  - **Style Settings** — campaign-level art style lock indicator + edit
  - **Imports / Exports** — JSON in/out, World Anvil import (v1.5)

- **Footer**: Total counts • license info • "Export Realms as JSON" • "Copy World to a new Campaign"

## Global Interactions

- Unified search spans Realms + Codex + Smithy + Characters. Results badged: *Realms (Region)*, *SRD (Codex)*, *Homebrew (Smithy)*, *Character*.
- Filters update results in <300ms.
- **View toggles per tab**: `Grid | List | Graph`. Graph is filtered to the current tab plus active filters; e.g., switching to Settlements + Graph shows only settlement nodes plus their direct edges.
- **Every card and every detail page** has: `[Edit]  [Expand with Generator] (if stub)  [Add to Campaign ▼]  [Duplicate]  [Export]  [⋯ More]`
- Bidirectional integration buttons mirror Codex/Smithy pattern: `[View in Codex / Smithy] [Use in Character] [Link to Faction] [Link to Settlement]` as appropriate to type.
- **"Stub" indicator** on every stub: dashed border + small ✦ badge. Hover shows: *"Stub — Expand with [Type] Generator for full details"*.
- Keyboard nav + ARIA live regions for accessibility.
- Auto-save on every edit; undo stack persists across sessions; version history per entity.

## Tab-by-Tab Flow & Wireframes

### 1. All Realms (Default Landing Tab)

- **Purpose**: bird's-eye overview of every worldbuilding asset, mixed grid.
- **Content**: masonry grid of all entities, color-bordered by type (regions = slate-blue, settlements = warm-amber, factions = crimson, NPCs = teal, etc.), filterable.

```
┌────────────────────────────────────────────────────────────────┐
│  ⚒  Quick Forge:  [Region ▼]  [Quick Generate]                │
│      ↳ click to expand into full per-type form                 │
└────────────────────────────────────────────────────────────────┘
  Search Realms… [_____________________________]  
  Filters: Type [All ▼]  Used in Campaign [Any ▼]  Show Stubs [✓] 
           Tag [_______]  Last Edited [Any ▼]   Style [_______]
  Sort: Last Edited ▼     View: [Grid] [List] [Graph]
  
  ┌──────────────────────────┐  ┌──────────────────────────┐
  │ 🏔 The Frozen Marches    │  │ 🏘 Lowgate Cross         │
  │   Region · Frontier      │  │   Settlement · Town      │
  │   3 settlements · 1 dung │  │   1,800 pop · Plutocracy │
  │   "iron sea meets the    │  │   "iron gate that never  │
  │    infinite white"       │  │    shuts"                │
  │   Used in: Curse… (1)    │  │   Used in: Curse… (1)    │
  │   [View] [Edit] [⋯]      │  │   [View] [Edit] [⋯]      │
  └──────────────────────────┘  └──────────────────────────┘
  ┌──────────────────────────┐  ┌──────────────────────────┐
  │ ⚔ The Clock              │  │ 👤 Thrain Ironbrand      │
  │   Faction · Thieves'     │  │   NPC · Hill Dwarf       │
  │   guild · Global         │  │   Artificer 7            │
  │   201-1000 mbrs · T.N.   │  │   Shopkeeper at          │
  │   "Time takes what it..."│  │     The Ember & Anvil    │
  │   Used in: (none)        │  │   Used in: (none)        │
  │   [View] [Edit] [⋯]      │  │   [View] [Edit] [⋯]      │
  └──────────────────────────┘  └──────────────────────────┘
  ┌──────────────────────────┐  ┌──────────────────────────┐
  │ 🛒 The Ember & Anvil ✦   │  │ 🍺 The Hearth & Hemlock  │
  │   STUB                   │  │   Tavern · Cozy Inn      │
  │   Shop · Blacksmith      │  │   Halfling Rogue (Lvl 4) │
  │   "Forge of Thrain…"     │  │   3 patrons · Rumor tbl  │
  │   [Expand with Shop Gen] │  │   [View] [Edit] [⋯]      │
  └──────────────────────────┘  └──────────────────────────┘
```

- **Empty state**: cinematic illustration of an unfurled blank map and an unlit forge. Copy: *"Your world awaits — forge your first realm."* CTA: `[Quick-Forge a Region] [Run Guided World Setup] [Browse Templates]`.

### 2. Regions

- Filters: Region Type (Kingdom/Frontier/Wilderness/etc.), Climate, Scale, Magic Level, Dominant Culture, Used-in-Campaign
- **Quick Generate Bar**: `Region Type [▼]  Terrain [▼]  Climate [▼]  Scale [▼]  Magic Level [▼]  Dominant Culture [▼]  Extra Details [_____]  [Quick Generate]`
- Card: hex-map thumbnail + name + tagline + 3 settlement stub chips + biome tags
- **Detail page** opens full-page (not modal) — see Detail Page Flow below.

### 3. Settlements

- Filters: Settlement Type (Village/Town/City/Metropolis/Outpost/etc.), Population, Location Type, Wealth Level, Parent Region, Used-in-Campaign
- **Quick Generate Bar**: `Settlement Type [▼]  Population [▼]  Location [▼]  Theme [▼]  Party Level [▼]  Parent Region [Pick ▼ optional]  Extra Details [_____]  [Quick Generate]`
  - If "Parent Region" picked, settlement auto-links and inherits climate/terrain context.
- Card: district-map thumbnail + name + pop + government type + 1-line atmospheric description

### 4. Buildings

- Filters: Building Type, Condition (Pristine / Worn / Haunted / Ruined), Size, Party Level, Parent Settlement
- **Quick Generate Bar**: `Building Type [▼]  Condition [▼]  Size [▼]  Party Level [▼]  Parent Settlement [Pick ▼ optional]  Extra Details [_____]  [Quick Generate]`
- Card: interior thumbnail + name + type + condition badge + owner NPC chip

### 5. Taverns

- Filters: Tavern Type, Theme, Parent Settlement, Has Rumor Table, Party Level
- **Quick Generate Bar**: `Tavern Type [▼]  Party Level [▼]  Theme [▼]  Parent Settlement [▼]  Extra Details [_____]  [Quick Generate]`
- Card: tavern sign banner + name + keeper NPC chip + atmosphere line ("Quiet · candlelit") + 3 menu icons

### 6. Shops

- Filters: Shop Type, Specialty, Inventory Rarity, Parent Settlement, Party Level
- **Quick Generate Bar**: `Shop Type [▼]  Party Level [▼]  Theme [▼]  Parent Settlement [▼]  Extra Details [_____]  [Quick Generate]`
- Card: shop sign + name + keeper NPC chip + inventory item count + price range badge

### 7. Dungeons

- Filters: Size, Theme, Difficulty, Party Level, Monster Types, Trap Density, Loot Rarity, Parent Region
- **Quick Generate Bar**: `Size [▼]  Exact Room Count [optional]  Theme [▼]  Difficulty [▼]  Party Level [▼]  Monster Types [tags]  Loot Rarity [▼]  Trap Density [▼]  Extra Details [_____]  [Quick Generate]`
- Card: Dyson-style mini-map preview + name + room count + difficulty badge + overarching threat NPC chip

### 8. Factions

- Filters: Faction Type, Alignment, Size, Influence (Local / Regional / Global), Sphere, Public Reputation
- **Quick Generate Bar**: `Quick Description [_____]  Faction Type [▼]  Size [▼]  Alignment [▼]  Sphere [▼]  Theme [▼]  Extra Instructions [_____]  [Quick Generate]`
- Card: faction emblem (procedural heraldic crest) + name + alignment + size + leader NPC chip + motto

### 9. NPCs

- Filters: Species, Class, Level Range, Profession, Disposition (Friendly/Neutral/Hostile/Unknown), Faction Membership, Parent Settlement, Has Portrait, Is Stub
- **Quick Generate Bar**: `Species [▼]  Class [▼]  Level [▼]  Profession [▼]  Alignment [▼]  Theme [▼]  Quick Description [_____]  [Quick Generate]`
- Card: circular portrait + name + species/class/level + profession + parent location/faction chips
- **Special**: NPCs auto-created from other generators show "Auto-forged from: [parent entity]" badge.

## The Quick Generate Bar (consistent across all tabs)

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚒  Forge a new [Tavern]                  [Advanced Form →]   │
│                                                                 │
│  Type [Cozy Inn ▼]   Party Level [5 ▼]   Theme [Coastal ▼]    │
│  Parent Settlement [Lowgate Cross ▼ optional]                   │
│  Extra Details [Smuggler hangout, hidden cellar____________]    │
│                                                                 │
│  [ Surprise Me ]                       [ ⚒ Quick Generate ]    │
└─────────────────────────────────────────────────────────────────┘
```

- Default state: 3 fields + "Quick Generate". Click "Advanced Form →" to expand to full multi-field generator on a dedicated route (`/realms/generate/tavern`).
- "Surprise Me" randomizes all fields.
- After clicking Generate:
  1. Inline cinematic loader appears: glowing anvil animation + status text ("Drawing on the forge…", "Populating menu…", "Casting NPC portraits…")
  2. On completion: smooth transition into the new entity's full detail page (`/realms/taverns/the-rusty-nail`)
  3. Success toast: *"Forged The Rusty Nail — ready to customize"*
  4. The entity simultaneously appears in the grid behind, with a brief gold-shimmer animation.

## Detail Page Flow (Inline-Editable Entity Page)

Mirrors the Character View / Inline Editing pattern exactly. Default state is **editable**; no separate view-only mode unless sharing settings require it.

### Layout (using a Settlement as the worked example)

- **Fixed Header**: breadcrumb (`Realms / Settlements / Lowgate Cross`) + inline-editable name + entity type chip + status badges (*Stub* / *Forged* / *Used in 2 Campaigns*) + `[⚒ Expand with Generator]` (if stub) + `[Add to Campaign ▼]` + `[⋯ More]`
- **Left Sidebar** (collapsible): mini summary card mirroring creation wizard sidebar
  - Thumbnail map / portrait / crest
  - Type + key stats (population / size / alignment / CR / etc.)
  - **Tags & Style** (free text tags + campaign style indicator)
  - Used in: list of campaigns this is linked to
  - `[Reset to Generated]` (analogue of Smithy's "Reset to SRD")
  - `[Undo Last Change]`
- **Main Area**: horizontal tabs (vary per entity type — Settlement shown):
  - *Overview · Geography · Government · Economy · NPCs · Buildings · Taverns · Shops · History · Plot Hooks · Map · Relationships · Notes*
- **Right Rail** (toggleable, always shows by default): **Live Map Preview**
  - For Region: hex map of region with linked settlements as pins
  - For Settlement: district map with linked buildings/taverns/shops as pins
  - For Dungeon: Dyson-style room map
  - For Building/Tavern/Shop: floor plan
  - For Faction: heraldic emblem + territory tinted on a world thumbnail
  - For NPC: full portrait + token preview side-by-side
  - **Edit** button in corner opens the Map Editor (see Map drill-down — option #3 covers it)
- **Footer / Floating Toolbar**: `Cancel | Undo | Save All (green) | Regenerate Section ▼ | Last saved 5s ago (autosaved)`

### Tab-by-tab content (Settlement example, in their existing wireframe style)

**Overview** (default landing tab):
```
  Settlement Type: [Town ▼]
  Population: [1,800]
  Wealth Level: [Wealthy ▼]
  Tagline: [The iron gate that never shuts and the trade that never stops.]
  Atmosphere: [Tense and busy, characterized by the constant clatter…]
  
  Description (rich-text editor):
  [Lowgate Cross sits where the Salt Way intersects the High Road…]
  
  [Regenerate Description]   [Regenerate Tagline]
  
  ✦ Quick Stats Grid
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ 4 districts  │  │ 3 NPCs       │  │ 2 hooks      │
  └──────────────┘  └──────────────┘  └──────────────┘
```

**Geography**:
```
  Region: [The Sinking Mire ▼]  (link to Region entity)
  Climate: [Damp and foggy with perpetual overcast skies]
  Terrain: [Unnatural basalt plateau surrounded by peat bogs]
  Travel Links: [The King's High Road] [The Salt Way] [Blackwater Ferry] [+ Add]
  
  Live Map Preview (right rail): district map auto-updates
```

**Government**:
```
  Government Type: [Plutocratic Council ▼]
  Leader: [Mayor Thomas Thorne ▼] → click chip opens NPC detail
  Key Laws (drag-to-reorder):
   1. Travelers must check in with the Gate Warden upon arrival.
   2. No weapons larger than a dagger…
  [+ Add Law]
  
  Problems (collapsible accordion of structured problem objects):
   ▸ "A spike in disappearances has led to civil unrest…"
     Involved NPCs: [Thomas Thorne] [Elara Vane]
     [Convert to Plot Hook]   [Regenerate]
```

**Economy / Defenses / History / Culture / Law and Order / Recent Events / Calendar of Events**: same pattern — editable structured fields, drag-to-reorder lists, "Regenerate this section" on every block.

**NPCs / Buildings / Taverns / Shops** (sub-entity tabs):
```
  Stub-aware cards for each child entity. Same card design as the Realms grid,
  but scoped. Each card:
   [Open] [Expand with Generator] (if stub) [Unlink from Settlement] [Delete]
  
  At top: "+ Add NPC" (3 options):
    + Generate New NPC (form pre-filled with Lowgate context)
    + Link Existing NPC from Realms (picker)
    + Create Manually (blank stub)
```

**History**:
```
  Summary (paragraph editor)
  Key Events (timeline view):
    [Founding Era]   The Paving of Lowgate
    [Late Era]       The Night of Red Shadows
    [Current]        The Guild's Decree
  [+ Add Event]   [Regenerate Timeline]
```

**Plot Hooks**:
```
  Suggested Hooks (from generator output — embedded text):
   • The Wrongful Accused
     Starting NPC: [Widow Mary] (chip)  Reward: 100 gp + Ring of Protection
     [Accept into Campaign ▼]   [Edit]   [Regenerate]   [Discard]
   • The Singing Road
     ...
  
  Banner: "Hooks become tracked entities when accepted into a Campaign."
```

**Map**:
```
  Map of Lowgate Cross (district layout)
  [Open Full Editor]
  Layers: [✓] Districts [✓] Buildings [✓] Taverns [✓] Shops [✓] NPCs as pins
  Token positions visible (when linked to a campaign with active session)
```

**Relationships**:
```
  Parent
   ↳ Region: [The Sinking Mire]
  
  Children
   ↳ Buildings (1): [The High Archives]
   ↳ Taverns (1): [The Rusty Nail]
   ↳ Shops (1): [The Wheel & Axle]
   ↳ NPCs (4): [Thomas Thorne] [Elara Vane] [Father Julian] [Widow Mary]
  
  Cross-links
   ↳ Operating Factions: [The Veiled Ward] [Order of the Open Road]
   ↳ Connected Settlements: [Northshore]
   ↳ Referenced in Plot Hooks (2)
  
  [Open in Graph View]   [+ Add Link…]
```

**Notes**:
```
  Freeform markdown notes (private to you, or shared with party members
  of any campaign this is linked to — toggle per note).
```

### Per-Entity Tab Variations

| Entity | Tabs |
|---|---|
| **Region** | Overview · Geography · Demographics · Settlements · Dungeons · Factions · History · Plot Hooks · Map · Relationships · Notes |
| **Settlement** | Overview · Geography · Government · Economy · NPCs · Buildings · Taverns · Shops · History · Plot Hooks · Map · Relationships · Notes |
| **Building** | Overview · History · Architecture · Owner · NPCs · Notable Features · Plot Hooks · Floor Plan · Relationships · Notes |
| **Tavern** | Overview · Atmosphere · Menu · Patrons · Lore · Rumors · Plot Hooks · Floor Plan · Relationships · Notes |
| **Shop** | Overview · Inventory · Shopkeeper · Quirks · Loot · Plot Hooks · Floor Plan · Relationships · Notes |
| **Dungeon** | Overview · History · Atmosphere · Rooms · Wandering Monsters · Corridor Features · Secrets · Plot Hooks · Map · Relationships · Notes |
| **Faction** | Overview · Goals · Hierarchy · Members · Methods · Allies & Rivals · Secrets · Reputation · Plot Hooks · Crest · Relationships · Notes |
| **NPC** | Overview · Stat Block · Personality · Backstory · Roles & Affiliations · Portrait · Plot Hooks · Relationships · Notes |

NPC stat block tab fully reuses the **Character View** primitives (hex ability scores, HP, AC, conditions, attacks, spells if caster).

## Search & Filtering Flow

1. User types in **global search bar** → instant dropdown of top results across **Realms + Codex + Smithy + Characters**, each badged.
2. Click "See all results" → lands on Realms with matching tab pre-selected, filters applied; banner shows "Also found 3 SRD entries and 2 homebrew →".
3. On any tab, dynamic left-panel filters appear (type-specific) plus universal chips: *Used in Campaign / Show Stubs / Style*.
4. **Saved searches** (power-user feature): name and pin filter sets to the sidebar.

## Graph View Flow

- Accessed via: `View: [Grid] [List] [Graph]` toggle OR the "🕸 Open World Graph →" pill in the hero banner (full-screen).
- **Inline Graph mode** (within a tab): force-directed layout, filtered to entities matching current tab + filters.
- **Full-screen World Graph**:
  ```
  ┌─────────────────────────────────────────────────────────────┐
  │ 🕸 World Graph                                  [Close ×]   │
  │ Filter: [All Types ▼] [In Campaign: Any ▼] [Hide Stubs □]  │
  │ Layout: [Force ▼]   Zoom: [─●─]                            │
  ├─────────────────────────────────────────────────────────────┤
  │                                                             │
  │     ┌──────┐           ┌────────┐                          │
  │     │Region│───────────│Settle- │                          │
  │     └──┬───┘           │ ment   │                          │
  │        │               └───┬────┘                          │
  │     ┌──┴───┐               │                               │
  │     │Region│         ┌─────┴─────┐                         │
  │     └──────┘         │           │                         │
  │                  ┌───┴───┐  ┌────┴────┐                    │
  │                  │Tavern │  │ Shop    │                    │
  │                  └───┬───┘  └────┬────┘                    │
  │                      │           │                         │
  │                  ┌───┴───┐       ⚔                        │
  │                  │  NPC  │───────│Faction│                │
  │                  └───────┘                                  │
  │                                                             │
  │ Legend: 🏔Region 🏘Settlement 🏛Build 🍺Tav 🛒Shop          │
  │         🗝Dung ⚔Faction 👤NPC                              │
  │ Edge types: contains · member-of · ally · rival · located  │
  ├─────────────────────────────────────────────────────────────┤
  │ Side panel: hover a node → preview card                    │
  │             click a node → open its detail page in panel   │
  └─────────────────────────────────────────────────────────────┘
  ```
- **Interactions**: click a node opens a side-drawer preview; double-click opens full detail page; right-click → context menu (Edit, Add link, Hide, etc.); drag-to-pan; pinch/scroll to zoom; click an edge → edge type + chips for both endpoints.
- **Layout options**: force-directed (default), hierarchical (top-down by entity type), geographic (Region groups together their Settlements / Buildings).

## Integration Flows

- **Realms → Codex**: any NPC's stat-block fields are rendered using Codex primitives; clicking a species/class chip jumps to Codex entry.
- **Realms → Smithy**: a generated Shop's custom-item inventory items (e.g., "Stonefire Whetstone") get a "📋 Copy item to Smithy" button on hover. Once in Smithy, the shop's inventory shows the Smithy badge.
- **Realms → Character**: NPC detail page → "Convert to Player Character" creates a PC version (rare, e.g., promoting a beloved NPC to a backup PC).
- **Realms → Campaign**: every entity has `[Add to Campaign ▼]` opening a dropdown of user's campaigns. Adding links the entity (does not copy) — same entity can be in multiple campaigns. Discovery state is per-campaign.
- **Campaign → Realms**: World tab `[Browse Realms to add]` opens a Realms picker (modal) filtered to the current sub-type (Settlements / Factions / etc.). `[+ Forge New]` creates a new Realms entity already linked to this campaign.
- **AI-GM → Realms**: during play, anything the AI silently auto-creates lands in Realms with a "🤖 Auto-forged in [Campaign Name], Session 14" badge.

## Bulk Operations

- **Multi-select** via checkbox on grid cards: `Bulk Actions ▾` → Add all to Campaign / Bulk Expand stubs / Bulk Re-style portraits / Bulk Export / Bulk Delete
- **Bulk Forge** macro (sidebar shortcut): "Forge me 5 random shops at party level 5" — generates a batch in parallel
- **Bulk Cascade Expansion**: if you have 12 stubs, "Expand all stubs" runs a background job and notifies on completion

## Mobile Experience

- Top nav collapses to hamburger; "Realms" remains a primary action.
- Sidebar becomes horizontal scroll pills at top.
- Quick Generate Bar becomes a sticky bottom-sheet drawer.
- Detail pages become single-column with tab strip at top; right-rail map collapses to a "tap to expand" thumbnail.
- Graph view becomes pinch-zoomable canvas with a "Find" search to jump to a node.

## Polish & Edge Cases

- **Empty state per tab**: themed illustrations + 3 actions ("Quick Generate / Run Guided / Browse Templates")
- **Stub badge**: dashed border, ✦ icon, tooltip "Stub — Expand with Generator"
- **Conflict detection**: if generator output would duplicate an existing name (case-insensitive within parent context), modal offers `[Use Existing]  [Create Anyway]  [Rename]`
- **Auto-link**: when stub-expansion produces sub-entity names matching existing entities, auto-link instead of duplicating
- **Cascade-delete confirmation**: deleting a Settlement → modal lists its children, per-entity checkboxes, default-checked for orphans, default-unchecked for shared entities
- **Version history**: every save snapshots; "View History" panel restores any prior version
- **"Used in" awareness**: entities linked into campaigns get a soft warning banner if deleted: "This is used in Curse of Strahd (Session 12 - Discovered). Players will lose access to its narrated information."
- **Style consistency**: when AI generates portraits/maps for entities, it respects the campaign-level art style lock; if entity is in 0 campaigns, it uses the global default style

## Generator Loader Anim (cinematic detail)

```
  ╔═════════════════════════════════════════════════╗
  ║                                                 ║
  ║           ⚒                                    ║
  ║         (anvil w/                              ║
  ║        sparks anim)                            ║
  ║                                                 ║
  ║        Forging The Rusty Nail…                 ║
  ║                                                 ║
  ║   ✓ Drawing tavern blueprints                  ║
  ║   ✓ Populating menu                            ║
  ║   ✓ Casting NPC portraits                      ║
  ║   ⠋ Generating rumor table…                    ║
  ║   ○ Linking to The Sinking Mire                ║
  ║                                                 ║
  ║                              [Cancel]          ║
  ╚═════════════════════════════════════════════════╝
```

Progress reflects actual pipeline stages (each stage is a parallel call: text gen + portrait gen + map gen). Average completion 8-25s depending on entity type.

---

This is Realms. Single coherent surface, all 8 entity types, full bidirectional integration with Codex/Smithy/Characters/Campaigns, mobile + accessibility + polish covered, AI-GM hooks (auto-forge badges) baked in.
