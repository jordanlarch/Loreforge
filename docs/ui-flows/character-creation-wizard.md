# Character Creation Wizard

*Full-screen guided 10-step wizard. Visual language, layout patterns, and polish match the Level Up Wizard and Inline Editing Mode for perfect muscle memory. Veterans can jump steps freely; new players follow the guided flow. Hex ability scores, live calculations in < 300ms, SRD tooltips, validation banners, randomizers, undo stack.*

> **As-built (Jun 2026).** Step **count matches** (`creation-wizard.tsx`): 8 base steps (Concept · Species · Class · Background · Abilities · Skills · Equipment · Features) + Flavor + Review = **10**, plus an optional **Advancement** step when `startingLevel > 1`. Layout differs: it's a **2-column** layout (main + `SummaryCard` sidebar), **not** the 3-pane "left summary | main | right live-sheet preview" wireframe below. Drafts persist to **localStorage on change** (no 5s auto-save toast / "Suggest Fantasy Name" header / Skip-for-Now). Completion redirects to `/characters/{id}`.

---

## Persistent Wizard Layout (Identical Across All 10 Steps)

- **Fixed Header**: App logo + "Character Creator – 5E SRD" + inline-editable Character Name (with "Suggest Fantasy Name" button) + Progress stepper (10 clickable pills: 1. Concept → … → 10. Review; shows % complete or checkmark).
- **Left Sidebar** (collapsible): Real-time Character Summary Card
  - Portrait (upload / AI-generate)
  - Level 1 + Species / Class / Background icons + names
  - Hex ability score grid (score + modifier + source tooltip)
  - Quick stats: HP (max), AC preview, Speed, Prof Bonus (+2), Initiative, Passive Perception
  - Collapsible: Traits/Features, Skills
  - "Reset Step" / "Undo Last Change" buttons
- **Main Content Area**: Step-specific interactive UI (grids, cards, calculators, drag-and-drop).
- **Right Pane** (toggleable/resizable): Live mini Character Sheet Preview (tabbed mini version of the final sheet; updates instantly).
- **Footer** (fixed): Back / Next (disabled until validation passes) | "Skip for Now" (non-mandatory) | "Save Draft" (auto-saves every 5s) | "Exit to Dashboard" | Help (?) → SRD sidebar.

**Global polish**: live recalculations everywhere, SRD tooltips/popovers, search/filter on every list, red/green validation banners, randomizers per step, full undo stack, keyboard navigation.

**Entry**: from Characters list → "+ Create New Character" → opens wizard at Step 1 (pre-filled if coming from a Quickbuilder prompt).

---

## Step 1 — Concept

Header: "Start with an Idea" (Step 1 of 10)

```
Welcome to your new 5E SRD adventure!

Three large visual cards (side-by-side on desktop):
[ Dwarf Fighter Acolyte ]   [ Elf Wizard Criminal ]   [ Halfling Rogue Folk Hero ]

Quick prompt: "I want a tough spell-slinging dwarf"
[ Randomize All ]

Alignment: [ Lawful Good ▼ ]   Player Name: [ Jordan Larch ▼ ]
[ Campaign Link (optional) ]

Sidebar & Preview update immediately with basic card.
Validation banner: "Species + Class required to continue"
```

## Step 2 — Species

Header: "Choose Your Species"

```
Masonry grid of SRD Species cards (Dwarf, Elf, Halfling, Human, etc.)
Each card: thumbnail artwork + name + "+2 Con" + short flavor

Click opens detail modal:
• Full SRD traits list
• Sub-species selector (Hill Dwarf / Mountain Dwarf)
• Ability increase preview bars (live in sidebar)
• Variant Human / Custom Lineage toggle

Filters: Size • Speed • Darkvision • etc.
Live: Sidebar hex abilities shift + traits added to summary.
Validation: Must select one Species (sub-species optional but recommended).
```

## Step 3 — Class

Header: "Choose Your Class"

