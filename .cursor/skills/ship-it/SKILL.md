---
name: ship-it
description: >-
  Loreforge post-implementation ship checklist: verify CI, commit, open/merge PR,
  apply Supabase migrations, update CONTEXT.md and deferrals.md. Use when the user
  asks to ship, merge, commit and PR, or finish implementation handoff.
---

# Ship It — Loreforge Post-Implementation Checklist

Run this checklist after implementation is code-complete and tests pass locally.
Do not skip steps; execute them in order.

## Master flow (every ship)

| Step | Section | Engine-only? | UI/workspace? |
|------|---------|--------------|---------------|
| 1. Local verify | §1 | Required | Required |
| 2. Commit | §2 | Required | Required |
| 3. Branch + open PR | §3 | Required | Required |
| 4. CI green | §4 | Required | Required |
| 5. Merge | §5 | Required | Required |
| 6. Migrations (if any) | §6 | If schema changed | If schema changed |
| 7. Docs (`deferrals`, `CONTEXT`) | §7 | When applicable | When applicable |
| 8. Prod verify | §8 | **Skip** (CI = verify) | **Required** (1–3 steps on prod) |
| 9. Handoff / next slice | §9 | After CI merge | After prod verify passes |

Never start the next slice until the verify bar for the current slice is met (§0).

| Slice type | Verify bar | Start next slice when… |
|------------|------------|-------------------------|
| **UI / workspace** (campaign tabs, Live Play chrome, generators UI, etc.) | **Prod verify** — 1–3 concrete steps on deployed prod (Vercel web + WS server if Live Play) | Checklist passes on prod (or Jordan explicitly defers) |
| **Engine-only** (spells, handlers, pure `@app/engine` helpers) | **CI + relevant unit tests** | CI green locally / on PR |
| **Engine + Live Play or tab** (WS seed, projection consumed by a tab, etc.) | **CI/tests + prod verify** for the user-visible part | Both pass |

**Strict rule:** never begin the next UI/workspace slice until the current one's prod verify is done.

## 1. Verify locally

```powershell
# From repo root — adjust paths if only one package changed
Set-Location packages/engine; npx vitest run
Set-Location ../../services/ws-server; npx vitest run
Set-Location ../../apps/web; npm test -- --run
Set-Location ../..; npm run typecheck
```

Fix failures before committing.

## 2. Commit

Follow the user's git commit rule:

- Run `git status`, `git diff`, `git log -5` in parallel first
- Never commit secrets (`.env`, credentials)
- Only commit when the user asked (this skill implies they did)
- PowerShell commit message: use a here-string (`git commit -m @"..."@`)

Message style: `type(scope): why` — focus on why, not a file list.

## 3. Branch + PR

- Feature/fix branch off `main` (not direct commits to `main` unless user says so)
- Push: `git push -u origin HEAD`
- Create PR with `gh pr create` and a Summary + Test plan body
- Return the PR URL to the user

## 4. CI gate before merge

```powershell
gh pr view <N> --json state,mergeable,mergeStateStatus,statusCheckRollup
```

If CI failed:

1. Read logs: `gh run view <run-id> --log-failed`
2. Fix on the same branch, commit, push
3. Re-check until green (or user explicitly overrides)

Merge only when CI is green unless the user explicitly accepts a broken merge.

## 5. Merge

```powershell
gh pr merge <N> --merge --delete-branch
git checkout main
git pull origin main
```

Use `--squash` only if the user or repo convention requests it.

## 6. Supabase migrations (required when schema changes)

When the branch adds files under `packages/db/migrations/`:

### 6a. Preflight — confirm env is wired

Migrations read from repo-root `.env.local` via `dotenv-cli`. **At least one** of these must be set:

- `DIRECT_URL` — **preferred** (Supabase session pooler / direct, port **5432**)
- `DATABASE_URL` — fallback (often transaction pooler port 6543; use only if migrate succeeds)

Verify without printing secrets:

```powershell
Set-Location packages/db
npx dotenv -e ../../.env.local -- node -e "console.log('ready', !!(process.env.DIRECT_URL||process.env.DATABASE_URL))"
```

If this prints `ready false`, add `DIRECT_URL` to `.env.local` (see `.env.example` § Supabase) before continuing.

### 6b. Apply pending migrations

```powershell
Set-Location packages/db
npm run migrate
```

This runs `drizzle-kit migrate` against the Postgres instance. New SQL files in `packages/db/migrations/` (e.g. `0023_character_library_visibility.sql`) are applied in journal order.

### 6c. Confirm + handoff

- Re-run the preflight if migrate failed (wrong port, password encoding, network).
- Tell the user which migration tags were applied and any manual follow-up.
- **Apply migrations after merge to prod Supabase**, not only locally — local `.env.local` may point at prod or a dev project; clarify which DB was migrated.

Skip this section entirely when the PR has **no** new files in `packages/db/migrations/`.

## 7. Update docs (when applicable)

| Doc | When to update |
|-----|----------------|
| `docs/deferrals.md` | Shipped a deferred item → mark row **Done** with PR ref; new deferral → add row |
| `docs/srd-feature-coverage-audit.md` | **Required** whenever `deferrals.md` §12 (`SRD-FID-*`) changes — flip matching rows/scorecard; bump **Last reconciled** |
| `CONTEXT.md` | Milestone/phase status changed, major surface shipped, or current status paragraph is stale |
| `AGENTS.md` | Only if architectural/process rules changed |

Do not scatter deferrals outside `deferrals.md`. **Keep §12 and `srd-feature-coverage-audit.md` in sync** — deferrals schedules work; the audit doc is the SRD-shaped coverage map.

## 8. Prod verify (UI/workspace slices — required; agent runs it)

After merge **and** deploy (Vercel for web; redeploy **ws-server** when Live Play behavior changed):

**Agent owns prod verify.** Do not ask Jordan to verify UI/workspace slices — run the checklist yourself on deployed prod (browser MCP or equivalent) and report pass/fail in the handoff.

**Agent rules:**
- When prod verify requires a ws-server deploy, the agent redeploys (Railway: `npx @railway/cli redeploy --from-source -y` from repo root with the linked `@app/ws-server` service) before browser verification — do not hand off redeploy to Jordan unless CLI auth is missing.
- If browser auth blocks verification (login wall), attempt once; if still blocked, report the blocker and the exact steps you could not run — do not substitute "please verify on prod" for doing the work.

**Steps:**
1. Write a **1–3 step** prod checklist (specific URL, tab, expected UI) in the PR body or handoff.
2. **Run every step on prod** after deploy lands; note pass/fail for each.
3. **Stop** — do not start the next slice until all steps pass (or Jordan explicitly defers).

**Engine-only slices:** skip this section unless the change affects Live Play or a workspace tab; CI green on the PR is sufficient.

## 9. Handoff after verify

Report what was verified on prod (URLs + outcomes). For UI/workspace slices, §8 must be complete before picking up the next slice. If step 6 was skipped because env was missing, note that new DB columns require `npm run migrate` in `packages/db` before the feature works — that is an infra reminder, not a substitute for prod verify.

## Quick reference — Jordan's environment

- OS: Windows / PowerShell (use `;` not `&&`)
- Package manager: **npm** (not pnpm)
- GitHub: `gh` CLI
- Workspace: `C:\Users\Jordan\Desktop\Projects\Python Projects\Loreforge`
- DB migrations: `packages/db` → `npm run migrate` (needs `DIRECT_URL` or `DATABASE_URL` in `.env.local`)
