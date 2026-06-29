# Character View — Inline Editing Mode

*The full character view at `/characters/[id]`. Tabbed main layout, persistent right-side Live Stats HUD, Species terminology (modern 5E SRD), live calculations, SRD tooltips, "Use" buttons for resources, drag-and-drop. Editing is the default state; no separate view-only toggle unless sharing permissions require it. Green glow + floating toolbar + real-time validation banners.*

> **As-built (Jun 2026).** The sheet (`apps/web/src/app/(app)/characters/[id]/`, `character-sheet.tsx`) renders a **3-column Roll20-style layout** (left skills rail · center tabs · right rail + **Live Stats HUD**) with an `AbilitiesPanel` and `SheetHpPanel` above the grid. As-built tab set is **6 tabs — Combat · Spells · Inventory · Features & Traits · Notes · About** (abilities/skills are the rail/panel, not tabs; Personality is merged into **About**), not the 8-tab set described below. Editing **auto-saves on blur/mutation** — there's no floating "Save All / Cancel / Undo" toolbar (the bottom `SheetToolbar` shows a save timestamp + "Full Builder" link); conditions/inspiration live in `SheetRightRail`, not a drag-drop HUD. Route is `/characters/[id]` (no separate `/sheet` page).

---

## How to Enter / Exit

On the full Character View page (`/characters/[id]`):
- The page loads directly in **editable mode** by default.
- Floating toolbar (top or bottom): **Save All Changes** (green) | **Cancel** | **Undo Last Change** | **Switch to Full Builder** (jumps back to the 10-step wizard, pre-filled).
- **Auto-save every 30 seconds** + "Draft saved" toast.
- Any change instantly updates the right-side Live Stats HUD and all dependent fields.

## Overall Screen Layout

- **Fixed Header**: Character name (inline editable) + Species/Class/Level + "Back to My Characters" + Level Up button.
- **Main Area**: Horizontal tabs — Core Stats | Combat | Skills & Saves | Equipment & Inventory | Features & Traits | Spells | Personality & Backstory | Notes.
- **Right Sidebar (always visible)**: Live Stats HUD (portrait, hex abilities, HP bar, AC/Speed/Initiative/Passive Perception, dice roller, conditions, inspiration).
- **Left Sidebar (collapsible)**: Mini summary card (mirrors creation wizard sidebar).

---

## Right-Side Live Stats HUD (Persistent — updates live)

```
[ PORTRAIT ]   Thorin Ironfist
Level 1 Hill Dwarf Fighter          [Species • Class • Level]

STR [15] (+2)  DEX [14] (+2)  CON [16] (+3)
INT [12] (+1)  WIS [13] (+1)  CHA [10] (+0)     (hexagon layout)

HP [28 / 28] [██████████]   Temp HP: [0 ▼]
AC 16   Speed 25 ft   Init +2   Passive Perc 13
Prof Bonus +2   Inspiration [✓]

Quick Dice Roller
[ d20 + STR ] [Roll]   [ Advantage / Disadvantage toggle ]

Conditions (drag & drop)
[ Poisoned ] [ Prone ] [ + Add Condition ]
```

## Core Stats Tab (Default Landing Tab)

```
Ability Scores (click any for SRD breakdown popover)
STR [15 ▼] (+2)   [Athletics +5]   Saving Throw [✓] Proficient
DEX [14 ▼] (+2)   [Acrobatics +4]  Saving Throw [ ]
CON [16 ▼] (+3)                    Saving Throw [ ]
INT [12 ▼] (+1)                    Saving Throw [ ]
WIS [13 ▼] (+1)                    Saving Throw [✓]
CHA [10 ▼] (+0)                    Saving Throw [ ]

[ Auto-apply Racial Bonuses ]   [ Recommended for Fighter highlights ]
Live preview: All HUD stats + attacks update instantly.
```

## Skills & Saves Tab

