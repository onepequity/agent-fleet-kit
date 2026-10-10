# Worktrees: one task, one checkout

Several agents working in one checkout will overwrite each other's files, stage
each other's changes, and rebase out from under each other. Give every task its
own `git worktree` instead. Worktrees share one object store, so they are cheap.

## Naming

| Thing | Pattern | Example |
| --- | --- | --- |
| Task slug | short kebab-case | `fix-login-redirect` |
| Worktree directory | `../<repo>-<agent>-<slug>` | `../shop-api-engineer-fix-login-redirect` |
| Branch | `<agent>/<slug>` | `engineer/fix-login-redirect` |

The directory name tells a human, at a glance, which repo, which agent, and
which task. The branch name makes `git branch` output just as readable.
Reviews use the same pattern with the agent slot set to the reviewer, for
example `../shop-api-reviewer-pr-42`.

## Lifecycle

```bash
# Start
git fetch origin
git worktree add ../shop-api-engineer-fix-login-redirect \
  -b engineer/fix-login-redirect origin/dev
cd ../shop-api-engineer-fix-login-redirect
node scripts/check-worktree-integrity.mjs   # stop if this fails

# Work, commit (hooks run here), push the branch, open a PR against dev.

# Finish, after the PR merges
cd ../shop-api
git worktree remove ../shop-api-engineer-fix-login-redirect
git branch -d engineer/fix-login-redirect

# Housekeeping
git worktree list
git worktree prune
```

## Rules

1. **One task per worktree.** A second task means a second worktree.
2. **Never edit another agent's worktree.** Read it if you must; do not write.
3. **Never work in the primary checkout** for task work. It tracks `dev` and
   stays clean so anyone can create new worktrees from it.
4. **Check integrity first.** `scripts/check-worktree-integrity.mjs` catches
   worktrees where a crash, a bad sync, or disk cleanup deleted tracked files.
   Committing in that state records mass deletions. If the check fails, report
   Blocked and recreate the worktree.
5. **Rebase only your own branch**, and only before review starts. After review
   starts, merge `dev` in instead so reviewers keep their place.
6. **Remove the worktree when the PR merges.** Stale worktrees pin old branches
   and confuse the next agent.

## Integrity check options

```bash
node scripts/check-worktree-integrity.mjs                       # defaults
node scripts/check-worktree-integrity.mjs --critical=src,docs   # require these dirs
node scripts/check-worktree-integrity.mjs --max-missing=0       # strict mode
node scripts/check-worktree-integrity.mjs --branch-pattern='^[a-z0-9-]+/[a-z0-9-]+$'
```

Exit codes: `0` healthy, `73` integrity failure, `2` usage or git error.
