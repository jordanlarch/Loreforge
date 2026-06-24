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

## 6. Supabase migrations

When the branch adds files under `packages/db/drizzle/` or `supabase/migrations/`:

1. List pending migrations vs what prod has
2. Apply via the project's migration path (Drizzle push / Supabase CLI — whichever this repo uses)
3. Note in the PR or handoff if prod still needs manual apply

**This hotfix had no DB migration.** Skip when no schema changes.

## 7. Update docs (when applicable)

| Doc | When to update |
|-----|----------------|
| `docs/deferrals.md` | Shipped a deferred item → mark row **Done** with PR ref; new deferral → add row |
| `CONTEXT.md` | Milestone/phase status changed, major surface shipped, or current status paragraph is stale |
| `AGENTS.md` | Only if architectural/process rules changed |

Do not scatter deferrals outside `deferrals.md`.

## 8. Tell the user what to verify

After merge, give concrete manual verification steps (URLs, flows, env vars if any).

## Quick reference — Jordan's environment

- OS: Windows / PowerShell (use `;` not `&&`)
- Package manager: **npm** (not pnpm)
- GitHub: `gh` CLI
- Workspace: `C:\Users\Jordan\Desktop\Projects\Python Projects\Loreforge`
