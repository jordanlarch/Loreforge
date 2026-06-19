# Codex — SRD Reference

*The full SRD compendium experience at `/codex` — bidirectionally integrated with The Smithy. Every SRD entry can be copied to The Smithy in one click for full customization. Mirrors the visual language of Home, Characters, Creation Wizard, Level Up modal, Character View, and The Smithy. Dark-fantasy theme, responsive, 100% SRD-native.*

---

## Entry Points

- Top nav: `Home · Characters · Realms · Campaigns · Codex (active) · The Smithy`
- Quick-Jump Links from other pages:
  - Creation Wizard / Inline Edit → "Browse Codex" buttons (pre-filter relevant tab).
  - Character View → "View in Codex" on any trait, spell, item, or feature.
  - Dashboard → "Open Codex" in the right sidebar.
  - The Smithy → "View Original in Codex" on any copied homebrew item.
- **Global Search Bar** (top-right on every page): typing "fireball", "hill dwarf", or "custom shadowflame" instantly shows mixed results from Codex and Smithy.
- **Deep Links**: `/codex/species`, `/codex/spells/fireball`, `/codex?search=thunderstrike` (bookmarkable and shareable).

## Persistent Page Layout

- **Hero Banner** (subtle, fixed height): "The Codex – Official 5E SRD 5.2 Reference"
  - Quick-jump pill navigation: Rules • Species • Backgrounds • Classes • Animals • Monsters • Items • Spells • Feats • Advanced
  - **Prominent pill**: "Forge in The Smithy →" (direct link to `/smithy`)
- **Left Sidebar** (desktop: sticky, collapsible; mobile: top horizontal scrollable tabs) — lists all 10 categories.
- **Main Content Area**: Dynamic grid / list / table view that updates instantly on search/filter.
- **Right Pane** (desktop only, toggleable):
  - "Recently Viewed" (Codex + Smithy items)
  - **Quick Copy to Smithy** (suggested popular SRD entries with one-click copy buttons)
  - "Your Characters" quick-add shortcuts.
- **Footer**: SRD attribution + "Export this section as PDF/JSON" + "Copy entire section to The Smithy".

## Global Interactions

- Unified search spans Codex + Smithy; results show "SRD (Codex)" or "Homebrew (Smithy)" badges.
- Filters + sorting update in < 300ms.
- View toggles: Grid (default, card-based) ↔ List ↔ Data Table.
- Every card and every detail modal includes a prominent **"Copy to The Smithy"** button (anvil icon, glowing green).
- "Use in Character" and "Copy to The Smithy" appear side-by-side.
- Keyboard navigation + ARIA live regions for accessibility.
- Auto-save and undo stack preserved when copying/editing.

---

## Tab-by-Tab Flow

### 1. Rules Browser (Default / Landing Tab)

Collapsible table of contents for every core SRD rule.

```
Core Rules
├─ Ability Scores & Checks  [View] [Copy to Smithy]
├─ Combat                   [View] [Copy to Smithy]
├─ Spellcasting             [View] [Copy to Smithy]
├─ Equipment & Adventuring  [View] [Copy to Smithy]
└─ Conditions & Exhaustion  [View] [Copy to Smithy]
(Full expandable tree with search)
```

Click any rule → modal with full SRD text, tables, examples, "Bookmark", and **"Copy to The Smithy"** button.

### 2. Species

Masonry grid of all SRD Species (same cards as Creation Step 2).

Filters: Size, Speed, Darkvision, etc.

```
[Artwork] Hill Dwarf
+2 Con • Darkvision • Dwarven Resilience
[View Full Details] [Create Character as Hill Dwarf] [Copy to The Smithy]
```

Detail modal: full traits, sub-species, ability previews, "Create Character as [Species]", and **"Copy to The Smithy"**.

### 3. Backgrounds

Grid of all SRD Backgrounds (same style as Creation Step 4).

```
[Artwork] Folk Hero
2 Skills • 2 Tools • Feature • 10 GP
"You are a champion of the common folk…"
[View Full Details] [Create Character with this Background] [Copy to The Smithy]
```

