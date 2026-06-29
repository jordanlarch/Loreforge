# Campaign Workspace Flow

> **IA supersession (Jun 2026):** Navigation, tab taxonomy (9→7 prep tabs), map hierarchy, Combat tab removal, and prep↔play handoff are **canonical in [`unified-campaign-ux.md`](./unified-campaign-ux.md)**. This doc retains **list/create flows** and cross-cutting target design; per-tab wireframes for the old nine-tab shell are **archived** in [`../archive/ui-flows/campaigns-workspace-legacy-wireframes.md`](../archive/ui-flows/campaigns-workspace-legacy-wireframes.md). Implementation: `docs/deferrals.md` **CAMP-UX**.

*The dedicated per-campaign **prep shell** at `/campaigns/[id]` — world authoring, party, quests, notes, and settings for an AI-GM 5E experience. Sister to but distinct from the **play shell** at `/campaigns/[id]/play` (see `unified-campaign-ux.md` + `live-play-surface.md`). **As-built prep nav:** seven tabs — Overview / Map / Locations / Party / Quests / Notes / Settings (`apps/web/src/lib/campaign-workspace.ts`).*

## Entry Points

- **Top nav** (site-wide): `Campaigns` lands on the **Campaigns List** (`/campaigns`)
- **Campaign card → click "Open"** anywhere → opens workspace
- **From Character View**: "Add Thorin to Campaign ▼" → opens membership picker → opens campaign
- **From Realms detail**: `[Add to Campaign ▼]` → if user opens that campaign next, opens workspace
- **From Live Session Mode**: `[← Back to Workspace]` button in upper-left
- **Deep links**: `/campaigns/curse-of-strahd`, `/campaigns/curse-of-strahd/sessions/14`, `/campaigns/curse-of-strahd/world`, `/campaigns/curse-of-strahd?tab=hooks&filter=active`

## Campaigns List (`/campaigns`)

Modeled after the My Characters Dashboard for muscle memory.

- **Hero strip**: `My Campaigns                                 [+ New Campaign] (glowing button)`
- **Filter bar**: `Search… [_____]  Status [Active ▼]  Role [Any ▼ — Solo / Party / Hosting / Joined]  System [5E ▼]  Style [Any ▼]  Sort [Last Played ▼]  View [Grid] [List]`
- **Grid card**:
```
  ┌─────────────────────────────────────────────────────────┐
  │ [Campaign banner art (generated or uploaded)]           │
  │                                                          │
  │ 🜂 Curse of Strahd                                       │
  │ Gothic Horror · Party of 3 · Solo (you only)            │
  │                                                          │
  │ Party: Thorin (Ftr 5) · Elara (Brd 3) · Finn (Rog 7)   │
  │ World: 4 regions · 12 settlements · 8 factions · 47 NPCs│
  │ Hooks: 3 open · 2 active · 5 resolved                   │
  │ Last session: 2 days ago · Session 14 "Iron Gate"       │
  │                                                          │
  │ [▶ Start Live Session]  [Open Workspace]  [⋯]           │
  └─────────────────────────────────────────────────────────┘
```
- **Quick actions on ⋯**: Open · Resume Last Session · Duplicate · Export Campaign JSON · Archive · Delete
- **Empty state**: cinematic dungeon-entry illustration with `[Quick Forge a Campaign] [Guided Setup] [Empty World] [Browse Templates]`
- **"Templates" section** below grid (when populated): pre-built campaign templates from the SRD module library (e.g., starter Lost Mine, Phandelver, custom community templates)

## Campaign Creation Flow

Three coherent paths fork from `[+ New Campaign]` → modal:

```
  ╔═══════════════════════════════════════════════════════════╗
  ║                    Begin a New Campaign                   ║
  ║                                                            ║
  ║  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   ║
  ║  │              │  │              │  │              │   ║
  ║  │ ⚡ Quick     │  │ 📜 Guided    │  │ 📭 Empty     │   ║
  ║  │   Forge      │  │   Setup      │  │   World      │   ║
  ║  │              │  │              │  │              │   ║
  ║  │ One prompt,  │  │ Step-by-step │  │ Start with   │   ║
  ║  │ AI cascades  │  │ wizard       │  │ a blank      │   ║
  ║  │ a starter    │  │ (4-6 min)    │  │ canvas       │   ║
  ║  │ world ~60s   │  │              │  │              │   ║
  ║  │              │  │              │  │              │   ║
  ║  │ [Forge it]   │  │ [Start]      │  │ [Open]       │   ║
  ║  └──────────────┘  └──────────────┘  └──────────────┘   ║
  ║                                                            ║
  ║  Or pick a template:  [Lost Mine] [Phandelver] [Strahd]   ║
  ╚═══════════════════════════════════════════════════════════╝
```