```
Grid of SRD Classes (Barbarian … Wizard)
Each card: Hit Die icon, primary ability, armor/weapon proficiencies preview,
spellcasting badge (if applicable)

Click → modal with:
• Level 1 features (expandable SRD text)
• Subclass preview (if available at lvl 1)
• Multiclass warning (advanced toggle)

Live: Proficiencies auto-added to left sidebar + HP formula + spell slots in preview pane.
```

## Step 4 — Background

Header: "Choose Your Background"

```
Grid of SRD Backgrounds (Acolyte, Criminal, Folk Hero…)
Card shows: 2 skills + 2 tools + languages + equipment + feature + gold

Click → full description + choice selectors (e.g., pick two languages)

"Custom Background" button → freeform builder (any 2 skills + 2 tools)
Live: Equipment & skills instantly appear in summary card and right preview.
```

## Step 5 — Ability Scores

Header: "Determine Your Ability Scores"

```
Four method tabs:
1. Standard Array (15,14,13,12,10,8) – drag-and-drop to hex slots
2. Point Buy – 27-point calculator with cost table + remaining points
3. Roll 4d6 Drop Lowest – "Roll All" (dice animation) + assign / re-roll
4. Manual Entry (3-18 range validation)

Racial bonuses auto-applied & highlighted in sidebar hexes.
"Recommended for [Class]" highlights on relevant abilities.
Live: Every change instantly updates all derived stats in sidebar + preview pane.
```

## Step 6 — Proficiencies, Skills, Languages & Tools

Header: "Select Your Proficiencies"

```
Three-column layout:
Auto-granted (read-only list from Species/Class/Background)
Choices remaining: [ Rogue: pick 4 skills from list ] – checkboxes + count
Languages/Tools: Dropdown pickers with SRD limits

Full skill list preview with final bonuses (ability mod + prof)
Live: Passive Perception, skill list, and sheet preview update instantly.
Validation banner: "You have X choices remaining."
```

## Step 7 — Equipment

Header: "Choose Your Starting Equipment"

```
Tabbed interface:
• Starting Equipment – collapsible class/background packs + alternatives (SRD choices)
• Buy with Gold – simple shop (filtered SRD items) with background gold pre-filled
• Custom Add – searchable compendium

Drag-and-drop to inventory slots
Weight/encumbrance calculator with live warning
Live: AC auto-calculated (equipped armor + Dex), attacks list populated, inventory in right preview.
```

## Step 8 — Features, Spells & Special Choices

Header: "Finalize Level 1 Features & Spells"

```
Class features at level 1 (expandable SRD text)
Conditional spell selection (casters only):
  • Known/Prepared spells grid (filtered by class/level 1)
  • Drag-and-drop + tooltips with full SRD descriptions

Other choices (Fighting Style, Sorcerous Origin spells, etc.)
Live: Spells added to preview sheet with attack/save DC calculated.
```

## Step 9 — Flavor & Personalization

Header: "Bring Your Character to Life"

```
Personality Traits (2) – pre-filled suggestions from Background + custom textareas
Ideal / Bond / Flaw (styled quote cards + free-text)

Appearance:
Height [ ]   Weight [ ]   Eyes [ ]   Hair [ ]   Skin [ ]   [ Randomize ]

Backstory (rich-text editor)
Portrait upload / gallery selector

No validation – fully optional but encouraged with subtle prompts.
```

## Step 10 — Review & Finalize

Header: "Review & Create Your Character"

```
Full-screen live sheet preview (printable layout, tabbed like final View page)
Breakdown of all choices with direct "Edit" links back to any step
Derived stats final check (HP rolled or max, AC, attacks, etc.)
Warnings summary (if any)

Actions (big buttons):
• Save & Create → adds to My Characters + redirects to full editable View page
• Export: PDF / JSON / "Send to VTT"
• Level Up Later
• Start Over / Duplicate
```

---

## Completion

Wizard closes → success toast ("Character 'Thorin Ironfist' created!") → automatic redirect to the new Character View page (now in editable mode with Live Stats HUD). All data syncs bidirectionally with the Inline Editing experience.
