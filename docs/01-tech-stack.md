# Tech Stack

*The application-layer technology choices for Loreforge. This document covers the framework, language, data layer, real-time sync, hosting, monitoring, and testing primitives. External data and AI services (LLMs, embeddings, TTS, image generation, map procedural libraries, SRD ingest) are covered separately in [`./data-sources.md`](./data-sources.md).*

> **Version policy**: this document deliberately does not pin specific package versions. `package.json` is the source of truth. Choices below name a major/family ("Next.js 14+", "Postgres 15+") only where a major shift would invalidate an architectural assumption. When upgrading across majors, check this doc first; if the rationale still holds, update the version and add a note in the migration section.

> **As-built status (Jun 2026).** Several "Choice" sections below name a planned library that is **not yet wired**. As actually shipped: **Next.js 15 + React 19 + tRPC 11 + Drizzle + Postgres/pgvector + Yjs/Hocuspocus + PixiJS** are all live; **Supabase Auth is the chosen auth (not "open", not Clerk)**; **Trigger.dev** is the jobs provider (Inngest/BullMQ rejected — no Redis/Upstash); styling is **Tailwind only — shadcn/ui + Radix are not installed**; client state uses **TanStack Query — Zustand is not installed**; tests are **Vitest only — Playwright is not installed**; the package set is `@app/engine`, `@app/db`, `@app/llm`, `@app/memory`, `@app/config`, `@app/ws-server` (**no `@app/ui`**) on **npm workspaces** (not pnpm). The not-yet-adopted picks remain reasonable future choices; treat them as planned, not present. `package.json` is the source of truth.

---

## 1. Frontend Framework — Next.js (App Router) + React + TypeScript

**Choice**: Next.js 14+ with the App Router, React 18+, TypeScript strict mode.

Next.js gives us the React Server Components model out of the box, file-based routing aligned with our URL surface (`/characters/[id]`, `/realms/[type]`, `/campaigns/[id]`, `/smithy`, `/codex`), and a single build pipeline for both static marketing pages (Home, Codex) and dynamic gameplay surfaces (Live Play Surface, Campaign Workspace). The App Router's streaming + suspense model maps cleanly to our LLM-streaming chat UI and lets us colocate server-only data fetching with the components that render it.

TypeScript is non-negotiable for an engine-driven product — every Command, EngineEvent, and entity schema in [`./engine/architecture.md`](./engine/architecture.md) is a discriminated union, and the type system is what prevents the AI orchestrator from emitting malformed tool calls before they ever reach the engine. Strict mode + `tsc --noEmit` in CI.

**Alternatives considered**: Remix (similarly capable but smaller ecosystem and less mature streaming story); SvelteKit (smaller bundle, but the React + shadcn ecosystem we want to lean on is locked to React); plain Vite + React Router (more flexible, but we'd reinvent the SSR/RSC story for marketing pages and lose Vercel's deployment integration).

## 2. UI Components — Tailwind CSS + shadcn/ui + Radix Primitives

**Choice**: Tailwind for utility styling, shadcn/ui as the copied-in component layer, Radix Primitives underneath for accessibility.

The dark-fantasy aesthetic in our UI specs (hex stats, glowing CTAs, parchment textures, modal-heavy flows) needs both a fast utility CSS layer and a battle-tested unstyled primitive layer. Tailwind covers the first; Radix covers the second (Dialog, Popover, Tooltip, DropdownMenu, Tabs, Accordion, ToggleGroup — all of which appear in the wizards, sheet view, and generator forms). shadcn/ui is the connective tissue: components are *copied into our repo* rather than imported as a versioned dependency, which means we can freely customize them to match the dark-fantasy theme without fighting upstream changes.

**Alternatives considered**: MUI / Mantine (heavier opinionated design language that fights our aesthetic); Chakra UI (good DX but less granular customization); fully bespoke component layer (too much engineering for v1 with no payoff over Radix). Headless UI was a close runner-up to Radix, but Radix has richer composable primitives.

## 3. Map Rendering — PixiJS

**Choice**: PixiJS 8+ for the canvas-based interactive map layer.

The map appears in three places: the always-on map zone in the Live Play Surface (Tier 4 combat with tokens, fog of war, range rings, AoE previews), the per-entity map widgets on Region / Settlement / Building / Dungeon detail pages, and the embedded battle-map editor. All of these need smooth pan/zoom at 60fps, sprite-based token rendering with hundreds of layers (terrain, tokens, fog, overlays, pings), and integration with player input events without forcing a React re-render per frame. WebGL via PixiJS is the right level of abstraction — high enough to avoid raw WebGL bookkeeping, low enough to hit our perf budget on mid-tier devices.