```
Skills (two-column, editable checkboxes)
Acrobatics (DEX)     [+4]   [✓] Proficient   [★★] Expertise
Animal Handling (WIS)[+1]   [ ]
Arcana (INT)         [+3]   [✓]
... (full 18 skills)

Saving Throws (same row style as abilities)
Validation banner: "You have 1 skill proficiency remaining from background."
[ Reset to SRD Defaults from Species/Class/Background ]
```

## Combat Tab

```
Quick Bar (editable)
AC [16 ▼] (Chain Shirt + Dex)   Initiative [+2]   Speed [25 ft ▼]

Attacks & Spellcasting
Weapon/Attack          To-Hit     Damage              Range      Properties
Battleaxe              [+4 ▼]     1d8+2 slashing      Melee      Versatile
Light Crossbow         [+4 ▼]     1d8+2 piercing      80/320     Ammunition, Loading
[ + Add Attack from SRD Compendium ]   [ Edit Damage/Range ]

Death Saves
Success [ ] [ ] [ ]     Failure [ ] [ ] [ ]
[ Roll Initiative ]   [ Quick Attack buttons for each weapon ]
```

## Equipment & Inventory Tab

```
Carrying Capacity [78 / 240 lb] [Progress Bar – red if over]

Equipped (left column – drag & drop)
• Chain Shirt (AC 13 + Dex)   [Unequip]
• Battleaxe                    [Unequip]

Inventory (right column)
• 3 × Healing Potion [qty ▼]   [Remove]
• 10 × Rations                 [Remove]
• Thieves' Tools

[ Quick Add from SRD Shop ]   [ Buy with Gold (87 GP) ]
Coins: CP 45   SP 12   GP 87   PP 3   [Edit any]
```

## Features & Traits Tab

```
Racial Traits (Hill Dwarf)
✓ Darkvision 60 ft.
✓ Dwarven Resilience (advantage on poison saves)

Class Features (Fighter)
✓ Second Wind [1/1 uses remaining ▼]   [Use]
✓ Fighting Style: Defense (+1 AC while wearing armor)

Background Features
✓ Military Rank

[ + Add Homebrew Feature ]   [ Reorder ]   [ View Full SRD Text ]
```

## Spells Tab (casters only)

```
Spellcasting Ability: [Intelligence ▼]   Spell Save DC [12]   Spell Attack [+4]
Spell Slots
1st [████ 3/3 ▼]

Prepared Spells (drag-and-drop reorder)
1. Magic Missile     [Edit] [Remove]   [Cast]
2. Shield            [Edit] [Remove]   [Cast]
[ + Prepare New Spell from SRD List (filter by class/level) ]

Validation: "You may prepare 4 spells (INT mod + level)."
```

## Personality & Backstory Tab

```
Personality Traits
[ I'm always polite and respectful.                          ▼ ]
[ I'm obsessed with the honor of my former regiment.         ▼ ]

Ideal
[ My people are the most important thing in my life.         ▼ ]

Bond
[ I will someday return to my homeland and reclaim my title. ▼ ]

Flaw
[ I have a weakness for the vices of the city.               ▼ ]

Backstory (rich-text editor – full toolbar on focus)
[ Long formatted paragraph area with markdown support ]

Appearance
Height [4'8"]   Weight [180 lb]   Eyes [Brown]   Hair [Bald]   Skin [Tan]
[ Randomize Appearance ]
```

## Notes Tab

```
Freeform Markdown Notes
[ Large rich-text / markdown editor area ]
[ Campaign-specific or private toggle ]
[ Attach files / images ]
```

---

## Footer / Floating Toolbar (repeats on long pages)

```
Cancel | Undo Last Change | Save All Changes (green) | Switch to Full Builder | Last edited 47s ago (autosaved)
```

This inline editing experience feels **cohesive** with the rich 10-step creation wizard and tabbed viewer described in the spec, while delivering lightning-fast, contextual edits. Every section stays true to SRD rules with live validation, tooltips, and recalculations.
