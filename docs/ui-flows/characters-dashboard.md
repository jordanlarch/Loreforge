# My Characters Dashboard

*Central hub at `/characters` — polished to match the visual language, components, and delight of the Refined 10-Step Creation Wizard, Level Up Modal, and tabbed Character View / Inline Editing experience. Dark fantasy theme, clean sans-serif typography, mobile-first responsive. Every element uses hex ability previews, live SRD tooltips, green validation/confirmation accents, and instant feedback patterns.*

> **As-built (Jun 2026).** Shipped (`characters-browser.tsx`): Grid/List toggle, search, **XP progress bars**, optional **group-by-campaign**, **Play · {campaign}** links → `/campaigns/{id}/play`, and a **⋯ menu** (Duplicate · Export JSON · Copy share link) plus a separate delete (trash) action. **Not built** (treat the wireframes below as target): per-card hex ability previews, a **Level Up** button on cards, **filters** (Species/Class/Campaign), **bulk actions**, "Show Archived"/"Recently Leveled Up" badges, the hero banner, global search, and the rich right sidebar (the aside is "Quick tips" only). Empty state is a minimal "create your first" link, not quick-start templates/import.

---

## Purpose

- At-a-glance overview of all saved characters.
- Fast entry points for Create, View/Edit, Level Up, and campaign play.
- Strong campaign grouping and filtering for players with multiple games.
- Same header, sidebar style, and card aesthetics as the wizards and sheet.

## Overall Screen Layout (Persistent App-Wide Header + Dashboard Body)

- **Fixed Top Header**: App logo + "My Characters" + global search bar (searches across all characters) + Notifications + Profile avatar.
- **Main Nav** (left sidebar on desktop / bottom nav on mobile): Home · Characters (active) · Realms · Campaigns · Codex · The Smithy.
- **Dashboard Body**:
  - Hero banner with a big **"+ Create New Character"** primary button (floating action button on mobile).
  - Filter & control bar.
  - View toggle: Grid ↔ List.
  - Content area (grid or list).
- **Right Sidebar** (desktop only, collapsible): Quick "Recently Played" mini cards + "Campaign Quick Links" + "Create from Template" suggestions.

## Global Polish

- Live search & filters update results instantly.
- Hover tooltips show SRD flavor snippets.
- Every card has quick stats preview (mini hexes for key abilities + HP/AC).
- Auto-refresh when a character levels up elsewhere.
- Bulk actions (select multiple → Duplicate / Export / Delete).
- Accessibility: keyboard nav, ARIA live regions, high-contrast mode.

---

## Wireframe — Top Hero + Filter Bar

```
My Characters                                  [+ Create New Character]

Search characters… [______________________________]
Filters:  Species [All ▼]   Class [All ▼]   Level [1–20 ▼]   Campaign [All ▼]   Last Played [This Month ▼]
Sort: Last Edited ▼   View: [Grid] [List]   [Show Archived]
[ Advanced Filter: Has Spells / Has Multiclass / etc. ]
```

## Wireframe — Grid View (3–4 cards per row on desktop, 2 on tablet, 1 on mobile)

```
┌──────────────────────────────────────────────────────────────┐
│ [Portrait]                                                   │
│ Thorin Ironfist                                              │
│ Hill Dwarf • Fighter 5                                       │
│                                                              │
│ STR[15](+2) DEX[14](+2) CON[16](+3)                          │
│ HP 34/34    AC 16    XP 6,500 / 14,000 [progress bar]        │
│ Last played: 2 days ago                                      │
│                                                              │
│ [Level Up] (green if eligible)   [Open Sheet]   [⋯]          │
└──────────────────────────────────────────────────────────────┘
(Other cards: Elf Bard 3, Halfling Rogue 7, etc.)
```

## Wireframe — List View

```
Character             Species/Class/Level         Quick Stats         Last Edited     Actions
──────────────────────────────────────────────────────────────────────────────────────────────
Thorin Ironfist       Hill Dwarf • Fighter 5      HP 34 AC 16 XP 46%  2 days ago      [Level Up] [Open] [⋯]
Elara Moonwhisper     Wood Elf • Bard 3           HP 22 AC 14 XP 100% 5 hours ago     [Open Sheet] [⋯]
Finn Quickfoot        Lightfoot Halfling • Rogue 7 HP 45 AC 15 XP 12% 1 week ago      [Open Sheet] [⋯]
```

## Wireframe — Card Quick Actions Dropdown (⋯)

```
Open Sheet
Level Up (prominent if XP threshold met)
Duplicate Character
Export PDF / JSON
Share Public Link
Add to Campaign…
Archive / Delete (with confirmation modal)
```

## Wireframe — Empty State

```
[Illustration: empty tavern table with character sheet parchment]
No characters yet — your adventure awaits!

[+ Create New Character]

Quick Start Options:
• "I want a classic Fighter" → pre-fills Concept step
• "I want a spell-slinging Wizard"
• "Surprise me!" (full random SRD build)

[Import from JSON / D&D Beyond / other SRD tool]
```

## Wireframe — Campaign Grouping (active campaigns)

```
Active Campaigns
──────────────────────────────────────────
Hollowmark Crusade
  • Thorin Ironfist (Fighter 5) [Play Now]
  • Elara Moonwhisper (Bard 3)  [Play Now]

Tutorial — Lowgate Cross
  • Finn Quickfoot (Rogue 7)    [Play Now]

[View All Campaigns]
```

---

## Additional Polish

- **XP Progress Bars** on every card turn green when ready to Level Up, with tooltip "Ready to Level Up!"
- **"Recently Leveled Up"** badge with subtle confetti for the last 24 hours.
- **Bulk Select** checkbox in top-right of grid/list for mass actions.
- **Mobile**: vertical scroll, sticky filter bar, floating Create button; cards become full-width.

This dashboard feels like a **seamless extension** of the app: same visual language, same delightful interactions, and direct one-click paths into Creation Wizard, Level Up Modal, full editable Character View, or live Campaign play.