### Quick Forge (the demo-magic moment)

```
  Quick Forge · Single-prompt world generation
  
  Campaign Name [______________________]   [🎲 Suggest]
  
  Pitch your campaign in one paragraph:
  ┌────────────────────────────────────────────────────────────┐
  │ A frozen coastal frontier where settlers fight to extract │
  │ mana-ice crystals from the permafrost while frost giants  │
  │ and stranger things stir beneath the ice. Tone: grim but  │
  │ heroic. The party are sellswords escorting a doomed       │
  │ scientific expedition north.                              │
  └────────────────────────────────────────────────────────────┘
  
  GM Preset: [Heroic ▼]   Art Style: [Painterly ink ▼]
  
  Party: ○ Solo (just me)
         ● Multiplayer (invite later)
  
  [⚒ Quick-Forge the World] (~60 seconds)
```

On click: cinematic loader with cascading status:
```
  ⚒ Forging The Frozen Marches…
  ✓ Drawing the region geography (8s)
  ✓ Founding 3 settlements (12s)
  ✓ Birthing 1 faction: The Frost-Binders (5s)
  ✓ Generating 8 NPCs with portraits (10s)
  ✓ Designing 1 dungeon: The Marrow-King's Rest (15s)
  ⠋ Drafting starting hooks (2 of 5)…
  ○ Composing campaign opening narration
```

On completion: success modal celebrating the world (mini-graph preview + entity counts) + **[Enter Workspace] [Start Playing Now]**.

### Guided Setup

A 6-step mini-wizard mirroring the Creation Wizard pattern (sidebar summary + stepper). Steps:

1. **Concept**: campaign name, pitch paragraph, GM preset, art style
2. **Region**: full Region Generator form pre-bound to this campaign
3. **Settlements**: generates 2-3 settlements with cascade options
4. **Faction**: 1 primary faction generator
5. **Party Slot Configuration**: solo / party size; reserve character slots; invite later
6. **Opening Scene**: pick starting location + party arrival narration prompt

Final review screen with `[Save & Enter Workspace]`.

### Empty World

Single-step modal: name + pitch + GM preset + style. Drops you straight into a bare workspace. World tab is empty; user manually creates entities or imports from Realms.


## Prep workspace shell (as-built)

Canonical IA: [`unified-campaign-ux.md`](./unified-campaign-ux.md) — **7 prep tabs** (Overview / Map / Locations / Party / Quests / Notes / Settings) + Live Play lightboxes for sessions/memories. Legacy **9-tab wireframes** (Combat tab, Sessions tab, `[▶ Start Live Session]`, collapsible sidebar/right pane) live in [`../archive/ui-flows/campaigns-workspace-legacy-wireframes.md`](../archive/ui-flows/campaigns-workspace-legacy-wireframes.md).

**Shipped today:** header with **Play Now / Continue** (`play-now-button.tsx`); tab bar from `CAMPAIGN_WORKSPACE_TABS`; legacy `?tab=` slugs redirect (`world`→`locations`, `hooks`→`quests`, `combat`/`sessions`→`overview`). Encounter builder is **stub-scoped on Locations** (`stub-encounter-panel.tsx`), not a top-level Combat tab. Per-tab depth: `docs/deferrals.md` **CAMP-*** rows.

**Tab mapping (legacy → as-built):** Party→Party · World→Locations · Hooks→Quests · World Map→Map (overworld grid) · Combat→(Locations stub + live enter) · Sessions→(Overview cards + Live Play lightbox).

## Cross-Cutting: AI Memory Panel

Accessible from: Sidebar shortcut · Settings → "Manage Memory" · Overview "Manage Memory →" link.

Opens as a full-screen modal:

