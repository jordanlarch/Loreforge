# M5 "First Campaign" — Completion Plan

*Sequencing plan to finish **P4 / M5**. Companion to `docs/02-implementation-roadmap.md`
(phases + gates) and `docs/deferrals.md` (the canonical backlog — every row below cites a
deferral ID and, where mirrored, a GitHub issue). Written Jun 2026 after a per-surface code
review. This file sequences the **remaining** M5 work; it does not restate shipped slices.*

---

## 1. Where M5 stands

M5's definition of done (roadmap §4): **All 7 generators · Campaign workspace (9 tabs) ·
Live Play + always-on map · hook lifecycle.** Status from the code review:

| DoD pillar | State | Gap |
|---|---|---|
| All 7 generators | 6/7 rich | **Region** still on the thin schema (GENR-6). |
| Campaign workspace (9 tabs) | 4/9 built | Sessions, World Map, **Combat**, Notes, Settings are `StubTab`s (CAMP-6/7/8/9/10). |
| Live Play + map | substantial | Chat/HUD/combat/AoE/enemy-AI/reactions shipped (#57–#99, #104, #111). Missing: party rail (#100), top bar (#101), map upgrades (#102), scene transitions (#103), async affordances (#105). |
| Hook lifecycle | done | #59. |

**The one cross-milestone integration gap** (not just polish): every campaign's Live Play
seeds the hard-coded goblin-ambush fixture (`FIXTURE_BATTLE_COMMANDS`). The generators,
World tab, and dungeon/room encounter fields have **no path to the table** — M4's world and
M5's play are disconnected. Closing that seam is the highest-leverage M5 item and is the
spine the rest hangs off.

---

## 2. Principle: finish the spine, don't backfill old surfaces

The big deferral clusters on **M2/M3/M4 surfaces** — Home cinematic (HOME-*), Codex
category browsers (CODEX-*), Smithy deepening (SMITH-*), Realms detail polish
(REALM-2/3/5/6/7) — are correctly scheduled for **P2-deepen or P6 pre-beta polish**.
Pulling them forward now is exactly the scope creep the solo-plan risk table warns against.
They stay parked. The items below are the ones that are genuinely **M5 DoD or
closed-alpha-gating** and currently thin.

---

## 3. Workstream A — the M5 spine (do first)

Highest leverage; each closes a DoD pillar.

| Order | Slice | Deferral | Issue | Tracer scope |
|---|---|---|---|---|
| ~~**A1**~~ ✅ | **Combat tab + authored-encounter → Live seam** | CAMP-8 | #115 | **Shipped (#121).** `encounters` table + `campaigns.activeEncounterId`; Combat tab (catalog foe-roster builder) with **Run Now**; the WS server seeds `CampaignRoom` from the armed authored encounter instead of `FIXTURE_BATTLE_COMMANDS`. Removed the goblin-only wall; connects generators→play. |
| ~~**A2**~~ ✅ | **Rich Region generator** | GENR-6 | #116 | **Shipped.** Rich sectioned Region descriptor (Overview / Geography & Climate / Settlements & Sites group / Powers & Conflicts / Lore & Hooks); deepest cascade. All 7 descriptive types now richly sectioned. |
| ~~**A3**~~ ✅ | **Settings tab** | CAMP-10 | #117 | **Shipped.** GM persona + play-mode + art-style-lock persisted on the campaign (migration 0013); danger-zone delete (clears campaign-scoped dependents). |
| ~~**A4**~~ ✅ | **Notes tab** | CAMP-9 | #118 | **Shipped (#124).** `campaign_notes` table (title/body/`shared` flag; migration 0014); `notes` router (list/create/update/remove); Notes tab list + editor with DM-only/shared toggle; `campaigns.delete` clears notes. `@Entity` links + convert-to-hook + pin-to-memory deferred. **Workstream A spine complete.** |

**Deliberately deferred within A:** Sessions tab (CAMP-6) depends on the P5 memory tier
(recaps); World Map tab (CAMP-7) is a heavy pannable-canvas surface. Both are filed (see
§4) but sequenced after the alpha forcing functions unless a tutorial need pulls them in.

---

## 4. Workstream B — Live Play coverage (already ticketed)

Real M5 Live-Play gaps, lower leverage than A. Good once the spine is in.

| Order | Slice | Deferral | Issue |
|---|---|---|---|
| ~~B1~~ ✅ | Party rail (collapsed chips, hover mini-HUD) | PLAY-4 | #100 — **Shipped (#125).** Bottom rail of party-side chips (HP + action economy + active-turn pulse) with a hover mini-HUD, on pure `lib/live-party` helpers. Assist pulses + click-to-sheet deferred. |
| ~~B2~~ ✅ | Full top bar (scene breadcrumb, clocks, Pause, tools row) | PLAY-5 | #101 — **Shipped (#126).** Structured `live-top-bar`: breadcrumb, campaign+scene label, Live/Async chip, scene breadcrumb, real-time clock, client-side Pause, End turn/Reset, tools row. In-game clock, server pause freeze, named roster, and tool panels deferred. |
| B3 | Scene transitions (cross-fade, location banner, travel auto-forge stubs) | PLAY-8 | #103 |
| B4 | Map upgrades (zoom L0–L4, layer toggles, fog of war, text-move) | PLAY-7 | #102 |
| B5 | Async-play affordances (badge, Switch-to-Live prompt, resume banner) | PLAY-13 | #105 |
| B6 | Pacing controls remainder (round timers, initiative delay/hold) | PLAY-9 | #104 |

---

## 5. Workstream C — closed-alpha forcing functions (start a thin slice early)

These are **§7 closed-alpha gates** with long lead times that are currently Partial/Deferred.
Start thin slices now so they don't ambush M7.

| Slice | Deferral | Why early |
|---|---|---|
| Top-120 spell push + golden tests | ENG-2 | Alpha gate = 100% golden on the shipped set. Today's coverage (~5 registry spells + families) is also thin vs **M3's own DoD of "~30 T1 spells."** |
| LLM tool-adherence harness (>98% on fixtures) | ENG-6 | Hard alpha gate; no harness exists yet. |
| 6-client Tier-4 sync stress (P95 broadcast <500ms) | — | Alpha gate; never load-tested. |

---

## 6. Explicitly **not** in M5 (stay parked)

Home cinematic/marketing (HOME-1/2/3/4), Codex non-spell browsers + deep links
(CODEX-1/3/4/6), Smithy edit/search/copy-from-Codex/sandbox (SMITH-1/2/4/6/7), Realms
hero-strip/right-pane/map-preview/loader/bulk-ops (REALM-2/3/5/6/7), retcon UI (ENG-5),
QuickJS sandbox (ENG-4), TTS (PLAY-10), end-session + memory panel (PLAY-12, CAMP-13 — P5).
These are P2-deepen / P5 / P6 by the roadmap and remain so.

---

## 7. M5 exit criteria

- All 7 rich generators shipped (GENR-6 done).
- Campaign workspace: Combat + Settings + Notes tabs live (7/9 built; Sessions + World Map
  may trail into P5/late-P4 with a documented carve-out).
- An authored encounter can be built in the Combat tab and **Run Now** plays it in Live
  Play (no fixture dependency for real campaigns).
- Live Play has party rail + top bar (B1–B2) at minimum.
- A first thin slice of each §5 alpha forcing function exists (a top-120 batch with golden
  tests; a harness skeleton; one sync-stress run with numbers recorded).

---

*Last updated: Jun 2026.*