The hex map for Region maps and the dungeon Dyson-style maps both render through PixiJS using the procedural inputs from the map libraries documented in [`./data-sources.md`](./data-sources.md). The same canvas component handles both vector-style line maps and tactical grid maps; only the asset set differs.

**Alternatives considered**: Konva (good 2D canvas library, smaller community than PixiJS, less WebGL-mature); raw `<canvas>` + custom render loop (too much engineering); SVG-based rendering (fine for static dungeon maps, falls apart at Tier-4 combat scale with 20+ animated tokens); Three.js (overkill for 2D).

## 4. State Management — Zustand + TanStack Query

**Choice**: Zustand for client-only UI state, TanStack Query (React Query) for server state.

These solve different problems and we use both. Zustand handles ephemeral UI state: which tab is active, what's selected in a list, whether the inline edit toolbar is showing, the current draft of a form before save. Stores are small, composable, and don't require Provider wrappers — particularly important for the map canvas which lives outside the normal React tree.

TanStack Query handles everything that comes from the backend: characters, Realms entities, campaigns, sessions, the AI memory panel, engine projections. Its cache invalidation model maps cleanly to the event-sourced engine — when an `EngineEvent` arrives over the WebSocket, we invalidate the related queries and the UI updates automatically. The optimistic update pattern is what makes the Tier-4 combat UI feel instant even when the engine's command queue serializes on the server.

