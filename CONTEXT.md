# Loreforge — Project Context

**Loreforge is a modern, AI-GM 5E SRD 5.2 web experience.** Humans play characters; an AI runs the world. Combines deterministic mechanical fidelity, cascading-stub worldbuilding, and an always-on visual map for solo and multiplayer 5E play.

## Status

**Design phase complete (19 architectural decisions locked).** Roadmap locked (May 2026). Engineering started May 2026 (solo engineer).

**Code progress (Jun 2026): P0–P4 substantially complete; P5 (Tutorial + Memory) largely shipped early.** Milestones reached: **M1 Hello Codex, M2 First Character, M3 First Fight, M4 First World, M5 First Campaign (~complete at tracer depth), M6 Tutorial E2E (shipped).** Memory tier (MEM-1–MEM-8) is Done. **`docs/deferrals.md` is the single source of truth for everything deferred** (per-surface gaps, unbuilt generators, engine/infra items).

Highlights of what's built:
- **Engine (`packages/engine`, E1–E3):** seeded deterministic dice, append-only event store, `WorldState` projection + rebuild, typed Command API + serialized per-campaign queue, combat pipeline (conditions, action economy, initiative, movement/LOS, rests, concentration, OA reactions, weapon range enforcement), and a spell-cast pipeline with a growing spell registry + golden harness. **Per-campaign events persist to Postgres** (`engine_events` + `PgEventStore`; `engine.submit`/`state`). ~381 engine + ~159 ws-server tests.
- **Tier 4 multiplayer:** `@app/ws-server` Hocuspocus Yjs sync server (authoritative engine host) + PixiJS battle map with token drag/movement; persisted per-campaign live play. Owner-only rooms today (CAMP-14 invites pending).
- **Product surfaces:** Home shell, Codex (SRD spells, species/classes, backgrounds/feats, monsters/animals with preset filters, items), Characters (create/view/inline-edit/level-up slices), Smithy MVP (homebrew items + declarative spells), Realms (Grid/List/Graph + relationship panels + AI generator pipeline), Campaigns browser + **9-tab workspace** (7/9 built — World Map tab missing) + live play.
- **Realms AI generator pipeline:** `@app/llm` package, `generation_events` audit table, rich sectioned generators for all 7 types (Settlement tab depth partial), synchronous + Trigger.dev cascade routes, Advanced Form at `/realms/generate/[type]`.
- **Campaign workspace (M5 spine):** Overview, Party, World, Hooks, Sessions, Combat, Notes, Settings tabs shipped; authored encounter → Live Play seam (CAMP-8); hook lifecycle (CAMP-5); memory export + pins + recaps.
- **Live Play:** chat/HUD/combat overlay, real sheet weapons/spells, AoE targeting, enemy AI orchestrator, timed OA prompts + AI auto-reactions, readied actions, party rail, top bar, scene transitions, map zoom/layers, async affordances, pacing controls, tutorial E2E ("Lantern's Last Flicker").
- **Memory tier (P5):** rolling summaries, session recaps, pinned memories, RAG embed/search, live-turn context assembly — all shipped (MEM-1–8).
- **Background jobs:** nightly Open5e SRD ingest + character-options seed + nightly re-embed as scheduled Trigger.dev jobs; runtime task dispatch gated on `TRIGGER_SECRET_KEY` (INFRA-1 for prod/Vercel).

## What This Is

A web app at the intersection of:

- **AI Dungeon Master** — an LLM-driven GM that narrates, runs NPCs, and improvises
- **Roll20 / Foundry VTT** — real-time multiplayer with a battle map, tokens, and dice
- **D&D Beyond** — SRD reference, character sheets, level-up wizards
- **World Anvil / Char-Gen** — procedural worldbuilding generators (Regions, Settlements, Buildings, Taverns, Shops, Dungeons, Factions, NPCs)
- **A 5E rules engine** — deterministic mechanics for HP, AC, conditions, and all ~360 SRD spells

**The wedge**: a server-authoritative deterministic engine owns all mechanical state; the LLM proposes commands via tool calls and owns prose only. Mechanics are always faithful while narration stays fluid.

## Tech Stack (Approved Wholesale)

- **Frontend**: Next.js 14+ (App Router) · React · Tailwind · shadcn/ui · Radix · PixiJS (maps)
- **State**: Zustand · React Query · engine state via WebSocket
- **Backend**: Node + tRPC (TypeScript end-to-end)
- **DB**: Postgres + pgvector · Drizzle ORM
- **Sync**: Yjs CRDT over WebSocket
- **Auth**: Supabase Auth
- **LLM**: Anthropic Claude (Sonnet narration / Opus generation) + OpenAI fallback
- **Embeddings**: OpenAI `text-embedding-3-large`
- **TTS**: ElevenLabs / OpenAI TTS
- **Image gen** (v1.5): Flux via Replicate/fal
- **Map libs**: rot-js · honeycomb-grid · d3-voronoi · custom Watabou-style ports
- **Storage**: S3-compatible (Supabase Storage / R2)
- **Hosting**: Vercel (frontend) + Railway/Fly.io (backend) + Supabase (DB/Auth/Storage)
- **Jobs**: Trigger.dev (async generation, recaps, embeddings)
- **Monitoring**: Sentry + PostHog

