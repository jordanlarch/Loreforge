# Home Page

*Landing page at `/` — fully aligned with the dark-fantasy theme, hex stats, live SRD tooltips, and polished components from the Creation Wizard, My Characters Dashboard, Character View, and Level Up modal. The top navigation is now simplified to the core sections you specified (Home / Characters / Codex / The Smithy / Realms / Campaigns). This page serves as the welcoming cinematic entry point for both new players and returning adventurers.*

> Note: top-nav scope evolved through the locked design — current canonical nav is **Home · Characters · Realms · Campaigns · Codex · The Smithy**. This document preserves the original Home page UX intent; nav labels reflect the final lock.

---

## Overall Page Layout

- **Persistent Top Navigation Bar** (fixed, dark with subtle glow):
  - Left: App logo (fantasy crest) + "Loreforge"
  - Center: **Home** (active, underlined) | **Characters** | **Realms** | **Campaigns** | **Codex** | **The Smithy**
  - Right: Global search bar (searches characters + realms + codex) | Notifications bell | Profile avatar (dropdown: My Account, Settings, Log Out)
- **Full-width cinematic hero** (above the fold)
- **Feature Grid** (3–4 columns on desktop, stacked on mobile)
- **CTA Banner** (prominent mid-to-lower section)
- **Footer** (standard app links + SRD attribution)

## Tone & Polish

- Cinematic background imagery with subtle parallax on scroll.
- All CTAs use the same glowing primary green as "Create New Character" and "Level Up".
- Live elements: if user is logged in, dashboard-style previews (mini character cards) appear dynamically.
- Responsive: mobile collapses hero to full-screen vertical, grid to 2-column, CTA to full-width.

---

## Wireframe — Top Navigation Bar (Persistent)

```
[Logo]  Loreforge   Home    Characters   Realms   Campaigns   Codex   The Smithy
                    [Search bar: "Search characters, realms, spells…"]   [Bell]  [Avatar]
```

## Wireframe — Cinematic Hero (full-width, 100vh desktop, 70vh mobile)

```
[ Dramatic dungeon scene: torch-lit stone corridor, distant dragon silhouette, glowing runes ]

                  Welcome to Your 5E AI-GM Adventure
       Play 5E with an AI Game Master that runs the world, the rules,
       and a living, breathing campaign — built on the official SRD.

                  [ + Create Your First Character ]
       Already have characters?   [ Jump to My Characters → ]

                            [ scroll prompt ↓ ]
```

## Wireframe — Feature Grid ("Everything You Need to Play 5E")

```
┌────────────────────────────────────────────────────────────┐
│ 1. Build Characters                                        │
│    Guided 10-step wizard or fast inline editing            │
│    Species, Classes, Backgrounds — 100% SRD                │
│    [ Try the Wizard ]                                      │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│ 2. Generate a World                                        │
│    Regions, settlements, dungeons, taverns, factions       │
│    Cascading auto-creation; rich, editable detail pages    │
│    [ Open Realms ]                                         │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│ 3. Run a Campaign with an AI-GM                            │
│    AI handles narrative, mechanics, NPCs, and combat       │
│    Async or live multiplayer; deterministic 5E engine      │
│    [ Start a Campaign ]                                    │
└────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────┐
│ 4. Browse the Codex & Forge in the Smithy                  │
│    Full SRD reference + one-click copy to homebrew         │
│    [ Open Codex ]   [ Open The Smithy ]                    │
└────────────────────────────────────────────────────────────┘
```

## Wireframe — CTA Banner (high contrast, full-width)

```
Ready to roll initiative?
[ Try the Tutorial Adventure ]   [ Generate a Region ]   [ Browse Public Campaigns ]
```

---

## Additional Sections

- **Featured Builds** carousel: 3–4 pre-filled SRD example characters with "Use This Build" buttons.
- **SRD Fidelity Badge**: "Built exclusively on the official 5E SRD 5.2 — no homebrew, no paywalls."

## Logged-In Personalization

If the user has existing characters / campaigns:
- Hero CTA changes to "Continue Your Adventure" with a small grid of recent characters and active campaigns.
- "Quick Level Up" buttons appear directly in the hero for any character ready to level.
- "Resume Last Session" prominent if a campaign was in progress in the last 30 days.

---

This Home page is the **cinematic front door** to the experience: it sells the AI-GM fantasy immediately, funnels new users into Tutorial → Creation, returning users into Characters / Campaigns / Realms, and is consistent with every other surface in the app.
