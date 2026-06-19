# Tutorial Adventure Design

*The onboarding micro-campaign at `/tutorial` — a tightly-scripted, ~30-minute solo adventure that organically demonstrates every primary feature of the app. Per Q19d: tutorial adventure with first-time contextual tooltips. The player's first impression is the entire product, in miniature, on rails.*

---

## 1. Goals & Design Philosophy

### Goals

- **Demonstrate, don't explain.** Every feature is encountered through *play*, not through a "feature tour." If we need a tooltip, the feature isn't being demonstrated well enough.
- **Sub-30-minute completion.** Median target: 22-28 minutes. Skip-friendly for power users.
- **Production-quality experience.** This is the demo reel. Hand-authored where AI-gen quality is unreliable; AI-gen where it shines (NPC banter, atmospheric narration).
- **End with a hooked user.** Player should finish wanting to build their own character / world / campaign — not feeling lectured.
- **Replayable as reference.** A user 3 weeks in should be able to revisit the tutorial to remember how a feature works.
- **Singleplayer only.** Multiplayer onboarding is separate (covered in §9). The tutorial is solo for tight pacing.

### Design Philosophy

| Principle | What it means |
|---|---|
| **Show, don't pre-explain** | No upfront "Welcome to your character sheet!" walkthrough. Player sees the sheet because they need it for an upcoming check. |
| **One new feature per scene** | Each scene introduces ONE primary system. Tooltips fire only on that scene's primary feature. |
| **The story is the curriculum** | Narrative beats are designed around the systems they introduce, not retrofitted. |
| **Player agency, scripted outcome** | Player makes real choices that *feel* consequential, but all paths reach the same next scene. The illusion is enough. |
| **Mechanical fidelity from minute 1** | Dice rolls are real. The engine is real. Combat is real. This isn't a "training mode" — it's the actual product on its smallest stage. |
| **No "skip the tutorial" hostility** | Skippers get a 60-second cinematic + a starter character + dropped into Home. No guilt. |
| **Fail-forward** | Player cannot lose. Failed rolls produce different (often more interesting) narration; combat at 0 HP triggers "rescue" by the companion NPC rather than character death. |

---

## 2. Pre-built Content

### 2.1 The Character

**Mira Thornwood** — Level 3 Half-Elf Ranger (Hunter)

Chosen because:
- Ranger covers martial, ranged, AND a few spells (touches the most systems)
- Level 3 unlocks a subclass (demos features), proficiency bonus +2 (simple math), one or two spell slots (demos casting without overwhelming)
- Half-Elf species shows multi-source ability bonus
- Hunter subclass adds one combat decision (Colossus Slayer or Horde Breaker)

Stat block (preset; player cannot edit during tutorial):
- STR 12 (+1)  DEX 16 (+3)  CON 13 (+1)  INT 10 (+0)  WIS 15 (+2)  CHA 11 (+0)
- HP 27/27   AC 14   Speed 30ft   Init +3   PP 14
- Skills: Stealth ✓, Perception ✓, Survival ✓, Investigation ✓
- Equipment: Longbow + 20 arrows · Two shortswords · Leather armor · 2 Healing Potions · Lantern · Sealed Message · 15 gp
- Spells (1st level slots: 3): *Hunter's Mark*, *Cure Wounds*
- Subclass feature unlocked at scene 5: choice between Colossus Slayer / Horde Breaker

### 2.2 The Companion

**Old Brennar** — Level 2 Human Cleric (Life Domain), NPC follower

- AI-controlled. The player can request his help via the same chat/UI affordances as any other NPC, but Brennar takes his own initiative.
- Carries 1 Healing Potion + Sacred Flame cantrip + Cure Wounds (1st slot ×3)
- Acts as the "safety net" — if Mira drops to 0 HP, Brennar uses his action to stabilize/heal
- Demonstrates the "NPC companion" feature (Q4 + Party tab affordance)

### 2.3 The Campaign

**"The Lantern's Last Flicker"** — one-shot scripted micro-campaign

Premise (player sees this on the splash):
> *Last Light Hollow is the final speck of warmth before the Hungering Forest. For generations, an enchanted lantern at the village edge has held the dark trees at bay. Now the lantern is dark, the keeper is missing, and the forest is creeping closer by the hour. You've been sent to deliver a sealed message. You should leave by morning. You probably won't.*

GM Persona preset: **Cinematic · Heroic · Standard SRD**, Pacing slider center, Adult content off.

### 2.4 The World

Pre-built Realms entities (visible in Realms after tutorial completes):
- **Region**: *The Greylight Marches* (Frontier, Temperate, Standard Magic) — atmospheric small region
- **Settlement**: *Last Light Hollow* (Village, pop. 47, Wealth: Modest) — single dirt road, 4 named locations
- **Buildings**: 
  - *The Hearth and Hemlock* (Tavern — central social hub)
  - *Old Brennar's Cot* (Building — companion's home)
  - *The Lantern Spire* (Building, sealed — dungeon entry)
- **Faction**: *The Order of the Last Lantern* (defunct religious order; once tended the lantern, now extinct)
- **Dungeon**: *The Lantern Spire* (Tiny dungeon — 6 rooms, ground floor + tower)
- **NPCs**:
  - Barnaby Bramblefoot (innkeeper)
  - Old Brennar (companion)
  - Lily the Lampmaker's Daughter (quest-giver)
  - Marlowe the Lampkeeper (missing; found inside)
  - The Hungering Shade (final encounter)
- **Plot Hook**: *"The Lantern's Last Flicker"* (auto-accepted; primary objective)

### 2.5 The Tutorial-Only Setting

- Combat encounters use a constrained CR budget (≤ CR 2)
- Map zone defaults to Cinematic pacing (minimal fog of war during tutorial)
- TTS is OFF by default (introduced via tooltip; player can enable)
- Failure recovery is heavily weighted toward narrative pivots, not character death
- Pinned in user's Campaigns list as "Tutorial · Completed" (archived but visible)

---

## 3. Scene-by-Scene Script

The tutorial is structured as **7 scenes**, each ~3-5 minutes. Each scene has:
- **Setting** (where + when)
- **Player Experience** (what the player sees + does)
- **Primary Feature Introduced** (the one system this scene demos)
- **Tooltip(s) Fired** (first-time guidance for that feature)
- **Engine Events** (what the deterministic engine actually does)
- **Success / Failure / Skip paths**

