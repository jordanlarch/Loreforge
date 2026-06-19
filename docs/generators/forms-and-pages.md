# The 7 Generators: Input Forms & Output Detail Pages

*Per-generator drill-down. Each generator follows the locked pattern (Q6): single-page form for input + Character-View-style inline-editable detail page for output + per-section Regenerate. The Realms doc (option #1) covered the **shared** patterns; this document covers what's **unique** per generator — the fields, the cascade graph, the section layouts, the special widgets, the inter-generator interactions. Ordered by world-scale (largest first).*

## Shared Patterns (Recap)

Before per-generator details, the consistent shell every generator inherits:

- **Quick Generate Bar** (compact, on the relevant Realms tab) — 3-5 fields, one "Quick Generate" button
- **Advanced Form** (full route, `/realms/generate/[type]`) — all input fields with SRD tooltips, presets, examples, "Surprise Me" randomizer
- **Generation Pipeline** — cinematic loader with parallel stages; per-stage status
- **Output Detail Page** — header + left sidebar + main tab area + right rail (Live Map Preview or relevant entity-specific widget) + floating toolbar
- **Per-section Regenerate** — every output block has a `⟳ Regenerate this section` button
- **Reset to Generated** — analogous to Smithy's "Reset to SRD" (full revert to AI's original output, preserving any edits as a fork)
- **Auto-link** — when the generator emits child entities matching existing entity names within parent context, those get auto-linked rather than duplicated
- **Auto-art** — every entity gets a token/portrait/map via the hybrid pipeline (Q16) at creation time
- **Discoverability** — when launched from a Campaign context, the entity auto-links to that campaign; when launched from Realms, save-only

I won't repeat these in each section. Focus is on the unique surface.

---

## Generator 1 — Region Generator

*The largest worldbuilding generator. Produces a fully-realized region (kingdom, frontier, archipelago, contested borderlands) with biomes, governance, demographics, economy, settlements, factions, threats, and plot hooks.*

### Entry Points

- Realms → Regions tab → Quick Generate Bar or "+ Generate Region"
- Campaign → World → Regions sub-tab → "+ Generate Region (auto-link to campaign)"
- Campaign Creation → Guided Setup → Step 2 (Region)
- Quick Forge (campaign creation) — uses this generator under the hood
- AI-GM during play — when party travels beyond known regions
- From any Settlement detail → "Link to Region" → "+ Generate New Region"

### Quick Generate Bar

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚒ Forge a new Region                              [Advanced Form →] │
│                                                                       │
│ Region Type [Frontier ▼]   Terrain [Tundra ▼]   Climate [Polar ▼]    │
│ Scale [Regional ▼]   Magic Level [Low ▼]                              │
│                                                                       │
│ [🎲 Surprise Me]                              [⚒ Quick Generate]    │
└──────────────────────────────────────────────────────────────────────┘
```

### Advanced Form

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Forge a Region                                                           │
│                                                                           │
│ ─── Identity ──────────────────────────────────────────────────────     │
│ Region Name [______________________]  [🎲 Suggest Names]                │
│ Tagline    [Optional one-line evocation]                                │
│                                                                           │
│ ─── Type & Scale ──────────────────────────────────────────────────    │
│ Region Type [Frontier ▼]                                                  │
│   ▸ Kingdom · Empire · Frontier · Wilderness · Borderlands              │
│   ▸ Archipelago · City-State · Confederacy · Theocratic                 │
│   ▸ Untamed · Fallen · Sacred · Disputed                                 │
│                                                                           │
│ Scale [Regional (50-150 mi) ▼]                                            │
│   ▸ Local (5-20 mi) · Regional (50-150 mi)                              │
│   ▸ Subcontinental (500-1500 mi) · Continental                          │
│                                                                           │
│ ─── Geography ─────────────────────────────────────────────────────    │
│ Primary Terrain [Tundra ▼]                                                │
│   ▸ Tundra · Forest · Desert · Mountains · Hills · Plains               │
│   ▸ Coastal · Swamp · Jungle · Volcanic · Underdark                     │
│ Secondary Terrain [+ Add ▼]                                              │
│                                                                           │
│ Climate [Polar ▼]                                                         │
│   ▸ Tropical · Arid · Temperate · Continental · Polar · Magical         │
│                                                                           │
│ ─── Cultural & Magical ─────────────────────────────────────────────    │
│ Magic Level [Low ▼]                                                       │
│   ▸ None · Low · Standard · High · Saturated · Wild                     │
│ Dominant Culture (optional) [Coastal merchant culture, with nomadic____]│
│                                                                           │
│ ─── Tone & Theme ──────────────────────────────────────────────────    │
│ Theme tags (multi-select):                                                │
│  [✓] Frontier  [✓] Survival  [✓] Resource Boom  [ ] Gothic              │
│  [ ] Wuxia  [ ] High Fantasy  [ ] Grimdark  [+ Add]                     │
│                                                                           │
│ ─── Cascading Generation (post-creation) ────────────────────────────  │
│ Auto-generate child entities:                                             │
│  [✓] 3 Settlement stubs   [✓] 1 Faction stub   [✓] 1 Dungeon stub      │
│  [✓] 6 NPC stubs (region-relevant)   [✓] 3-5 Plot Hooks                │
│                                                                           │
│ ─── Additional Details ─────────────────────────────────────────────    │
│ [_______________________________________________________________]      │
│ "Recent discovery of mana-ice has triggered a colonial rush from the   │
│  southern kingdoms…"                                                     │
│                                                                           │
│ ─── Style ─────────────────────────────────────────────────────────    │
│ Art Style [Painterly ink ▼]  ← campaign lock if applicable              │
│                                                                           │
│ [🎲 Surprise Me]    [Save as Preset]      [⚒ Generate Region]         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Generation Pipeline

The loader shows the actual cascade:

```
⚒ Forging The Frozen Marches…
✓ Drawing geography & biomes (3s)
✓ Sketching hex map (4s)
✓ Establishing governance & demographics (6s)
✓ Founding 3 settlement stubs (5s)
  └─ Northshore · Iron-Hold · Frost-Watch
✓ Birthing 1 faction stub: The Frost-Binders (3s)
✓ Carving 1 dungeon stub: The Glacial Vault (3s)
✓ Casting 6 NPC stubs with portraits (8s)
  └─ Hjala the Sealkeeper, Captain Vex, Olin Frost-Step,
     Mariska the Cold-Tongued, Erik Pale-Eyes, the Silent Augur
⠋ Drafting 5 plot hooks (3 of 5)…
○ Composing AI-GM narration seed
```

### Output Detail Page

```
Realms > Regions > The Frozen Marches                          [⚒ Forged · 47m ago]

[Banner: hex map preview, parallax scrolling]
The Frozen Marches
"Where the iron sea meets the infinite white."
Region · Frontier · Polar · 50-150 mi · Low Magic
Used in: Curse of Strahd (1)            [+ Add to Campaign ▼]  [⋯ More]
─────────────────────────────────────────────────────────────────────────

Tabs:
[Overview] [Geography] [Demographics] [Governance] [Economy] 
[Settlements] [Dungeons] [Factions] [History] [Plot Hooks] [Map] 
[Relationships] [Notes]

Left Sidebar (collapsible):
┌──────────────────────────────┐
│ [Hex map thumbnail]          │
│ ─────────────────────────    │
│ Type: Frontier                │
│ Scale: Regional               │
│ Climate: Polar                │
│ Magic: Low                    │
│ Stability: High               │
│ Wealth: Impoverished, rising  │
│ Threats: 3                    │
│ ─────────────────────────    │
│ Tags: frontier · survival ·   │
│       resource-boom · gothic  │
│ Style: Painterly ink          │
│ ─────────────────────────    │
│ Used in:                      │
│ • Curse of Strahd             │
│ ─────────────────────────    │
│ [Reset to Generated]          │
│ [Undo Last Change]            │
└──────────────────────────────┘

Right Rail (always visible by default):
┌──────────────────────────────────────────┐
│ Map Preview · Hex View                    │
│                                            │
│ [interactive hex grid with biome tints,   │
│  settlement pins (3), dungeon pin (1)]    │
│                                            │
│ Layers: [✓] Biomes [✓] Settlements        │
│         [✓] Dungeons [✓] Routes           │
│         [ ] Faction territories            │
│                                            │
│ [Open Full Map Editor →]                   │
└──────────────────────────────────────────┘
```

### Tab-by-Tab Content (Region-specific)

**Overview** (default landing):
```
Tagline: [Where the iron sea meets the infinite white.]
                                                         [⟳ Regenerate]
Type: [Frontier ▼]    Scale: [Regional (50-150 mi) ▼]
Magic Level: [Low ▼]

Description (rich-text):
[The Frozen Marches are a desolate expanse of jagged ice and 
wind-scoured tundra serving as a perilous gateway to the northern 
reaches. Small, resilient communities cling to the rocky shoreline...]
                                                         [⟳ Regenerate]

Quick Stats:
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ 3 settlmts │ │ 1 dungeon  │ │ 1 faction  │ │ 6 NPCs     │
└────────────┘ └────────────┘ └────────────┘ └────────────┘
```

**Geography**:
```
Biomes (drag-to-reorder):
  • Ice-choked fjords
  • Treeless tundra
  • Frozen salt marshes
  • Volcanic hot-spring pockets
  [+ Add Biome]                                  [⟳ Regenerate]

Borders (each clickable, may link to adjacent regions):
  • The High Glacial Wall to the north
  • The Churning Sea to the west  [Link to Region ▼]
  • Storm-Shield Peaks to the east
  [+ Add Border]

Terrain (textarea):
  [Low-lying coastal shelf fragmented by massive glacial fingers.]

Waterways:
  • The Still-Water Sound · Razor-Ice River · Deep-Blue Strait

Travel Notes (DM/AI usable):
  • Snowshoes or sleds mandatory for any inland travel.
  • Navigating by stars difficult due to constant aurora interference.
  • Coastal ships must be reinforced against crushing ice floes.

