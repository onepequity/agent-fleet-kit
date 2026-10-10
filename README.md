# agent-fleet-kit

A copy-paste template for running a disciplined fleet of AI engineering agents
from one seat. It packages the pieces that make a small team of coding agents
trustworthy: personas with clear lanes, shared operating standards, skills with
routing evals, review rules, git hooks, CI gates, and a worktree convention so
parallel agents never trample each other.

The pattern works with any agent runtime (OpenClaw, Claude Code, Codex, Cursor).
Nothing here depends on a specific vendor.

## Philosophy

1. **Specs, review rules, and CI gates the agents cannot talk past.** An agent
   saying "typecheck passes" is a claim. A hook that refuses the commit unless
   typecheck actually ran in the last two minutes is a guardrail. Every rule
   that matters is enforced by a machine, not by a persona's good intentions.
2. **Humans own decisions.** Agents own execution. Product direction, merges to
   production, scope changes, and anything irreversible belong to a person.
   Agents surface the decision as a narrow question and wait.
3. **Lanes, not crowds.** Each persona has an explicit "what I do" and "what I
   do NOT do" list. Overlap is where agents duplicate work or silently undo each
   other.
4. **Status you can trust.** Every work lane ends in Done, Blocked, Question, or
   FYI. No silent finishes, no "launched" for something that was only planned.
5. **One task, one worktree, one branch.** Parallel agents get isolated
   checkouts named `<repo>-<agent>-<slug>`, so a crash or a bad rebase in one
   lane cannot corrupt another.

## Quick start

```bash
# 1. Copy the kit into your repo (or start from it).
cp -r agent-fleet-kit/{personas,overlays,skills,docs,scripts,.githooks,.github} your-repo/
cp agent-fleet-kit/AGENTS.md.template your-repo/AGENTS.md

# 2. Point git at the hooks and set your real commands.
cd your-repo
git config core.hooksPath .githooks
$EDITOR .githooks/hooks.conf      # TYPECHECK_CMD, TEST_CMD, file patterns

# 3. Write your personas from the template.
cp personas/_TEMPLATE.SOUL.md personas/my-role.SOUL.md

# 4. Check skills and worktree health.
node scripts/check-skill-quality.mjs
node scripts/check-worktree-integrity.mjs

# 5. In GitHub branch protection for main, require the checks
#    "guard" and "gitleaks", and require a pull request.
```

Run the kit's own tests with `npm test` (Node 20 or newer, no dependencies).

## File map

| Path | Purpose |
| --- | --- |
| `AGENTS.md.template` | Repo-level instructions every agent reads first |
| `personas/_TEMPLATE.SOUL.md` | Persona template and frontmatter schema |
| `personas/engineer.SOUL.md` | Example: backend and infra engineer |
| `personas/app-builder.SOUL.md` | Example: product and app builder |
| `personas/reviewer.SOUL.md` | Example: code reviewer and release captain |
| `personas/OPERATING-STANDARDS.md` | Rules shared by every persona |
| `overlays/status-and-judgment.md` | Closeout format and judgment calls, layered on any persona |
| `skills/_TEMPLATE/` | Skill template: `SKILL.md`, `provenance.md`, `evals/routing.jsonl` |
| `skills/code-review-dispatch/` | Worked example: deciding and routing code review by risk |
| `skills/registry.yaml` | Index of skills: owner, risk, status, evals, review cadence |
| `docs/BRANCHING.md` | Trunk and release branch policy |
| `docs/WORKTREES.md` | One worktree per task, naming and cleanup |
| `.github/pull_request_template.md` | PR template with a verification checklist |
| `.github/workflows/secret-scan.yml` | gitleaks on every push and PR |
| `.github/workflows/guard-main-source.yml` | Blocks merges and pushes into main from non-release branches |
| `.githooks/pre-commit` | Secret scan, typecheck, staged and adjacent tests, writes evidence |
| `.githooks/commit-msg` | Requires a `Verification:` block backed by fresh evidence |
| `.githooks/hooks.conf` | Your project's commands and file patterns |
| `scripts/check-skill-quality.mjs` | Lints every skill's frontmatter, sections, provenance, and evals |
| `scripts/check-worktree-integrity.mjs` | Detects half-deleted or corrupted worktrees before work starts |

## How the pieces fit

```
human decision -> task with a slug -> agent persona picks it up
  -> new worktree <repo>-<agent>-<slug> on branch <agent>/<slug>
  -> skills loaded by trigger, bounded by risk_level
  -> pre-commit runs real checks and records evidence
  -> commit-msg refuses claims without evidence
  -> PR with verification checklist -> reviewer persona (code-review-dispatch)
  -> CI: secret scan + branch source guard -> human merges
```

## Adapting it

- Rename personas freely. Keep the frontmatter keys so tooling can read them.
- Keep the template skill passing `check-skill-quality`; it doubles as a fixture.
- If your trunk is not `dev`, set the repository variable
  `RELEASE_SOURCE_BRANCHES` (space separated, globs allowed) for the guard.
- Hooks can be bypassed with `--no-verify`. CI is the backstop, which is why the
  secret scan and branch guard also run server side.

## License

MIT. See `LICENSE`.
