# Loreforge — Project Context

**Loreforge is a modern, AI-GM 5E SRD 5.2 web experience.** Humans play characters; an AI runs the world. Combines deterministic mechanical fidelity, cascading-stub worldbuilding, and an always-on visual map for solo and multiplayer 5E play.

## Status

**Design phase complete (19 architectural decisions locked).** Roadmap locked (May 2026). Engineering start: M0 = May 2026 (solo engineer).

**P0 Foundation complete (Jun 2026):** monorepo scaffolded, Supabase Auth gating verified (sign-up → email confirm → Home shell), engine + Codex tables migrated, Open5e ingest spike validated (25 spells), source on GitHub with green CI. See `docs/02-implementation-roadmap.md` §6 P0 for the deliverable checklist and the "P0 status" note.

**P1 complete (Jun 2026):** Engine **E1 skeleton** built in `packages/engine` (seeded deterministic dice, append-only event store, `WorldState` projection + rebuild, base entities, typed Command API + serialized per-campaign queue, 67 Vitest tests incl. golden replay) and exposed over tRPC (`engine` router). **Codex MVP** (`/codex` read-only SRD spells browser) and a **read-only character sheet** (`/characters/[id]` on fixture data) are live, plus a fleshed-out Home shell. The **full Open5e SRD spell ingest** now runs as a **scheduled nightly Trigger.dev job** (cron `0 8 * * *`, deployed to prod, project `proj_pywyqcovveavdmoqpzsg`) — the first real background job — so the Codex holds the full SRD 5.1 spell set (~319) instead of the 25-spell spike. Typecheck/lint/build + 67 tests green; CI green on `main`. Deferred to P2: Postgres-backed per-campaign event persistence (issue #2). See `docs/02-implementation-roadmap.md` §6 P1 and `docs/engine/architecture.md` §16 E1.

Milestone **M1 "Hello, Codex"** reached. **Next: P2 — Combat Core + Characters + Smithy** (milestones M2 "First character", M3 "First fight"); the remaining work is broken into GitHub issues #2–#16 (see the repo Issues and `docs/02-implementation-roadmap.md` §6 P2).

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
- **Auth**: Supabase Auth / Clerk
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
- **`docs/02-implementation-roadmap.md`** — v1 phased roadmap: milestones, dependency graph, beta gates, solo calendar (~28–34 months to GA)
- **`docs/01-tech-stack.md`** — application-layer technology choices with 1-2 paragraph rationale and alternatives per choice (frontend, components, maps, state, API, DB, sync, auth, jobs, hosting, monitoring, testing, sandboxing)
- **`docs/data-sources.md`** — external services and data sources: SRD content ingest, procedural map libraries, art generation pipeline, TTS providers, LLM providers, embeddings & RAG
- **`docs/product-spec.md`** — product-level concerns not covered elsewhere: target personas (5), success metrics (activation / engagement / quality / commercial), consolidated v1 out-of-scope list, and explicit assumptions
- **`docs/ui-flows/`** — per-surface UI specifications
  - `home.md` · `characters-dashboard.md` · `character-creation-wizard.md` · `level-up-wizard.md` · `character-view-inline-editing.md`
  - `codex.md` · `smithy.md`
  - `realms-library.md` · `campaigns-workspace.md` · `live-play-surface.md`
- **`docs/generators/forms-and-pages.md`** — the 7 worldbuilding generators (Region, Settlement, Building, Tavern, Shop, Dungeon, Faction): input forms, generation pipelines, output detail pages, cross-generator integration, engineering effort estimates
- **`docs/generators/samples/`** — sample generator outputs (one per generator type) preserved as reference artifacts
- **`docs/engine/architecture.md`** — the deterministic 5E rules engine: data model, event store, command API, effect system, full spell automation architecture, retcon mechanism, phased implementation plan. *Note: some sections (specific TypeScript signatures, the phased month-by-month plan, the test-strategy detail) are concrete proposals rather than fully-locked decisions; revisit before commitment.*
- **`docs/onboarding/tutorial-adventure.md`** — the 30-minute "Lantern's Last Flicker" onboarding micro-campaign (every primary feature demonstrated through play)

## Current Goal

**Begin P2 (Combat Core + Characters + Smithy)** per `docs/02-implementation-roadmap.md` §6 P2, toward **M2 "First character"**. Work is filed as GitHub issues #2–#16. Unblocked starting points (no blockers): **#2** persistent campaigns + Postgres-backed event store, **#3** persistent characters, **#4** Smithy MVP custom items. Engine specifics in `docs/engine/architecture.md` §16 E2.

**P0 and P1 are done** (see Status above). Trigger.dev is live (CLI authed; nightly ingest deployed to prod). Still deferred until needed: Vercel deploy (repo pushed, unblocked); Sentry/PostHog provisioning (env-gated stubs in place); the **`tr_prod_` runtime secret key** (only needed once the app triggers tasks at runtime, e.g. P3/P4 generation cascades — the nightly cron doesn't need it).

Roadmap and product locks live in `docs/02-implementation-roadmap.md` and `docs/product-spec.md` §5.

## Critical Risks (Acknowledged)

1. **Full SRD spell automation** is the single largest engineering subproject — ~4–6 engineer-months alone
2. **Tier 4 multiplayer + real-time sync infra** — ~6–8 weeks for the sync layer alone
3. **LLM cost per session** — $0.50–$3 each; needs usage-based pricing if commercial
4. **TTS latency** — pre-generate and cache aggressively
5. **Combined v1 scope** — realistic estimate is **12–18 months** with a small team to ship the full v1 as designed

## Repository

- **GitHub**: https://github.com/jordanlarch/Loreforge
- **Local**: `C:\Users\Jordan\Desktop\Projects\Python Projects\Loreforge`
- **Owner**: Jordan Larch (`@jordanlarch`)