### Scene 0 — The Splash (90 seconds)

**Setting**: pre-play, fresh from login

**Player Experience**:

```
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                                                                    ║
  ║                    Welcome to 5E SRD Adventure                    ║
  ║                                                                    ║
  ║                         [animated logo]                            ║
  ║                                                                    ║
  ║          A modern, AI-driven 5E experience. You play.             ║
  ║          The AI runs the world. Roll real dice.                   ║
  ║                                                                    ║
  ║                                                                    ║
  ║                                                                    ║
  ║  ┌─────────────────────────────────────────────────────────┐    ║
  ║  │                                                          │    ║
  ║  │     ▶ Play the 30-Minute Tutorial Adventure            │    ║
  ║  │       (Recommended for first-time players)              │    ║
  ║  │                                                          │    ║
  ║  └─────────────────────────────────────────────────────────┘    ║
  ║                                                                    ║
  ║  ┌─────────────────────────────────────────────────────────┐    ║
  ║  │   Skip — Take me straight to character creation          │    ║
  ║  └─────────────────────────────────────────────────────────┘    ║
  ║                                                                    ║
  ║  ┌─────────────────────────────────────────────────────────┐    ║
  ║  │   Just let me browse — Take me to Home                   │    ║
  ║  └─────────────────────────────────────────────────────────┘    ║
  ║                                                                    ║
  ╚═══════════════════════════════════════════════════════════════════╝
```

On `[▶ Play the Tutorial Adventure]`:
- Brief pre-roll modal:
  ```
  Tonight you'll play Mira Thornwood, a half-elf ranger arriving
  in a frontier village called Last Light Hollow. ~30 minutes.
  You won't lose anything if you walk away — your progress saves
  automatically.
  
  [▶ Begin]    [Show me what features will be covered]
  ```
- `[Begin]` → fade to scene 1
- `[Show me what features…]` → expandable accordion listing features previewed, with "Just begin" CTA underneath

**Primary Feature**: meta — the value proposition
**Tooltip**: none
**Engine**: spins up tutorial campaign + Mira + Brennar + scene state from canned fixtures

---

### Scene 1 — The Hollow's Edge (Arrival, ~3 min)

**Setting**: Outdoor road, dusk, light rain, edge of village. Player can see the village ahead through trees; the dark lantern atop the spire is visible.

**Player Experience**:

Player lands directly in **Live Session Mode** with the full 5-zone layout. Everything is rendered; nothing is pre-narrated except the opening hook:

```
  ─── 📍 The Hollow's Edge · Dusk · Light Rain ───
  
  🎲 GM
  The road bends one last time through silver birches and you see
  it — Last Light Hollow, half a dozen roofs huddled around a tall
  stone spire. The spire's great lantern is dark.
  
  The rain finds its way through your cloak. You can smell wet
  woodsmoke from the village; a tavern, perhaps. You have a sealed
  message in your pack for someone here, and the daylight is
  going fast.
  
  Behind you, the forest sounds different than it did an hour ago.
  
  What do you do?
```

**Map zone shows**: outdoor terrain map of the village outskirts; Mira's token is on the road (north of her: 4-building hamlet, "Lantern Spire" visible as a dark tower; south of her: forest darkness; her token is the only one visible).

**Player input options shown** in the chip row above the text input:
- `[💬 Speak]` `[⚔ Action]` `[🎯 Check]` `[🎒 Use Item]`

Player can type anything reasonable. The AI accepts roughly four paths (all funnel to scene 2):
1. *"I head into the village"* → AI narrates approach
2. *"I light my lantern first"* → AI narrates with a small bonus (perception of an animal eye in the trees → foreshadowing)
3. *"I look around the road for tracks"* → AI calls for a check (Investigation/Survival)
4. *"I check my pack to see what I have"* → opens inventory (introduces Inventory tooltip)

**Primary Feature**: Chat + always-on map + token + free-text input

**Tooltips fired**:
- First message in chat → tooltip overlay arrow pointing at chat zone:
  ```
  ┌── This is where the story unfolds. ──────────────┐
  │ The AI narrates; you respond. Type anything,    │
  │ click an action button, or use slash commands.  │
  │                                  [Got it]        │
  └─────────────────────────────────────────────────┘
  ```
- After 5 seconds → tooltip on map zone:
  ```
  ┌── Your map is always above the chat. ────────────┐
  │ Drag your token to move. Click anywhere to see   │
  │ what's there. Scroll out for a wider view.       │
  │                                  [Got it]        │
  └─────────────────────────────────────────────────┘
  ```
- After 8 seconds → tooltip on character HUD:
  ```
  ┌── You are Mira Thornwood. ────────────────────────┐
  │ Lvl 3 Ranger. Bow at range; shortswords up close. │
  │ Your full sheet is here on the right.            │
  │                                  [Got it]        │
  └─────────────────────────────────────────────────┘
  ```

If player chooses path 3 (look for tracks), an inline check widget appears:

```
  🎯 Make a Wisdom (Survival) check — DC 12
  [🎲 Roll +4]
```

Click → dice animation → result → AI narrates the outcome (success = sees a wolf paw print fresh in mud → foreshadowing scene 5; failure = sees nothing definite, atmospheric narration).

This **first dice roll** fires a tooltip:
```
┌── That was a real die roll. ─────────────────────────────┐
│ The engine rolled it deterministically — no fake math.   │
│ Modifiers came from your character. Any time the GM      │
│ asks for a check, the roll button appears in chat.      │
│                                       [Got it]           │
└──────────────────────────────────────────────────────────┘
```

Scene closes when player moves toward the village (any path lands at scene 2). Map zone smoothly transitions (auto-zoom from outdoor to village center).

**Engine events**: `SceneChangedEvent`, possibly `RequestCheckCommand` + `ResolveCheckCommand` if player rolled.

---

### Scene 2 — The Hearth and Hemlock (~5 min)

**Setting**: Interior of the tavern; warm hearth, 6 patrons scattered, Barnaby behind the bar. Lily Lampmaker sits alone in a corner, crying quietly.

**Player Experience**:

