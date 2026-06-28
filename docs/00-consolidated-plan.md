# Consolidated Plan — All Decisions Locked

## The product

**This is an AI-GM 5E SRD 5.2 experience.** Humans play characters; an AI runs the world. The seven generators (Buildings, Factions, Dungeons, Regions, Settlements, Taverns, Shops) are both **human worldbuilding tools** AND **the AI-GM's silent toolbox** for fleshing out content during play. The product's wedge against AI Dungeon, Friends & Fables, and others is **deterministic mechanical fidelity + cascading-stub worldbuilding + always-on visual map**.

## Navigation (final 6-item top bar)

```
[Logo] 5E SRD Adventure   Home  Characters  Campaigns  Codex  Smithy  Realms
                                                                [Search] [🔔] [Avatar]
```

## Information architecture by feature

| Surface | Purpose | Pattern |
|---|---|---|
| **Codex** | Official SRD 5.2 reference | (already designed) |
| **Smithy** | Your homebrew SRD rules content | (already designed) |
| **Realms** | Worldbuilding library (8 entity types: Regions, Settlements, Buildings, Taverns, Shops, Dungeons, Factions, NPCs) | Flat-by-type sidebar mirroring Codex + Grid/List/**Graph** view toggle + relationship panels in detail pages |
| **Campaigns** | Workspace per campaign (9 tabs) | Overview / Party / World / Hooks / Sessions / World Map / Combat / Notes / Settings |
| **Plot Hooks / Quests** | Campaign-scoped narrative state (not in Realms library) | Kanban-style: Suggested / Open / Active / Resolved / Abandoned. **Jun 2026:** unified **Quest** model locked (`docs/quests.md`); Realms embed `data.quests[]` templates; Live Play tease triggers Phase A shipped; campaign tab rename **Hooks → Quests** in Phase B. |

## Entity model

- **NPCs are first-class, auto-created** by every generator. Cascading auto-creation: any named sub-entity in a generator's output becomes a first-class stub with an **"Expand with Generator"** button. Stubs are useful as-is; expansion is pre-context-filled from parent.
- Suggested plot hooks stay embedded on Realms entities until **accepted** into a Campaign, where they become first-class Campaign-scoped Hook entities.

## Generator UX

- **Input**: Single-page form (4–9 fields, char-gen.com style). One Generate button.
- **Output**: Inline-editable detail page reusing Character View patterns (tabbed, autosave, undo, floating toolbar).
- **Per-section Regenerate** on every output block.
- **Reset to Generated** mirrors Smithy's "Reset to SRD".

## Maps (procedural-first, always-on)

| Map type | Algorithm | Source |
|---|---|---|
| Campaign World Map | Voronoi + custom layering | d3-voronoi, custom |
| Region | Hex grid + biome paint | honeycomb-grid + custom |
| Settlement | Medieval city procgen | Custom port of Watabou patterns |
| Dungeon | Tree-growth + loop connections (Dyson-style) | rot-js + custom |
| Interior | Room grid + door placement | Custom (~200 LOC) |
| Battle | Grid overlay + token layer | PixiJS |

- Maps are **always visible above the chat log** during play; zoom out to broader context; tokens drag-and-drop or via text command to AI.
- **Frozen on first generation; then editable + stored as canonical asset.**
- AI-styled overlay (painterly skin) deferred to **v1.5**.
- Scene backdrop art deferred to **v1.5**.

## Tokens & portrait art

- Hybrid pipeline: instant library default (curated ~500 assets) + on-demand AI gen + user upload override.
- **Campaign-level art style lock** (e.g., "Ink illustration", "Anime", "Painterly") for visual coherence.
- Token state: `{x, y, mapId, disposition, visibility, facing, size}`.

## Campaign creation flow

- New Campaign → choose: **Quick Forge** (single prompt → AI cascades world in ~60s) / **Guided Setup** (sequential generators) / **Empty World** (build in Realms manually).
- Default landing on opening a campaign: **Overview** tab.

## AI-GM behavior

| Knob | Setting |
|---|---|
| **Mechanical fidelity** | Deterministic engine owns mechanics; LLM proposes via tool calls; LLM owns narration |
| **Engine scope** | Full SRD 5.2: HP/AC/checks/saves/attacks/damage/conditions/spell slots/action economy/initiative + spell-by-spell automation for ALL ~360 spells |
| **Memory** | Multi-tier: engine state (canonical) + hot context + rolling session summary + RAG vector store + auto-generated session recaps |
| **Player canon controls** | Visible Memory panel + pin facts + edit summaries + Retcon button on past sessions |
| **Failure recovery** | Event-log retcon (rewind to any point) + "talk to GM" meta override |
| **Pacing** | Per-campaign Pacing slider (Reactive ↔ Cinematic) + Continue/Hold + /skip time-jump command |
| **Persona** | Preset (Heroic/Gritty/Comedic/Horror/Mystery/Sandbox/RAW/Cinematic) that sets slider defaults + user fine-tunes (Lethality, Tone, RAW Strictness, Narrative Density, Pacing, Improv Aggression, Combat Realism, Adult Content) |
| **Generation timing** | Hybrid: pre-generated seed core + silent JIT cascading-stub expansion + background pre-fetch |

## Play model

- **Play surface**: Hybrid — text-chat backbone with always-on map above chat + character sheet in right rail + progressive visual panels (combat battle map unfolds during combat).
- **Player count**: Solo + multiplayer parties both supported.
- **Tempo**: Async default + opt-in Live Session Mode. Combat encounters auto-route to Live Mode.
- **Voice**: Text + optional TTS with per-NPC voices (ElevenLabs premium / OpenAI TTS default). STT/voice-input deferred to v1.5.

## Combat (Tier 4 — full real-time multiplayer)

- Encounter Builder: drag party + Codex monsters + Realms NPCs + custom combatants.
- CR-based difficulty estimate.
- Initiative tracker with HP, AC, conditions, dice roller.
- **Battle Map** with grid, tokens, drag-drop movement, basic line of sight (Tier 3 baseline required for Tier 4).
- **Real-time sync** via Yjs CRDT over WebSocket.
- Player rolls sync across clients; shared encounter log; presence indicators.
- AI runs monster turns via deterministic engine + LLM tool calls.

## Permission / multi-user model

- Single global user account per human (Supabase Auth / Clerk).
- Campaigns can be solo or shared (party invites via link/email).
- AI is always the GM — no human-DM permission tier.
- **Discovery**: Realms entities have per-campaign "Discovered by Party" state. Discovery happens *automatically when AI narrates* the entity. Players can also explicitly canon-seed via the Memory panel.
- "Secret" fields on entities are the AI's private knowledge; players see them only after AI reveals them in narration.

## Tech stack (approved wholesale)

- **Frontend**: Next.js 14+ App Router, React, Tailwind, shadcn/ui, Radix, PixiJS (maps)
- **State**: Zustand + React Query; engine state via WebSocket
- **Backend**: Node + tRPC (TypeScript end-to-end)
- **DB**: Postgres + pgvector
- **ORM**: Drizzle
- **Sync**: Yjs over WebSocket
- **Auth**: Supabase Auth / Clerk
- **LLM**: Anthropic Claude (Sonnet narration / Opus generation) + OpenAI fallback
- **Embeddings**: OpenAI text-embedding-3-large
- **TTS**: ElevenLabs / OpenAI TTS
- **Image gen**: Flux via Replicate/fal (v1.5)
- **Map libs**: rot-js, honeycomb-grid, d3-voronoi, custom Watabou-style ports
- **Storage**: S3-compatible (Supabase Storage / R2)
- **Hosting**: Vercel (frontend) + Railway/Fly.io (backend) + Supabase (DB/Auth/Storage)
- **Jobs**: Trigger.dev (async gen, recaps, embeddings) — was Inngest, swapped Jun 2026; see `01-tech-stack.md` §9
- **Monitoring**: Sentry + PostHog

## Data sources

- **SRD 5.2**: hybrid ingest — **Open5e `srd-2024`** for machine ingest; **official SRD 5.2.1 PDF** as canonical reference for names/mechanics; migrate to custom PDF parse post-GA. *(Amended Jun 2026: 5e-bits API removed from plan — 2014-only, never integrated.)*
- **Token art**: Open Game Art + commissioned starter pack (~500 assets) + community contributions
- **Map style**: Custom Dyson-style renderer (commercial-safe)
- **Names**: SRD-aligned + Watabou Fantasy Name Generator port

## Mobile

- Desktop-first; mobile is a degraded/responsive view (per your call).
- Mobile play view: vertical stack of Map / Chat / Sheet / Party with bottom-tab switcher.

## Onboarding

- First login: choice between **30-minute tutorial adventure** (pre-built character + micro-campaign that demos every primary feature) OR **fresh start**.
- Tutorial uses contextual tooltips on first encounter with each system.

## Realms ↔ Live Play integration

- **Realms is prep; Live Play is play.** World-tab entities (Region, Settlement, Building, Tavern, Shop, Dungeon) should be explorable via **map + chat** — not only a combat fixture on load.
- **Default campaign bootstrap:** open in the first World-tab tavern/settlement (or generic fallback), with GM opening narration — **no combat** until fiction requires it (armed encounter / Run Now, dungeon foes, travel hazards, social hostility, etc.).
- **Do not** spend further v1 effort on Ladder 3 campaign-tab polish (Overview/Hooks/Sessions depth) ahead of this integration ladder — see `docs/deferrals.md` (Rung 4).
- **Campaign UX (Jun 2026):** prep/play shells, map hierarchy, and tab IA are locked in `docs/ui-flows/unified-campaign-ux.md` (**CAMP-UX**). Global Realms nav unchanged; encounters stub-scoped; play layout = center map above chat with **Current | World** tabs.

---

## Critical risks I flagged that you accepted

1. **Full SRD spell automation (~360 spells) is the single largest engineering subproject** — ~4–6 engineer-months alone.
2. **Tier 4 multiplayer + real-time sync infra** — ~6–8 weeks for the sync layer alone.
3. **LLM cost per session** — $0.50–$3 each; needs usage-based pricing if commercial.
4. **TTS latency** — pre-generate and cache aggressively.
5. **Combined v1 scope** — realistic estimate is **12–18 months** to ship the full v1 as designed, with a small team. Worldbuilding-only Path 1 would have shipped in 2–3 months.
