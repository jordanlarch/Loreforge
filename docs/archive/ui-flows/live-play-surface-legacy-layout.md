# Live Play Surface — Legacy Layout Wireframes (pre–#241)

> **ARCHIVED Jun 2026.** The **#214 left party-rail** layout ASCII and the original five-zone target sketch — **superseded** by the unified play shell (left nav + center map/chat + right `PlayRightRail`) in [`unified-campaign-ux.md`](../../ui-flows/unified-campaign-ux.md). Kept for historical reference only.

---

## Layout — shipped (Jun 2026, #214)

**Exploration** (desktop):

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ ① TOP BAR (breadcrumb · title · Live/Async · scene · clock · Pause)   │
  ├──────┬──────────────────────────────────────────────┬──────────────────┤
  │      │  ② MAP (tactical grid when scene has a map)  │ ④ COMPACT PC HUD │
  │ ⑤    │                                              │ (name · HP/AC/   │
  │PARTY │                                              │  speed · Sheet)  │
  │RAIL  ├──────────────────────────────────────────────┤ + tutorial panel │
  │(left)│  ③ CHAT + moded composer                     │  when applicable │
  │      │                                              │                  │
  └──────┴──────────────────────────────────────────────┴──────────────────┘
```

**Combat**:

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ ① TOP BAR (no End turn · no round/turn/movement during combat)        │
  ├─────────────────────────────────────────────────────────────────────────┤
  │ INITIATIVE STRIP — Round N · active name · horizontal initiative chips  │
  ├──────┬──────────────────────────────────────────────────────────────────┤
  │ ⑤    │  ② MAP — tokens · movement radius · target/aim pickers           │
  │PARTY │                                                                  │
  │RAIL  ├──────────────────────────────────────────────────────────────────┤
  │      │  TURN BAR — economy · Attack/Ready/Cast · quick-use · End turn   │
  │      │            · reaction prompts (when open)                        │
  │      ├──────────────────────────────────────────────────────────────────┤
  │      │  ③ CHAT + moded composer                                         │
  └──────┴──────────────────────────────────────────────────────────────────┘
```

**Shipped proportions:** viewport-fit column; map and chat share vertical space; party rail is a **fixed-width left column** (~8–10rem), not a bottom strip.

### Target layout (v1 design intent — not fully built)

The original five-zone sketch below remains the north star for polish passes. Items **not shipped** include: bottom party rail, draggable map/chat split, full right-rail Live Stats HUD during combat, hierarchical L0–L4 map zoom, fog of war, and in-game clock in the top bar.

```
  ┌─────────────────────────────────────────────────────────────────────────┐
  │ ① TOP BAR                                                                │
  ├─────────────────────────────────────────────────────────────────────────┤
  │                                                              ┌────────┐  │
  │                                                              │        │  │
  │                                                              │  ④     │  │
  │           ② MAP ZONE (always-on, current location)           │ CHAR   │  │
  │           ────────────────────────────────────────           │ HUD    │  │
  │           [interactive map: tokens, layers, fog]             │ (you)  │  │
  │                                                              │        │  │
  │                                                              │        │  │
  ├──────────────────────────────────────────────────────────────│        │  │
  │                                                              │        │  │
  │           ③ CHAT / NARRATIVE ZONE                            │        │  │
  │           ──────────────────────────                         │        │  │
  │           [AI narration, player actions, dice, chips]        │        │  │
  │                                                              │        │  │
  │                                                              │        │  │
  │           ┌──────────────────────────────────────────┐       │        │  │
  │           │ [Input: text / slash commands / actions] │       │        │  │
  │           └──────────────────────────────────────────┘       │        │  │
  ├─────────────────────────────────────────────────────────────│        │  │
  │ ⑤ PARTY RAIL (target: bottom slim strip)                     └────────┘  │
  └─────────────────────────────────────────────────────────────────────────┘
```

**Target proportions** (desktop, 1440px+): Map ≈ 45% vertical · Chat ≈ 50% vertical · Top bar ≈ 5%; Character HUD ≈ 280px right; Party Rail = bottom slim strip (collapsed).

**User can resize**: the horizontal divider between Map and Chat is draggable. Each user's preference saved per campaign. *(Not built.)*

**Visual tone**: same dark-fantasy theme as the rest of the app. Map zone uses parchment-on-dark tile; chat uses warm dark with subtle texture; HUD reuses the character sheet's Live Stats HUD aesthetics.

---

