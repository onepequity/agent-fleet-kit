---
name: _TEMPLATE
version: 0.1.0
description: One sentence saying what this skill does and when to load it. Lead with the trigger situation.
triggers:
  - "a phrase a human or agent would actually say"
  - "another distinct phrase for a different branch of the skill"
tools:
  - git
risk_level: low
mutating: false
personas: all
owner: reviewer
---

# Skill name

<!-- Frontmatter reference
name        kebab-case, must match the directory name
version     semver; bump minor for behavior changes, major for contract changes
description under ~160 characters; the router reads this first
triggers    real phrases, one per distinct use; these feed evals/routing.jsonl
tools       every tool or command the skill may call; nothing outside this list
risk_level  low (read only), medium (writes inside the worktree), high (anything
            outside the worktree: shared environments, external services, data)
mutating    true if the skill changes files, state, or external systems
personas    "all" or a list of persona slugs allowed to load it
owner       persona responsible for keeping the skill accurate
-->

## Contract

What the skill guarantees when it finishes, in two or three sentences. Include
what it must never claim (for example, never claim tests passed unless they ran).

## When not to use

- A situation that looks similar but belongs to a different skill or persona.

## Workflow

1. A concrete step, ending in something you can check.
2. A concrete step, ending in something you can check.
3. Report using the output format below.

## Output Format

```yaml
status: done | blocked | question
summary:
evidence:
  - command:
    result:
not_verified:
next:
```

## Escalation

- Who to hand off to when the skill cannot finish, and what to include.