Landforms (collapsible list)
Notable Features (with optional pin-on-map):
  • The Singing Crevasse  [📍 Pin on map] [Convert to Dungeon stub]
  • The Pillar of Aurora  [📍 Pin]
  • The Sunken Stone Ring [📍 Pin]
  • The Frozen Leviathan  [📍 Pin] [Convert to Encounter Seed]

Hazards (used by AI-GM during travel narration):
  • Thin ice shelves · Supernatural frostbite · Roving ice-storm elementals

Resources (linkable to economy):
  • Mana-ice crystals · Whale oil · Mammoth ivory · Cold-water kelp
                                                  [⟳ Regenerate Landscape]
```

**Demographics**:
```
Population Density: [Extremely low ▼]
  ▸ Uninhabited · Extremely low · Low · Moderate · High · Dense

Major Groups (chips, droppable into NPC affinity):
  • Coastal humans · Mountain dwarves · Wandering goliaths

Minor Groups:
  • Snow-dwelling goblins · Aquatic triton traders

Languages (multi-select linked to Codex):
  [Common] [Dwarvish] [Giant] [Primordial] [+ Add]

Religions (each → linkable to faction or generates a religious-order
faction stub on click):
  • The Hearth-Mother  [Generate religious order]
  • The Frozen Sea Spirit  [Generate religious order]
                                                  [⟳ Regenerate]
```

**Governance**:
```
Structure: [Decentralized council ▼]
  ▸ Monarchy · Theocracy · Council · Tribal · Anarchy · Cabal ...

