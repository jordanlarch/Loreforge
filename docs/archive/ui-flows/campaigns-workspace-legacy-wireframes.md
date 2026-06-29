# Campaign Workspace — Legacy 9-Tab Wireframes (pre–CAMP-UX)

> **ARCHIVED Jun 2026.** Wireframes for the original nine-tab prep shell (Overview / Party / World / Hooks / Sessions / World Map / Combat / Notes / Settings), collapsible sidebar, right pane, and `[▶ Start Live Session]` CTA — **superseded** by the seven-tab CAMP-UX shell in [`unified-campaign-ux.md`](../../ui-flows/unified-campaign-ux.md). Kept for historical reference only.

---

## Persistent Campaign Workspace Layout

Identical across all 9 tabs.

- **Fixed Header** (top bar):
```
  ← Back to Campaigns                                          ⚡ Live: Off
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🜂 Curse of Strahd · Gothic Horror · Session 14 "Iron Gate"
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [Overview] [Party] [World] [Hooks] [Sessions] [World Map] [Combat] [Notes] [Settings]
                                                                       
                                                                  [▶ Start Live Session]
```
- **Top-right pinned button**: **`[▶ Start Live Session]`** (high-contrast green, always visible) — opens the Live Session Mode (option #3 covers it).
- **Live indicator**: small `⚡ Live: Off / Active (3 connected)` widget showing if a live session is running.
- **Left Sidebar (collapsible)**: campaign sigil + name + party list + AI Memory shortcut + Quick Forge shortcut + Style Settings.
- **Main Area**: tab-specific.
- **Right Pane (toggleable per tab)**: contextual. Defaults vary per tab (e.g., on Sessions tab the right pane shows "Quick Recap" of the latest session; on World tab it shows "Recently Forged").
- **Footer / Toast Layer**: autosave indicator, AI background-job indicator ("AI is forging The Forgotten Shrine in the background…"), dismissable notifications.

## Tab 1 — Overview (Default Landing)

The cinematic "you are here" hub. First thing you see when opening a campaign.

```
  ┌────────────────────────────────────────────────────────────────┐
  │                                                                │
  │  [ Campaign banner image — generated/uploaded — parallax ]    │
  │                                                                │
  │   🜂 Curse of Strahd                                           │
  │   "A doomed expedition to the north…"                          │
  │                                                                │
  │   [▶ Start Live Session]   [📖 Continue last session →]       │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘
  
  ┌─────────── Next Session ────────────┐  ┌─── Currently in ───┐
  │ Session 15 (unscheduled)             │  │ 📍 Lowgate Cross   │
  │ Last session: 2 days ago             │  │ The Rusty Nail     │
  │ Last recap: "The party uncovered the │  │                    │
  │   Veiled Ward's connection to the    │  │ [Map thumbnail]    │
  │   Salt Way disappearances…"          │  │                    │
  │ [Read full recap] [Edit recap]       │  │ [Open World Map →] │
  └──────────────────────────────────────┘  └────────────────────┘
  
  ┌─────────────────────── Party ───────────────────────┐
  │  [Thorin]  Lvl 5 Fighter  HP 34/34 ✓ Ready to Lvl  │
  │  [Elara]   Lvl 3 Bard     HP 22/22                  │
  │  [Finn]    Lvl 7 Rogue    HP 45/45                  │
  │  [+ Add Character]   [Open Party →]                 │
  └──────────────────────────────────────────────────────┘
  
  ┌── World ──┐ ┌── Hooks ──┐ ┌── NPCs ──┐ ┌── Sessions ──┐
  │ 4 regions │ │ 3 open    │ │ 47 total │ │ 14 played    │
  │ 12 settle │ │ 2 active  │ │ 12 known │ │ 32 hrs total │
  │ 8 fac     │ │ 5 done    │ │   to PCs │ │ Last: 2d ago │
  │ 3 dungeons│ │           │ │          │ │              │
  │ [Open →]  │ │ [Open →]  │ │ [Open →] │ │ [Open →]     │
  └───────────┘ └───────────┘ └──────────┘ └──────────────┘
  
  ─────────── Recent Activity (auto-feed) ───────────
   • 🤖 AI auto-forged "The Forgotten Shrine" (Building) · 5m ago
   • 🆙 Thorin Ironfist gained XP and is ready to level up · 2d ago
   • ✓ Hook "The Singing Road" completed · 3d ago
   • 📝 Session 14 recap updated · 3d ago
   • 🛒 New shop "The Wheel & Axle" linked from Realms · 1w ago
  
  ─────────── Pinned (AI Memory highlights) ───────────
   📌 The party owes Captain Vane a favor for letting them through the gate.
   📌 Father Julian carries a yellow silk-wrapped shovel; never explained.
   📌 The Mayor's brother is rumored to be alive in the sewers.
   [Manage Memory →]
  
  ─────────── Suggested Next Steps (AI hints) ───────────
   • 🜍 "Iron-Hold settlement is a stub. Expand it before next session?"
   • 🜍 "Thorin hasn't interacted with The Clock faction yet — set up a hook?"
   • 🜍 "Session 14 ended mid-scene. Resume from there?"
```

The Overview tab is **the dashboard for the world**. Every section links into a deeper tab.

## Tab 2 — Party

Mini Characters Dashboard scoped to this campaign.

```
  Party Roster                            [+ Add Character ▼] [+ Generate NPC Companion]
  
  Grid of character cards (same component as /characters, scoped):
  ┌──────────────────────────────┐  ┌──────────────────────────────┐
  │ [portrait]                   │  │ [portrait]                   │
  │ Thorin Ironfist              │  │ Elara Moonwhisper            │
  │ Lvl 5 Hill Dwarf Fighter     │  │ Lvl 3 Wood Elf Bard          │
  │ STR15(+2) DEX14(+2) CON16(+3)│  │ STR8(-1) DEX16(+3) CON12(+1) │
  │ HP 34/34  AC 16              │  │ HP 22/22  AC 14              │
  │ Player: Jordan (you)         │  │ Player: (invite pending)     │
  │ [Open Sheet] [Level Up] [⋯]  │  │ [Open Sheet] [Re-invite] [⋯] │
  └──────────────────────────────┘  └──────────────────────────────┘
  
  ─────── Party Composition Analysis ───────
  Avg Level: 5    Roles: Tank ✓  Skill ✓  Healer ✗  Caster (partial) ✓
  ⚠ No dedicated healer — consider NPC cleric companion or Healing Potions
  
  ─────── Companions & Followers ───────
  + Generated NPC: Old Maddy (Tiefling Diviner) - traveling with party
    [Open NPC] [Remove from Party]
  
  ─────── Shared Party Resources ───────
  Currency Pool:  PP 12  GP 247  SP 31  CP 60   [Edit] [Distribute]
  Shared Inventory:  3 Healing Potions, 1 Map of the Salt Way, ...
    [+ Add Item] [Move to Character ▼]
  
  ─────── Bench (characters not currently played) ───────
  • Roric Hammerfell - benched 2 weeks ago
```

- `[+ Add Character ▼]` dropdown: *Add from my Characters / Generate a new one / Create blank*
- `[+ Generate NPC Companion]` runs the NPC generator pre-bound to "Party Member" role
- Per-character `⋯`: Bench, Remove from Campaign, Mark as Deceased (preserves history)
- "Player" line shows account ownership; *(invite pending)* / *(unassigned NPC)* / *(your character)*

## Tab 3 — World

The campaign-scoped view into Realms. **Reuses the entire Realms IA in miniature**, but filtered to entities linked to this campaign + discovery state visualized.

```
  World of Curse of Strahd                  [+ Generate New ▼] [+ Add from Realms]
  
  Sub-tabs: [All] [Regions] [Settlements] [Buildings] [Taverns] [Shops] [Dungeons] [Factions] [NPCs]
  Filters:  [Discovered ▼ All / Known to PCs / Hidden]  [Tag] [Search] [View: Grid/List/Graph]
  
  Hero strip: "Tip: entities become Known to PCs automatically when the AI narrates them.
               You can also manually mark/unmark to set fog-of-war state."
  
  Card (with discovery overlay):
  ┌──────────────────────────────────────────────────────────┐
  │ 🏘 Lowgate Cross                  ● Known to PCs  ✓     │
  │   Town · 1,800 · Plutocracy                              │
  │   "iron gate that never shuts"                           │
  │   First narrated: Session 2 · Visited 6 times            │
  │   [Open] [Hide from Party] [Edit] [Unlink from Campaign] │
  └──────────────────────────────────────────────────────────┘
  ┌──────────────────────────────────────────────────────────┐
  │ 🏔 Iron-Hold ✦                    ◐ Stub · Hidden       │
  │   Resource extraction outpost                            │
  │   [Expand with Generator] [Reveal to PCs] [Open]         │
  └──────────────────────────────────────────────────────────┘
  ┌──────────────────────────────────────────────────────────┐
  │ ⚔ The Veiled Ward                ⚠ Partially Known      │
  │   Town's elite cabal                                     │
  │   Public Goals: known  ·  Secret Goals: hidden          │
  │   [Reveal Goal: ▼ Public / Secret]  [Open]              │
  └──────────────────────────────────────────────────────────┘
```

- Per-entity **discovery state**: `Hidden / Partially Known / Known to PCs`
- **Reveal granularity**: entity-level OR section-level (e.g., on a Faction you can reveal `Public Goals` without revealing `Secret Goals`)
- **Reveal sources**: automatic (AI narrated it), manual (you toggle), import (added via Realms picker — defaults Hidden)
- **Graph view** scoped to this campaign's subgraph — visually distinguishes Hidden (faded) vs Known (full color) nodes

`[+ Generate New ▼]` opens the per-type generator pre-bound to this campaign (auto-link); `[+ Add from Realms]` opens a picker modal of the user's Realms library not yet linked.

## Tab 4 — Hooks

Kanban-style narrative tracker. The lifecycle is the cleanest demonstration of "Plot Hooks become first-class only when accepted into a Campaign" (Q7).

```
  Plot Hooks · Curse of Strahd                           [+ Create Hook]
  
  Filter: [Scale ▼ Any/Personal/Local/Regional/Campaign]  [Starring NPC ▼]
          [Region ▼]  [Status ▼]
  View: [Kanban] [List] [Timeline]
  
  ┌─── SUGGESTED ───┐ ┌─── OPEN ───┐ ┌─── ACTIVE ───┐ ┌── RESOLVED ──┐ ┌─ ABANDONED ─┐
  │ (auto-pulled    │ │             │ │              │ │              │ │              │
  │ from linked     │ │             │ │              │ │              │ │              │
  │ Realms entities │ │             │ │              │ │              │ │              │
  │ — not yet       │ │             │ │              │ │              │ │              │
  │ accepted)       │ │             │ │              │ │              │ │              │
  │                 │ │             │ │              │ │              │ │              │
  │ ┌─────────────┐ │ │ ┌─────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │
  │ │ The Wrongful│ │ │ │ The     │ │ │ │ The Salt │ │ │ │ The      │ │ │ │ The      │ │
  │ │   Accused   │ │ │ │ Hourbook│ │ │ │ Way      │ │ │ │ Singing  │ │ │ │ Treaty   │ │
  │ │ ──────────  │ │ │ │ Heist   │ │ │ │ Washout  │ │ │ │ Road     │ │ │ │ of Ice   │ │
  │ │ Local       │ │ │ │ Regional│ │ │ │ Local    │ │ │ │ Mystery  │ │ │ │ Personal │ │
  │ │ ★ Widow Mary│ │ │ │ ★ Sylas │ │ │ │ ★ Vane   │ │ │ │ ✓ S.11   │ │ │ │ ✗ S.7    │ │
  │ │ 100gp +Ring │ │ │ │ Wealth+ │ │ │ │          │ │ │ │          │ │ │ │          │ │
  │ │ [Accept]    │ │ │ │ [Start] │ │ │ │ [Pause]  │ │ │ │          │ │ │ │          │ │
  │ │ [Discard]   │ │ │ │ [Edit]  │ │ │ │ [Resolve]│ │ │ │          │ │ │ │          │ │
  │ └─────────────┘ │ │ └─────────┘ │ │ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │
  │                 │ │             │ │              │ │              │ │              │
  └─────────────────┘ └─────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

- **Suggested column** is read-only auto-feed from any Realms entity linked into this campaign that emitted hooks. Accept → moves to Open.
- **Open** → unstarted, available to pick up
- **Active** → currently being pursued (links to the session that started it)
- **Resolved** → with outcome (XP / loot / reputation deltas captured)
- **Abandoned** → with reason text
- Hook detail click → full panel with: title, description, starting NPC chip, suggested reward, scale, source entity, sessions touched, outcome
- **Linked entity preview**: hovering a hook card shows which Realms entity it originates from
- **Timeline view**: hooks plotted on the session axis — visually shows "this hook was active sessions 4-9"
- **AI-aware**: AI can be asked to "weave a new hook based on current state" → drops into Suggested column

## Tab 5 — Sessions

Time-ordered session log + per-session detail.

```
  Sessions · Curse of Strahd                          [▶ Start Live Session]
                                                       [+ Manual Session Entry]
  
  Filter: [Date range]  [NPCs encountered]  [Locations]  [Hooks touched]
  Sort: Newest first ▼
  
  ┌───────────────────────────────────────────────────────────────┐
  │ Session 14 · "Iron Gate" · 2 days ago · 3 hrs                │
  │ Party: Thorin, Elara, Finn  ·  Location: Lowgate Cross       │
  │ NPCs encountered: Thomas Thorne, Elara Vane, Father Julian   │
  │ Hooks advanced: The Salt Way Washout (▶ Active)              │
  │ XP awarded: 750 ea  ·  Loot: 47gp, 1 Healing Potion           │
  │                                                                │
  │ Recap (auto-generated, editable):                             │
  │ "The party arrived at Lowgate Cross under heavy rain. Captain│
  │ Vane intercepted them at the Toll-Gate, requesting their help│
  │ investigating the strange catatonic episodes among her guards│
  │ during night watch. After interviewing Widow Mary, they uncov-│
  │ ered evidence of Father Julian's nocturnal sojourns to the   │
  │ mire. The session ended as Thorin's group prepared to follow │
  │ Julian after sunset."                                          │
  │                                                                │
  │ [Open Full Recap] [Edit Recap] [Continue from Here] [⋯]      │
  └───────────────────────────────────────────────────────────────┘
  
  ┌───────────────────────────────────────────────────────────────┐
  │ Session 13 · "The Salt Way"  ·  9 days ago · 2.5 hrs        │
  │ ...                                                            │
  └───────────────────────────────────────────────────────────────┘
```

### Per-session detail page

Click a session card → full-page detail:

```
  ← Back to Sessions
  
  Session 14 · "Iron Gate"                    [Edit Title] [▶ Continue Live]
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Date: Apr 23, 2026  ·  Duration: 3h 14m  ·  Mode: Live (3 connected)
  Attendees: Thorin (Jordan) · Elara (Kim) · Finn (Alex)
  
  ─── Tabs: [Recap] [Transcript] [Combat Log] [Engine Events] [Loot & XP] [Media] ───
  
  [Recap] (default tab):
   Rich-text editor with auto-generated draft, human-editable
   "Session opening" / "Major beats" / "Cliffhanger" auto-headers
   [Regenerate Recap from Transcript]
   [Pin to Memory]
   
  [Transcript]:
   Chronological chat log with timestamps
   Filter: [All] [GM] [Player] [Dice] [Tool Events]
   Each entry: [↺ Retcon from here]
   
  [Combat Log]:
   Encounter cards for any encounters in this session
   • Encounter: "Ambush at the Toll-Gate" (Round 1-7)
     Initiative order, full event log, damage chart, MVP, etc.
     [Replay Encounter]
   
  [Engine Events]:
   Append-only audit log of every state mutation:
   • R3T2 Bandit#2 attacks Thorin (+5 vs AC 16) → hit, 1d6+2=6 slashing
   • Thorin HP 34 → 28
   • Round 4 begins
   ...
   
  [Loot & XP]:
   XP awarded (per-character, with reasons)
   Loot acquired (linked to inventory)
   Currency deltas
   
  [Media]:
   Screenshots of key moments
   Map snapshots
   AI-generated scene art (if enabled)
```

- **"Continue from Here" / "Continue Live"** on a session reopens Live Session Mode at the saved state (engine snapshot + scene + map + party position).
- **"Retcon from here"** branches the timeline: state rolls back to that point, subsequent events are rebuilt by replaying from there with player input. Original branch is preserved as a "ghost timeline" accessible in history.
- **Manual Session Entry** allows the user to record off-platform sessions (in-person play) by just dropping in a hand-written recap; useful for hybrid groups.

## Tab 6 — World Map

The Campaign-scoped strategic canvas (distinct from the in-play always-on map of option #3). This is the **DM-binder map**: a top-down view of the entire campaign world.

```
  Campaign World Map · Curse of Strahd                  [Edit Mode] [Export]
  
  ┌─────────────────────────────────────────────────────────────────┐
  │                  [pannable / zoomable canvas]                   │
  │                                                                  │
  │             ╔═══════════════╗                                    │
  │             ║ THE FROZEN    ║                                    │
  │             ║   MARCHES     ║ ◄── Region shaded outline         │
  │             ║               ║                                    │
  │             ║   🏘 Iron-Hold◐ ◄── stub indicator                │
  │             ║                ║                                   │
  │             ║   🏘 Northshore● ◄── known to party               │
  │             ║                                                    │
  │     ╔════════════════╗                                          │
  │     ║ THE SINKING    ║                                          │
  │     ║   MIRE         ║   ⚔ Veiled Ward influence (red tint)   │
  │     ║                ║                                          │
  │     ║   🏘 Lowgate ●  ║                                         │
  │     ║      Cross    🗝 Marrow-King's Rest (hidden)              │
  │     ║                ║                                          │
  │     ╚════════════════╝                                          │
  │                                                                  │
  │      🛤 Trade routes (lines)                                    │
  │      ⚓ Party token (current position)                          │
  │                                                                  │
  └─────────────────────────────────────────────────────────────────┘
  
  Layers (toggleable):
   [✓] Regions    [✓] Settlements   [✓] Dungeons   [✓] Factions (territories)
   [✓] Trade Routes  [✓] Party Token  [✓] Discovered only  [ ] Hidden entities
   [ ] Player Notes Pins  [ ] Combat encounter markers
  
  Zoom: [─●─────]  (continental → regional → settlement-level)
  Layout: [Generated ▼ from linked entities]  [Manual canvas ▼]  [Hybrid ▼]
```

### Edit Mode

- Drag entity pins to reposition
- Draw region outlines / faction territory polygons
- Add **player-note pins** ("Suspect Father Julian here")
- Upload custom map image as background (for users with their own art)
- "Auto-arrange from linked entities" button (re-runs layout)
- **Reveal/Hide controls** on every pin (mirrors World tab discovery)

### Play-time view (referenced forward)

When the user opens Live Session Mode, this **same map** is the source-of-truth canvas for the always-on map above the chat. Zoom levels map naturally: zoom into the party's current settlement → reveals district map (Settlement entity's map); zoom in further → reveals interior map (current Building / Tavern / Shop). The campaign world map is the *top zoom level*.

## Tab 7 — Combat

The Encounter Builder + Library. Live encounters route to a different surface (option #3) but their **definition, history, and analytics** live here.

```
  Encounters · Curse of Strahd                       [+ New Encounter]
  
  Filter: [Status ▼ Draft/Saved/Run/Completed]  [Location]  [Difficulty]  [Session]
  
  ┌───────────────────────────────────────────────────────────────┐
  │ #14 Ambush at the Toll-Gate                                   │
  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
  │ Status: Completed  ·  Difficulty: Hard ★★★★☆                 │
  │ Linked: Session 14  ·  Location: Lowgate Cross > Toll-Gate    │
  │                                                                │
  │ Combatants:                                                    │
  │  Allies:   Thorin · Elara · Finn                              │
  │  Enemies:  3× Bandit, 1× Bandit Captain                       │
  │                                                                │
  │ Outcome: Victory (R7) · Party HP avg: 64%                     │
  │ MVP: Finn (3 crits, 47 damage)                                │
  │                                                                │
  │ [Replay] [Duplicate] [Edit] [View Log] [⋯]                    │
  └───────────────────────────────────────────────────────────────┘
```

### Encounter Builder (when creating/editing)

```
  Encounter Builder · Untitled
  
  Title [_____________]   Linked Location [Lowgate Cross > Toll-Gate ▼]
                          Linked Session [Session 15 (next) ▼]
  
  ─── Combatants ──────────────────────────────────────────
  [+ Add Party]  [+ Add Monster from Codex]  [+ Add NPC from Realms]  [+ Custom]
  
  Allies:
    [Thorin Ironfist]  HP 34  AC 16  Init: --  [Roll Init] [Remove]
    [Elara Moonwhisper] HP 22  AC 14  Init: --  [Roll Init] [Remove]
  
  Enemies:
    [Bandit] (×3)  HP 11 ea  AC 12  Init: --  [Group Init?]
    [Bandit Captain]  HP 65  AC 15
    [+ Add another monster]
  
  ─── Difficulty ──────────────────────────────────────────
  Calculated: Hard (1,250 XP threshold, encounter XP 1,400)
   ↳ recommendation: Add 1 healer or reduce 1 Bandit
  
  ─── Battle Map ──────────────────────────────────────────
  Map: [Toll-Gate (auto-derived from Lowgate district)] [Change]
  Token placements: [Auto-arrange] [Edit positions]
  
  ─── Encounter Setup ──────────────────────────────────────
  Ambush?: [✓]  Surprise round
  Environmental hazards: [Heavy rain, dim light]
  AI tactics hint (sets monster AI behavior):
   "Bandits aim to ambush from elevated walkways. Captain hangs back."
  
  ─── Save & Schedule ─────────────────────────────────────
  [Save as Draft] [Save & Add to Session 15] [Run Now (Live)] [Cancel]
```

- **Save Now** parks it for later use.
- **Run Now (Live)** opens **Live Session Mode** directly into encounter (option #3).
- **CR/XP calculation** uses standard SRD encounter math; engine validates real-time.
- **AI tactics hint** is a freetext field the LLM uses when running monster turns.

## Tab 8 — Notes

```
  Notes · Curse of Strahd                              [+ New Note]
  
  ┌── Sidebar ──────┐  ┌── Editor ──────────────────────────────┐
  │ ALL NOTES        │  │                                         │
  │ • DM-Only        │  │ # Theory: Father Julian is undead       │
  │ • Party-Shared   │  │                                         │
  │                  │  │ Evidence so far:                        │
  │ Pinned           │  │ - Wears bright yellow silk in the fog   │
  │ ★ Father Julian  │  │ - Was seen with shovel + lantern        │
  │   theories       │  │ - Father is a non-traditional title…    │
  │ ★ Lowgate maps   │  │                                         │
  │                  │  │ [Pin to AI Memory] [Convert to Hook]    │
  │ Recent           │  │                                         │
  │ • Session 14 …   │  │ Visibility: ● DM-Only (AI-aware)        │
  │ • Captain Vane   │  │             ○ Party-Shared              │
  │                  │  │                                         │
  │ [+ Folder]       │  │ Linked entities (chips):                │
  └──────────────────┘  │   [Father Julian] [Lowgate Cross]       │
                        └────────────────────────────────────────┘
```

- Markdown + rich-text editor with file/image attachments
- **Pin to AI Memory** → injects the note into the campaign's RAG context with priority weight
- **Convert to Hook** → drops a draft into Hooks → Suggested
- **DM-Only** = visible only to the campaign owner (the human running the campaign); party members in multiplayer don't see these
- **Party-Shared** = visible to all party members
- Notes can link to any entity via `@Entity` autocompletion

## Tab 9 — Settings

```
  Campaign Settings · Curse of Strahd
  
  ─── General ─────────────────────────────────────────────
  Name: [Curse of Strahd_____________]
  Tagline: [A doomed expedition…]
  Banner: [Upload] [Generate] [Use default]
  System: [5E SRD 5.2] (locked v1)
  Created: Apr 8, 2026 by Jordan
  
  ─── AI-GM Persona ───────────────────────────────────────
  Preset: [Gothic Horror ▼]   [Restore Defaults]
  
  Fine-tuning sliders:
   Lethality              [───●────────] (Moderate)
   Tone                   [────────●───] (Grim)
   RAW Strictness         [──●─────────] (Loose; rule-of-cool)
   Narrative Density      [─────●──────] (Balanced)
   Pacing                 [───●────────] (Reactive)
   Improv Aggression      [──────●─────] (Surprise-prone)
   Combat Realism         [─────●──────] (Theater of mind +)
   Adult Content          [ off · light · explicit ]  ● light
   
  System prompt addendum (advanced):
   [_____________________________________________________________]
  
  ─── Art Style Lock ──────────────────────────────────────
  Style: [Painterly ink ▼]   [Generate Preview]
  Applied to all generated portraits & maps in this campaign.
  
  ─── Play Mode ───────────────────────────────────────────
  Default tempo:  ● Async  ○ Live only
  Combat routing: [✓] Auto-route encounters to Live Mode
  TTS narration:  [ ] Enabled  Voice: [—]
  
  ─── Members (Multiplayer) ───────────────────────────────
  Jordan (you)             · Host & Player (Thorin)
  Kim (kim@…)              · Player (Elara) · Connected
  Alex (alex@…)            · Player (Finn) · Invited 2d ago
  [+ Invite Player]  [Manage permissions]
  
  Invite link: https://app.com/join/aef7c2 [Copy]
  Public visibility: ○ Private (default)  ○ Unlisted link  ○ Public
  
  ─── AI Memory ───────────────────────────────────────────
  Total memories: 247 entries  ·  Session summaries: 14
  [Manage Memory →]   [Export Memory JSON]
  
  ─── Imports / Exports ───────────────────────────────────
  [Export Campaign as JSON]  [Export Recap PDF Book]  [Import JSON]
  
  ─── Danger Zone ─────────────────────────────────────────
  [Archive Campaign]   [Duplicate]   [Delete Permanently]
```

