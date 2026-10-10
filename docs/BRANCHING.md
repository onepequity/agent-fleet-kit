# Branching policy

One invariant keeps production reproducible and rollbacks safe:

> **`dev` is always a superset of `main`.** Production runs `main`. Code never
> lands on `main` unless it already exists on `dev`.

## Branches

### `dev`: trunk

- Default branch. All feature work, refactors, and fixes land here first.
- Every agent task branch targets `dev`.
- CI must be green on `dev` before any release.

### `main`: production pointer

- Updated only by pull requests whose head branch is an allowed release source
  (default: `dev`). Enforced by `.github/workflows/guard-main-source.yml` and
  by branch protection.
- A human merges release PRs. Agents prepare them.
- Use merge commits for `dev` to `main`. Squash or rebase would rewrite commit
  identity and make containment hard to audit.
- After a release merge, back-merge `main` into `dev` right away so `dev` keeps
  the merge commit and the next release PR is not "behind".

### Task branches

- Branch from `origin/dev`, one branch per task, inside its own worktree
  (see `docs/WORKTREES.md`).
- Naming: `<agent>/<slug>`, for example `engineer/fix-login-redirect`.
  Humans can use `<type>/<slug>`, for example `feat/export-csv`.
- Open PRs against `dev`. Squash merge is fine for task branches.

### Emergency fixes

There is no hotfix lane into `main`. Make the smallest safe fix on a task
branch, merge it to `dev`, then release `dev` to `main`. The invariant is worth
more than the minutes a shortcut saves.

## Release flow

```
<agent>/<slug>  ->  PR  ->  dev    (CI, review)
                             |
                             v
                            PR  ->  main   (guard + human merge)
                                     |
                                     v
                            back-merge main -> dev
```

## Required repository settings

These live in GitHub settings, not in the repo.

For `main`:

- Require a pull request before merging, with at least one approval.
- Require status checks: `guard` (branch source guard) and `gitleaks` (secret scan),
  plus your normal CI.
- Require branches to be up to date before merging.
- Restrict who can push. Most accounts, including agent accounts, should never
  push to `main`.
- Block force pushes and deletion.

For `dev`:

- Require a pull request and green CI. Block force pushes.

Optional: set the repository variable `RELEASE_SOURCE_BRANCHES` (space
separated, globs allowed, for example `dev release/*`) to change which branches
may open PRs into `main`.

## When in doubt

- Unsure if it is urgent enough to skip `dev`? It is not.
- Unsure which branch to target? `dev`.
- The guard blocked a PR you think should pass? Do not bypass it. Ask a human
  and update this policy first.