Full rationale per-choice (with alternatives considered) in `docs/01-tech-stack.md`. External services and data sources (LLM providers, embeddings, TTS, image gen, SRD ingest, map libraries) in `docs/data-sources.md`. Locked decisions summarized in `docs/00-consolidated-plan.md`.

**Implemented packages of note:** `@app/engine` (deterministic 5E engine), `@app/ws-server` (Yjs/Hocuspocus sync), `@app/llm` (provider-agnostic LLM generation), `@app/db` (Drizzle schema + migrations + `PgEventStore`), `@app/config` (env validation), `@app/memory` (embeddings + RAG retrieval).

## Core Architecture

- **AI-GM model** — there is no human DM tier; the AI is the GM for every campaign
- **Deterministic rules engine** — server-authoritative; the LLM proposes commands via structured tool calls; engine validates, executes, and emits events; the LLM owns prose only
- **Event-sourced state** — every mutation is an immutable event; full replay, retcon, and audit log for free
- **Six top-level navigation** — Home / Characters / Campaigns / Codex / Smithy / Realms
- **Three content libraries** — **Codex** (official SRD 5.2 reference) · **Smithy** (your homebrew rules content) · **Realms** (your worldbuilding entities)
- **Always-on map** — current scene map is rendered above the chat during play; tokens dragged or moved via text command
- **Tier 4 multiplayer combat** — real-time sync via Yjs CRDT over WebSocket
- **Full SRD 5.2 spell automation** — all ~360 spells deterministically resolved (declarative schema + imperative escape hatch)
- **Hybrid play tempo** — async by default, with opt-in Live Session Mode (combat auto-routes to Live)
- **Cascading stub creation** — every generator emits child stubs (NPCs, child entities); higher-tier entities cascade automatically; child generators expand stubs

## Documentation Map

Read `docs/00-consolidated-plan.md` first. Then drill into whatever surface you need.

- **`docs/00-consolidated-plan.md`** — the 19 locked architectural decisions
- **`docs/deferrals.md`** — **single source of truth for all deferred/backlog items** (generator-pipeline deferrals, per-surface UI-flow gaps, unbuilt generators, engine/infra, v1.5+ cuts). Add new deferrals here.
- **`docs/02-implementation-roadmap.md`** — v1 phased roadmap: milestones, dependency graph, beta gates, solo calendar (~28–34 months to GA)
- **`docs/03-m5-completion-plan.md`** — M5 sequencing plan; Workstreams A/B/C all marked complete (Jun 2026)
- **`docs/01-tech-stack.md`** — application-layer technology choices with rationale and alternatives per choice
- **`docs/data-sources.md`** — external services and data sources
- **`docs/product-spec.md`** — personas, success metrics, v1 out-of-scope, assumptions
- **`docs/ui-flows/`** — per-surface UI specifications
- **`docs/generators/forms-and-pages.md`** — the 7 worldbuilding generators
- **`docs/generators/samples/`** — sample generator outputs
- **`docs/engine/architecture.md`** — the deterministic 5E rules engine
- **`docs/onboarding/tutorial-adventure.md`** — the "Lantern's Last Flicker" tutorial micro-campaign

## Current Goal

**M7 closed-alpha prep** per `docs/02-implementation-roadmap.md` §7. M5 DoD met at tracer/vertical-slice depth; M6 tutorial E2E shipped and verified.

**Active frontier** (all tracked in `docs/deferrals.md`):

| Priority | Item | ID |
|---|---|---|
| Combat polish | Multiattack in enemy AI | PLAY-15 |
| Combat polish | Reach-weapon OA provoke | ENG-10 |
| Alpha gate | Top-120 spell batch 3 | ENG-2 |
| Tier 4 promise | Multiplayer invites + seat auth | CAMP-14 |
| Workspace | World Map tab | CAMP-7 |
| Infra | Trigger `tr_prod_` on Vercel | INFRA-1 |
| Post-M6 | Real reputation system | REP-1 |

**Closed-alpha gates still open:** top-120 golden coverage (ENG-2 partial), LLM tool-adherence ≥98% (ENG-6 skeleton shipped), 6-client sync stress (ENG-7 harness shipped), tutorial E2E ✅, billing + 10 DM chats (M8).

**Branch:** `main`, clean. Package manager is **npm**.

Roadmap and product locks live in `docs/02-implementation-roadmap.md` and `docs/product-spec.md` §5.

## Critical Risks (Acknowledged)

1. **Full SRD spell automation** is the single largest engineering subproject — ~4–6 engineer-months alone
2. **Tier 4 multiplayer + real-time sync infra** — sync layer shipped; invite/seat auth still needed (CAMP-14)
3. **LLM cost per session** — $0.50–$3 each; needs usage-based pricing if commercial
4. **TTS latency** — pre-generate and cache aggressively
5. **Combined v1 scope** — realistic estimate is **12–18 months** with a small team to ship the full v1 as designed

## Repository

- **GitHub**: https://github.com/jordanlarch/Loreforge
- **Local**: `C:\Users\Jordan\Desktop\Projects\Python Projects\Loreforge`
- **Owner**: Jordan Larch (`@jordanlarch`)
