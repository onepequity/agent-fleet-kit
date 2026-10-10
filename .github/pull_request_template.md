## What and why

<!-- One or two sentences on what changed and the reason. Link the task or issue. -->

Task slug:
Author (human or agent persona):

## Risk class

- [ ] trivial
- [ ] standard
- [ ] security_sensitive (auth, input handling, queries, secrets, external input)
- [ ] user_facing (UI, live endpoint, page)
- [ ] gate_sensitive (hooks, workflows, build config, dependencies): needs human sign-off

## Verification

Fill these in from real runs. `skipped` with a reason is fine. A false check is not.

- [ ] Typecheck ran and passed (command and result below)
- [ ] Tests ran and passed (command, count, and result below)
- [ ] New or changed behavior has a test that failed before this change
- [ ] Every commit has a `Verification:` block that matches the evidence
- [ ] Ran the change for real (app, endpoint, or script), if user facing
- [ ] No secrets, tokens, `.env` files, or customer data in the diff
- [ ] Diff is limited to the task scope

```
Commands and results:

```

## Not verified

<!-- Anything you could not check and why. Write "none" if none. -->

## Reviewer notes

<!-- Where to start reading, tricky spots, follow-ups split into other tasks. -->
