---
status: accepted
date: 2026-10-02
deciders: [nuttakulsv]
areas:
  - src/action.ts
  - src/comment.ts
---

# Comment by default, fail only when asked

## Context

Teams adopt decision records slowly. A check that blocks merges on the first day gets switched off on the second.

## Options

| | Comment only | Fail on any match | Comment, fail on outdated decisions if enabled |
|---|---|---|---|
| Friction on day one | none | high | none |
| Catches work against a replaced decision | shown, not enforced | yes, plus noise | yes, when the team opts in |

## Decision

The Action always posts one comment and keeps it updated instead of adding new ones. It only fails the job when `fail-on-deprecated: true` is set and the pull request changes code governed by a superseded or deprecated decision without mentioning the current one. Editing the decision files in the same pull request also counts as acknowledging them.

## Consequences

- Good: safe to add to any repository.
- Bad: a team that never enables the flag only gets reminders.