Map auto-zooms to L3 (tavern interior). Tokens visible: Mira, Barnaby (behind bar), 4 unnamed patrons (gray "unknown" border), Lily (named, neutral border).

```
  ─── 📍 The Hearth and Hemlock · Evening ───
  
  🎲 GM
  Warm air rolls out as you push open the heavy door — hearth-smoke,
  mulled wine, the slow drum of rain on the slate roof above. Behind
  the bar, [👤 Barnaby Bramblefoot] looks up from polishing a
  pewter mug.
  
  "Cold night to be on the road, friend. The fire's lit, and we've
  a stew on if your purse can bear it."
  
  At a corner table you see a young woman — [👤 Lily], by the
  way the locals avoid her eye — sitting alone. She's been crying.
  Beside her, a sealed letter, untouched.
  
  Three patrons quiet down as you enter. One looks pointedly out
  the dark window toward the spire.
  
  What do you do?
```

**The clickable chips fire tooltips on first hover**:
```
┌── This name is an entity. ──────────────────────────┐
│ Click any chip — names, places, items — to see     │
│ what your character knows about it.                │
│                                  [Got it]          │
└────────────────────────────────────────────────────┘
```

Click `[👤 Barnaby Bramblefoot]` → side-drawer opens:
```
  Barnaby Bramblefoot
  Halfling · Tavernkeeper · Apparent age: middle
  Known: tavernkeeper here; warm but watchful tonight
  Disposition: ● Neutral
  
  [Speak to Barnaby]
```

Click `[Speak to Barnaby]` → auto-types `"I'd like to speak with Barnaby"` and sends. The AI responds with Barnaby's dialogue and lays out three soft choices:
- Ask about the dark lantern → leads to plot
- Ask about Lily → leads to Lily encounter
- Order food → atmospheric, then prompt back to Lily

Any path eventually pivots to Lily (the quest-giver). The AI narrates over to Lily; player can sit down (`I sit at her table`) → Lily delivers the central hook:

```
  🎲 GM
  Lily's eyes are red. She doesn't look up.
  
  "You're not from here. Good. Folk here have given up. Three nights
  ago my father went up the Lantern Spire to relight it — the keeper
  hadn't come down in two days. He hasn't come back either. Mayor
  said the door's sealed by the Order's wards now, that no one can
  go in. He's lying. The wards only seal *out*."
  
  She slides a small iron key across the table.
  
  "This was my father's. If anyone with a hand on the bow could
  find him… or what's left of him… we'd be in your debt. You'd be
  in *all* our debt."
  
  Make a Wisdom (Insight) check, DC 10.
  [🎲 Roll Insight +4]
```

Player rolls. On any result (success = "she's telling the truth and terrified"; failure = "you can't tell, but the desperation is real"), the AI offers the hook acceptance:

```
  🎲 GM
  She looks at you for the first time, and you realize her hand
  hasn't left the key. She is not asking. She is offering.
  
  ⚒ A new plot hook is available:
  ┌─ 📜 The Lantern's Last Flicker ─────────────────────────┐
  │ Find Marlowe Lampkeeper inside the sealed Lantern Spire │
  │ and re-ignite the lantern before the forest reaches the │
  │ village.                                                  │
  │ Starting NPC: Lily Lampmaker                              │
  │ Reward: The village's gratitude (and Lily's key)         │
  │                                                           │
  │ [Accept ▶] [Decline]                                      │
  └──────────────────────────────────────────────────────────┘
```

Click `[Accept ▶]` → hook moves to "Active" in the Campaign's Hooks tab → tooltip fires:

```
┌── Plot hooks live in your Campaign. ────────────────────┐
│ Accepted hooks track through your sessions. You can     │
│ see all of them anytime in the Hooks tab.              │
│                                       [Got it]          │
└─────────────────────────────────────────────────────────┘
```

If player tries to leave the tavern without engaging Lily, the AI gently funnels them back: *"As you turn to go, she calls after you, voice cracking…"* — soft rail.

Old Brennar enters from the back room:

```
  🎲 GM
  An old human in patched cleric's robes steps in from the back
  room, eyes on the door. [👤 Old Brennar] looks at the iron key
  in your hand, sighs, and reaches for his walking-staff.
  
  "Then I'm coming too. Mayor's a coward, but I knew Marlowe.
  He'd want someone besides me to say his name when he's gone."
  
  ⚒ Old Brennar has joined your party.
```

Tooltip:
```
┌── You have a companion. ─────────────────────────────────┐
│ Brennar will follow you and take his own turns in        │
│ combat. He's a 2nd-level Cleric — useful for healing.    │
│                                       [Got it]           │
└──────────────────────────────────────────────────────────┘
```

Party rail now shows both Mira and Brennar.

**Primary Feature**: NPC dialogue + chips + plot hook acceptance + companion NPC
**Engine events**: `RequestCheckCommand`, `ResolveCheckCommand`, `UpdateHookStatusCommand` (Active), `ActorJoinedPartyCommand` (Brennar)

Scene ends when player leaves the tavern toward the Lantern Spire.

---

### Scene 3 — The Crooked Lane (Brief Diversion, ~2 min)

**Setting**: Single dirt road through the village; the Lantern Spire is ahead. As Mira and Brennar walk, they pass a tiny shop with its door wedged open.

**Player Experience**:

```
  ─── 📍 The Crooked Lane · Night ───
  
  🎲 GM
  The two of you start up the lane. Halfway, you pass a small
  shopfront — a hand-painted sign reads "[🛒 Tinker's Mercy]" and
  the door is wedged open with a brick despite the rain.
  
  Inside, a stooped old gnome is closing up. He sees you, hesitates,
  then jerks his head: come in, come in.
  
  Do you stop?
```

**Optional path** — if player says yes:

Shop interior opens (map slides to small interior). Inventory list appears:

```
  🛒 Tinker's Mercy
  Shopkeeper: Toric Pennywhistle (Gnome · Tinkerer)
  
  ┌────────────────────────────────────────────────────────┐
  │ 🧪 Oil of Brightness                          25 gp   │
  │    "Lamp oil that burns ten times as bright."         │
  │    [Buy]                                                │
  └────────────────────────────────────────────────────────┘
  ┌────────────────────────────────────────────────────────┐
  │ 🗡 Silvered Arrow ×5                          15 gp   │
  │    "Effective against creatures of the shadow."        │
  │    [Buy]                                                │
  └────────────────────────────────────────────────────────┘
  ┌────────────────────────────────────────────────────────┐
  │ 🔥 Tinder-Twigs (10)                          1 gp    │
  │    "Catch any flame instantly."                        │
  │    [Buy]                                                │
  └────────────────────────────────────────────────────────┘
  
  You have 15 gp.
```