```
  ╔════════════════════════════════════════════════════════════════╗
  ║ AI Memory · Curse of Strahd                          [Close ×] ║
  ╠════════════════════════════════════════════════════════════════╣
  ║                                                                 ║
  ║ ─── Pinned Facts (always in AI context) ──────────────────    ║
  ║ 📌 The party owes Captain Vane a favor              [Edit][✕] ║
  ║ 📌 Father Julian carries a yellow silk shovel       [Edit][✕] ║
  ║ 📌 Mayor's brother rumored alive in sewers          [Edit][✕] ║
  ║ [+ Add Pin]                                                    ║
  ║                                                                 ║
  ║ ─── Session Recaps (compressed history) ─────────────────     ║
  ║ Session 14 · "Iron Gate" · 247 tokens                         ║
  ║   The party arrived at Lowgate Cross…   [View Full] [Edit]    ║
  ║ Session 13 · 312 tokens   …                                    ║
  ║ ...                                                            ║
  ║                                                                 ║
  ║ ─── Entity Awareness (what AI knows) ─────────────────────    ║
  ║ Filter: [All] [Discovered by PCs] [Hidden] [Stub]             ║
  ║ • Lowgate Cross   ● Known   Last referenced: Session 14       ║
  ║ • Father Julian   ◐ Partial Known  ...                        ║
  ║ • The Veiled Ward (secret goals) ○ Hidden                     ║
  ║                                                                 ║
  ║ ─── Recent Retrievals (what AI fetched last 5 turns) ─────   ║
  ║ Turn 47: Lowgate Cross, Captain Vane, Salt Way                ║
  ║ Turn 46: Father Julian, Widow Mary                            ║
  ║ ...                                                            ║
  ║                                                                 ║
  ║ ─── Drift Detection (potential continuity issues) ──────     ║
  ║ ⚠ Session 12 said Father Julian was "a tall man" but         ║
  ║   Session 14 described him as "diminutive". [Resolve]         ║
  ║                                                                 ║
  ║ [Export Memory JSON]  [Bulk Re-summarize]  [Clear & Rebuild] ║
  ╚════════════════════════════════════════════════════════════════╝
```

The Memory panel is **the heart of player canon control** (Q15). It's intentionally transparent — players see what the AI is working from and can correct, pin, or rebuild.

## Multiplayer / Invite Flow

```
  [+ Invite Player] modal:
  
  ┌──────────────────────────────────────────────────┐
  │ Invite to Curse of Strahd                        │
  │                                                  │
  │ Method:  ● Email   ○ Shareable link              │
  │                                                  │
  │ Email: [kim@example.com_________________]        │
  │ Character: [Elara Moonwhisper ▼]                 │
  │            (or [Let them create one])            │
  │ Permissions: ● Player (recommended)              │
  │              ○ Observer (read-only)              │
  │                                                  │
  │ Optional message:                                │
  │ [Hey Kim, dropping you into our Strahd campaign…]│
  │                                                  │
  │ [Send Invite]                                    │
  └──────────────────────────────────────────────────┘
```

- Invitee receives email with magic-link / signup
- On accept: lands in the campaign with their character assigned
- Sees player-mode UI (subset of workspace — Overview, Party, World [discovered only], Sessions [recaps only], World Map [fog-of-war], Combat [their character], Notes [shared only])
- **Cannot see**: Settings, Hooks pipeline, AI Memory, Recent Activity DM-only items, Hidden entities

## Mobile Experience

- Workspace tabs collapse to a horizontal scrollable pill row
- Sidebar collapses into a hamburger drawer
- Right pane disappears (accessible via icon strip)
- "Start Live Session" button is the **primary FAB** at bottom-right
- Per-card actions reduce to a ⋯ menu
- Detail pages become full-screen modals
- Kanban Hooks tab becomes single-column with status pills + horizontal swipe
- World Map becomes pinch-zoom canvas with overlay layer toggles

## Polish & Edge Cases

- **Live indicator** in header: `⚡ Live: Off / Live: Active (3 connected) — [Join]`. If a live session is running, header turns subtle gold tint and "Join" button appears for any campaign member.
- **AI background jobs** surface via a non-blocking toast: "🤖 AI is forging The Forgotten Shrine in the background…" with cancel option. Completion drops a chip into the Overview feed.
- **Cascading reveal**: when AI narrates an entity, related entities auto-discover via a configurable rule (e.g., "narrating a Tavern reveals its parent Settlement"). Toggle in Settings.
- **Cross-campaign reuse warnings**: editing an entity used in multiple campaigns shows "Editing this entity affects [Campaign A, Campaign B]. Continue?" — option to fork into a campaign-specific variant.
- **Session resume safety**: if app crashed mid-session, reopening the workspace shows a banner: "Last session ended unexpectedly mid-turn. [Resume from autosave] [Discard]"
- **Solo vs Party mode visual hint**: solo campaigns have a subdued single-portrait header; party campaigns show all character portraits in a row
- **"Conduct ritual" Easter eggs**: long-pressing the campaign sigil plays a campaign-specific sound (TTS preset's audio identity)

---

That's the Campaign workspace — every tab, the prep/admin side of the AI-GM experience.
