# Live Play Surface

> **IA supersession (Jun 2026):** Play shell layout (center map above chat with **Current | World** tabs, left-nav lightboxes, **collapsible right character rail**), entry/handoff rules, and map hierarchy are **canonical in [`unified-campaign-ux.md`](./unified-campaign-ux.md)**. This doc retains **combat mechanics, chat modes, pacing, and drill-down detail**; legacy layout wireframes are **archived** in [`../archive/ui-flows/live-play-surface-legacy-layout.md`](../archive/ui-flows/live-play-surface-legacy-layout.md). Implementation: `docs/deferrals.md` **CAMP-UX**.

*The dedicated **play shell** at `/campaigns/[id]/play` — invoked via **Play Now** / **Continue** from prep. The single surface where humans play their characters under the AI-GM. Hybrid text-chat backbone with the **always-on map above the chat log** in the **center column**. **Exploration** scenes show a collapsible PC rail on the right; **combat** adds an initiative strip above the map and a turn bar between map and chat. Designed for solo async sessions on a laptop and live multiplayer sessions across multiple connected clients with real-time sync.*

> **Doc convention:** sections labeled **Shipped** match the running app today. Sections labeled **Target design** describe v1 intent that is not fully built yet — see `docs/deferrals.md` §3.7 (PLAY-*) and **CAMP-UX**.

## Entry Points

- **Primary**: `[▶ Start Live Session]` button in the Campaign workspace header (always visible on every tab)
- **Resume**: `[Continue last session →]` on the Overview tab or `[Continue from Here] / [Continue Live]` on any past session card
- **Combat auto-route**: clicking `[Run Now (Live)]` on an Encounter in the Combat tab jumps straight into Live Mode at that encounter
- **Join (multiplayer)**: when another party member starts a Live session, all members get a push notification + a `⚡ Live: Active (2 connected) — [Join]` chip in the workspace header
- **Async resume**: opening any campaign with a saved play state shows a banner at the top of Overview: *"You're mid-scene at The Hearth and Hemlock. [Continue ▶]"*
- **Deep link**: `/campaigns/curse-of-strahd/play` (resumes from latest play state)

## Two Modes of the Same Surface

The same UI shell runs in two distinct sync modes:

| Mode | When | Sync model |
|---|---|---|
| **Async / Solo** | Solo campaigns; multiplayer with no other members connected | Single client; engine + AI run locally + server; no peer sync overhead |
| **Live** | Two or more party members connected simultaneously; OR combat encounter triggered (auto-routes to Live) | Yjs CRDT over WebSocket; all clients see the same engine state, chat stream, map, dice rolls in real-time |

The visual UI is identical. A small **`⚡ Live · 3 connected`** chip in the header indicates Live mode; **`◐ Async · You only`** indicates solo.

## Render modes (exploration vs combat)

The same shell hosts two render paths (see `play-surface.tsx`):

| Mode | When | Chrome |
|---|---|---|
| **Exploration** | Mapped scene, no active `encounter` | Top bar · map · chat · **optional right sidebar** (compact PC HUD + tutorial controls) · **left party rail** |
| **Combat** | Active encounter | Top bar · **initiative strip** · left party rail · map · **horizontal turn bar** · chat — **no right sidebar** |

During combat, character vitals come from the **party rail** (hover mini-HUD, click for read-only sheet peek). The engine still owns all mechanics; the UI only surfaces what the synced `WorldState` exposes for party-side entities.


## Layout (as-built)