Toric *insists* on giving Mira the Oil of Brightness on credit (*"You'll need it. And if you're back tomorrow, we'll all owe you. If you're not… well."*). Free item, no transaction friction; demos the inventory model without forcing economic decisions.

Tooltip:
```
┌── Items work mechanically. ──────────────────────────────┐
│ Oil of Brightness has a real game effect — use it on    │
│ the lantern later and it'll do something. Inventory     │
│ lives in your sheet, right rail.                         │
│                                       [Got it]           │
└──────────────────────────────────────────────────────────┘
```

Inventory chip in the HUD briefly pulses gold to draw the eye.

If player skips the shop, AI doesn't punish (Marlowe's old lantern oil works fine at the spire — narratively rougher, mechanically identical). Both paths funnel forward.

**Primary Feature**: Shops + inventory + item acquisition
**Engine events**: `InventoryChangedEvent`, `CurrencyChangedEvent` (if purchase)

---

### Scene 4 — The Lantern Spire, Lower Hall (~5 min)

**Setting**: Inside the sealed spire's ground floor. Cold stone, the smell of burnt cedar. The great lantern is in a glass cage at the room's center — dark. There are bloody fingertip drags on the floor heading up the spiral stairs.

**Player Experience**:

Map auto-zooms to L3 (spire interior). Procedural Dyson-style floor plan visible: one large round chamber + spiral stairs up. Two tokens (Mira, Brennar). Bloody drags as a map decoration. A small **chest** token in the corner (locked, mundane treasure).

```
  ─── 📍 The Lantern Spire · Lower Hall · Night ───
  
  🎲 GM
  The lock turns with Lily's key. The door groans inward.
  
  Inside, the great lantern is silent in its glass cage — black
  wick, no flame. The cedar incense smell is mostly gone, replaced
  with something colder.
  
  Bloody fingertip drags lead from the door to the foot of the
  spiral stair.
  
  Brennar lowers his staff and says nothing.
  
  What do you do?
```

Available actions visible: explore the chamber, follow the trail upstairs, examine the lantern, examine the chest, talk to Brennar.

**The chest** demonstrates: thieves' tools check, then loot. Mira isn't proficient → Brennar offers to help. If player attempts unlock:

```
  🎲 GM
  *Make a Dexterity check with Thieves' Tools.* DC 13. You don't
  have proficiency, but Brennar can [Help] you (giving you advantage).
  
  [🎲 Roll +3]  [Accept Brennar's Help (Advantage)]
```

Click "Accept Help" → roll changes to advantage. Tooltip:

```
┌── Advantage rolls two dice. ─────────────────────────────┐
│ When someone Helps you, the engine rolls two d20s and    │
│ takes the higher. Most 5E advantage/disadvantage rules   │
│ are automatic — you don't have to track them.            │
│                                       [Got it]           │
└──────────────────────────────────────────────────────────┘
```

Roll → success (rigged to succeed on advantage 95% of the time) → chest opens → 12 gp + a Scroll of *Cure Wounds*. Auto-claimed into inventory.

If player **examines the lantern** (or just heads upstairs), Brennar mutters about the wards. AI doesn't gate progression on the chest.

When player heads upstairs:

```
  🎲 GM
  The stair winds up the spire's spine. Halfway, you hear it —
  something dragging itself across stone above. Slow. Wet. Then
  silence.
  
  Brennar's lips move in silent prayer.
  
  The stair opens onto the upper chamber. Marlowe Lampkeeper is
  here, slumped against the lantern's pedestal, eyes open. Not
  breathing. His lantern-oil flask, untouched, is in his hand.
  
  The cold in this room is wrong.
  
  Then the air thickens. Behind you on the stair, a shape pulls
  itself up — vaguely human, made of forest-shadow, with two
  empty bright spots for eyes.
  
  ⚔ Combat begins. Roll initiative.
```

**Primary Feature**: Map zoom + dungeon exploration + checks with Help/advantage + loot acquisition
**Engine events**: `SceneChangedEvent`, `RequestCheckCommand`, `InventoryChangedEvent`, `EncounterStartedEvent`

---

### Scene 5 — The Hungering Shade (Combat, ~7 min)

**Setting**: Top of the spire. 5ft grid overlays the floor plan. Mira and Brennar on the stairs side; Marlowe (corpse, no token) at the pedestal; The Hungering Shade emerging from the stair.

**The Combat Encounter**:
- 1× **The Hungering Shade** (custom monster, CR 2): HP 35, AC 13, Dexterity ambush, single bite attack (1d8+3 necrotic), one "Hungering Touch" reaction (advantage if Mira is at low HP)
- 1× **Mira Thornwood** (player-controlled)
- 1× **Old Brennar** (AI-controlled companion)

**Phase 1 — Initiative**:

Auto-roll initiative. Visual:
```
  ⚔ COMBAT · Round 1 · Initiative
  Mira(19) → Shade(14) → Brennar(11)
              ↑ now
```

Tooltip:
```
┌── This is a real Tier-4 combat. ─────────────────────────┐
│ Real positions on the grid. Real dice. The engine        │
│ enforces every rule. Your action options will pop up     │
│ on your turn.                                             │
│                                       [Got it]           │
└──────────────────────────────────────────────────────────┘
```

**Phase 2 — Mira's first turn**:

```
  ⚔ Round 1 · ▶ Your turn (Mira) · ✓Action ✓Bonus ✓Reaction · 0/30ft used
  
  Your token glows gold. Movement radius visible.
  
  Available actions:
   [⚔ Attack ▼ Longbow / Shortswords]
   [🔮 Cast Spell ▼ Hunter's Mark / Cure Wounds]
   [🎒 Use Item ▼ Healing Potion / Scroll / Oil of Brightness]
   [🛡 Dodge] [🏃 Dash] [🤝 Help] [Disengage] [Hide]
```

