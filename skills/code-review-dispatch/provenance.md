# Provenance: code-review-dispatch

## Origin

- Reason: reviews were inconsistent in depth. Small changes got heavy reviews,
  and some risky config changes got a quick glance because the general reviewer
  found nothing wrong with the code itself.
- Based on: whatever general review, security review, and QA commands your
  runtime ships. This skill orchestrates them and adds house rules.

## Changes

| Version | Change | Why | Evidence |
| --- | --- | --- | --- |
| 1.0.0 | Initial version with five risk classes and house rules | Standardize review depth | Routing evals added |

## Known limits

- Assumes CI results are available through `gh` or the PR page.
- Does not judge product fit; that stays with a human.
