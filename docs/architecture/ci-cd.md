# CI / CD Pipeline

> Status: Living doc — update when the workflow or deploy contract changes.
> Last updated: 2026-07-18

This is the reference for how DiceTable builds, gates, and deploys. Read this before changing [.github/workflows/ci.yml](../../.github/workflows/ci.yml), the `engines.node` pin, or anything about the Vercel deploy path.

---

## TL;DR

- **One workflow, three jobs.** `ci` runs `npm ci → build → test → lint --max-warnings 0`. `deploy-preview` and `deploy-production` each declare `needs: ci`, so they cannot start unless `ci` passed. That `needs:` is the entire gating mechanism.
- **Branch model.** feature → PR → `develop` (Vercel preview / staging) → PR → `main` (Vercel production). `develop` is the default branch; after every merge to `main`, `backmerge.yml` fast-forwards `develop` automatically. See [branching.md](branching.md).
- **GitHub Actions is the only deploy authority.** Vercel's native Git auto-deploy is deliberately disabled, because it deploys independently of CI and cannot be gated on it.
- **Node 24 everywhere** via `engines.node` in `package.json` (local, CI, Vercel all agree).
- A red `ci` never deploys anything. A push to a feature branch / a PR only runs `ci` (no deploy).

## What is automated vs. manual

The workflow file, the `engines.node` pin, and the `.vercel/` gitignore entry are committed and need no further action. Everything below requires repo-admin or Vercel-admin access and must be done by a human once. The deploy jobs fail until steps 1–3 are done; `ci` works immediately and independently.

---

## One-time setup

### Step 1 — Vercel IDs and token

On a local machine, from the project root:

```powershell
npm i -g vercel
vercel login          # opens a browser
vercel link           # writes .vercel/project.json (gitignored)
Get-Content .vercel/project.json
```

`project.json` contains `orgId` and `projectId`. Then create an access token at
https://vercel.com/account/tokens → **Create Token** (name it e.g. `dicetable-gh-actions`,
set an expiration you'll rotate). Copy it immediately — shown once.

### Step 2 — GitHub repository secrets

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**.
Names must match the workflow exactly:

| Secret name | Value |
|---|---|
| `VERCEL_TOKEN` | token from Step 1 |
| `VERCEL_ORG_ID` | `orgId` from `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | `projectId` from `.vercel/project.json` |

### Step 3 — Disable Vercel native Git auto-deploy (load-bearing)

Vercel → project → **Settings → Git**. Prefer **Disconnect** the Git repo (Actions still
deploys via token). If you must keep the connection, set **Ignored Build Step** to `exit 0`
so Vercel always skips its own build. Skipping this step means Vercel double-deploys on
every push regardless of CI — the gate becomes meaningless.

### Step 4 — Reserve the staging alias

Vercel → project → **Settings → Domains → Add Domain** → `dicetable-staging.vercel.app`.
Must be globally unique on `vercel.app`. If taken, choose another and update the single
`vercel alias set` literal in [.github/workflows/ci.yml](../../.github/workflows/ci.yml).
Until the domain exists, `deploy-preview` succeeds but the alias step fails; the per-deploy
URL still works as a fallback.

### Step 5 — Branch protection

GitHub → **Settings → Branches**. Protect `main`: require the **`ci`** status check to pass
before merging, require a PR before merging, and allow only the **merge commit** method for
PRs into it (the back-merge in [branching.md](branching.md) depends on this). The `ci` check
is only selectable *after* it has run at least once (see Bootstrap). `develop` is also
protected against direct pushes; the back-merge workflow gets through because it pushes
with a write deploy key (`BACKMERGE_SSH_KEY` secret) and **Deploy keys** is on the bypass
list of `develop`'s ruleset. Personal-account rulesets cannot add the GitHub Actions app
as a bypass actor, which is why the deploy key exists at all. Rotating it means: new
keypair, replace the deploy key and the secret, done.

---

## Bootstrap and verification

The `ci` check has no history until the workflow runs once, and enabling required-status-check
protection before that first run can block the very first merge. So:

1. Push these changes on a branch and open a PR into `develop`. Confirm **CI / ci** appears
   and goes green. Only `ci` runs on a PR — no deploy.
2. Now finish Step 5 (the `ci` check is selectable).
3. Merge into `develop` → `ci` runs, then `deploy-preview`; the job summary prints the
   staging URL.
4. PR `develop` → `main` and merge → `ci`, then `deploy-production`.

**Gate sanity check:** push a deliberately failing test to `develop`, confirm `deploy-preview`
does not start (skipped — `needs: ci` unmet), then revert. Do not leave that commit.

---

## Operational notes

- `vercel build` runs inside the deploy job, separate from the `ci` build. That is
  intentional: the deployed artifact is the one Vercel built, and `ci` has already proven
  the build is sound. Not worth sharing artifacts between jobs at this scale.
- `concurrency: ci-${{ github.ref }}` with `cancel-in-progress` means a newer push to the
  same ref cancels an in-flight run.
- The chunk-size warning is a Vite warning, not an error — `npm run build` exits 0
  and `ci` stays green. If the build ever needs to *fail* on bundle size, that is a separate
  deliberate change.
- `lint --max-warnings 0` means any future warning-only ESLint rule fails CI by design.
