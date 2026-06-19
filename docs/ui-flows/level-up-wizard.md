# Level Up Wizard

*Large modal launched from the Character View page header's prominent "Level Up" button. Same dark-fantasy theme and exact layout patterns as the 10-step Creation Wizard for instant familiarity. Underlying Character Sheet + Live Stats HUD remain faintly visible behind the modal. Progress stepper shows "Leveling to X".*

---

## Entry Point

On Character View (`/characters/[id]`): big glowing **"Level Up"** button in the header (with XP tooltip). Click → large modal opens with live data pre-loaded.

## Persistent Modal Layout (identical to Creation Wizard)

- **Header**: App logo + "Level Up – [Character Name] to Level X" + progress stepper (5 pills).
- **Left Sidebar**: Real-time Character Summary Card (portrait, hex abilities, quick stats, traits — updates live).
- **Main Content**: Step-specific UI.
- **Right Pane**: Live mini Character Sheet Preview (updates in < 300ms).
- **Footer**: Back / Next | "Save Draft" | "Cancel Level Up" (reverts to previous level).

---

## Step 1 — Class Progression

Header: "Choose How to Grow" (Step 1 of 5)

- **Current Status** (prominent card): "Thorin Ironfist is currently Level 4 Hill Dwarf Fighter" (multiclass shows full list).
- **Two Large Option Cards**:
  1. **Advance in Fighter** (pre-selected, green) — "Gain next features of your primary class"
  2. **Multiclass into a New Class** — Dropdown of SRD classes + real-time prerequisite validation banner ("Fighter requires 13+ Strength" or red warning with SRD tooltip).
- **Info Panel** (collapsible): Multiclass consequences (proficiencies, spell slots, etc.).
- **Sidebar & Preview** update immediately with new total level.

## Step 2 — Hit Points

Header: "Roll for Health"

- **Current HP Display**: "Current HP: 28 / 28"
- **Two Choices** (big buttons with SRD icons):
  - **Take Average** (+6 for d10 Fighter — recommended)
  - **Roll Hit Die** (animated d10 + CON mod; "Roll Again" once)
- **Result Preview**: "New Max HP will be 34 (+6 this level)"
- Live update to left sidebar and right preview pane.

## Step 3 — New Features & Choices

Header: "Unlock New Abilities" (dynamic — only what this level grants)

- **Auto-Populated Feature List** (accordion, same style as Creation Step 8):
  - New class features at this level (e.g., "Extra Attack", "Ability Score Improvement").
  - Choice prompts:
    - ASI/Feat grid (hex buttons for +1/+2 or searchable SRD Feat list).
    - Subclass choice (if granted this level).
    - Other decisions (Fighting Style, etc.).
- **Multiclass Note** (if applicable): "You also gain [new class] proficiencies…"
- **Validation Banner**: "You have 1 ASI remaining – assign before continuing."

## Step 4 — Spells & Magic

Header: "Expand Your Spellbook" (skipped with friendly message if not applicable)

- **Spellcasting Ability** reminder + new spell slots (bubbles, multiclass rules applied).
- **Prepared / Known Spells** grid (filterable SRD list, drag-and-drop, same as Creation Step 8 and Inline Spells tab).
- **Validation**: "You may prepare X more spells."

## Step 5 — Review & Confirm

Header: "Ready for Adventure?"

- **Side-by-Side Comparison** (left: before | right: after — changes highlighted green).
- **Live Full Preview** (mini version of the tabbed Character Sheet).
- **Final Checklist** with green checkmarks:
  - All SRD prerequisites met
  - Hit Points updated
  - Features & choices complete
  - Spells prepared
- **Celebration Teaser**: "Level X Achieved!" + class-specific flavor.
- **Big Primary Button**: **"Level Up Complete"** (confetti + sound effect).
- Secondary: "Save as Draft & Finish Later" or "Cancel".

---

## Completion

Modal closes → Character View page updates instantly with new level, HP, features, etc. Success toast + automatic XP reset + version history entry created.

This is **perfectly consistent** with the Creation Wizard (same layout, same components) and the Inline Editing Mode (same HUD, hex scores, validation style), while being meaningfully "mini" and staying inside the sheet view.