**Alternatives considered**: Redux Toolkit (too much boilerplate for our needs; we don't need time-travel debugging because the engine event log IS our time-travel mechanism); Jotai/Valtio (similar to Zustand, mostly preference; we picked Zustand for ecosystem maturity); SWR (fine, but TanStack Query's `useInfiniteQuery` and mutation lifecycle are richer for our needs); putting everything in TanStack Query (over-fetches; ephemeral UI state shouldn't round-trip).

## 5. API Layer — tRPC

**Choice**: tRPC v11+ on top of the Next.js API surface.

The engine's Command API is fundamentally a typed RPC — every Command has a schema, every result is structured. tRPC lets us express that contract once in TypeScript and have the client see the exact return type with no codegen step. Combined with TanStack Query (which tRPC wraps natively), every Command call from the UI is a fully-typed mutation with optimistic updates and automatic cache invalidation.

The same procedure registry serves the AI orchestrator: when the LLM emits a tool call, it routes through the same tRPC procedure that a UI button would call, with the same validators and the same event emissions. This single-surface property is critical — it's what lets us guarantee "the AI cannot do anything a player couldn't, and vice versa."

**Alternatives considered**: REST + OpenAPI (lots of boilerplate, codegen drift); GraphQL (over-engineered for a single-client product; subscriptions are nice but Yjs over WS covers our real-time needs better); Hono + Zod (clean, but we'd reinvent the React Query integration that tRPC gives us for free); raw Next.js API routes with manual types (works but loses type safety at the boundary).

## 6. Database — PostgreSQL + pgvector + Drizzle ORM

**Choice**: PostgreSQL 15+ with the `pgvector` extension; Drizzle ORM for the schema and queries.

Postgres is the obvious choice for the relational layer: characters, campaigns, sessions, Realms entities, engine event log, engine snapshots, engine command log. Drizzle gives us TypeScript-first schemas, migrations as code, and a query builder that doesn't fight the type system the way Prisma sometimes does. Drizzle's schema-as-types means the engine's projections can share types between the DB row and the in-memory representation.

`pgvector` is the same database with embedding columns added — used for RAG over campaign session history, Realms entities, and pinned memories (see [`./data-sources.md`](./data-sources.md) §6 for the embedding pipeline). Keeping vector storage in the primary Postgres avoids a separate vector DB hop, simplifies backups, and lets RAG queries JOIN against relational data (e.g., "find the top-5 most similar memories from this campaign that mention this NPC").

**Alternatives considered**: SQLite (great for dev, but our concurrency story for Tier-4 multiplayer plus Yjs persistence plus event log needs Postgres-level concurrency); MySQL (less mature JSONB and no `pgvector` equivalent); MongoDB (loose schema fights the engine's tight discriminated-union model); separate vector DB like Pinecone / Weaviate / Qdrant (extra ops surface, extra hop, no JOIN-against-relational story — we'd add one only if pgvector hits a scale wall, which is unlikely under our user counts); Prisma instead of Drizzle (heavier runtime, slower migrations, less TypeScript-native query builder).

## 7. Real-time Sync — Yjs over WebSocket

**Choice**: Yjs CRDT documents synced over a Node.js WebSocket server (likely the `y-websocket` server, possibly hosted via Hocuspocus).

Tier-4 multiplayer combat needs sub-200ms convergence on map state, token positions, HP changes, and condition icons across all party clients. Yjs gives us a battle-tested CRDT that handles offline-then-reconnect and concurrent edits without conflict UI. Per the engine architecture, the engine itself is server-authoritative — Yjs is purely a transport for projection diffs, not the source of truth for game state. That separation keeps the CRDT scope manageable (we sync render-state, not rules-state) and lets us re-hydrate the Yjs document at any time from a fresh engine projection.

The same WebSocket channel also carries `EngineEvent` notifications, reaction window prompts, and chat streaming, multiplexed via subprotocols.

**Alternatives considered**: Liveblocks (excellent DX but expensive at scale and adds vendor lock-in for a feature we can self-host); Automerge (similar CRDT story, smaller ecosystem); Socket.IO + custom OT (we'd reinvent the CRDT); Server-Sent Events only (one-way; bidirectional sync requires WS); WebRTC peer-to-peer (cool but the engine is server-authoritative so a hub-and-spoke model is the right topology).

## 8. Authentication — Supabase Auth ✅ (locked Jun 2026)

**Choice — locked to Supabase Auth.** (Originally "open" between Supabase Auth and Clerk.) Implemented via `@supabase/ssr` + `@supabase/supabase-js` with Next.js middleware gating; required env lives in `@app/config`. Clerk was not adopted.

Both give us email/password + OAuth (Google, Discord, GitHub at minimum) + session management + an SDK that integrates cleanly with Next.js middleware. Supabase wins on cost-of-ownership if we're already paying for Supabase Postgres; Clerk wins on the polished out-of-the-box UI and the user-management dashboard.

**Alternatives considered**: NextAuth/Auth.js (more configuration burden, no managed dashboard); rolling our own (no); Firebase Auth (would force Firebase elsewhere); WorkOS (overkill for consumer auth, designed for enterprise SSO).

Either way, **Discord OAuth must be supported** — our target users overlap heavily with the D&D Discord community, and lowering friction at signup matters.

## 9. Background Jobs — Trigger.dev

**Choice**: Trigger.dev (cloud) for durable background tasks.

Background jobs cover: long-running generation pipelines (Region generation cascades), embedding generation for new entities, art-pipeline image generation when AI-on-demand fires, scheduled session reminders, post-session recap generation, and engine snapshot creation. Most are minutes-scale and idempotent.

Trigger.dev is a managed, cloud-hosted job platform: task code lives in our repo (`apps/web/src/trigger/`) but **executes on Trigger.dev's infrastructure**, not inside our Vercel deployment. That property matters for us specifically — the heaviest jobs (multi-step generation cascades that chain several LLM and image calls) would otherwise fight Vercel's serverless function timeout. Running them on Trigger.dev removes the timeout ceiling, and there is no always-on worker process and no Redis to operate. It has a usable free tier for the solo pre-alpha period.

> **Decision change (Jun 2026):** This slot was previously "Inngest or BullMQ (open)," then locked to Inngest. Switched to **Trigger.dev** at the product owner's direction. Rationale: Trigger.dev is equally cloud-hosted (no server to babysit, satisfying the same ops-burden goal that ruled out BullMQ) while executing tasks on its own infra rather than inside our Vercel functions — a better fit for long-running generation cascades. This is a like-for-like managed-jobs swap; it does not affect any of the 19 architectural decisions in `00-consolidated-plan.md` beyond the provider name. The roadmap, product spec, consolidated plan, and CONTEXT have been updated to match.

**Alternatives considered**: **Inngest** (the prior choice — excellent DX and also cloud-hosted, but functions run inside our own Vercel serverless routes, so long jobs are bounded by the serverless timeout); **BullMQ** (self-hosted Redis-backed queue — rejected because it requires an always-on worker process and a Redis instance, i.e. exactly the standing infrastructure we want to avoid); Vercel Cron alone (only scheduled work, no event-driven jobs with retry); Temporal (heavyweight; designed for long-running workflows we don't really have); pg-boss (Postgres-backed queue, viable but still needs a worker we host).

> **Implementation status (Jun 2026):** **Six** Trigger.dev task files exist in `apps/web/src/trigger/`: (1) **nightly Open5e SRD ingest** (`ingest-spells.ts`, scheduled cron `0 8 * * *` — spells + creatures + items + backgrounds + feats + rules + character seed); (2) **durable Realms generation cascade** (`generate-cascade.ts`, D3); (3) **nightly re-embed** (`reembed-entities.ts`, scheduled cron `0 9 * * *`); (4) **runtime entity embed** (`embed-entity.ts`); (5) **session recap** (`generate-recap.ts`); (6) **health check** (`health-check.ts`). The v1 thin-schema cascade also runs synchronously inside the `realms.generate` tRPC mutation. Runtime task triggering needs the `tr_prod_` secret key (`docs/deferrals.md` INFRA-1); scheduled crons do not. Per-task wiring gotchas are in `docs/02-implementation-roadmap.md` §6 P1 "Trigger.dev wiring notes."

## 10. Hosting — Vercel + Supabase (most likely)

**Choice**: Vercel for the Next.js application + managed Postgres (Supabase). Tier-4 WebSocket server hosted separately (Railway) since Vercel's serverless model isn't ideal for long-lived connections. *(No managed Redis — BullMQ was rejected in favor of Trigger.dev (§9), so the "Upstash if we go BullMQ" path does not apply.)*

This split is the standard modern-web pattern: serverless edge for the request/response surface, dedicated VMs for stateful real-time. Both can autoscale; both have good free/dev tiers for the pre-launch period.

**Alternatives considered**: Railway or Fly.io for everything (more uniform, but Vercel's Next.js integration is meaningfully better than anyone else's); AWS (full control, much higher ops burden, not justified at our stage); Cloudflare Workers (great edge story, but Postgres + WebSocket needs land elsewhere anyway, so we don't gain much); self-hosting on a VPS (no thank you).

## 11. Monitoring — Sentry + PostHog

**Choice**: Sentry for error tracking and performance traces, PostHog for product analytics and feature flags.

Sentry catches uncaught exceptions client and server side, and its tracing surface gives us the per-request engine command latency we need to hit the P95 budgets in the engine architecture doc. PostHog handles product analytics (tutorial completion funnel, generator usage by type, time-to-first-character, retention cohorts) and feature flags (gated rollout of v1.5 features like image generation).

Both have generous free tiers. Both can be self-hosted later if data sovereignty becomes a concern.

**Alternatives considered**: Datadog (excellent but expensive for our stage); LogRocket (session replay is nice but adds privacy complications for D&D campaigns); Plausible / Fathom (privacy-focused web analytics but lack PostHog's feature-flag and event-funnel capabilities); rolling our own (no).

## 12. Testing — Vitest + Playwright

**Choice**: Vitest for unit and integration tests (engine, validators, projections, RPC procedures), Playwright for end-to-end browser tests (tutorial flow, character creation wizard, live play surface smoke tests).

Vitest is faster than Jest on our codebase shape (lots of small TypeScript files with discriminated unions), has native ESM support, and shares the Vite plugin ecosystem. The engine's golden replay tests, property-based tests (via fast-check), and per-spell test matrix all run under Vitest.

Playwright covers the surfaces where the integration of UI + engine + AI orchestrator is what matters: the tutorial adventure must play end-to-end without manual QA, and the live play surface must survive a synthetic combat encounter.

**Alternatives considered**: Jest (slower, ESM story is worse); Mocha+Chai (older, less DX); Cypress (Playwright is better for multi-tab and multi-browser scenarios); Storybook for component testing (we'll likely add Storybook later for visual regression, but it isn't critical for v1).

## 13. Sandboxed Scripting — QuickJS Isolate

**Choice**: QuickJS via a Node.js binding (e.g. `quickjs-emscripten`) for executing user-authored homebrew handlers in The Smithy.

Per the engine architecture doc §13, power-user homebrew can include scripted handlers for spells, items, and conditions. Those handlers must run inside a CPU- and memory-capped sandbox with no network access and a constrained read-only view of engine state. QuickJS is the industry-standard answer: small, embeddable, ES2020+ support, well-tested sandbox boundaries. The wrapper enforces the 50ms CPU cap and 10MB heap cap and exposes only the engine's constrained API.

**Alternatives considered**: VM2 / isolated-vm (deprecated / known sandbox escapes); WebAssembly with a custom DSL (much more engineering for marginal benefit); a Lua sandbox via Wasmoon (viable but we'd be exposing two scripting languages — JS for the rest of the app, Lua for homebrew — for no clear win); banning user scripts entirely (limits Smithy power-user appeal, but is the right fallback if QuickJS proves problematic).

---

## 14. External Services & Data Sources

The application stack above intentionally stops short of LLM providers, embedding models, TTS, image generation, procedural map libraries, and SRD content ingestion. Those are covered in [`./data-sources.md`](./data-sources.md). The short version: Anthropic Claude is primary for LLM-as-GM with OpenAI as fallback; OpenAI handles embeddings for RAG; ElevenLabs handles TTS with OpenAI as fallback; Flux/DALL-E 3 handle on-demand art generation (deferred to v1.5); rot-js / honeycomb-grid / d3-voronoi / custom Watabou-style ports cover procedural map geometry; SRD content ingests from **Open5e `srd-2024`** (PDF-first QA) with a planned migration to custom SRD 5.2 PDF parse post-GA.

### LLM generation package (`@app/llm`) + tool-calling contract — implemented

How we actually call the LLM in-app (built Jun 2026; design plan `realms_generator_pipeline_50e6bfcd`, D1–D11). `@app/llm` is a provider-agnostic package with an **injectable Anthropic client** + a provider/model registry (OpenAI fallback seam present but not wired — `docs/deferrals.md` GEN-3), and a **fake client** so all generation logic is unit-tested without network calls.

The contract enforces the non-negotiable Q12 lock (**the LLM never does math; the engine/zod owns mechanics**):

1. **One `emit_entity` tool** whose `input_schema` is **derived from the per-type zod schema** via a zod→JSON-Schema converter (`buildEmitEntityTool`). Single source of truth — the same schema validates manual `realms.create`.
2. **Forced tool use** — the model must return structured `data`, never prose-as-mechanics.
3. **Server-side re-validation** — the tool output is re-parsed through the same zod (`parseData`) before insert. **Generate→validate→insert is transactional**: on `parseData` failure the package re-prompts with the zod error (~2× retry, D9), then surfaces a clean failure and writes nothing.
4. **`generateEntity({prompt, schema, fields?})`** supports regenerating a **subset of fields** with existing values as context — one code path for whole-entity and per-section regenerate (D7).
5. **Cost observability** — every run writes a `generation_events` audit row (owner, type, mode, model, token usage, cost estimate, status) from day one (D8; see `product-spec.md` §5.1).

Grounding today is schema-driven (enums + min/max in the prompt) + a curated list of valid SRD species/class names; full pgvector RAG grounding is deferred (`docs/deferrals.md` GEN-4). Rich per-type schemas are deferred — the contract runs on thin `REALM_FIELDS` schemas for now (GEN-1).

---

## 15. Cross-Cutting Conventions

- **Module organization**: monorepo on **npm workspaces** — `apps/web` (Next.js) + `services/ws-server` + internal packages `@app/engine`, `@app/db`, `@app/llm`, `@app/memory`, `@app/config` wired through TypeScript path aliases. *(There is no `@app/ui` package — UI lives in `apps/web`; and the repo uses npm workspaces, not pnpm.)*
- **Code style**: Prettier + ESLint (typescript-eslint plugin) with a strict ruleset; no unused vars, no implicit any, exhaustive switch checking via `assertNever`.
- **Schema validation**: Zod everywhere at boundaries — tRPC procedures, LLM tool-call validation, form inputs, environment variables.
- **Environment management**: `.env` files for local development, platform env vars in production. All env vars validated through a Zod schema at boot — the app refuses to start with missing or malformed config.
- **Migrations**: Drizzle Kit for schema migrations; migrations always reversible and idempotent.
- **Secrets**: never in the repo. Use the hosting platform's secret manager (Vercel env vars, Supabase secrets).

---

## 16. Migration & Version Bump Notes

When upgrading any major (Next.js 14 → 15, React 18 → 19, etc.):
1. Read this doc's rationale for the choice; confirm the assumptions still hold.
2. Check the upstream migration guide.
3. Update `package.json`, run the migration codemods if any.
4. Run the full Vitest + Playwright suite.
5. Add a one-line entry below if the upgrade changed any assumption documented above.

(No entries yet — this doc is being written before the v0.1 setup phase.)