Tooltip on first turn:
```
┌── Action Economy. ──────────────────────────────────────┐
│ Each round you get one Action, one Bonus Action, one    │
│ Reaction, and your Speed. The engine tracks every one.  │
│                                       [Got it]          │
└─────────────────────────────────────────────────────────┘
```

**Recommended play path (the AI gently suggests if Mira hesitates 15s)**:
- Cast Hunter's Mark on Shade (Bonus Action — demos spell + concentration)
- Longbow attack on Shade (Action — demos attack + damage roll)

Player clicks `[🔮 Cast Spell] → Hunter's Mark → Target: Shade` → engine resolves; concentration starts.

Tooltip:
```
┌── Concentration. ────────────────────────────────────────┐
│ Hunter's Mark requires concentration. If you take damage │
│ you'll roll a Constitution save to keep it; that's all   │
│ automatic. Your HUD shows the concentration spell.       │
│                                       [Got it]           │
└──────────────────────────────────────────────────────────┘
```

Player clicks `[⚔ Attack] → Longbow → Target: Shade`. Engine rolls:

```
  🎲 Mira attacks the Hungering Shade with Longbow
     Attack: d20[16] + 5 = 21 vs AC 13  →  HIT
     Damage: 1d8[5] + 3 + Hunter's Mark 1d6[4] = 12 piercing
     Shade: HP 35 → 23
```

AI narrates:
```
  🎲 GM
  Your arrow finds the bright spot where its eye should be. The
  shadow recoils, hissing without lungs.
```

`[End Turn]` button activates.

**Phase 3 — Shade's turn**:

Shade moves 30ft toward Mira (rendered on map), then bites. Engine rolls:

```
  🎲 Hungering Shade attacks Mira with bite
     Attack: d20[11] + 5 = 16 vs AC 14  →  HIT
     Damage: 1d8[6] + 3 = 9 necrotic
     Mira: HP 27 → 18
  🎲 Mira's Hunter's Mark Concentration check:
     CON save DC 10: d20[14] + 1 = 15  →  Maintained ✓
```

AI narrates:
```
  🎲 GM
  Cold teeth pass through your armor like it isn't there. You feel
  something pull at the warmth in your chest — but the spell holds.
  Brennar's eyes flash white-gold for a moment.
```

**Phase 4 — Brennar's turn (AI-controlled)**:

Brennar moves into range and casts Sacred Flame on Shade. Engine rolls Shade's DEX save → fails → Shade takes 1d8 = 5 radiant damage.

Tooltip on first NPC turn:
```
┌── Brennar plays himself. ────────────────────────────────┐
│ The AI runs all non-player characters. Their actions    │
│ go through the same engine rules as yours. No fudging.   │
│                                       [Got it]           │
└──────────────────────────────────────────────────────────┘
```

**Phase 5 — Rounds 2-4**:

Combat plays out over 3-5 rounds total. The Shade has enough HP to require multiple turns but not enough to ever truly threaten Mira (with Brennar healing).

**Scripted "near-death" beat**: At some point during Round 2 or 3, Mira's HP drops below 8 (engine-tracked). Brennar's AI automatically casts Cure Wounds on her on his next turn. This demos:
- The companion as a safety net
- Healing via spell
- HP recovery animation

If Mira's HP somehow hits 0 (very unlikely):
- Death save UI appears, but **before the first death save resolves**, Brennar uses his action to Spare the Dying or feed her a potion
- Mira recovers to 1 HP, scene continues
- Tooltip: *"Brennar's got you. In real campaigns you'd handle this yourself."*

**Phase 6 — Reaction prompt** (forced demo, Round 2):

When Brennar casts Sacred Flame at the start of his turn, the engine fires a scripted reaction trigger: Shade attempts a counter-bite at Brennar. This is *not* a real SRD mechanic, but a tutorial-only beat — when Brennar declares the spell, Shade's "Hungering Touch" reaction triggers an opportunity to bite Brennar before the spell resolves. This pauses, and a reaction prompt fires for Mira (because she has Hunter's Mark active and could use a different reaction — say, the engine offers a tutorial-only "Hunter's Snipe" reaction as a free action):

Actually — simpler and more SRD-accurate: when Mira's adjacent enemy moves away (which the engine can script in Round 3 by having Shade try to flee to engage Brennar instead), an **Opportunity Attack** reaction prompt fires:

```
  ⚡ REACTION (8s) — The Shade is leaving your reach. Make an
     Opportunity Attack?
  [Attack with Shortsword] [Don't react] [Auto-pass]    ⏱ 8s
```

Player clicks → free attack → resolves.

Tooltip:
```
┌── Reactions interrupt the normal flow. ──────────────────┐
│ The engine triggers reactions automatically (Opportunity │
│ Attack, Shield, Counterspell, etc.). You'll always get   │
│ a chance to react when something qualifies.              │
│                                       [Got it]           │
└──────────────────────────────────────────────────────────┘
```

**Phase 7 — Victory**:

Shade falls; the script triggers:

```
  ⚔ COMBAT ENDS · Victory (Round 4)
  
  ┌─────────────────────────────────────────────────────────┐
  │ The Hungering Shade collapses in on itself like        │
  │ extinguished smoke. Cold leaves the room in a single,  │
  │ silent rush.                                            │
  │                                                          │
  │ Marlowe Lampkeeper is dead. The unlit lantern looms.   │
  │                                                          │
  │ Outcome: Victory                                         │
  │ XP awarded: 450 ea                                       │
  │ Loot: Marlowe's flint-and-cedar (atmospheric item)      │
  │                                                          │
  │ [Continue ▶]                                            │
  └─────────────────────────────────────────────────────────┘
```

Map auto-zooms back to L3.