Canonical play shell: [`unified-campaign-ux.md`](./unified-campaign-ux.md) — **left icon nav** + **center map above chat** (`Current | World` tabs) + **collapsible right `PlayRightRail`** (`play-shell-chrome.tsx`, #241).

**Exploration:** map column + chat; right rail shows PC panel (+ tutorial extras when applicable). **Combat:** initiative strip above map; turn bar between map and chat; compact HUD in right rail during combat.

Legacy **#214 left party-rail** layout ASCII and the original five-zone target sketch are archived in [`../archive/ui-flows/live-play-surface-legacy-layout.md`](../archive/ui-flows/live-play-surface-legacy-layout.md).

**Still deferred:** hierarchical L0–L4 on Current, fog of war, Edit Map authoring, token context menus, draggable map/chat split — see `docs/deferrals.md` PLAY-7 / CAMP-UX.

## ① Top Bar

**Shipped (B2 / #101):** `live-top-bar` — breadcrumb back to workspace, campaign title, Live/Async presence chip (peer count), current scene name, **real-time session clock**, client-side **Pause** (freezes local turn UI + map interactions), **Reset**, optional **End session** (campaigns), rejected-move hint, and a tools row. **🎚 Pacing** is live (style + soft turn timer + Continue/Hold/Skip). **End turn** lives in the **combat turn bar**, not here. During combat, round/turn/movement are **not** duplicated in the top bar (they appear in the initiative strip + turn bar). **Still placeholders:** 🔊 TTS, 🧠 Memory, 📋 Inventory. **Still deferred:** in-game clock, named connection roster, server-side pause freeze, `[Zoom Out ▲]`, session rename, ⚙ Session dropdown.

**Target design** — full top bar mockup:

```
  ← [Workspace]    🜂 Curse of Strahd · Session 15      ⚡ Live · 3 connected
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📍 The Hearth and Hemlock (Lowgate Cross > Tavern District)  [Zoom Out ▲]
  ⏰ In-game: Day 3, Night · 22:14    ⏱  Real-time: 47m       [Pause Session]
  Connected: 🟢 Jordan (Thorin) · 🟢 Kim (Elara) · 🟡 Alex (Finn, typing…)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Tools:  [🎚 Pacing]  [🔊 TTS Off]  [🧠 Memory]  [📋 Inventory]  [⚙ Session]
```

Top bar elements:
- **Breadcrumb back**: returns to workspace without ending the session (session continues in background)
- **Campaign + session label**: click to rename the session (live)
- **Live indicator**: gold chip when ≥2 connected; muted when async
- **Current scene chip**: shows current location with full breadcrumb; `[Zoom Out ▲]` toggles map zoom level
- **Dual clocks**: in-game time (advances on AI narration / time-skips) and real-time (this session's duration)
- **`[Pause Session]`**: freezes engine state + AI; useful for breaks. Resumes on `[Play]` toggle.
- **Connection roster**: presence indicators for each party member; click a name → opens their character mini-card
- **Tools row**: persistent quick-access to in-session affordances:
  - **🎚 Pacing**: opens slider (Reactive ↔ Cinematic) + [Continue / Hold] buttons + `/skip` shortcut
  - **🔊 TTS**: toggle on/off; gear icon → voice picker per NPC
  - **🧠 Memory**: opens AI Memory panel inline (same component as workspace)
  - **📋 Inventory**: opens shared party inventory + your character inventory in a drawer
  - **⚙ Session**: dropdown — End Session · Retcon to point · Export transcript · Connection settings · Help

---

## ② Map Zone (Always-On Map)

The defining feature of the play surface. The map of the **current scene** is always rendered above the chat; player tokens are visible at their positions; the map *is* the spatial truth of where the party is.

**Shipped:** tactical grid for the current scene (`MapViewport`) — CSS zoom in/out/reset, grid + movement-radius layer toggles, token drag within reachable cells, target picker + AoE aim overlay during combat. Scene transition banner (#103).

### Zoom Levels (hierarchical) — **Target design (PLAY-7, not built)**

The map zone supports five vertical zoom levels, navigable via `[Zoom Out ▲] / [Zoom In ▼]` in the top bar OR mouse-wheel/pinch:

| Level | Shown | Source |
|---|---|---|
| **L0 — Campaign World Map** | Continental view, all regions + faction territory tints | Campaign workspace World Map |
| **L1 — Region Map** | Single region, hex grid, biomes, settlement pins | Region entity map |
| **L2 — Settlement Map** | Town/city districts, streets, key buildings as pins | Settlement entity map |
| **L3 — Interior / Floor Plan** *(current scene default for indoor)* | Single building/tavern/shop/dungeon-room layout | Building/Tavern/Shop/Dungeon entity map |
| **L4 — Tactical / Battle Grid** *(combat default)* | Same interior with 5ft grid overlay + combatant tokens | Battle map layer over current L3 |

**Auto-zoom behavior**:
- Entering a Tavern via narration → AI sets current scene to that Tavern → map auto-zooms to L3 (the tavern interior)
- Combat initiated → map auto-zooms to L4 (grid + tokens, combat overlay opens)
- Combat ends → map auto-zooms back to L3
- Player typing "I head out into the street" → AI advances scene to settlement-level → map auto-zooms to L2

**Manual zoom**: any user can scroll out at any time to check broader context without changing the scene. The "current scene" lock prevents accidental scene jumps; manual zoom is a *view-only* state. A "Return to scene" pill appears: `📍 Return to The Hearth and Hemlock (L3)`.

### Map Layer Controls

Floating in upper-right corner of the map zone:

```
  ┌─ Layers ─┐
  │ ✓ Tokens │
  │ ✓ Names  │
  │ ✓ Fog    │
  │ ✓ Grid   │  ← only at L4
  │ ✓ Notes  │
  │ ☐ Routes │  ← only at L0-L2
  └──────────┘
  [Edit Map ✎]
```

`[Edit Map ✎]` opens an inline map editor (drag walls, add pins, adjust fog regions). Edits sync to all connected players and persist to the entity's canonical map. (Map edits during play are rate-limited to prevent disruption.)

### Tokens

Every entity with a presence on the current map renders as a token:

- **PC tokens**: circular portrait crop, gold border, name label below
- **NPC tokens**: portrait crop, border color = disposition (green friendly / gray neutral / red hostile / dashed unknown)
- **Monster tokens**: Codex art crop, red border in combat
- **Object tokens**: chest, door, trap, altar (icon-based)
- **Stub indicators**: tokens with a small ✦ badge if the underlying entity is a stub

**Token interactions**:
- **Drag** to move (snaps to grid in L4 combat; free-move otherwise)
- **Single-click**: opens a side-drawer with that entity's info (read-only during play; what the AI has narrated/revealed)
- **Double-click**: opens the entity's full Realms detail page in a new tab (for the DM-curious — note no human is DM, but the player can read up on what's been revealed)
- **Right-click** (player's own token): quick actions menu — *Move here / Use item / Cast spell / Take action*
- **Hover**: tooltip with name + disposition + (in combat) HP bar + conditions
- **Movement-from-chat**: typing *"I move behind the bar"* triggers the AI to issue a `move(target, position)` tool call → engine validates legality (speed, terrain) → token slides smoothly. Both drag and text input go through the same engine path; engine is canonical.

### Fog of War — **Target design (PLAY-7, not built)**

Per-token visibility computed from the map's wall geometry + line-of-sight from each PC's position:
- **Unexplored**: solid dark — never been here
- **Explored, not currently visible**: dimmed gray + last-known token positions ("memory")
- **Visible**: full color

Default settings per campaign (Pacing-tied):
- **Cinematic pacing**: minimal fog (everyone sees the whole scene for narrative clarity)
- **Reactive pacing**: strict line-of-sight fog

Fog can be **revealed by the AI's narration** ("you peer around the corner and see…") — the AI calls `reveal_area(map, region)` tool which clears the fog client-side for all players.

### Tactical Combat Overlay — **Shipped (#58, #214)**

When combat is active (`encounter` present):

1. Map shows the scene's tactical grid with combatant tokens
2. **Initiative strip** (full width, above map + party row): round badge, active combatant name, horizontal initiative chips (hostile chips styled differently; dead combatants dimmed)
3. Active token highlighted on the map; **movement radius** for the active combatant (reachable cells)
4. On a controllable party turn, **turn bar** above chat: action-economy chips, **Attack** (sheet weapons), **Ready**, **Cast** (prepared spells), consumable quick-use buttons (narrative `use_item` chat until SMITH-7), **End turn**
5. Arming Attack/Cast/Ready activates the map **target picker** or **AoE aim cell**; engine resolves on confirm
6. **Reaction prompts** appear in the turn bar when the engine opens a reaction window (Opportunity Attack + Pass; Shield tracer when available)

**Target design (not built):** L4 auto-zoom from L3, token reveal animations, range rings on action hover, initiative strip *inside* the map zone only.

**Target design** — overlay mockup along the top of the map zone:

   ```
   ⚔ COMBAT · Round 3 · ▶ Thorin's turn (Action available · 30ft moved/30ft)
   ────────────────────────────────────────────────────────────────────────
   Initiative: 🛡 Thorin(22) → 🎵 Elara(18) → 🗡 Bandit#1(15) → 🗡 Bandit#2(12)
                                          ↑ now
   ```

- Token avatars in initiative (vs name chips today)
- Pulsing gold ring on active token *(partially shipped — active highlight + reachable cells)*
- Range rings on action hover *(not built)*

---

## ③ Chat / Narrative Zone

The text backbone of play. Vertically scrolling log of structured chat entries.

### Entry Types

Each entry has a distinctive visual treatment:

```
  ┌─ 🎲 GM (Claude Sonnet · 22:14) ─────────────────────────────────────┐
  │ You push open the iron-bound door of [📍 The Hearth and Hemlock].   │
  │ Warm air rolls out — hearth-smoke, mulled wine, the slow drum of    │
  │ rain on the slate roof above. Behind the bar, [👤 Barnaby           │
  │ Bramblefoot] looks up from a pewter mug he's polishing.             │
  │                                                                       │
  │ "Cold night to be on the road, friend. The fire's lit, and we've    │
  │ a stew on if your purse can bear it."                                │
  │                                                                       │
  │ Three patrons sit in the common room. [👤 Captain Valerius]          │
  │ nurses a tankard near the hearth, watching the door. [👤 Kallista]   │
  │ the cartographer is hunched over scrolls at a corner table. A wood   │
  │ elf you don't recognize sits alone in shadow.                        │
  │                                                                       │
  │ [🔊 Listen ▶]   [Mention @ Pin to memory] [Edit] [↺ Retcon from here]│
  └───────────────────────────────────────────────────────────────────────┘
```

```
  ┌─ 👤 Thorin (Jordan · 22:15) ─────────────────────────────────────────┐
  │ "Aye. I'm looking for a missing herbalist named Silverleaf. Anyone   │
  │ been by asking about her?"                                            │
  │                                                                       │
  │ I also slide a silver piece across the bar.                          │
  └───────────────────────────────────────────────────────────────────────┘
```

```
  ┌─ 🎲 GM ──────────────────────────────────────────────────────────────┐
  │ Barnaby's eyes flick to the silver, then back to you. He pockets    │
  │ the coin without comment.                                             │
  │                                                                       │
  │ *Make an Insight (WIS) check.*                                       │
  │ [🎲 Roll Insight +1] [🎲 Advantage] [🎲 Disadvantage]                │
  └───────────────────────────────────────────────────────────────────────┘
```

```
  ┌─ 🎲 Thorin rolled Insight ───────────────────────────────────────────┐
  │ d20[14] + 1 = 15        Result: 15 vs DC: 12  →  Success            │
  └───────────────────────────────────────────────────────────────────────┘
```

```
  ┌─ 🎲 GM ──────────────────────────────────────────────────────────────┐
  │ Barnaby pauses just a beat too long. He knows something — but he's   │
  │ scared. He glances toward the man in the corner.                     │
  │                                                                       │
  │ "Couldn't say, friend. But you might try [👤 Father Julian] in       │
  │ the morning. He's known to wander these parts at strange hours."    │
  │                                                                       │
  │ ⚒ AI auto-forged: [👤 Father Julian] (NPC stub) · added to Realms    │
  └───────────────────────────────────────────────────────────────────────┘
```

```
  ┌─ ⚒ ENGINE EVENT (collapsed by default) ──────────────────────────────┐
  │ Thorin spent 1 SP (Inspiration). HP: 34 → 34. Conditions: —.        │
  └───────────────────────────────────────────────────────────────────────┘
```

### Chip Types (clickable inline references)

Every entity reference in any chat entry is a clickable chip:

| Chip | Icon | Click action |
|---|---|---|
| **Location** | 📍 | Opens side-drawer with location summary; double-click jumps map zoom to that location |
| **NPC** | 👤 | Opens NPC side-drawer (portrait, disposition, what's been revealed); double-click opens NPC entity in side panel |
| **Item** | 🗡 / 🛡 / 🧪 | Opens item card (cost, weight, properties, full SRD text) |
| **Spell** | 🔮 | Opens spell card; if you can cast it, shows `[Cast]` button |
| **Faction** | ⚔ | Opens faction summary (only revealed info) |
| **Skill / Save** | 🎯 | Hover for SRD definition |
| **Dice roll** | 🎲 | (Inline button — see Dice flow below) |

Hover shows preview tooltip; click expands inline; cmd-click pins to "Watch list" (appears in HUD as a quick-reference strip).

### Dice & Check Resolution Flow

When the AI calls for a check, it produces an **inline check widget**, not free text:

```
  ┌─ 🎲 GM ──────────────────────────────────────────────────────────────┐
  │ The lock is intricate dwarven work.                                  │
  │                                                                       │
  │ Make a Sleight of Hand (DEX) check, DC 18.                           │
  │ ┌──────────────────────────────────────────────────────────────┐    │
  │ │  Skill: Sleight of Hand (+5 = DEX 14 +2 + Prof +2 + Exp +1)  │    │
  │ │  Tools: Thieves' Tools (proficient, +2)                       │    │
  │ │  Effective modifier: +7                                       │    │
  │ │                                                                │    │
  │ │  [🎲 Roll +7]   [Advantage]   [Disadvantage]   [Help (assist)]│    │
  │ │  [Use Inspiration]   [Bardic Inspiration: d6 (Elara)]         │    │
  │ └──────────────────────────────────────────────────────────────┘    │
  └───────────────────────────────────────────────────────────────────────┘
```

- Player clicks `[🎲 Roll +7]` → animated dice icon + result appears
- Engine validates (was advantage applied correctly, were all modifiers included)
- Result feeds back as a chat entry; AI receives the result + DC outcome and continues narration
- **Bardic Inspiration** chip appears automatically because Elara has BI available within range — if Elara accepts in real time, the d6 is added to Thorin's roll before resolution
- **Help** action chip appears when another party member is in position to assist (engine knows positions on the map)
- **Inspiration** chip appears when Thorin has Inspiration available

The player **never types damage numbers**. They never compute modifiers. Engine handles all math; UI surfaces the inputs the player has agency over (advantage, items used, etc.).

### Player Input

Bottom of the chat zone:

```
  ┌──────────────────────────────────────────────────────────────────────┐
  │ [💬 Speak] [⚔ Action] [🎯 Check] [🔮 Cast] [🗡 Attack] [🎒 Use Item] │
  │                                                                       │
  │ [_____________________________________________________________]      │
  │  ⌨ Free text · Slash commands available (/help)              [Send]  │
  └──────────────────────────────────────────────────────────────────────┘
```

**Input modalities** (all available simultaneously):

1. **Free text** — natural language. AI interprets intent. Default for narrative/RP.
2. **Action mode buttons** — chip-row above input. Clicking `[🔮 Cast]` opens a spell picker; selection inserts a structured action (`/cast Fireball at <target>`) and arms the engine to expect target selection on the map.
3. **Slash commands** — power-user shortcuts:
   - `/cast <spell> [target]` — cast a spell
   - `/attack <target> [weapon]` — make an attack
   - `/check <skill>` — request a skill check (player can also self-initiate)
   - `/move <location | "to X">` — explicit movement
   - `/use <item>` — use an inventory item
   - `/speak <to npc>` — direct dialogue cue
   - `/rest short | long` — initiate rest
   - `/skip <hours | "to morning">` — request time skip
   - `/help` — opens command palette
4. **Map-driven** — drag your token to a position; right-click for context menu
5. **Sheet-driven** — clicking `[Cast]` on a spell card in the right-rail HUD initiates casting
6. **Voice (v1.5)** — STT button in input bar; press-to-talk transcription with structured-action extraction

**Input mode badge**: a subtle chip at the right of the input shows what mode the AI thinks you're in:
- `💬 Speaking` (your text will be treated as dialogue)
- `🎬 Acting` (your text will be treated as action)
- `🤔 OOC` (out-of-character — bracket your text with `((double parens))` for meta talk)

The AI's "talk to GM" meta override (Q19a) lives here: bracket your text with `((...))` to step outside the fiction (e.g., *"((That's not how Fireball works — should be 8d6 not 6d6))"*); the AI acknowledges OOC and corrects.

### AI "Thinking" State

When the AI is composing a response:

```
  ┌─ 🎲 GM is composing… ────────────────────────────────────────────────┐
  │  ⠋ Considering Barnaby's reaction…                                   │
  │     ↳ Retrieved: Barnaby Bramblefoot · Lowgate Cross · Hooks (active)│
  │     ↳ Consulting: SRD Insight skill, NPC disposition rules           │
  └───────────────────────────────────────────────────────────────────────┘
```

The "thinking" entry shows in real-time what context the AI fetched (RAG retrievals) and what tools it's considering. Players can:
- **Read** it as an immersive "GM behind the screen" effect
- **Click `[Interrupt]`** to retract and re-prompt (in case the AI is going wrong direction)
- **Collapse** it (per-user preference) if they prefer cleaner output

This transparency is a deliberate design choice (Q15 player canon control) — players see what the AI is working from, which builds trust.

---

## ④ Character HUD

### Shipped (exploration + party rail)

| Surface | What the player sees |
|---|---|
| **Exploration right sidebar** | Compact PC panel: name, HP/AC/speed, **Sheet** link to full overlay; tutorial inventory button when applicable. No ability grid, attacks, or action economy here. |
| **Combat party rail hover** | Mini-HUD popover: ability mods, AC/speed/temp HP, conditions, concentration spell name, spell slot pips, death saves. Shown for **party-side** members only (engine-synced). |
| **Combat sheet peek** | Click a party chip → read-only character sheet overlay (PLAY-4). |

There is **no** full character sidebar during combat. The old `CharacterHud` component (active-combatant stats in the right rail) was removed in #214 — it surfaced whoever's turn was active, not necessarily the player's PC.

### Target design — full right-rail Live Stats HUD

The right rail would reuse the **Live Stats HUD** component already designed in the Inline Editing spec — enriched for live play during **all** play modes:

```
  ┌────────────────────────────────────┐
  │ [PORTRAIT]                          │
  │ Thorin Ironfist                     │
  │ Lvl 5 Hill Dwarf Fighter            │
  │                                     │
  │ ◄ STR 15 (+2)  DEX 14 (+2)  ►      │
  │   CON 16 (+3)  INT 12 (+1)          │
  │   WIS 13 (+1)  CHA 10 (+0)          │
  │                                     │
  │ HP [█████████░] 28 / 34   +THP[0]   │
  │ AC 16   Init +2   Speed 25ft        │
  │ PP 13   Prof +3   Insp ☆            │
  │                                     │
  │ ─── Quick Roll ─────────────────    │
  │ [🎲 d20+STR] [🎲 Initiative]        │
  │ [⚖ Advantage] [⚖ Disadvantage]      │
  │                                     │
  │ ─── Conditions ─────────────────    │
  │ [Poisoned ▼] [+ Add]                │
  │                                     │
  │ ─── Active Resources ───────────    │
  │ Second Wind  [1/1]   [Use]          │
  │ Action Surge [0/1]   used           │
  │ Spell Slots: —                       │
  │                                     │
  │ ─── Attacks ────────────────────    │
  │ Battleaxe  +4 to hit  1d8+2  [Attack]│
  │ L. Crossbow +4  1d8+2  80/320 [Atk] │
  │                                     │
  │ ─── Equipped & Bag ─────────────    │
  │ 🛡 Chain Shirt   🗡 Battleaxe        │
  │ 🧪 Healing Potion ×3   [Use]        │
  │ Coins: 87gp                          │
  │                                     │
  │ [Open Full Sheet]   [Compact ↑]     │
  └────────────────────────────────────┘
```

**Live-only additions over the standard Character View HUD** *(target — not shipped in live play)*:
- **Active turn highlight**: when it's your turn in combat, the HUD gets a pulsing gold border
- **Action economy chips** (combat only): `Action ✓ available · Bonus ✓ · Reaction ✓ · Move 30/30ft`
- **Concentration tracker** (when you have a concentration spell active): `🧠 Concentrating: Bless · 9 rounds left · CON save DC 10 on damage`
- **Resource burn animations**: when a slot is used, the slot pip flips and the visual ticks down with a subtle anvil-tap sound
- **Quick-cast / quick-attack buttons** spawn the same structured input pattern as slash commands
- **HP-change toasts**: when HP changes, a brief delta (`-6`) animates over the HP bar
- **Death save tracker** appears automatically at 0 HP

**Compact mode**: collapses HUD to a slim icon strip (HP bar + critical resources only) for maximizing map/chat real estate.

---

## ⑤ Party Rail

**Shipped (#100, #125, #214):** a **left column** (not a bottom strip) listing party-side members as vertical chips. Each chip shows name, HP bar, and (in combat) action/bonus/movement ticks; the active combatant gets a gold border + ▶ marker. **Hover** → mini-HUD (see §④). **Click** → read-only sheet peek when roster ids are bridged (PLAY-4). Tutorial companion backfill when hook accepted.

**Target design (not built):** bottom horizontal strip; presence dots; cross-character assist pulses; chips reorder to initiative order.

**Target design** — bottom strip mockup:

```
  ┌─ Party (collapsed) ──────────────────────────────────────────────────┐
  │ 🛡 Thorin HP 28/34 ✓Action ✓Move    🎵 Elara HP 22/22 ✓ ✓           │
  │ 🗡 Finn   HP 45/45 ✓ ✓               👤 Old Maddy(NPC) HP 18/22 ✓ ✓   │
  └───────────────────────────────────────────────────────────────────────┘
```

- **Hover** any party member chip → expands to show full mini-HUD *(shipped via left-column popover)*
- **Click** another player's chip → opens their character sheet in read-only mode *(shipped)*
- **Presence indicators**: green dot connected · yellow typing · gray disconnected · zzz away *(deferred)*
- **Cross-character assist**: when an action requires another party member's involvement (e.g., Bardic Inspiration, Help action), their chip pulses *(deferred)*
- **Party initiative order indicator** in combat: chips reorder to show initiative; current actor pulses gold *(deferred — initiative order is in the strip above the map)*

---

## Scene Transitions

Scenes are first-class entities in the engine. A scene = `{ locationEntityId, time, weatherOverride, sceneNotes }`. When the AI advances scene, the engine emits a `scene_change` event that the UI handles with a smooth transition.

**Transition animation** (~1 second):
1. Current map fades to 60% opacity with subtle "scroll" parallax
2. New location map cross-fades in
3. Tokens animate to their new positions (or fade in if newly-spawned)
4. A small banner pill drops from the top of the map zone:

```
  ┌─────────────────────────────────────────────┐
  │ 📍 The Whispering Woods · North of Lowgate │
  │    Late Evening · Light Rain                │
  └─────────────────────────────────────────────┘
```

5. The chat receives a small scene-divider entry:

```
  ─────────────  📍 The Whispering Woods · Late Evening  ─────────────
```

**Scene transitions trigger**:
- AI narration ("you leave the tavern and head into the woods")
- Player explicit movement (`/move to Whispering Woods`)
- Time skip (`/skip to morning`)
- Combat start / end

**Cascading auto-creation during transitions**:
- If the destination location doesn't exist yet (e.g., player invents "I head to the abandoned watchtower"), the AI:
  1. Pauses briefly (loading state in chat: *"⚒ Forging The Abandoned Watchtower…"*)
  2. Calls the relevant generator silently
  3. Creates a stub entity + map in Realms (auto-linked to campaign, defaults to Discovered)
  4. Completes the scene transition
  5. Drops a chip in chat: *"⚒ Auto-forged: [📍 The Abandoned Watchtower]"*
- Background pre-fetch (Q13): when AI sees direction-of-travel hints, it pre-generates likely destinations to mask latency

---

## Combat Mode (Detailed)

Combat is the highest-stakes interaction. When the engine receives an `encounter_start` event:

### Phase 1 — Encounter Initiation

```
  ┌─ ⚔ ENCOUNTER STARTING ───────────────────────────────────────────────┐
  │                                                                       │
  │ Father Julian whirls, drawing a curved obsidian dagger.              │
  │ "You should not have followed."                                       │
  │                                                                       │
  │ A wave of cold rolls from his outstretched hand. Two skeletal forms  │
  │ rise from the mire.                                                   │
  │                                                                       │
  │ ⚔ Combat begins. Surprise round: party loses initiative.             │
  │                                                                       │
  │ Combatants:                                                           │
  │  ● Father Julian (revealed: not undead, but a death cleric)          │
  │  ● 🗡 Bog Skeleton × 2                                                │
  │  ○ Thorin · Elara · Finn                                              │
  │                                                                       │
  │ [Roll Initiative]                                                     │
  └───────────────────────────────────────────────────────────────────────┘
```

- Engine assembles encounter from declared combatants (party + new enemies the AI tool-called into the scene)
- **Shipped:** tactical map with tokens; **initiative strip** above map + party row when `encounter` is active; chat may show combat start divider (#103)
- **Target design (not built):** L4 auto-zoom, token reveal animations, in-chat encounter-start panel with `[Roll Initiative]` button
- **Multiplayer sync**: all clients share the same synced `WorldState` via Yjs; initiative order comes from the engine projection

### Phase 2 — Combat Loop

**Shipped loop:**

```
  ┌─ Initiative (above map) ─────────────────────────────────────────────┐
  │ ROUND 3 · Thorin's turn                                              │
  │ Thorin(22) → Elara(18) → 🗡 Bandit#1(15) → …                         │
  └──────────────────────────────────────────────────────────────────────┘

  ┌─ Turn bar (above chat, on your controllable turn) ───────────────────┐
  │ Economy: Action · Bonus · Reaction · Move 30/30ft                    │
  │ [Attack ▾] [Ready] [Cast ▾] [Healing Potion] …          [End turn]   │
  └──────────────────────────────────────────────────────────────────────┘
```

On your turn:
1. Your token is active on the map; **movement radius** shown (reachable cells)
2. **Turn bar** shows action economy + **Attack / Ready / Cast** (sheet weapons + prepared spells) + consumable quick-use + **End turn** — not a chat-embedded panel and not a right-rail HUD
3. Player arms an action → **map target picker** or **AoE aim cell** activates
4. Engine validates and resolves; chat gets structured engine-event rows + GM narration
5. **End turn** in the turn bar passes initiative

**Target design** — richer turn affordances inside chat (Dodge/Dash/Help/class features as buttons, free-text turn panel):

```
  ⚔ Round 3 · ▶ Your turn (Thorin) · ✓Action ✓Bonus ✓Reaction · 0/30ft used
  
  ┌─ Initiative ──────────────────────────────────────────────────────────┐
  │ Thorin(22) → Elara(18) → 🗡FJulian(16) → 🗡Skel#1(11) → Finn(9) → Skel#2(7)
  │     ↑ now                                                              │
  └───────────────────────────────────────────────────────────────────────┘
```

On your turn *(target flow)*:
1. Your token glows gold on the map; movement radius shown
2. Right-rail HUD shows action economy active *(not shipped during combat)*
3. Chat opens a turn-specific affordance *(not shipped — actions are in the turn bar)*:

```
  ┌─ Your Turn ──────────────────────────────────────────────────────────┐
  │                                                                       │
  │ Available actions:                                                    │
  │  [⚔ Attack ▼ Battleaxe / L. Crossbow]                                │
  │  [🔮 Cast Spell] (none prepared)                                      │
  │  [🎒 Use Item ▼ Healing Potion / Thieves' Tools / ...]               │
  │  [🛡 Dodge] [🏃 Dash] [🤝 Help] [Disengage] [Hide] [Search]          │
  │  [🌬 Second Wind (1/1)] [💥 Action Surge (1/1)]                      │
  │                                                                       │
  │ Movement: drag token, /move, or click destination                    │
  │                                                                       │
  │ Or describe what you do in free text:                                │
  │ [_____________________________________________________________]      │
  │                                                          [End Turn]  │
  └───────────────────────────────────────────────────────────────────────┘
```

*(Target design — continued; engine resolution in steps 5–8 below matches shipped behavior. End turn and reactions live in the **turn bar** today, not chat.)*

4. Player picks an action (button, slash command, free text, or map interaction)
5. If a target is required, **map target picker activates** — valid targets glow; range rings visible; click to select
6. Engine validates legality (range, line of sight, action economy budget, spell slot availability, concentration interruption, etc.)
7. Engine rolls + applies effects; chat gets a structured combat entry:

```
  ┌─ 🎲 Thorin attacks Father Julian with Battleaxe ────────────────────┐
  │ Attack: d20[17] + 4 = 21 vs AC 15  →  HIT                           │
  │ Damage: 1d8[6] + 2 = 8 slashing                                     │
  │ Father Julian: HP 41 → 33                                            │
  └───────────────────────────────────────────────────────────────────────┘
```

8. AI narrates the *result* in prose:

```
  ┌─ 🎲 GM ──────────────────────────────────────────────────────────────┐
  │ Your axe-head cracks through Julian's robes and bites into his      │
  │ shoulder. He hisses through his teeth — not pain, you realize, but  │
  │ effort. The wound knits closed even as you watch.                    │
  └───────────────────────────────────────────────────────────────────────┘
```

9. `[End Turn]` — **turn bar** (shipped) or chat panel (target); turn passes
10. If a reaction trigger fires, a **turn-bar reaction prompt** (shipped for OA/Shield tracer) or inline chat modal (target):

```
  ┌─ ⚡ REACTION PROMPT (8s) ────────────────────────────────────────────┐
  │ Father Julian casts Inflict Wounds at Thorin (3rd level).            │
  │ You can react with Shield (1st-level slot).                          │
  │                                                                       │
  │ [Cast Shield (1st)] [Don't react] [Auto-pass]    ⏱ 8s                │
  └───────────────────────────────────────────────────────────────────────┘
```

11. NPC turns run automatically — the AI proposes the NPC's action via tool call (informed by the encounter's `AI tactics hint`), engine validates + executes, chat shows the entry + AI narration. Player sees enemy actions exactly as their own — same structure, same transparency.

### Phase 3 — Encounter Resolution

Combat ends when one side is defeated, fled, or surrendered:

```
  ┌─ ⚔ COMBAT ENDS · Victory ────────────────────────────────────────────┐
  │ Father Julian collapses. Bog Skeletons crumble to dust.              │
  │                                                                       │
  │ Outcome: Victory                                                      │
  │ Duration: 7 rounds (42 sec in-game)                                  │
  │ XP awarded: 1,400 ea (Hard)                                           │
  │ Loot dropped: 🗡 Obsidian Dagger (magical), 18gp, journal page       │
  │ MVP: Elara (kept everyone alive via Bardic Healing)                  │
  │                                                                       │
  │ [Take Short Rest]   [Continue]   [View Combat Log]                   │
  └───────────────────────────────────────────────────────────────────────┘
```

- Map auto-zooms back to L3
- Combat overlay collapses
- Loot drops as object tokens on the map; click to claim into inventory
- The encounter is **recorded** as a saved Encounter in the Combat tab with full event log (replayable)
- XP, loot, faction-rep deltas applied via engine
- AI prompts: *"What do you do with Father Julian's body?"* — back to narrative flow

### Reactions & Concurrent Actions (Tier 4 sync)

In Live Mode, certain triggers are time-bounded (8-15 seconds default, configurable). Players must react within the window or pass. This keeps real-time combat from grinding to a halt if one player AFKs.

**Default reaction window**: 8 seconds
**Auto-pass on disconnect**: 3 seconds after disconnect detected
**Pause** button on the combat overlay halts the timer entirely (anyone can hit it)

### Combat Performance & Sync

- Engine state changes broadcast via Yjs CRDT — all clients see HP, position, condition updates within ~50-200ms
- Dice rolls are computed on the server (cryptographic seed) and broadcast as truth; no client can fake a roll
- Chat entries sync with order-preserving timestamps
- Token positions sync; if two players drag at once, last-write-wins with a brief snap animation indicating the conflict resolution

---

## Pacing Controls

Activated via the `[🎚 Pacing]` button in the top bar tool row:

```
  ┌─ Pacing Controls ────────────────────────────────┐
  │ Style: [Cinematic ──●─── Reactive]               │
  │ Default narration density: [Detailed ▼]          │
  │                                                   │
  │ Quick controls (right now):                      │
  │  [▶ Continue]  — ask AI to advance the scene     │
  │  [⏸ Hold]     — AI waits, won't narrate ambient │
  │  [↷ /skip]    — request time skip               │
  │                                                   │
  │ Auto-advance: ☐ Skip ambient between scenes      │
  │                                                   │
  │ [Save as default for this campaign]              │
  └───────────────────────────────────────────────────┘
```

- **Continue** is the most-used button. After a player action, if no AI response is forthcoming (Reactive mode), Continue prompts the AI to advance.
- **Hold** is for table breaks or when the player wants to think uninterrupted.
- **/skip** is also a slash command; opens a small prompt: *"How long? [10 minutes ▼ / 1 hour / until dawn / custom]"* → AI narrates the elapsed time + emerging state.

---

## TTS / Voice Playback

When TTS is enabled (`[🔊 TTS]` toggle in top bar):
- Each AI narration entry auto-plays through TTS
- A `[🔊 Listen ▶]` button replays any entry on demand
- Per-NPC voices assigned automatically based on NPC attributes (gender, species, age, profession) — overridable in NPC detail page
- **Voice queue**: rapid-fire AI entries queue and play sequentially; cancellable
- **Audio ducking**: when a player speaks (via STT v1.5), TTS pauses
- **Real-time multiplayer**: TTS plays per-client based on each user's preference; doesn't broadcast (no shared audio stream)
- **Cost-aware**: TTS only generated for visible/audible scope (only NPCs the player sees; only narration the player witnesses)
- **Voice settings** (per-campaign): voice provider (ElevenLabs / OpenAI), narrator voice (the GM's voice), speaking rate

---

## Memory & Retcon (Inline)

The Memory panel (Q15) is accessible from `[🧠 Memory]` in the top bar — opens as a slide-in panel from the right (above the HUD).

Inline Retcon is even more powerful:
- **Every chat entry** has a `[↺ Retcon from here]` action in its action row
- Clicking it opens a confirmation:

```
  ┌─ Retcon Timeline ────────────────────────────────────────────────────┐
  │ Roll back to this point?                                              │
  │                                                                       │
  │ Will undo: 47 chat entries · 12 engine events · 1 encounter outcome  │
  │ Snapshot will be preserved as "Ghost Timeline · v3"                  │
  │                                                                       │
  │ After retcon, the AI will re-narrate from this point with your       │
  │ guidance. Optional retcon note (will be added to AI memory):         │
  │ [_____________________________________________________________]      │
  │                                                                       │
  │ [Cancel]                            [Retcon to this point]           │
  └───────────────────────────────────────────────────────────────────────┘
```

- Confirmed retcon → engine rolls back state, chat rewinds with a visual "burn" effect, AI receives a system message about the retcon, optionally re-narrates the moment
- Ghost timelines accessible in Sessions → past session → Engine Events → "Timeline branches"
- In multiplayer, retcon requires majority consent (party vote) by default; configurable to require host-only

The **`((double parens))`** meta-talk affordance is also always available — type *`((That's not how Cure Wounds works))`* and the AI gets the message OOC and self-corrects without affecting fiction.

---

## Inventory & Spell Use During Play

`[📋 Inventory]` in the top bar opens a slide-in panel:

```
  ┌─ Inventory · Thorin ─────────────────────────────────────┐
  │                                                            │
  │ Equipped:                                                  │
  │  🛡 Chain Shirt                                            │
  │  🗡 Battleaxe                                              │
  │                                                            │
  │ Carried:                                                   │
  │  🧪 Healing Potion ×3       [Use ▼ Self/Other]            │
  │  🔥 Alchemist's Fire ×2     [Use ▼]                        │
  │  📜 Map of the Salt Way                                    │
  │  🎲 Loaded Dice (cursed)    [Use]                          │
  │  ...                                                       │
  │                                                            │
  │ Coins: PP 3 GP 87 SP 12 CP 45                              │
  │                                                            │
  │ Party Shared Inventory:  [Open ▶]                          │
  │ Recently Acquired:                                         │
  │  🗡 Obsidian Dagger (from F. Julian) [Identify] [Claim]    │
  │                                                            │
  └────────────────────────────────────────────────────────────┘
```

- Use actions invoke the engine: `use_item(item, target?)` → engine handles charges, effects, consumption
- Identify (magical items) triggers an Identify ritual sub-flow (or AI lore reveal)
- Items from defeated enemies appear in "Recently Acquired" until claimed

Spells: cast from the HUD's Attack/Spells section OR from `[🔮 Cast]` action button OR via `/cast` command. Target picker activates on map. Engine applies effects deterministically using the spell-by-spell automation (Q18b).

---

## Async Play Specifics

When the campaign is in async mode (you're playing solo, or you're the only one connected to a multiplayer campaign):

- The play surface looks **identical**, but:
  - No Live indicator; shows `◐ Async · You only`
  - No turn timers in combat (you have all the time you need)
  - No "typing…" presence indicators (other players aren't online)
  - `[Save & Exit]` button is more prominent in the top bar
- **Resume**: when you reopen, the play state is exactly as you left it — same scene, same map zoom, same chat scroll position, engine state intact
- **Background AI**: if the AI is mid-generation when you close (e.g., generating a stub for the location you just entered), the job continues server-side and completes; when you return, a chat entry shows the result waiting
- **Multiplayer-while-async**: if another party member opens the campaign while you're playing async, you get a notification: *"Kim joined the session. Switch to Live? [Switch ▶] [Stay solo]"*. Choosing Switch promotes the session to Live; the other player's chat appears in the log going forward.
- **Async combat caveat**: combat in pure async (solo) is fine. Combat in semi-async (one or more players unavailable in a party campaign) — the engine has a configurable rule: *"Allow other players to act for absent characters / AI runs absent characters / Pause encounter until all present"* (campaign setting).

---

## End Session Flow

`[⚙ Session] → End Session`:

```
  ┌─ End Session ────────────────────────────────────────────────────────┐
  │                                                                       │
  │ This will save your current state and exit Live Mode.                │
  │                                                                       │
  │ Session 15 stats:                                                     │
  │  Duration: 2h 47m                                                     │
  │  Chat entries: 287                                                    │
  │  Combat encounters: 1                                                 │
  │  XP awarded: 1,400 ea                                                 │
  │  Loot: Obsidian Dagger, 18gp, journal page                            │
  │  Hooks advanced: The Salt Way Washout (still active)                  │
  │                                                                       │
  │ Auto-generate session recap?  [✓] (recommended)                      │
  │ Pin highlights to AI memory?  [✓]                                     │
  │ Share recap with party?        [✓]                                     │
  │                                                                       │
  │ [Cancel]                                  [End & Save Session]       │
  └───────────────────────────────────────────────────────────────────────┘
```

On confirm:
- Engine snapshot saved
- Session recap auto-generated via LLM summarization of the full chat + engine event log
- Embeddings updated (campaign memory)
- All party members redirected to the Campaign workspace
- Success toast: *"Session 15 saved. Recap ready in Sessions tab."*

**Cliffhanger detection**: if combat is mid-round or there's an active dialogue when you end:
- *"You're ending mid-scene. Save as cliffhanger? Players will resume from this exact moment. [Cliffhanger save] [Wrap scene then save]"*
- Choosing Wrap → AI generates a brief "natural pause" narration before saving

---

## Mobile Experience

The 5-zone desktop layout collapses to a **vertical full-screen stack** on mobile with bottom-tab navigation:

```
  ┌─────────────────────────────────────┐
  │ Top bar (compact)                   │
  ├─────────────────────────────────────┤
  │                                      │
  │  Active Tab Content (full screen)   │
  │  [Map | Chat | Sheet | Party]       │
  │                                      │
  ├─────────────────────────────────────┤
  │ Input (when Chat tab active)        │
  ├─────────────────────────────────────┤
  │ Bottom tabs:                         │
  │  [🗺 Map] [💬 Chat*] [📋 Sheet] [👥 Party]│
  └─────────────────────────────────────┘
```

- Default tab on mobile: **Chat** (with input fixed at bottom)
- Swipe between tabs left/right
- **Combat mode on mobile**: bottom tabs become `[🗺 Battle] [⚔ Actions] [📋 Sheet]`; Battle tab shows the grid + tokens; Actions tab shows the turn affordances
- Touch gestures on Map: pinch zoom, two-finger pan, long-press for token context menu
- Dice rolls and reactions use full-screen modals to avoid mis-taps
- Party rail collapses to a horizontal scroll strip across the top of the Party tab
- TTS becomes more compelling on mobile (hands-free-ish play during commutes)

---

## Polish & Edge Cases

- **Connection loss**: if your WebSocket drops mid-session, the UI shows a yellow banner: *"Reconnecting… (3s)"* — chat input disables, but you can still read; auto-reconnect with state replay
- **Lag indicator**: if engine round-trip exceeds 500ms, top-bar shows a small `⚠ Slow` chip
- **AI failure**: if the LLM call fails (rate limit, error), chat shows a polite error chip: *"⚠ The narrator stumbled. [Retry] [Skip] [Switch to backup model]"*
- **Cost meter** (optional, settings-gated): a subtle widget shows estimated LLM cost for the session (`💰 $0.34`) — useful for budget-conscious users
- **Idle timeout**: after 15 minutes of no activity, session auto-saves with a "still there?" prompt
- **Spectator mode** (v1.5): observers (non-player members) can watch a live session in read-only with delayed updates
- **Highlight reel** (post-session, v1.5): AI auto-extracts 3-5 "highlight" moments per session for the Overview activity feed
- **Achievement chips**: subtle in-chat moments for milestone hits ("First Critical Hit! Thorin rolled a natural 20"), per-player toggleable
- **Crash recovery**: every engine event is journaled; reopening after a crash replays from the last journal checkpoint — no progress lost
- **Multi-tab safety**: opening the same campaign in two tabs of the same account shows a warning: *"You're already in this session in another tab. [Take over] [Cancel]"* — prevents state divergence on a single account
- **Token movement animation tier**: in async or low-bandwidth mode, animations downgrade to instant snaps to preserve perceived performance
- **Map render fallback**: if PixiJS fails to initialize (older browser/device), map zone falls back to static SVG with limited interactivity; chat + engine fully functional
- **Accessibility**:
  - All chat entries are screen-reader friendly with semantic roles
  - Color-blind safe disposition colors (border + icon redundancy)
  - Keyboard shortcuts: `Tab` to cycle focusable affordances, `Enter` to send, `Esc` to cancel, `/` to open command palette, `1-9` to quick-pick combat actions
  - High-contrast theme toggle
  - Reduce-motion respects OS setting

---

That's the Live Play Surface — the heart of the AI-GM experience. Every play moment flows through this surface: map always-on, chat-led narrative, structured combat with deterministic engine validation, real-time multiplayer sync, transparent AI memory + retcon, and a host of safety/polish/accessibility affordances baked in.
