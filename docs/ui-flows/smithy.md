# The Smithy — Homebrew Forge

*The dedicated homebrew & custom content forge at `/smithy` — consistent with the dark-fantasy theme, hex previews, live updates, card grids, modals, and polished interactions from Home, Characters Dashboard, Codex, Creation Wizard, Level Up, and Character View.*

---

## Persistent Top Navigation Bar

```
[Logo]  Loreforge   Home   Characters   Realms   Campaigns   Codex   The Smithy (active, glowing anvil icon)
        [Global Search: "Search my homebrew or Codex…"]   [Bell]   [Avatar]
```

## Overall Page Layout

- **Hero Banner** (cinematic forge theme): torch-lit anvil, glowing runes on custom weapons, subtle hammer sparks.
- **Left Sidebar** (sticky): Categories mirroring Codex + "All My Homebrew".
- **Main Content**: Dynamic grid of your custom creations (empty state is welcoming).
- **Right Pane** (toggleable): "Recently Forged" + "Quick Copy from Codex" shortcuts + "Your Characters" links.
- **Global polish**: live filters/search, view toggles (Grid/List/Table), SRD "Original" badges on copied items, "Use in Character" buttons everywhere, undo stack, auto-save drafts.

## Hero Banner

```
[ Dramatic forge background: glowing anvil, custom sword being hammered, sparks ]

          The Smithy – Forge Your Own 5E Legends
   Copy any SRD content from the Codex, customize freely,
   and make it yours. All homebrew lives here.

          [ + Forge New Custom Content ]   [ Browse Codex to Copy ]
   Your custom library • 100% compatible with characters
```

---

## Primary Categories (Left Sidebar / Top Tabs on Mobile)

Exactly mirrors Codex structure for instant familiarity, but shows **only your custom/homebrew versions**.

1. **All My Homebrew** (default landing – combined grid)
2. **Species**
3. **Backgrounds**
4. **Classes & Subclasses**
5. **Animals**
6. **Monsters & NPCs**
7. **Items** (sub-tabs: Weapons | Armor | Adventuring Gear | Tools | Potions | Magic Items)
8. **Spells**
9. **Feats**
10. **Advanced Rules** (Curses & Magical Contagions | Environmental Effects | Fear & Mental Stress | Poisons | Traps)

---

## Wireframe — All My Homebrew (Default Grid View)

```
Search my homebrew… [________________________]
Filters: Type • Last Edited • Source (Copied / Original)
[ + Forge New ]   [ Bulk Copy from Codex ]   View: [Grid] [List]

┌──────────────────────────────────────────────────────────────────┐
│ [Custom Icon]  Ironclad Berserker (Copied from Path of Berserker)│
│ Subclass • Edited 3 days ago                                     │
│ "Your rage now leaves burning trails of molten iron…"            │
│ [Edit] [Duplicate] [Use in Character] [Delete]                   │
└──────────────────────────────────────────────────────────────────┘
(Other cards: Custom "Shadowstep Rogue" background, "Crystal Dragon" species,
 homebrew "Frostbite Trap", etc.)
```

## Wireframe — Category Grid (e.g., Weapons)

```
Weapons (12 custom)
[ + New Custom Weapon ]   [ Copy from Codex Weapons ]

Grid cards:
• [Icon]  Thunderstrike Greataxe (Copied from Greataxe)
  Damage: 1d12+2 thunder • Properties: Heavy, Two-Handed, Special (stun on crit)
  [Edit Full Stats] [Equip to Thorin] [Delete]

Empty state per category:
"No custom [Weapons] yet. [Copy a weapon from Codex] or [Forge from scratch]"
```

---

## Copy-from-Codex Flow

- In any Codex detail modal (Species, Spell, Monster, etc.): new prominent button **"Copy to The Smithy"** (anvil icon, green).
- On click → instantly creates a duplicate in The Smithy (pre-filled with all SRD data) and opens the edit modal.
- Toast: "Copied to The Smithy – ready to forge!"
- Bulk option on Codex tabs: "Select multiple → Copy to Smithy".

## Editing / Forging Flow (Inline + Modal)

- **"Edit"** on any card opens a **rich edit modal** (same layout style as Creation Wizard Step 8 / Codex detail modal but fully editable).
- Fields are pre-populated from the copied SRD original (or blank for new creations).
- Live preview pane on the right of the modal shows how it would appear on a character sheet.
- All fields support full customization:
  - Textareas for flavor/descriptions
  - Number inputs + dice rollers for stats (HP, damage, DC, etc.)
  - Checkboxes/dropdowns for traits, proficiencies, conditions
  - Drag-and-drop for reordering features/actions
  - "Reset to Original SRD" button (for copied items)
- Auto-save every 5 seconds + version history.
- **"Forge Complete"** button saves and returns to grid.

## Wireframe — Edit Modal (Custom Spell)

```
Modal Title: Edit Homebrew Spell – "Shadowflame Bolt"

Left Form:
Name: [Shadowflame Bolt]   Level: [2 ▼]   School: [Evocation ▼]
Casting Time: [1 action]   Range: [60 ft]   Components: [V, S]
Description (rich text editor):
[You hurl a bolt of writhing shadow and flame…]

Right Live Preview:
Spell Card as it would appear on character sheet + "Add to Elara Moonwhisper" button
```

---

## Additional Smithy Features

- **Create from Scratch**: "+ Forge New [Category]" buttons everywhere — opens blank edit modal tailored to that type (e.g., full stat-block builder for Monsters/Animals).
- **Organization**: Folders/tags (e.g., "My Campaign Homebrew", "Personal Favorites") + color-coded rarity tags for magic items.
- **Export/Import**: one-click "Export All Homebrew as JSON" or "Import Homebrew JSON".
- **Integration with Characters**:
  - From Smithy card → "Equip / Learn / Apply to [Character]" dropdown (instantly adds to inline edit or Level Up).
  - From Character View → "Browse My Smithy" filtered to relevant category.
- **Engine Integration** (per locked decision Q14): homebrew spells, items, monsters, and features run through the same `EffectTemplate` / `SpellDefinition` / `MonsterDefinition` schemas as SRD content. Advanced power-user homebrew can include sandboxed handlers (QuickJS isolate); see `docs/engine/architecture.md` §13.

### Right Pane Examples

```
Recently Forged
• Thunderstrike Greataxe
• Shadowflame Bolt

Quick Copy Suggestions (from Codex)
• [Copy Fireball] [Copy Hill Dwarf] [Copy Trap: Collapsing Ceiling]
```

## Mobile Experience

- Top nav collapses to hamburger (The Smithy is prominent).
- Sidebar becomes horizontal scroll.
- Edit modals become full-screen.
- Forge feels like a portable blacksmith's toolkit.

## Thematic Polish

- Subtle anvil hammer animations on buttons.
- "Forged" badge on fully customized items.
- Empty state illustration: empty forge with "Time to heat the anvil!" prompt.

The Smithy is the **creative workshop** companion to the Codex: every SRD element can be copied in one click, fully edited, and instantly used in characters — while keeping your homebrew library clean, searchable, and organized.