**Primary Feature**: Combat (Tier 4 in miniature) — initiative, action economy, attacks, spells, concentration, reactions, companion AI, healing, victory
**Engine events**: many — `EncounterStartedEvent`, `RollInitiativeCommand`, multiple `AttackCommand` + resolutions, `CastSpellCommand`, `EffectAttachedEvent` (Hunter's Mark), `SaveRolledEvent` (concentration), `DamageDealtEvent`, `HealingAppliedEvent`, reaction window events, `EncounterEndedEvent`

---

### Scene 6 — The Choice & The Light (~5 min)

**Setting**: Upper chamber, post-combat. The unlit lantern, Marlowe's body, the cedar-incense quiet.

**Player Experience**:

```
  🎲 GM
  The shadow that hunted from the forest is gone — for tonight.
  But the lantern is still dark. And the trees below are still close.
  
  You have:
   • Marlowe's lantern-oil flask (in his hand)
   • Marlowe's flint-and-cedar (just looted)
   • The Oil of Brightness (if you bought it from Toric)
   • A Scroll of Cure Wounds (if you opened the chest)
  
  Brennar quietly closes Marlowe's eyes and looks to you.
  
  "Light it however you can. The Order's prayer was 'cedar to the
  flame, flame to the dark, dark to the deep.' But I think any
  light will do."
  
  What do you do?
```

The player faces a **soft narrative choice** that demos several systems:

**Option A — Use Oil of Brightness on the lantern** (best outcome)
- Player opens inventory → uses Oil of Brightness → engine processes use → lantern relights in brilliant white-gold
- AI narrates the village basking in light; the forest visibly retreats
- **Achievement**: "First Light"
- Bonus reputation note added: *"Last Light Hollow is in your debt."*

**Option B — Use Marlowe's flint-and-cedar with normal lamp oil** (standard outcome)
- Lantern relights in normal warm gold
- AI narrates a quieter victory; the forest holds at bay but doesn't recede
- **Achievement**: "First Light"

**Option C — Recite the Order's prayer** (RP outcome — player types it or paraphrases)
- AI rewards with a small mechanical bonus (calls for a Persuasion or Religion check, success blesses the lantern with a +1 effect; failure → falls back to B)
- Demonstrates that RP input has real mechanical reach

**Option D — Player tries something unexpected** (e.g., casts Cure Wounds on the lantern, asks Brennar to do the prayer, etc.)
- AI improvises within engine constraints; usually falls back to Option B narratively
- Demonstrates AI flexibility + meta `((double parens))` if they want to chat with the GM

After lighting:

```
  🎲 GM
  Light pours from the lantern in a slow, even tide. The forest
  below pulls back from the village edge — not far, but enough.
  Brennar exhales for the first time in hours.
  
  "Marlowe would have wanted you to keep his flint. He'd have wanted
  someone besides us to remember him."
  
  ⚒ Plot hook "The Lantern's Last Flicker" — RESOLVED
  ⚒ Faction "The Order of the Last Lantern" — first reference noted
  ⚒ Reputation with Last Light Hollow: +Honored
  ⚒ XP awarded: 250 ea
  ⚒ You leveled up! (You can review the level-up in your sheet.)
  
  [Continue ▶]
```

Tooltip (level-up):
```
┌── Mira leveled up. ──────────────────────────────────────┐
│ In a normal campaign you'd open the Level Up Wizard to   │
│ pick new features. We'll skip that for the tutorial —   │
│ but it lives on your character sheet anytime you're     │
│ ready to advance.                                        │
│                                       [Got it]           │
└──────────────────────────────────────────────────────────┘
```

Then **Memory & Retcon demo** (one organic beat):

After the resolution, the AI narration says:

```
  🎲 GM
  Lily is waiting at the spire's base when you descend. She knows.
  She knew before you came down. She presses her father's key into
  your hand and refuses to take it back.
```

The chat shows a `📌 Pin to memory` action on the message. Tooltip:

```
┌── You can pin anything to memory. ───────────────────────┐
│ The AI uses pinned facts in future sessions to stay     │
│ consistent. Try pinning "Lily gave me her father's key." │
│                                       [Got it]           │
└──────────────────────────────────────────────────────────┘
```

Click pin → fact appears in the Memory panel pulse-glow. Done.

**Primary Feature**: narrative consequence + item use + multiple resolution paths + leveling + memory pinning + reputation
**Engine events**: `UseItemCommand`, `UpdateHookStatusCommand` (Resolved), `XpAwardedEvent`, `ReputationChangedEvent`, `PinMemoryCommand`, `LevelUpAvailableEvent`

---

### Scene 7 — Wrap & Handoff (~3 min)

**Setting**: Soft fade-out / fade-in. Mira and Brennar walk the road back to the tavern, lit by the relit lantern behind them.

**Player Experience**:

```
  ─── 📍 The Hollow's Edge · Dawn approaching ───
  
  🎲 GM
  The forest is dark, but it is only dark. Brennar walks beside you,
  staff tapping the wet road. He won't say goodbye, but he's already
  walking slower than he should.
  
  In the east, you can almost see morning.
  
  ⚒ Session 1 complete · Duration 27m 14s
  ⚒ Hooks resolved: 1 · XP earned: 700 · Reputation gained: 1
```

Full-screen graduation modal:

```
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                    The Lantern's Last Flicker                     ║
  ║                          ✦ COMPLETE ✦                              ║
  ║                                                                    ║
  ║                  [Achievement: First Light]                        ║
  ║                                                                    ║
  ║  In 27 minutes you used:                                           ║
  ║                                                                    ║
  ║  ✓ Live AI-GM narration         ✓ Skill checks with dice          ║
  ║  ✓ Inline chips for NPCs/items  ✓ Inventory + item use            ║
  ║  ✓ Always-on map + token        ✓ Spellcasting with concentration ║
  ║  ✓ Companion NPCs               ✓ Tier 4 combat with reactions    ║
  ║  ✓ Shop + purchase              ✓ Plot hook lifecycle             ║
  ║  ✓ Faction & reputation         ✓ Memory pinning                  ║
  ║  ✓ Engine-deterministic rules   ✓ Multiple outcome paths          ║
  ║                                                                    ║
  ║  Everything you just played is now in your Realms library and    ║
  ║  Campaigns list. You can re-explore it anytime.                   ║
  ║                                                                    ║
  ║  ┌─────────────────────────────────────────────────────────┐    ║
  ║  │                                                          │    ║
  ║  │   What's next?                                            │    ║
  ║  │                                                          │    ║
  ║  │   ▶ Create my own character (Creation Wizard)            │    ║
  ║  │                                                          │    ║
  ║  │   ⚒ Forge a brand new campaign (Quick Forge)             │    ║
  ║  │                                                          │    ║
  ║  │   📚 Browse the Codex (5E SRD reference)                │    ║
  ║  │                                                          │    ║
  ║  │   🏔 Explore my Realms library                          │    ║
  ║  │                                                          │    ║
  ║  │   ⌂ Just take me to Home                                 │    ║
  ║  │                                                          │    ║
  ║  └─────────────────────────────────────────────────────────┘    ║
  ║                                                                    ║
  ║   [↻ Replay the Tutorial]   [⤓ Share my Adventure Recap]          ║
  ║                                                                    ║
  ╚═══════════════════════════════════════════════════════════════════╝
```

The "Adventure Recap" share is an auto-generated 2-paragraph summary + the achievement badge + a screenshot of the relit lantern; sharable to social / link / image.

The four "what's next" options each guide into a different primary surface, completing the onboarding funnel.

**Primary Feature**: completion + graduation + sticky next-actions
**Engine events**: `SessionEndedEvent`, `AchievementUnlockedEvent`, `XpAwardedEvent`

---

## 4. Tooltip System Architecture

### 4.1 Trigger Model

Tooltips fire on **first observation** of a feature, scoped per user. Once dismissed, they never re-appear for that user (tracked in a `user_tutorial_seen_features` table).

```ts
type TooltipTrigger = {
  feature: FeatureId
  scope: 'global' | 'tutorial-only'
  condition: 'first_seen' | 'on_action' | 'after_delay_ms'
  delay?: number
  positionRef: UiElementRef        // anchored to a real UI element
  content: { title: string, body: string, cta?: string }
}
```

### 4.2 Tutorial-Only vs. Global Tooltips

Tooltips fall into two classes:
- **Tutorial-only** — only fire during the tutorial; richer copy, anchored, dismissable; never recur (e.g., "This is where the story unfolds.")
- **Global** — fire across the whole app on first encounter, including outside the tutorial (e.g., "You can drag tokens on the map.")

The tutorial uses ~15 tooltips. The rest of the app uses ~30 global ones. Tutorial-completed users skip *both* tutorial-only AND any global tooltip already triggered during play.

### 4.3 Dismissal & Recovery

Every tooltip has a `[Got it]` button. There's also a global `Settings → Reset all tutorial tooltips` toggle for users who want them back.

### 4.4 No-tooltip Mode

Power users can disable all tooltips via `Settings → Tutorial → "I know what I'm doing"` (set during Splash → Skip path). The tutorial itself still works if they later opt into it.

---

## 5. Skip Path

For users who hit `[Skip — Take me to character creation]`:

```
  ╔══════════════════════════════════════════════════════════════════╗
  ║  Skipping the Tutorial                                            ║
  ║                                                                    ║
  ║  We'll seed your account with:                                    ║
  ║   • An optional starter character (Mira Thornwood, Lvl 3 Ranger) ║
  ║     for testing — you can edit or delete her anytime.            ║
  ║   • The 5E SRD Codex (always available).                          ║
  ║   • An empty Smithy + Realms + Campaigns.                         ║
  ║                                                                    ║
  ║  First-time tooltips will still show as you encounter features.   ║
  ║                                                                    ║
  ║  [Drop Mira and start fresh]   [Keep Mira as a sandbox]           ║
  ║                                                                    ║
  ║                                          [Continue to Home →]      ║
  ╚══════════════════════════════════════════════════════════════════╝
```

Skipping is *frictionless*. No re-prompting; no "are you sure?" The product respects power users.

---

## 6. Replay Path

The tutorial is always in the user's Campaigns list as `Tutorial · The Lantern's Last Flicker · Completed`. Opening it offers:

```
  ┌─ Tutorial Campaign ──────────────────────────────────────────┐
  │ The Lantern's Last Flicker · Completed 3 days ago           │
  │                                                                │
  │ [↻ Replay from start]   [Continue from save]   [View Recap]  │
  │ [Browse the world in Realms]   [Open Sessions]   [Archive]   │
  └──────────────────────────────────────────────────────────────┘
```

`Replay from start`:
- Resets engine state for this campaign only
- Restores Mira to lvl 3 HP 27, inventory baseline, no plot hook accepted
- All tooltips will NOT re-fire (already-seen)
- All other progress (other campaigns, characters, Realms) is unaffected

`Continue from save`:
- Resumes where the user left off (e.g., if they ended after Scene 3)

This pattern lets the tutorial serve as **permanent reference material** — a user 6 months in can replay Scene 5 to remember how reactions work, without messing with their actual campaigns.

---

## 7. "I'm Stuck" / Hint System

If the player is idle for >45 seconds in any scene, a soft hint chip appears:

```
  ┌─ 💡 Stuck? ─────────────────────────────────────────────┐
  │ Try: "I follow Brennar up the stairs."                  │
  │ Or click the bloody trail on the map.                   │
  │                                          [Dismiss]      │
  └────────────────────────────────────────────────────────┘
```

Hints are per-scene scripted (not LLM-generated — these need to be reliable). After 3 dismissed hints in one scene, the AI gently auto-progresses ("Brennar nudges your elbow. 'Up?'").

---

## 8. Failure Modes & Fail-Forward

The tutorial is designed so the player **cannot lose**:

| Possible failure | Recovery |
|---|---|
| Mira dies in combat | Brennar stabilizes/heals; scripted near-death beat |
| Player skips combat (e.g., tries to run) | Shade pursues; combat happens at base of spire instead (same encounter, different backdrop) |
| Player attempts to leave village mid-tutorial | Brennar calls after them; soft rail back |
| Player tries to attack Barnaby or Brennar | AI deflects ("I'm not your enemy, friend. Put it down.") + Bar fight de-escalation; no engine combat |
| Player goes silent / AFK | Hint system + auto-progression after 3 dismissed hints |
| Player exits mid-tutorial | Session autosaves; resumable from `[Continue from save]` |
| Connection drops | Autosave + reconnect with state replay |
| LLM call fails | Tutorial uses cached pre-canned responses for narration backbone; LLM only used for player-response interpretation |

Critical: the tutorial's narration is **mostly pre-written** with LLM only handling the variable response paths. This keeps quality consistent + makes the tutorial demoable in air-gapped environments + lowers LLM cost for high-volume onboarding.

---

## 9. Edge Cases

### 9.1 Mobile

The tutorial runs on mobile in the same 5-zone layout that collapses to bottom-tab navigation (per Live Play Surface §"Mobile Experience"). The dice and reaction prompts use full-screen modals on mobile to avoid mis-taps. Tooltips reposition based on viewport.

### 9.2 Accessibility

- All tooltips are screen-reader-friendly (`role="dialog"`, `aria-describedby`)
- All chat entries have semantic roles
- Color choices for dispositions / chips meet WCAG AA
- Keyboard navigation: `Tab` cycles affordances, `Enter` rolls or sends, `Esc` dismisses
- The tutorial scenes work without sound (TTS is off by default)
- Combat tooltips include keyboard shortcuts: "Press 1 to attack with bow, 2 for swords, 3 for spell, ..."

### 9.3 Multiplayer Onboarding

The tutorial is **strictly solo**. If a user is invited to a multiplayer campaign before completing the tutorial:
- They see a prompt: *"Welcome! This is your first time. Would you like the 30-min tutorial first, or jump straight into [Campaign Name]?"*
- If they jump in, global tooltips fire as features appear, in-context
- They get a small chip at the top of the screen: *"📚 Want the tutorial? [Open]"* — persistent until dismissed once

### 9.4 First Solo Campaign After Tutorial

After tutorial completion, the user's first *non-tutorial* solo Campaign gets one final overlay tooltip:

```
┌── This is your campaign now. ────────────────────────────┐
│ The training wheels are off. The AI won't pull punches. │
│ Mira's safe in your library — but make your own hero    │
│ for this one.                                            │
│                                       [Got it]           │
└──────────────────────────────────────────────────────────┘
```

### 9.5 LLM Latency Spike During Tutorial

If LLM response time exceeds 5s mid-tutorial scene, a cinematic shim appears:
```
  🎲 GM is thinking… [animated lantern flicker]
```
Combined with the pre-canned narration backbone, the tutorial never feels broken even at degraded LLM availability.

---

## 10. Achievement Surfacing

Two achievements unlock during the tutorial:

| Achievement | Trigger | Visual |
|---|---|---|
| **First Steps** | Completed Scene 2 (accepted first hook) | Bronze medallion |
| **First Light** | Tutorial completion | Gold lantern medallion |

Achievements appear:
- In the graduation modal (Scene 7)
- In `Profile → Achievements`
- On shared session recaps

This isn't a heavy gamification layer — just two warm "I did this" moments. The full achievement system is out of v1 scope; these are tutorial-only.

---

## 11. Engineering Scope

### 11.1 Authoring Effort

| Component | Effort |
|---|---|
| Scripted scene state machine + branching rails | 2-3 engineer-weeks |
| Pre-canned narration content (writer + editor) | 1-2 writer-weeks |
| Pre-built Realms entities (Region, Settlement, 3 Buildings, Faction, Dungeon, 5 NPCs, 1 Plot Hook) | 1 designer-week (just content; tooling reused) |
| Pre-built Mira + Brennar character data | 0.5 designer-day |
| Custom monster (Hungering Shade) — uses existing engine, just stat block + visual | 0.5 engineer-day |
| Custom items (Oil of Brightness, Lantern, Flint, Scroll of Cure Wounds — last 3 are SRD) | 0.5 designer-day |
| Tooltip system (engine + render + dismissal tracking) | 1 engineer-week (used for global tooltips too) |
| Achievement system (minimal) | 3-5 engineer-days |
| Hint system + idle timer + auto-progression | 3-5 engineer-days |
| Graduation modal + recap share generator | 1 engineer-week |
| Replay-from-start (engine reset for one campaign) | 3-5 engineer-days |
| QA across all paths (each scene has 3-5 player-action paths × 7 scenes ≈ 25-30 paths) | 1-2 QA-weeks |
| Accessibility audit | 3-5 engineer-days |
| Voiceover / TTS-tutorial polish (deferred to v1.5) | 0 in v1 |

**Total: ~8-10 engineer-weeks + 1-2 writer-weeks + 1-2 designer-weeks** for tutorial-specific work, assuming the rest of the app's primitives (engine, Realms entities, Combat, Map, etc.) are built. Most of the heavy lifting is *content*, not code.

### 11.2 Dependencies

The tutorial cannot ship before:
- ✅ Engine (Phase 1-3 of engine plan)
- ✅ Combat (Phase 2 of engine plan; needs Tier 4 sync for the demo)
- ✅ At least 3 SRD spells fully automated (Hunter's Mark, Cure Wounds, Sacred Flame)
- ✅ Live Play Surface (option #3)
- ✅ Realms library + Region/Settlement/Building/Faction/Dungeon/NPC entity types
- ✅ Plot Hook lifecycle (Campaign workspace)
- ✅ Shop minimal UX (inventory display + purchase flow)
- ✅ Memory panel + pinning
- ✅ Character HUD + inventory drawer

It's effectively a **gate on v1 launch readiness** — if the tutorial doesn't play smoothly end-to-end, the product isn't ready for public release.

### 11.3 Telemetry

The tutorial is the **single most important measurement surface** of the product. Track:
- Splash → start tutorial vs skip ratio
- Per-scene completion rate (where do people drop off?)
- Per-scene duration (which scenes drag?)
- Tooltip dismissal vs ignore rate
- Combat round count (is the encounter too long?)
- Item use rate (did people figure out inventory?)
- Hint trigger rate (where are people getting stuck?)
- Replay rate
- Tutorial → first-character-created funnel
- Tutorial → first-campaign-created funnel

These metrics drive iteration. Expect 3-6 months of post-launch tuning.

---

## 12. Future Tutorials (Out of v1 Scope)

A small library of "deep-dive tutorials" planned for v1.5+:
- **"The Smithy: Forging Your First Homebrew"** (15 min)
- **"Realms: Building a World from a Single Region"** (20 min)
- **"Multiplayer: Hosting Your First Live Session"** (10 min)
- **"The Level Up Wizard"** (10 min)
- **"Advanced Combat: Reactions, Concentration, and the Action Economy"** (20 min)

Each follows the same architecture: scripted micro-scenarios + first-time tooltips + replayable forever.

---

That's the tutorial. Hand-authored where it matters, AI-flexible where it shines, ~30 minutes from cold start to graduation, demonstrates every primary feature through play instead of explanation, fails forward, ships as a permanent reference fixture in the user's account.