Stability: [High ▼]  (internal cohesion 1-5)
Stability Threat: [Incoming prospectors threaten the council's balance]

Seat: [A large seasonal gathering ground on the southern bay]
  [Convert seat to Settlement stub]

Key Laws (drag-to-reorder):
 1. Theft of heating fuel is punishable by immediate exile.
 2. Mutual aid during blizzards is legally mandatory.
 3. Magic use must be registered to support public warmth.
 [+ Add Law]                                    [⟳ Regenerate]
```

**Economy**:
```
Wealth Level: [Generally impoverished, rising ▼]

Primary Industries: [Whaling] [Crystal mining] [Pelt trading] [Magical research]

Major Exports: [Cured mammoth meat] [Polished ice-glass] [Scrimshaw] [Heating charms]
Major Imports: [Grains] [Textiles] [Firewood] [Forged steel]

Trade Hubs (each linkable to settlement):
  • South-Wind Port  [→ Northshore]
  • High-Cliff Exchange  [→ Iron-Hold]
  • Drift-Ice Market

Currency: [Standard ▼]  Local Variant: [None ▼ optional]
                                                  [⟳ Regenerate Economy]
```

**Settlements / Dungeons / Factions** (sub-entity tabs):

Each shows linked stubs as cards. Same card design as Realms grid. Each card:
```
┌────────────────────────────────────────────┐
│ 🏘 Northshore  ✦ STUB                       │
│ Settlement · Fishing Hub                    │
│ "Population unknown; full SRD details      │
│  available on expansion"                    │
│ [Open] [Expand with Settlement Generator]   │
│        [Unlink from Region] [⋯]             │
└────────────────────────────────────────────┘
```

"+ Add" options: *+ Generate New (pre-filled with region context) · + Link from Realms · + Create Stub Manually*

**History**:
```
Era Timeline (visual horizontal timeline):
  ─────[Ancient]─────────[Expansion]─────────[Recent]─────[Now]─────

Key Events (drag to reorder, edit, convert to plot hook):
  ▾ Ancient Era · The Great Thaw
     "A century-long warming period that first exposed the coastal 
      valleys."  [Edit] [Convert to Plot Hook] [⟳ Regenerate this event]

  ▾ Expansion Era · The Flux Discovery
     "The finding of magical ice that launched the current colonization."

  ▾ Recent Era · The Red Blizzard
     "A massive supernatural storm that destroyed three frontier camps."
     [Linked to Dungeon: The Marrow-King's Rest? Yes / No]
     [+ Add Event]
                                                  [⟳ Regenerate Timeline]
```

**Plot Hooks** (uses the campaign-scoped Hook lifecycle when accepted):
```
Suggested Hooks (embedded text from generation):
─────────────────────────────────────────────────────
🎯 Lost Expedition          (Investigation · Local scope)
  "Find a missing group of prospectors lost in the White-Out Zone."
  Starting Point: A crying spouse waiting at the local docks
  Suggested Reward: A pouch of rare mana-ice crystals
  [Accept into Campaign ▼] [Edit] [⟳ Regenerate] [Discard]

🎯 The Beacon's Dark        (Maintenance · Local scope)
  "Re-light the magical lighthouse during a heavy, magical storm."
  ...

🎯 Treaty of Ice            (Diplomacy · Regional scope)
  "Negotiate a truce between miners and a frost giant clan."
  ...
                                                  [⟳ Regenerate All Hooks]
```

**Map**:
```
Hex Map Editor (in-page)
Mode: [View ▼ View / Edit]

Layers (toggleable):
  [✓] Biome shading  [✓] Borders  [✓] Settlement pins
  [✓] Dungeon pins   [✓] Routes   [✓] Faction territories
  [ ] Travel hazards [ ] Resource nodes

[Open Full Editor]    [Export as PNG/SVG]    [Re-render with new seed]

When "Edit" mode:
  - Click hex to set biome
  - Drag pins to reposition
  - Draw faction territories (polygon tool)
  - Place custom pins (player notes)
```

**Relationships**: standard relationship panel (children + cross-links + graph open button).

**Notes**: same as base Realms detail.

### Unique Region-Specific Features

- **Travel Generator** widget on Overview: "Generate a travel encounter from Northshore → Iron-Hold (3 days)" — uses region hazards + threats + monster types
- **Auto-import region terrain as map background** in the always-on play surface when party is exploring overland
- **Demographics → NPC seed pool**: when AI auto-creates an NPC stub in this region, it pulls Species/Culture weights from Demographics tab
- **Religion → Faction quick-spawn**: each Religion entry has "Generate religious-order faction stub" one-click

---

## Generator 2 — Settlement Generator

*Mid-scale settlement (village/town/city/metropolis/outpost/port/etc.) with districts, government, economy, defenses, NPCs, shops, taverns, factions, secrets, and plot hooks. The richest output by section count.*

### Entry Points

- Realms → Settlements → Quick Generate or "+ Generate Settlement"
- Campaign → World → Settlements → "+ Generate" (auto-linked)
- From a Region detail page → Settlements tab → "+ Generate" (auto-parented to region)
- Quick Forge / Guided Setup
- AI-GM during play (party enters unexplored area near existing region)

### Quick Generate Bar

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚒ Forge a new Settlement                          [Advanced Form →] │
│                                                                       │
│ Type [Town ▼]   Population [1,500-3,000 ▼]   Location [Crossroads ▼] │
│ Parent Region [The Sinking Mire ▼ optional]                            │
│                                                                       │
│ [🎲 Surprise Me]                              [⚒ Quick Generate]    │
└──────────────────────────────────────────────────────────────────────┘
```

### Advanced Form

Adds fields for: Theme tags · Party Level · Wealth Level override · Government Type seed · Cultural ethos · Cascading generation toggles (auto-generate 1 tavern, 1 shop, 1 notable building, N notable NPCs).

### Generation Pipeline

```
⚒ Forging Lowgate Cross…
✓ Sketching town layout & districts (4s)
✓ Drawing district map (5s)
✓ Establishing government & laws (3s)
✓ Composing economy & trade flows (3s)
✓ Building 4 NPC stubs with portraits (6s)
  └─ Mayor Thomas Thorne · Captain Elara Vane · Father Julian · Widow Mary
✓ Forging 1 tavern stub: The Rusty Nail (2s)
✓ Forging 1 shop stub: The Wheel & Axle (2s)
✓ Designing 1 notable building stub: The High Archives (2s)
✓ Drafting 2 plot hooks (3s)
⠋ Composing rumors & recent events…
```

### Output Detail Page

**Tab list**: `Overview · Geography · Government · Economy · Defenses · NPCs · Buildings · Taverns · Shops · Districts · History · Culture · Law & Order · Recent Events · Plot Hooks · Rumors · Secrets · Map · Relationships · Notes`

That's a lot — these are organized into **section groups** in the tab strip (Overview / Place / People / History / Threads / Map+Rel):

```
[Overview] [Place ▼] [People ▼] [History ▼] [Threads ▼] [Map] [Relationships] [Notes]
                │              │              │              │
        Geography           NPCs           History        Plot Hooks
        Government          Buildings      Culture        Rumors
        Economy             Taverns        Law & Order    Secrets
        Defenses            Shops          Recent Events
        Districts
```

Dropdown menus on the grouped tabs let you jump to any inner section.

**Overview tab (sample)**:
```
Settlement Type: [Town ▼]
Population: [1,800] (auto-updates from district populations if edited)
Wealth Level: [Wealthy ▼]
Tagline: [The iron gate that never shuts and the trade that never stops]
                                                          [⟳ Regenerate]
Atmosphere (rich-text):
[Tense and busy, characterized by the constant clatter of iron-rimmed
 wheels and hushed conversations in dark corners.]
                                                          [⟳ Regenerate]

Description:
[Lowgate Cross sits where the Salt Way intersects the High Road...]
                                                          [⟳ Regenerate]

Quick Stats:
┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐
│ 4 distrs ││ 3 NPCs   ││ 1 tavern ││ 1 shop   ││ 2 hooks  │
└──────────┘└──────────┘└──────────┘└──────────┘└──────────┘
```

**Districts tab** (Settlement-unique):
```
Districts (each is a sub-region of the settlement, can have its own pins on map):

  ┌─────────────────────────────────────────────────────┐
  │ The Gate Quarter                            [Edit] │
  │ Heavily-patrolled area surrounding the Toll-Gate.   │
  │ Buildings here: The High Archives                   │
  │ NPCs typically here: Captain Vane                   │
  │ Atmosphere: Authoritarian, watchful                 │
  │ [Pin location on settlement map] [⟳ Regenerate]    │
  └─────────────────────────────────────────────────────┘
  
  ┌─────────────────────────────────────────────────────┐
  │ The Old Causeway                                    │
  │ Original cobbled trade route, lined with stalls.   │
  │ Buildings: The Wheel & Axle, The Rusty Nail        │
  │ ...                                                 │
  └─────────────────────────────────────────────────────┘
  
  ┌─────────────────────────────────────────────────────┐
  │ The Sunken District                                 │
  │ Lower-elevation residential, prone to flooding.     │
  │ ...                                                 │
  └─────────────────────────────────────────────────────┘
  
  ┌─────────────────────────────────────────────────────┐
  │ The Mire's Edge                                     │
  │ Where the basalt plateau meets the swamp.          │
  │ Notable: The Basalt Pit                            │
  │ ...                                                 │
  └─────────────────────────────────────────────────────┘
  
  [+ Add District]                          [⟳ Regenerate All]
```

Districts get **first-class pin areas on the settlement map** — clicking a district highlights its region on the map.

**Defenses tab** (Settlement-unique):
```
Readiness: [High ▼]
  ▸ Negligible · Low · Moderate · High · Wartime

Fortifications (chips):
  • Obsidian Outer Walls
  • The Great Toll-Gate
  • Elevated Sentry Walkways
  [+ Add Fortification]

Standing Military:
  Name: [The Gate Wardens]
  Size: [40 Professional Soldiers]
  Description: [Highly disciplined infantry equipped with polearms 
                and heavy crossbows. Specialize in crowd control 
                and swamp tracking.]
  [Convert to Faction stub →]
                                                  [⟳ Regenerate]

Garrison NPCs (linked):
  • Captain Elara Vane (leader)
```

**Law & Order tab** (Settlement-unique):
```
Crime Level: [Moderate but hidden ▼]
Enforcement: [Strict and often invasive]
Typical Punishment: [Hefty fines for locals; foreigners risk 
                     'unspecified community service' for serious crimes]

Active Criminal Threats:
  • Possible smuggling network (unconfirmed)
  • Disappearances along the Salt Way
                                                  [⟳ Regenerate]
```

**Secrets tab** (Settlement-unique, **DM-only by default** in campaign context):
```
🔒 DM-only — Hidden from party until AI narrates or you manually reveal

🔒 Scope: World-changing
   Summary: The town is built on a mechanical seal keeping an Abyssal 
            rift closed.
   Discovery Hint: Archival records show ground temperature rises 
                   when the Toll-Gate is unused for >3 days.
   [Reveal to Party ▼]  [⟳ Regenerate]
```

**Rumors tab**:
```
Town Rumors (rumor table — DM/AI can roll one when needed):
 1. Mayor Thorne's brother didn't die of plague; he's living in 
    the sewers as a transformed beast.
 2. If you put your ear to the cobblestones at midnight, you can 
    hear a heartbeat.
 3. The Salt Way merchants plan to boycott unless the merchant 
    prince's disappearance is solved.
 4. Father Julian was seen carrying a shovel and a hooded lantern 
    toward the mire after sunset.
 [+ Add Rumor]   [🎲 Roll Random]                    [⟳ Regenerate]
```

**Recent Events tab**:
```
Recent Events Timeline (most recent first):

  ▾ Last Week · A Public Execution
    Impact: The Council executed a 'notorious thief' last week. 
    Since then, the tremors under the town have temporarily stopped.
    [Convert to Plot Hook] [⟳ Regenerate]

  ▾ Two Weeks Ago · The Salt Way Washout
    Impact: Heavy rains flooded the bypass road, forcing all heavy 
    caravans through the center of Lowgate Cross and straining 
    the Toll-Gate.
    [Linked to active Hook: "The Salt Way Washout" ✓]
                                                  [⟳ Regenerate All]
```

**Map tab**:
```
Settlement Map · District View
[interactive map with district outlines, building pins, gate, walls]
  Pins: 🏛 Building · 🍺 Tavern · 🛒 Shop · ⚔ Garrison · 📍 Custom
  
  [Open Full Editor]   [Re-render]   [Use as Battle Map (combat tab)]

When zoom-in: shows interior maps of pinned buildings (transitions to 
their floor plans). When zoom-out: shows position within region map.
```

### Unique Settlement-Specific Features

- **Quick-spawn child entities** from any tab via context chips ("Captain Vane mentions a smuggler" → click → "+ Generate NPC: smuggler under Captain Vane's investigation")
- **Religion / Calendar of Events** sub-section under Culture (sample output showed "The Festival of Lights")
- **Notable Buildings vs. Common Buildings**: notable = first-class child entities; common = listed in flavor only
- **Districts → Map zones**: districts define camera-jump points on the map
- **Auto-cascading from regional context**: settlement inherits region climate/terrain/threats; user can override

---

## Generator 3 — Building Generator

*Single-structure generator: temples, guild halls, libraries, archives, prisons, barracks, academies, manor houses, bathhouses, marketplaces, alchemist workshops, thieves' dens, custom. 13+ building types. Each comes with history, owner, NPCs, secrets, plot hooks, and architectural details.*

### Entry Points

- Realms → Buildings → Quick Generate or "+ Generate Building"
- Campaign → World → Buildings → "+ Generate"
- From a Settlement detail → Buildings tab → "+ Generate" (auto-parented)
- From a Settlement District → "+ Generate Building in this district"
- From a Faction detail → "Generate Headquarters Building"
- AI-GM during play

### Quick Generate Bar

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚒ Forge a new Building                            [Advanced Form →] │
│                                                                       │
│ Type [Open-air Bazaar ▼]   Condition [Haunted ▼]   Size [Medium ▼]   │
│ Party Level [5 ▼]   Parent Settlement [Lowgate Cross ▼ optional]      │
│                                                                       │
│ [🎲 Surprise Me]                              [⚒ Quick Generate]    │
└──────────────────────────────────────────────────────────────────────┘
```

### Advanced Form

Building types (presets):
- Temple · Guild Hall · Library · Archive · Prison · Barracks · Academy · Manor House · Bathhouse · Marketplace · Alchemist Workshop · Thieves' Den · Watchtower · Lighthouse · Mill · Smithy · Cathedral · Mausoleum · Asylum · Custom

Conditions:
- Pristine · Well-Maintained · Worn · Damaged · Ruined · Haunted · Sealed · Active · Abandoned

Sizes:
- Tiny · Small · Medium · Large · Huge · Vast (mansion / cathedral / fortress)

Additional fields: Architectural Style preset, Religious/Magical affiliation, Themes, Cascading generation (Owner NPC, 2-3 Notable NPCs, 1-3 Plot Hooks, optional Floor Plan map).

### Generation Pipeline

```
⚒ Forging The Iron Paving Market…
✓ Selecting building type (Open-air Bazaar) (1s)
✓ Establishing condition (Haunted) and history (4s)
✓ Designing architectural style (3s)
✓ Drawing floor plan (3s)
✓ Creating owner: Marlowe Graves (Market Factor) (3s)
✓ Building 3 notable NPCs with portraits (5s)
✓ Generating notable features & secrets (3s)
⠋ Drafting 2 plot hooks…
```

### Output Detail Page

**Tab list**: `Overview · History · Architecture · Owner · NPCs · Notable Features · Secrets · Plot Hooks · Floor Plan · Relationships · Notes`

**Overview** (default):
```
Building Type: [Open-air Bazaar ▼]
Size: [Medium ▼]    Condition: [Haunted ▼]    Active: [Yes ▼]
Tagline: [A market where the dead still try to do business]
                                                          [⟳ Regenerate]
Description:
[A stone-paved square surrounded by tall, soot-stained buildings where 
the air remains unnaturally cold even in the height of summer...]
                                                          [⟳ Regenerate]

Quick Stats:
┌──────────┐┌──────────┐┌──────────┐┌──────────┐
│ Owner: 1 ││ NPCs: 3  ││ Hooks: 2 ││ Secret:1 │
└──────────┘└──────────┘└──────────┘└──────────┘

Parent Settlement: [Lowgate Cross ▼]
District: [The Old Causeway ▼]      [Pin on settlement map]
```

**History**:
```
History (rich-text):
[Three decades ago, the market was the site of a Great Fire that 
trapped hundreds of merchants and patrons behind a collapsed gate.
Since that night, the market has been plagued by 'The Lingering,'
spirits of the deceased who still try to conduct their daily business.
The city council allowed the market to reopen only after hiring 
specialists to ward the stalls.]
                                                          [⟳ Regenerate]

Origin Event: [The Great Fire of 30 years ago]
Past Owners (drag-to-reorder):
 1. Original founders (~80 years ago)
 2. Council-administered after the Fire
 3. Marlowe Graves (current)
 [+ Add Past Owner]                              [⟳ Regenerate Timeline]
```

**Architecture** (Building-unique):
```
Architectural Style: [Gothic Industrialism]
  "Heavy granite blocks, wrought-iron gates, and stalls reinforced 
   with cold iron to deter spiritual interference."

Materials: [Granite · Wrought Iron · Cold Iron · Salt-rimmed Stone]
Defensive Features: [Salt-line wards] [Silver bells] [Sealed perimeter]
Hidden Features: [Sub-basement crypt] [Secret merchant tunnel]
                                                          [⟳ Regenerate]
```

**Owner** (Building-unique, links to NPC entity):
```
Owner:
┌─────────────────────────────────────────────────────────┐
│ 👤 Marlowe Graves                                       │
│ Market Factor                                            │
│                                                          │
│ Personality: A weary, no-nonsense bureaucrat who smells │
│   of sage and incense. He treats the hauntings as a    │
│   logistical nuisance.                                   │
│                                                          │
│ Secret (DM-only): Actually a sentient undead using a    │
│   Ring of Mind Shielding to hide his nature while he    │
│   manages the spirits of his former colleagues.          │
│                                                          │
│ [Open NPC Page]   [Replace Owner ▼]   [⟳ Regenerate]    │
└─────────────────────────────────────────────────────────┘
```

**Notable Features** (Building-unique):
```
Notable Features (each can be pinned on floor plan):
  • The Weeping Fountain [📍 Pin on floor plan]
    "A dry stone basin in the center that drips black ichor 
     instead of water."
  • Silver Bells at every stall lintel [📍 Pin]
    "Chime when a non-living entity passes by."
  • Massive Clock Tower [📍 Pin]
    "Permanently points to midnight."
  • Salt-lines [📍 Pin]
    "Drawn across every threshold and around every merchant's display."
  [+ Add Feature]                                  [⟳ Regenerate]
```

**Additional Sections** (Building generator emits free-form "Additional Sections" — settlement-style flexibility):
```
Custom Sections (drag-to-reorder, add new):

▾ Spectral Trade Goods
  Aside from common gear, the market is known for 'Ghost-Touched' items.
  A level 5 party can find: Potion of Etherealness (rarely), Oil of 
  Sharpness, or silvered weapons. There is also a black market for 
  'Echo Crystals' which capture 10 seconds of sound from the past.
  [⟳ Regenerate Section] [Delete Section]

▾ Warding Regulations
  All visitors must check their weapons at the gate, and each person 
  is given a small sprig of dried rowan. Casting 'Turn Undead' within 
  the market is a criminal offense.

▾ The Night Shift
  After sunset, the living merchants depart and the market is 
  officially 'closed.' Those who stay can witness the 'Shadow Market'...

  [+ Add Custom Section]
```

**Floor Plan** (Building-unique map):
```
Floor Plan · Top-down view

  [interactive procedural floor plan: rooms, walls, doors, key features]
  
  Layers: [✓] Walls [✓] Features [✓] NPC starting positions
          [ ] Grid (5ft, for combat use) [ ] Secret features
  
  Levels: [Ground Floor ▼ / Sub-basement / Roof]
  
  [Edit Floor Plan]   [Use as Battle Map in combat]   [Export]
```

### Unique Building-Specific Features

- **Custom Section authoring**: free-form custom sections (per generator output structure)
- **Multi-level floor plans**: buildings can have multiple levels (ground / upper / cellar)
- **Pin features on floor plan**: notable features map to physical locations
- **Faction HQ promotion**: any Building can be marked as "Headquarters of [Faction]" → bidirectional link
- **Service hours / availability**: optional widget for active buildings (e.g., "Open dawn to dusk, except festival days")

---

## Generator 4 — Tavern Generator

*Themed taverns and inns with tavernkeeper, menu, patrons, atmosphere, lore, rumors, amenities, and adventure hooks. Most-used generator in active campaigns.*

### Entry Points

- Realms → Taverns → Quick Generate
- From any Settlement → Taverns tab → "+ Generate"
- From AI-GM during play when party seeks lodging
- From a Building detail page → "Convert to Tavern" (rare)

### Quick Generate Bar

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚒ Forge a new Tavern                              [Advanced Form →] │
│                                                                       │
│ Type [Cozy Inn ▼]   Party Level [5 ▼]   Theme [Coastal ▼]            │
│ Parent Settlement [Lowgate Cross ▼ optional]                            │
│                                                                       │
│ [🎲 Surprise Me]                              [⚒ Quick Generate]    │
└──────────────────────────────────────────────────────────────────────┘
```

### Advanced Form

Tavern Types (presets):
- Cozy Inn · Rowdy Tavern · Noble's Rest · Adventurer's Haven · Dockside Pub · Mountain Lodge · Hidden Speakeasy · Roadside Inn · Brothel-Tavern · Mystic Lounge · Custom

Cascading toggles: Tavernkeeper NPC + N patron NPCs + Rumor Table + Menu items + Adventure Hooks.

### Generation Pipeline

```
⚒ Forging The Hearth and Hemlock…
✓ Selecting tavern type (Cozy Inn) (1s)
✓ Composing atmosphere & lore (3s)
✓ Drawing tavern interior plan (3s)
✓ Generating tavernkeeper: Barnaby Bramblefoot (3s)
✓ Creating 3 patron NPCs with portraits (6s)
  └─ Thistle of the High Forest · Captain Valerius · Kallista
✓ Composing menu (8 items) (2s)
✓ Drafting amenities (3s)
⠋ Generating rumor table & adventure hooks…
```

### Output Detail Page

**Tab list**: `Overview · Atmosphere · Menu · Patrons · Tavernkeeper · Amenities · Lore · Quirks · Rumors · Plot Hooks · Floor Plan · Relationships · Notes`

**Overview** (default):
```
Tavern Type: [Cozy Inn ▼]
Tagline: [Where the moon's nectar cures more than thirst]
                                                          [⟳ Regenerate]

Description:
[An ancient stone tower converted into an inn, with thick walls and a 
roaring central hearth...]                                [⟳ Regenerate]

Quick Stats:
┌──────────┐┌──────────┐┌──────────┐┌──────────┐
│ Patrons:3││ Menu: 8  ││ Rumors:5 ││ Hooks: 3 │
└──────────┘└──────────┘└──────────┘└──────────┘

Parent Settlement: [_____ ▼]   District: [_____ ▼]
```

**Atmosphere** (Tavern-unique):
```
Atmosphere:
  Smell: [Mulled wine, herb-smoke, wet wool, hearth-cedar]
  Sound: [Slow drum of rain, low conversation, occasional pewter clink]
  Lighting: [Warm hearth-orange, candles at every table, dim corners]
  Crowd Level: [Moderate ▼]
  Mood: [Welcoming but watchful]
                                                          [⟳ Regenerate]

Music / Entertainment:
  • A lone bard plays on alternate evenings
  • Storytelling competitions on the first of each month
```

**Menu** (Tavern-unique, structured):
```
Menu Items (drag-to-reorder, edit prices):

Food:
  🍲 Hearty Venison Stew                            [4 cp]
     "Chunks of slow-cooked deer meat with potatoes, leeks, and a 
      thick brown gravy served in a bread bowl."
     [⟳ Regenerate] [Convert to Item in Codex]

  🥧 Forest Mushroom Tart                            [3 cp]
     "A flaky pastry filled with creamed wild mushrooms..."

  🥕 Honey-Glazed Roasted Carrots                    [2 cp]
  
  🍰 Brambleberry Cobbler                            [3 cp]
  
  🥖 Lavender Shortbread (per piece)                 [1 cp]

Drinks:
  🍷 Old Oak Cider (pitcher)                          [8 cp]
  🍾 Spiced Mulled Wine (mug)                         [5 cp]
  ☕ The Hemlock Special (herbal tea)                 [2 cp]

Special:
  ✨ Moon-Glow Ale (seasonal, sold out)               [—]

[+ Add Item ▼ Food / Drink / Special]      [⟳ Regenerate Menu]
```

**Patrons** (Tavern-unique, links to NPCs):
```
Regular Patrons:
┌──────────────────────────────────────┐
│ 👤 Thistle of the High Forest        │
│ Wood Elf · Druid · "always at the    │
│   back table during evening storms"  │
│ [Open NPC]  [Replace]  [⟳ Regen]     │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ 👤 Captain Valerius                  │
│ Retired Guard Captain · "watches the │
│   door from his usual stool"         │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ 👤 Kallista                          │
│ Traveling Mapmaker · "corner with    │
│   her scrolls, hates interruption"   │
└──────────────────────────────────────┘
[+ Generate Patron] [+ Add from Realms]
```

**Tavernkeeper** (Tavern-unique, links to NPC):
```
The Keeper:
┌─────────────────────────────────────────────────────┐
│ 👤 Barnaby Bramblefoot                              │
│ Halfling (Lightfoot) · Rogue (Mastermind) · Lvl 4   │
│                                                      │
│ Public face: "Bluff and cheerful, knows every gossip│
│   line through the region. Brews his own bitter."   │
│                                                      │
│ Secret (DM-only): A retired information broker for  │
│   the Harpers. Keeps a coded ledger of every secret │
│   whispered in his private parlors, written as      │
│   herbal tea recipes.                                │
│                                                      │
│ [Open NPC Page]   [Replace Keeper]   [⟳ Regenerate] │
└─────────────────────────────────────────────────────┘
```

**Amenities** (Tavern-unique):
```
Amenities (services available):

  ▾ The Sun-Drenched Reading Nook
    "Quiet corner with overstuffed armchairs and a small library of 
     local histories and botanical journals."
    Available: 24/7 to lodgers; small fee for non-lodgers.
    [⟳ Regenerate]

  ▾ Cedar Wood Wash Tubs
    "Private bathing stalls behind the hearth, copper pipes for warm 
     water."
    Cost: 2 sp per use. Open dawn to midnight.

  ▾ The Verdant Stable
    "Hay-filled barn with dedicated groomer; specializes in exotic 
     mounts and pack animals."
    Cost: 5 sp/night per mount.

  ▾ Private Parlors
    "Soundproofed small rooms for sensitive negotiations."
    Cost: 1 gp/hour. (Hint: Barnaby listens.)

  [+ Add Amenity]
```

**Lore & Quirks** (Tavern-unique, AI-GM material):
```
Lore:
  "Legend says the inn is built atop a fairy ring, and that on the 
   summer solstice, the ale turns into nectar that can cure any minor 
   ailment. Barnaby denies this, though he does charge double for rooms 
   on that specific night."
                                                          [⟳ Regenerate]

Quirks (memorable details for the AI-GM to reference):
  • The fireplace's stone face sneezes sparks when someone lies nearby
  • Furniture magically grows/shrinks to fit any creature sitting in it
  • The wine cellar has a sealed iron door no one alive remembers opening
                                                          [⟳ Regenerate]
```

**Rumors** (Tavern-unique rumor table):
```
Rumors heard at this tavern (DM/AI can roll):

 d6 | Rumor
 ───┼─────────────────────────────────────────────────────────────────
  1 | "Silverleaf herb's been blooming early; herbalist went looking..."
  2 | "Found a map tucked into an old book here — points to a cellar..."
  3 | "Goblins raided the Moon-Glow Ale supply — they're partying in 
     a nearby cave."
  4 | "Captain Valerius isn't really retired."
  5 | "Kallista charts more than maps — she's said to map dreams."
  6 | "Barnaby once vanished for a year. No one will say where."

[🎲 Roll]  [+ Add Rumor]  [⟳ Regenerate Table]
```

**Floor Plan** (Tavern-unique interior):
```
Tavern Interior · Floor Plan

  [interactive top-down map: common room, hearth, bar, private parlors,
   stairs, kitchen, stable connection]
  
  Layers: [✓] Walls [✓] Furniture [✓] NPC starting positions [✓] Amenities
          [ ] Grid overlay (combat)
  
  Levels: [Ground Floor ▼ / Upper Rooms / Cellar]
  
  [Edit Floor Plan]  [Use as Battle Map]  [Export]
```

### Unique Tavern-Specific Features

- **Menu items convertible to Codex items** — any menu line can be promoted to an Item entity in Smithy
- **Rumor table seeds AI narration**: when AI narrates "you overhear...", it rolls on this table
- **Lodging widget**: optional rooms+rates table for adventurer accommodation
- **Patron arrival schedule**: optional time-of-day chart for when patrons are typically present (used by AI-GM to populate scenes correctly)

---

## Generator 5 — Shop Generator

*Shops with shopkeeper, stocked inventory, prices scaled to party level, quirks, loot/security details, and adventure hooks. The inventory list is the unique structural feature — every item line is a first-class object with price + properties.*

### Entry Points

- Realms → Shops → Quick Generate
- From any Settlement → Shops tab → "+ Generate"
- From AI-GM during play (party visits market)
- From a Shop's "+ Sister Shop" action (e.g., sibling alchemist owned by same family)

### Quick Generate Bar

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚒ Forge a new Shop                                [Advanced Form →] │
│                                                                       │
│ Type [Blacksmith ▼]   Party Level [5 ▼]   Theme [Dwarven trade ▼]    │
│ Parent Settlement [Lowgate Cross ▼ optional]                            │
│                                                                       │
│ [🎲 Surprise Me]                              [⚒ Quick Generate]    │
└──────────────────────────────────────────────────────────────────────┘
```

### Advanced Form

Shop Types: General Store · Blacksmith · Magic Shop · Potion Shop · Armory · Weaponsmith · Jeweler · Bookstore · Scroll Shop · Fletcher · Herbalist · Alchemist · Exotic Goods · Black Market · Fence · Custom

Additional fields: Inventory Rarity slider (Common ↔ Rare ↔ Legendary), Inventory Size (4-15 items), Pricing tier (cheap / standard / premium), Allows Haggling, Has Loot section (security details for thieving parties).

### Generation Pipeline

```
⚒ Forging The Ember and Anvil…
✓ Selecting shop type (Blacksmith) (1s)
✓ Composing shop name & exterior (2s)
✓ Drawing shop interior (3s)
✓ Generating shopkeeper: Thrain Ironbrand (3s)
✓ Composing 8 inventory items with prices (6s)
✓ Designing shop quirk (2s)
⠋ Generating loot section & security checks…
```

### Output Detail Page

**Tab list**: `Overview · Inventory · Shopkeeper · Quirks · Loot · Plot Hooks · Floor Plan · Relationships · Notes`

**Overview**:
```
Shop Name: [The Ember and Anvil]
Shop Type: [Blacksmith ▼]    Specialty: [Dwarven dwarven steel + magical infusion]
Tagline: [Where iron remembers its forge]
                                                          [⟳ Regenerate]

Description:
[A solid stone-and-iron structure with a perpetually lit forge visible 
through wrought-iron grilles. Smoke rises from twin chimneys; the smell 
of hot metal lingers in the alley...]                     [⟳ Regenerate]

Pricing Tier: [Premium ▼]     Allows Haggling: [Yes, DC 15 Persuasion ▼]

Quick Stats:
┌──────────┐┌──────────┐┌──────────┐┌──────────┐
│ Items: 8 ││ Keeper:1 ││ Hooks: 1 ││ Loot: yes│
└──────────┘└──────────┘└──────────┘└──────────┘
```

**Inventory** (Shop's signature tab — fully structured):
```
Inventory                              [+ Add Item] [Import from Codex/Smithy]

Filters: [Type ▼] [Rarity ▼] [Price range]

┌────────────────────────────────────────────────────────────────────┐
│ 🗡 Battleaxe +1                                       500 gp       │
│    Weapon · Martial Melee · Magical                                 │
│    "Finely balanced axe with runes etched along the beard."        │
│    Attack: +1 to hit & damage · 1d8 slashing · Versatile           │
│    Special: Counts as magical for overcoming resistance             │
│    [SRD Reference: Magic Weapon (+1)] · [Custom Variation]          │
│    [Edit] [Sell to Party Member ▼] [Remove] [⟳ Regenerate]         │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ 🧪 Potion of Greater Healing                          150 gp       │
│    Potion · SRD                                                     │
│    "Thick red liquid with suspended gold flakes."                  │
│    Effect: 4d4+4 HP restored when consumed                         │
│    [Sell to Party Member] [Quick Cast on Sale]                     │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ 🔭 Goggles of Night                                   300 gp       │
│    Wondrous Item · SRD                                              │
│    "Brass frames with lenses carved from dark smoky quartz."       │
│    Grants Darkvision 60 ft                                          │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ 💍 Ring of Protection                                 1,000 gp     │
│    Wondrous Item · SRD · Requires Attunement                        │
│    +1 AC and saving throws                                          │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ ⚒ Stonefire Whetstone                                 75 gp        │
│    Consumable · CUSTOM                                              │
│    "Coarse grey stone that emits heat when touched."               │
│    Effect: Adds 1d4 fire damage to next successful weapon hit      │
│    [📋 Copy to Smithy as Custom Item] [⟳ Regenerate]               │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ 🛡 Shield of the Low Road                             450 gp       │
│    Armor · Shield · CUSTOM · Requires Attunement                    │
│    AC +2; Advantage on saves vs. being knocked Prone or pushed     │
│    [📋 Copy to Smithy]                                              │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ 🧪 Tunneler Tonic                                     50 gp        │
│    Consumable · CUSTOM                                              │
│    "Foul-smelling brew; tastes like dirt and copper."              │
│    Effect: Advantage on STR checks/saves for 1 hour                │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ 🥖 Ironbrand Rations (1 day)                          5 sp         │
│    Consumable · CUSTOM                                              │
│    "Dense hardtack soaked in honey and ale; stays fresh for years."│
└────────────────────────────────────────────────────────────────────┘

[⟳ Regenerate Entire Inventory]   [💰 Auto-Scale Prices to Party Lvl ▼]
```

Per-item actions:
- `📋 Copy to Smithy` — if it's a CUSTOM item, promote to Smithy entity so it's reusable
- `Sell to Party Member` — opens character picker → transfers gold from character to shop, item to character's inventory (engine-aware transaction)
- `Quick Cast on Sale` — for potions/scrolls with auto-cast effects
- `Edit` — full item editor
- `Remove` — delete from inventory
- `⟳ Regenerate` — re-roll just this item

**Shopkeeper** (Shop-unique):
```
The Shopkeeper:
┌─────────────────────────────────────────────────────┐
│ 👤 Thrain Ironbrand                                 │
│ Hill Dwarf · Artificer · Level 7                    │
│                                                      │
│ Personality: "Stern, taciturn, but warms to anyone  │
│   who shows respect for craft. Refuses to deal with │
│   anyone who can't grow a beard (a fake wool one    │
│   counts)."                                          │
│                                                      │
│ Goals: [Pay off his dead brother's debts to a       │
│   southern noble]                                    │
│                                                      │
│ Secret (DM-only): The forge contains a captive      │
│   fire elemental, bound through generations.        │
│                                                      │
│ [Open NPC Page]   [Replace Keeper]   [⟳ Regenerate] │
└─────────────────────────────────────────────────────┘
```

**Quirks** (Shop-unique):
```
Shop Quirk (memorable detail):
  "Thrain refuses to conduct business with anyone who cannot grow 
   a beard, or at least wear a convincing fake one made of wool."
                                                          [⟳ Regenerate]

Additional Quirks (optional, secondary):
  [+ Add Quirk]
```

**Loot** (Shop-unique — for thieving parties):
```
Loot & Security (DM/AI material)

Overview: 
  Valuables are kept in a massive stone safe built into the rear wall, 
  disguised as a support pillar.

Security Check:
  Skill: [Thieves' Tools ▼]    DC: [18]

Failure Consequence:
  "A Glyph of Warding triggers a Thunderwave, and the stone doors 
   slam shut, alerting the nearby Iron Guardian construct."
  [Generate Iron Guardian as Encounter]

Lootable Items (separate from sale inventory):
┌────────────────────────────────────────────────────────────────┐
│ 📜 The Ironbrand Ledger                          ~100 gp      │
│    Records · "Contains business secrets and blackmail on       │
│    several surface-world nobles."                              │
│    Location: In the stone safe                                 │
│    [⟳ Regenerate]                                              │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│ 💰 Merchant's Cash Box                           ~450 gp      │
│    Currency · "A locked iron box containing 300 gp and 15 pp."│
│    Location: Under the main counter                            │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│ 🎨 Mithral Anvil Miniature                       ~250 gp      │
│    Art Object · "Tiny, perfectly detailed anvil made of solid │
│    mithral."                                                    │
│    Location: Display shelf behind Thrain                       │
└────────────────────────────────────────────────────────────────┘

[+ Add Lootable]                                  [⟳ Regenerate Loot]
```

**Floor Plan** (Shop-unique): same as Building/Tavern — small interior map.

### Unique Shop-Specific Features

- **Inventory price auto-scaling**: button auto-adjusts all prices to current party level (SRD rarity tables)
- **CUSTOM item promotion to Smithy**: one-click on any custom item creates a Smithy entity (no orphan custom items)
- **Bidirectional sale flow**: "Sell to Party Member" actually mutates engine state (currency + inventory)
- **Loot vs. Inventory split**: sale inventory is what's openly offered; loot is what's hidden for thieves
- **Stocking schedule**: optional "Restocks weekly with [type] from [region]" — gives the AI hooks for "the shipment was late"

---

## Generator 6 — Dungeon Generator

*The most mechanically rich generator. Produces a procedural Dyson-style map with 8-40 rooms, AI-keyed descriptions, monsters scaled to party level, traps, treasure, atmosphere, secrets, and adventure hooks. Each room is a first-class sub-entity.*

### Entry Points

- Realms → Dungeons → Quick Generate
- From any Region → Dungeons sub-tab → "+ Generate"
- From any Settlement → "+ Generate Nearby Dungeon"
- From a Building detail → "Convert to Dungeon" (e.g., a haunted mansion becomes explorable)
- From the AI-GM during play (party stumbles upon a ruin)
- Quick Forge / Guided Setup

### Quick Generate Bar

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚒ Forge a new Dungeon                             [Advanced Form →] │
│                                                                       │
│ Size [Medium (10-18 rooms) ▼]   Theme [Crypt ▼]   Difficulty [Hard▼] │
│ Party Level [5 ▼]                                                      │
│                                                                       │
│ [🎲 Surprise Me]                              [⚒ Quick Generate]    │
└──────────────────────────────────────────────────────────────────────┘
```

### Advanced Form

```
Dungeon Size: [Medium (10-18) ▼]
  ▸ Tiny (5-8) · Small (8-12) · Medium (10-18) · Large (18-26) · Massive (26-40)

Exact Room Count (optional): [14]   (overrides size estimate)

Theme:
  ▸ Crypt · Ruined Temple · Lost Library · Goblin Warren · Drow Outpost
  ▸ Sunken Manor · Wizard's Tower · Necromancer's Vault · Cave System
  ▸ Mine · Asylum · Prison · Sewer · Fey Glade · Lich's Sanctum
  ▸ Custom

Difficulty: [Hard ▼]   (Easy / Medium / Hard / Deadly)
Party Level: [5 ▼]

Monster Types (multi-select, biases composition):
  [✓] Undead [ ] Constructs [ ] Aberrations [✓] Humanoids
  [ ] Beasts [ ] Demons [ ] Devils [ ] Fey [ ] Giants
  [+ Specific monsters from Codex]

Loot Rarity: [Standard ▼]   (Sparse / Standard / Generous / Treasure Vault)
Trap Density: [Moderate ▼]  (None / Light / Moderate / Heavy / Lethal)

Atmosphere preset: [Oppressive · Funereal ▼]
Light Level: [Dark ▼]  (Dim / Dark / Magical)

Parent Region (optional): [The Sinking Mire ▼]
Linked to Plot Hook (optional): [_____ ▼]

Additional Details:
[The Marrow-King once ruled here; his ghost yet roams. Six centuries 
of necromantic experiments have corrupted the lower levels.]

[🎲 Surprise Me]   [Save as Preset]   [⚒ Generate Dungeon]
```

### Generation Pipeline

```
⚒ Forging The Marrow-King's Rest…
✓ Selecting tree-growth seed (1s)
✓ Drawing dungeon layout (14 rooms, 5 corridors) (5s)
✓ Rendering Dyson-style map (3s)
✓ Composing overarching threat: Ghost of Alaric (2s)
✓ Keying 14 rooms with descriptions (12s)
✓ Placing monsters per CR budget (4s)
  └─ 1× Wraith, 4× Skeleton, 2× Ghoul, 1× Bone Golem
✓ Placing traps (3) and treasure (8 piles) (3s)
✓ Generating 3 wandering encounters (3s)
✓ Designing 2 dungeon secrets (3s)
⠋ Drafting plot hooks…
```

### Output Detail Page

**Tab list**: `Overview · History · Atmosphere · Rooms · Wandering Monsters · Corridor Features · Traps · Treasure · Secrets · Plot Hooks · Map · Relationships · Notes`

**Overview**:
```
Dungeon Name: [The Marrow-King's Rest]
Tagline: ["The heavy scent of ancient cedar and dust-dry bone lingers 
          in every breath."]                              [⟳ Regenerate]

Size: [Medium · 14 rooms]   Difficulty: [Hard]   Party Level: [5]

Description:
[A subterranean necropolis carved into the limestone hills, once 
intended for the nobility of a forgotten city. Now, it serves as a 
feeding ground for restless spirits and scavenging horrors.]
                                                          [⟳ Regenerate]

Overarching Threat:
[The Ghost of Alaric, known as the Marrow-King, seeks a physical 
vessel to reclaim his title. His necrotic influence slowly drains 
the vitality of any living creature that stays too long...]
                                                          [⟳ Regenerate]

Quick Stats:
┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐
│ Rooms:14 ││ Mons: 8  ││ Traps: 3 ││ Loot: 8  ││ Hooks: 3 │
└──────────┘└──────────┘└──────────┘└──────────┘└──────────┘
```

**History**:
```
Founded: [~600 years ago by the Vorpal-Duke Alaric]
Original Purpose: [Necropolis for the Duke's lineage and occult libraries]
Corruption Event: [Alaric's soul-binding experiments corrupted the site]
Seal Event: [Sealed by imperial decree when whispers drove locals mad]
Current State: [Abandoned for 400+ years; recent activity suggests 
                Alaric's ghost is reasserting]
                                                          [⟳ Regenerate]
```

**Atmosphere** (Dungeon-unique):
```
Atmosphere:
  Smell: [Funeral incense, damp earth, cold rot]
  Sound: [Grinding stone, distant weeping, echo of own footsteps]
  Sight: [Phosphor-glow lichen, dust-thick floors, scratched runes]
  Temperature: [Freezing, even in summer]
  Magical Aura: [Necromantic, palpable]
                                                          [⟳ Regenerate]

Persistent Effects (apply to characters spending >1hr inside):
  • Healing reduced by 1d4 (necrotic influence)
  • Heavy shadows follow the party for d6 hours after exit
  • Alaric senses gold taken from his vaults
  [+ Add Persistent Effect]                          [⟳ Regenerate]
```

**Rooms** (Dungeon-unique, each room is a first-class sub-entity):
```
Rooms (14)                                    [Auto-Number] [+ Add Room]

Filters: [Type ▼] [Has Monster ▼] [Has Trap ▼] [Has Loot ▼] [Cleared ▼]

┌────────────────────────────────────────────────────────────────────┐
│ Room 1 · The Threshold of Tears                  [📍 Map] [Open]  │
│ ─────────────────────────────────────────────────────────────────  │
│ "A cold stone vestibule where four distinct doors stand sentinel.  │
│ Dust lies thick on the floor, disturbed only by the scratching of  │
│ small vermin near the corners."                                     │
│                                                                      │
│ Read-Aloud Text: [...]                                              │
│ Monsters: — (none)                                                  │
│ Traps: — (none)                                                     │
│ Loot: — (none)                                                      │
│ Secrets: — (none)                                                   │
│ Exits: → Room 2 (north) → Room 6 (east) → Room 3 (south)           │
│ [Edit Room] [⟳ Regenerate]                                          │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ Room 2 · The Grinding Hall                       [📍 Map] [Open]  │
│ ─────────────────────────────────────────────────────────────────  │
│ "A narrow, oppressive corridor where the walls are lined with      │
│ jagged iron spikes. The air is stagnant..."                         │
│                                                                      │
│ Traps: ⚠ Pressure plate spike-wall (DC 15 DEX save, 2d10 piercing)│
│   [Defuse: DC 17 Thieves' Tools]                                    │
│ Monsters: — (cleared)                                               │
│ ...                                                                  │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ Room 3 · The Scribe's Ossuary                    [📍 Map] [Open]  │
│ ─────────────────────────────────────────────────────────────────  │
│ "Shelves carved into the walls contain skulls with runes etched   │
│ into their foreheads instead of books..."                           │
│                                                                      │
│ Monsters: 👹 1× Wraith (CR 5) [Quick Encounter]                    │
│ Secrets: 🔒 Lore — Alaric was manipulated by his head scribe      │
│   (now the Wraith). [Reveal to Party ▼]                             │
│ Loot: 💰 ~500 gp in scattered jewelry                              │
└────────────────────────────────────────────────────────────────────┘

... (rooms 4-14)

[Bulk: Mark all cleared / Reset all / Re-key descriptions]
[Open Room Detail Pages]                          [⟳ Regenerate Rooms]
```

Per-room actions:
- `📍 Map` — jump map to this room
- `Open` — full Room detail page (rooms ARE first-class entities under the dungeon)
- `Quick Encounter` — build an Encounter from this room's monsters → save to Combat tab
- `Mark as Cleared` — moves room to "explored" state; AI knows party has been here
- `⟳ Regenerate Description` / `⟳ Regenerate Monsters` / etc.

**Wandering Monsters** (Dungeon-unique):
```
Wandering Encounter Table (DM/AI rolls when appropriate):

 d6 | Encounter
 ───┼─────────────────────────────────────────────────────────────────
  1 | Restless Spirit (wraith-like; harasses, doesn't engage)
  2 | Grave Rats (small, aggressive, attempt to steal rations)
  3 | Bone Golem Sentry (patrols; CR 4)
  4 | (Reroll twice; combine the results)
  5 | Pair of Skeletons reanimating from a corner pile
  6 | Distant moaning approaches; party has 1 round to hide or prepare

[+ Add Wandering Encounter]  [🎲 Roll]              [⟳ Regenerate Table]
```

**Corridor Features** (Dungeon-unique):
```
Corridor Features (between rooms):

  • Walls 'weep' a thick black ichor that pools at floor edges
    (between Room 1 and Room 3)
  • Dense, sticky cobwebs hang like funeral veils; muffle sound 10ft
    (between Room 7 and Room 13)
  • Rows of tiny niches contain singular teeth, each inscribed with 
    a different name
    (between Room 2 and Room 6)
  [+ Add Corridor Feature]                          [⟳ Regenerate]
```

**Traps** (Dungeon-unique, aggregated):
```
All Traps in Dungeon:

  ⚠ Pressure Plate Spike-Wall (Room 2)
    Trigger: Step on plate. DC 15 DEX save. 2d10 piercing.
    Disable: DC 17 Thieves' Tools.
    [Edit] [⟳ Regenerate]

  ⚠ Glyph of Warding (Room 10)
    Trigger: Touch the altar. Fireball 3d6.
    Disable: DC 15 Dispel Magic.
    
  ⚠ Soul-Drain Pit (Corridor 4-7)
    Trigger: Step on illusion-covered pit. Fall 20ft + necrotic touch.
    Spot: DC 18 Investigation.
    
[+ Add Trap]                                       [⟳ Regenerate All]
```

**Treasure** (Dungeon-unique):
```
Treasure Distribution:

  💰 Scattered jewelry, 500 gp value (Room 3 — Scribe's Ossuary)
  💰 Sarcophagus contents, 1,200 gp + 1 magic item (Room 7)
  💰 Skeletal noble's signet ring (heirloom hook reward) (Room 13)
  💰 Vault: 3,000 gp + Tome of Necromancy (Room 14 — main throne)
  ...
  
Total estimated value: 5,200 gp + 3 magic items + 1 quest item

[+ Add Treasure Pile]   [⟳ Regenerate per SRD tables]
```

**Secrets** (Dungeon-unique, **DM-only**):
```
🔒 Dungeon-wide secrets:

🔒 Scope: Dungeon-wide
   Summary: The entire crypt is built atop a natural sinkhole that 
            Alaric used to dispose of failed experiments.
   Discovery Hint: An echoing roar can be heard when heavy items 
                   are dropped on the floor of Room 10.
   [Reveal to Party ▼]                              [⟳ Regenerate]

🔒 Scope: Lore-focused
   Summary: Alaric was not the true villain; he was being manipulated 
            by his head scribe (now the wraith in Room 3).
   Discovery Hint: A hidden diary in Room 4 reveals the scribe's plans.
                                                    [⟳ Regenerate]
```

**Map** (Dungeon's signature visual):
```
Dyson-Style Map · Top-down view

  [interactive SVG: thick wall outlines, diagonal hatching, parchment 
   palette, numbered rooms 1-14, corridors, doors, stairs]
  
  Layers: [✓] Room numbers [✓] Doors [✓] Traps (marked)
          [✓] Secret doors [✓] Notable features [ ] Party token
          [ ] Grid overlay (5ft, for tactical combat)
  
  Mode: [View ▼ View / Edit / Run Live]
  
  Click a room → opens that Room's detail in side panel
  Right-click → quick actions (mark cleared, set as battle map, etc.)
  
  [Edit Map]  [Re-render with new seed]  [Use as Battle Map]
  [Export SVG/PNG]  [Print one-page version]
```

### Unique Dungeon-Specific Features

- **Rooms as first-class sub-entities**: each room has its own detail page (mini-version of dungeon page; addressable as `/realms/dungeons/marrow-kings-rest/rooms/3`)
- **Room exploration state**: cleared / partial / unexplored — tracked per-campaign
- **Quick encounter promotion**: any room's monsters → instant Encounter
- **Dyson-style SVG export**: print-ready one-page dungeon
- **Live integration**: when party is exploring the dungeon during play, the map auto-zooms per room transition; fog of war applies room-by-room
- **Per-CR budget validation**: engine validates total monster CR against party-level encounter budget; warns if over/under

---

## Generator 7 — Faction Generator

*Non-spatial generator. Creates organizations: guilds, thieves' guilds, religious orders, military orders, secret societies, noble houses, mercenary companies, cults, druidic circles, mage circles, revolutionary movements, trade consortiums. Rich political/relational output. Unlike all other generators, no map — a heraldic emblem instead.*

### Entry Points

- Realms → Factions → Quick Generate
- From any Region → Factions sub-tab
- From any Settlement → "+ Generate Faction Operating Here"
- From an NPC → "Generate Faction this NPC Leads/Belongs To"
- Quick Forge / Guided Setup
- AI-GM during play (party uncovers an organization)

### Quick Generate Bar

```
┌──────────────────────────────────────────────────────────────────────┐
│ ⚒ Forge a new Faction                             [Advanced Form →] │
│                                                                       │
│ Type [Thieves' Guild ▼]   Size [Large 201-1000 ▼]   Align [True N ▼]  │
│ Influence [Regional ▼]                                                 │
│                                                                       │
│ [🎲 Surprise Me]                              [⚒ Quick Generate]    │
└──────────────────────────────────────────────────────────────────────┘
```

### Advanced Form

Faction Types: Guild · Thieves' Guild · Religious Order · Military Order · Secret Society · Noble House · Mercenary Company · Cult · Druidic Circle · Mage Circle · Revolutionary Movement · Trade Consortium · Pirate Brotherhood · Knightly Order · Adventuring Company · Custom

Sizes: Tiny (1-25) · Small (26-100) · Medium (101-200) · Large (201-1000) · Massive (1000+)

Alignment: full SRD 9-cell grid (LG/NG/CG/LN/N/CN/LE/NE/CE)

Sphere of Influence: Local · Regional · National · Continental · Global · Planar

Additional fields: Quick Description (free-text seed), Theme tags (Maritime / Industrial / Mystical / Underground / etc.), Cascading generation toggles (auto-generate Leader NPC + N Key Members + N Outpost Building stubs + 3-5 Plot Hooks + Relationships to existing factions).

### Generation Pipeline

```
⚒ Forging The Clock…
✓ Composing identity, motto, emblem description (3s)
✓ Establishing hierarchy & ranks (3s)
✓ Generating leader: The Main Spring (anonymous) (3s)
✓ Forging 4 key members with portraits (8s)
  └─ Thief General Freeman · Maris Deep-Note Vellar
     Sylas Venn · Krackle the Forger
✓ Designing services, methods, primary activities (4s)
✓ Establishing wealth, territory, special capabilities (3s)
✓ Composing public + secret goals + major secret (4s)
✓ Crafting allies, rivals, enemies (3s)
⠋ Drafting 4 plot hooks & rumors…
```

### Output Detail Page

**Tab list (Faction-unique structure)**: `Overview · Goals & Vision · Hierarchy & Members · Methods & Services · Allies & Rivals · Secrets · Reputation · History · Plot Hooks · Crest & Symbols · Relationships · Notes`

**Overview**:
```
Faction Name: [The Clock]
Tagline: [Time takes what it must. We take what time forgets.]
Faction Type: [Thieves' Guild ▼]   Size: [Large (201-1000) ▼]
Alignment: [True Neutral ▼]   Influence: [Global ▼]   Wealth: [Rich (uneven) ▼]

Motto: [Time takes what it must. We take what time forgets.]
                                                          [⟳ Regenerate]

Public Reputation:
  Locally seen as shadowy but governed by old rules. In some quarters 
  romanticized as a thieves' code with strange honor; in others feared 
  as a dangerous criminal syndicate.
                                                          [⟳ Regenerate]

Secret Reputation (DM-only):
  Among intelligence circles, treated as a dangerous but useful 
  information broker, capable of compromising officials for a price 
  and occasionally acting as an independent geopolitical actor.

Quick Stats:
┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐
│ Members  ││ Allies:2 ││ Rivals:2 ││ Enemies:3││ Hooks: 4 │
│ ~500     ││          ││          ││          ││          │
└──────────┘└──────────┘└──────────┘└──────────┘└──────────┘
```

**Goals & Vision** (Faction-unique):
```
Long-Term Vision:
  "Survive as the unseen keeper of information and wealth, shaping 
   commerce and politics subtly while maintaining the art of the lift..."
                                                          [⟳ Regenerate]

Public Goals (party can hear about these):
  • Preserve the craft of the lift; protect members from tyrannical 
    prosecutorial overreach
  • Maintain stability among criminal trades; ensure fences have business
  [+ Add]                                            [⟳ Regenerate]

🔒 Secret Goals (DM-only):
  • The Deep Hand seeks to open pathways for an oceanic intelligence 
    to exert psionic influence over port cities
  • Certain Council members quietly collect municipal secrets to 
    blackmail entire governments into noninterference
  [+ Add]                                            [⟳ Regenerate]

Current Objectives (active right now):
  • Expand influence into coastal city-states and key trade hubs
  • Secure arcane wards for safehouses
  • Investigate and purge the Deep Hand cell
                                                          [⟳ Regenerate]

🔒 Hidden Agendas (DM-only, deeper than secret goals):
  • Weaponize mind-affecting sea sorcery to leverage navies
  • Archive ledger of names for mass extortion if threatened
  • Some senior members plan to transform guild into political syndicate
```

**Hierarchy & Members** (Faction-unique):
```
Hierarchy (top to bottom):
  1. The Main Spring  (singular, anonymous; ceremonial head)
  2. Clock Council    (~7 members)
  3. Thief Generals   (~12, regional commanders)
  4. Hands            (~80, skilled operatives)
  5. Knobs            (~150, journeyman thieves)
  6. Ticks            (~250, initiates and observers)
  
[+ Add Rank]                                       [⟳ Regenerate Hierarchy]

Leader:
┌─────────────────────────────────────────────────────┐
│ 👤 The Main Spring (anonymous)                     │
│ Faction Leader · True Neutral                       │
│                                                      │
│ Personality: "Measured, secretive, ritualistic.     │
│   Prefers slow moves and long-term planning."       │
│                                                      │
│ Background: "Anonymous figure rumored to be the     │
│   descendant of the Horologist or a puppet council."│
│                                                      │
│ Goals: Preserve guild longevity, avoid open warfare │
│   with civic powers, maintain plausible deniability │
│                                                      │
│ [Open NPC]   [Replace]   [⟳ Regenerate]             │
└─────────────────────────────────────────────────────┘

Key Members:
┌─────────────────────────────────────────────────────┐
│ 👤 Thief General Freeman                           │
│ Senior Thief General · Regional commander          │
│ "Personally sponsors promising Ticks"               │
│ [Open NPC]                                          │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ 👤 Maris 'Deep-Note' Vellar                        │
│ Head of Tide Chambers · Suspected kraken conduit   │
│ [Open NPC]                                          │
└─────────────────────────────────────────────────────┘
... (Sylas Venn, Krackle)

[+ Generate Member] [+ Add Existing NPC]
```

**Methods & Services** (Faction-unique):
```
Primary Activities:
  • Petty theft, targeted recoveries, forgery, information brokering, 
    staged heists for political leverage

Methods (specific tactics):
  • Pickpocket runs timed to large public events
  • Forgery of travel documents and ledgers
  • Use of clockwork devices and timing signals to coordinate heists
  • Blackmail using personal tokens in the Hourbook
                                                          [⟳ Regenerate]

Services Offered (party may purchase):
  ▾ Discreet Recovery
    "Recovery of stolen or lost items; discretion guaranteed."
    Typical cost: 25% of recovered value
    [Quote varies by target]
  
  ▾ False Faces
    "Forgery and identity crafting for travel and legal cover."
    Cost: 50-500 gp depending on quality
  
  ▾ Clockwork Whisper
    "Information brokering and whisper campaigns targeting Hourbook names."
    Cost: variable; payment in coin or favors
                                                          [⟳ Regenerate]

Special Capabilities (what makes them dangerous):
  • Networked informants in docks and markets worldwide
  • Highly skilled petty thieves trained in coordinated timing
  • Access to forbidden arcane and psionic techniques

Major Assets:
  • The Hourbook (global ledger of stolen tokens & favors)
  • Safehouses hidden beneath clocks and shipwrights
  • Skilled forgers + cadre of mages and artificers
```

**Allies, Rivals, Enemies** (Faction-unique relationship structure):
```
Allies (click to open faction; create stubs for new):
┌──────────────────────────────────────────────────────┐
│ ⚔ Harbor Fences                                     │
│ Network of fencehouses + illicit auctioneers         │
│ Relationship: ally · "Handle stolen goods for a cut" │
│ [Open Faction] [Edit Relationship] [Remove]          │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│ ⚔ The Quiet Ledger ✦ STUB                          │
│ Neutral ledger-keeper cabal · launders coin          │
│ [Expand with Faction Generator] [Open Stub]          │
└──────────────────────────────────────────────────────┘
[+ Add Ally Faction]

Rivals:
┌──────────────────────────────────────────────────────┐
│ ⚔ Iron Syndicate                                    │
│ Uses brute force; detests the Clock's subtlety       │
│ Relationship: rival                                   │
└──────────────────────────────────────────────────────┘

Enemies:
┌──────────────────────────────────────────────────────┐
│ ⚔ Varied City Watches                               │
│ Institutions robbed/embarrassed by the Clock         │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│ ⚔ Tidebound Covenant ✦ STUB                        │
│ Deep-sea cultists resentful of Clock interference    │
│ [Expand with Faction Generator]                       │
└──────────────────────────────────────────────────────┘

Neutral Parties:
┌──────────────────────────────────────────────────────┐
│ ⚔ Coastal Merchant Leagues                          │
│ Prefer to avoid confrontation; pay for gentle help   │
└──────────────────────────────────────────────────────┘

[+ Add Relationship]                          [⟳ Regenerate All]
```

**Secrets** (Faction-unique, **DM-only**):
```
🔒 Major Secret (campaign-shaping):
  Summary: The Deep Hand, a faction within the Clock, made clandestine 
  pacts with illithid agents and an ancient kraken intelligence.
  Discovery hint: Two high-ranking Hands now exhibit subtle 
  mind-bonded behavior.
  Impact: World-shaping if revealed publicly.
                                                          [⟳ Regenerate]

🔒 Minor Secrets:
  • Some Chambers maintain 'sleeping Ticks' kept dormant in coffers
  • The Clock returns items to victims for political theater, not 
    compassion
  [+ Add Secret]

🔒 Internal Conflicts:
  Open conflict between traditionalists (insist on old codes) and 
  modernists (attracted to arcane shortcuts). Radical cell 'Deep Hand' 
  experimented with mind-link rituals → factional split threatens 
  civil war within the Clock.
                                                          [⟳ Regenerate]

🔒 Weaknesses (party can exploit):
  • Dependence on secrecy; exposure of the Hourbook would destabilize 
    the guild
  • Internal factionalism between Deep Hand and traditionalists
  • Vulnerability to mind-control if wards fail
```

**History** (Faction-unique):
```
Founder Story:
  "The Clock began as a string of seaside pickpockets who organized 
  after a disastrous tidal heist. A pragmatic thief known as 'The 
  Horologist' devised strict rules and the ritual of the pocket watch..."
                                                          [⟳ Regenerate]

Historical Stages (drag-to-reorder):
  Stage 1: Loose networks of waterfront thieves and watch-farmers
  Stage 2: Formalization under the Horologist with pocket watch ceremony
  Stage 3: Expansion into inland trade hubs via forged documents
  Stage 4: The Deepening (offshoots contacted strange entities)
  Stage 5: Present (global reach, fighting internal schisms)

Recruitment Process:
  Prospects observed as Ticks for a year. They must perform a successful 
  pick of a watch during initiation and recite the Oath of the Horologist 
  before being raised to Knob and then Hand.

Succession Process:
  Ritualized. Main Spring rarely overtly replaced. If proxy fails, Clock 
  Council convenes in secret and endorses new proxy through Watch-and-Ward 
  ceremony.

Crimes Committed (rap sheet):
  • Pickpocketing, high-end burglary, document forgery, smuggling, 
    blackmail, targeted political thefts
```

**Crest & Symbols** (Faction-unique, replaces "Map" for spatial entities):
```
Emblem:
┌─────────────────────────────────────────────────┐
│                                                  │
│       [generated heraldic crest art]            │
│                                                  │
│  A stylized clock face with a single missing    │
│  tooth in the gear and a slender hand pointing  │
│  between midnight and one, overlaid with a      │
│  thin key.                                       │
│                                                  │
│  Colors: brass · charcoal gray · deep teal     │
│                                                  │
│  [Regenerate Emblem] [Upload Custom]            │
└─────────────────────────────────────────────────┘

Symbols (used for member recognition):
  • Pocket watch tokens given to Hands with carved initials
  • Notch pattern scratched into hidden wall gear to indicate safe Chamber

Uniform / Dress:
  No formal uniform. Members favor muted practical clothing with brass 
  accents, pocketed cloaks, often a personal clock token worn hidden 
  on a belt or as a lapel pin.

Headquarters Description:
  Decentralized hub system. Major headquarters ('Chambers') hidden in 
  converted clock towers, abandoned warehouses, shipwright basements. 
  Each Chamber layered with false walls, sound-muffling clocks, and 
  complex lockworks.

Headquarters Settlement: [Waterdeep ▼]   (symbolic seat)

Outposts (each is a Building stub):
  • The Tide Chamber  [Expand with Building Generator]
  • The Archive Chamber  [Expand with Building Generator]
  [+ Add Outpost]

Territory (described, optionally mappable):
  • Coastal ports and inland trade hubs across multiple nations
  • Clusters of Chambers aligned along major shipping lanes
  
  [Show Territory on Campaign World Map]
```

### Unique Faction-Specific Features

- **Crest generator**: procedural heraldic emblem (vector SVG) using parametric color/shape templates; respects campaign art style lock
- **Relationship graph**: factions are richly cross-linked; their nodes are central to the Realms Graph view
- **Headquarters → Building stub auto-link**: faction emblem appears on the linked Building's detail page
- **Reputation tracker** (Campaign-scoped, when faction linked to a campaign):
  ```
  Party Reputation with The Clock: [────●──────] Neutral leaning Wary
   Specific events:
   • -10 for foiling The Hourbook Heist (Session 8)
   • +5 for paying for Discreet Recovery (Session 11)
   ```
- **Service-purchasing during play**: services offered are clickable in chat ("the party considers hiring False Faces" → quick price negotiation flow)
- **Internal conflict as plot generator**: factions with internal conflicts spawn richer hook variety
- **Faction crest appears on member NPCs** as a small badge on their portrait when "member of" is linked

---

## Cross-Generator Integration Patterns (Summary)

| From | To | Pattern |
|---|---|---|
| Region | Settlement | "Settlements in this Region" sub-tab; generate auto-parents |
| Region | Dungeon | "Dungeons in this Region" sub-tab |
| Region | Faction | "Factions Operating Here" sub-tab |
| Settlement | Building | "Buildings" sub-tab; auto-parents on generation |
| Settlement | Tavern | "Taverns" sub-tab |
| Settlement | Shop | "Shops" sub-tab |
| Settlement | District | Districts as map-zone sub-entities |
| Building | Faction | "Used by Faction" relationship (e.g., HQ) |
| Tavern | NPC | Tavernkeeper + Patrons |
| Shop | NPC | Shopkeeper |
| Shop | Smithy item | Custom inventory items promotable |
| Dungeon | Region | Parent region |
| Dungeon | Encounter | Room-monsters → quick encounters |
| Dungeon | Room | Rooms as first-class sub-entities |
| Faction | NPC | Leader + Key Members + (anonymous) Founders |
| Faction | Building | Headquarters + Outposts |
| Faction | Faction | Allies / Rivals / Enemies / Neutral |
| NPC | Any | NPCs auto-promoted from any generator; manual NPC standalone |
| Any | Plot Hook (Realms) | Embedded suggestions |
| Any | Plot Hook (Campaign) | Accepted hooks → tracked first-class |
| Any | Realms | Saved to library |
| Any | Campaign | Linkable via "Add to Campaign" |
| Any | The Smithy | Items/spells/conditions promoted |
| Any | Codex | "View Original SRD" for any SRD-derived field |

---

## Per-Generator Authoring Effort (Engineering Estimate)

| Generator | Schema complexity | UI complexity | Maps | Cascade depth | Approx engineer-weeks |
|---|---|---|---|---|---|
| Region | Very High | High | Hex map | Deep (settlements + dungeons + factions + NPCs) | 8-10 |
| Settlement | Very High | Very High (19 tabs) | District map | Deep | 8-10 |
| Building | Medium | Medium | Floor plan | Shallow (owner + NPCs) | 4-5 |
| Tavern | Medium | Medium-High (menu structured) | Floor plan | Shallow | 4-5 |
| Shop | Medium-High (inventory + loot) | High | Floor plan | Shallow + items | 5-6 |
| Dungeon | Very High (rooms as entities) | High | Dyson map | Medium (rooms + encounters) | 8-10 |
| Faction | High (relational) | High (no map; crest gen) | Crest art only | Medium (members + outposts) | 6-8 |

**Total: ~45-55 engineer-weeks ≈ 10-13 engineer-months** for full generator surface, assuming the engine + Realms shell are already built.

---

That's all 7 generators. Each has its unique structural surface; together they cover the entire char-gen.com reference plus deeper engine/cross-link integration. Ready for #6 (Tutorial Adventure design)?