### 4. Classes (with integrated Subclasses)

Grid of Classes → modal with level 1–20 table. Inside modal: Subclasses tabbed inline. **"Create Character as [Class]"** and **"Copy Class to The Smithy"** buttons.

### 5. Animals

Dedicated grid for SRD beasts/mounts/familiars.

```
[Token] Riding Horse
CR ¼ Beast  HP 13  AC 10  Speed 60 ft
[View Stat Block] [Add as Mount / Familiar] [Copy to The Smithy]
```

Filters: Mount • Companion • Wild Shape • Environment.

### 6. Monsters & NPCs

Unified grid of higher-CR creatures. Full stat-block modals with **"Copy to The Smithy"**, "Add to Encounter", and "Use as NPC".

### 7. Items

Horizontal sub-tabs: Adventuring Gear | Armor | Weapons | Tools | Potions | Magic Items. Grid shows icon, name, cost, weight, rarity. Detail modal includes full description, "Equip to [Character]", and **"Copy to The Smithy"**.

### 8. Spells

Most-used tab. Grid of spell cards with level badge + school. Filters: Level 0–9, School, Class list, Ritual/Concentration. Modal: complete SRD text + **"Prepare on [Character]"** and **"Copy to The Smithy"** buttons.

### 9. Feats

Grid with prerequisite highlights. Modal includes full benefit text + **"Add Feat during Level Up"** and **"Copy to The Smithy"**.

### 10. Advanced Rules (expandable accordion in sidebar)

- Curses & Magical Contagions
- Environmental Effects
- Fear & Mental Stress
- Poisons
- Traps

Each has its own filterable grid + detail modals with **"Copy to The Smithy"**.

---

## Search & Filtering Flow

1. User types in global search bar → instant dropdown of top results from **Codex + Smithy**.
2. Click "See all results" → lands on Codex with matching tab pre-selected and filters applied; banner shows "Also found X homebrew items in The Smithy →".
3. On any tab, dynamic left-panel filters appear (e.g., "Level" on Spells, "CR" on Animals/Monsters) plus "Source: SRD / Homebrew" chip.

## Detail View Flow (Modal / Panel)

- Opens centered or as right panel.
- Contains: full SRD text, tables, artwork, mechanical breakdowns.
- `[Use in Character ▼] [Copy to The Smithy] (green anvil) [Bookmark] [Share Link] [View SRD Source]`
- Clicking **"Copy to The Smithy"**:
  1. Instantly creates a fully editable duplicate in The Smithy.
  2. Opens the Smithy edit modal pre-filled with all SRD data.
  3. Success toast: "Copied to The Smithy — ready to customize!"
- Bulk action on any tab: "Select multiple → Copy to The Smithy".

## Integration Flows (Character ↔ Codex ↔ Smithy)

- From any character sheet (inline edit or wizard): "Browse Codex" or "Browse My Smithy" buttons (pre-filtered).
- From Codex → Smithy: one-click copy.
- From Smithy → Codex: "View Original SRD" link on every copied item.
- From Smithy → Character: same "Equip / Learn / Apply" pattern.
- All changes remain fully bidirectional and validation-aware.

## Mobile Experience

- Top nav collapses to hamburger (The Smithy remains visible).
- Sidebar becomes horizontal scrollable tabs at the top.
- Detail views become full-screen modals.
- Search is sticky at the very top; Copy buttons are large and thumb-friendly.

## Polish & Edge Cases

- Empty state on any tab: "No results in Codex. [Copy something from here to The Smithy] or [Forge from scratch in Smithy]."
- "Recently Viewed" in right pane persists across sessions and mixes Codex + Smithy items.
- Export options include "Export + Copy to Smithy".
- Dark-mode toggle (default).

This is the **complete Codex page flow** — a beautiful, powerful SRD browser that forms a creative loop with The Smithy. Every official rule, creature, spell, or item is one click away from becoming fully customizable homebrew, while the Codex remains the clean, authoritative reference.
