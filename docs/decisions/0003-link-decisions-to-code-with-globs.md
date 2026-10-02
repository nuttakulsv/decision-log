---
status: accepted
date: 2026-10-02
deciders: [nuttakulsv]
areas:
  - src/affected.ts
  - src/check.ts
---

# Link decisions to code with globs in the decision file

## Context

To show a decision on a pull request, the tool has to know which files the decision is about. Records are written once and rarely opened again, so whatever links them to code has to be cheap to keep correct.

## Options

| | Mapping file (like CODEOWNERS) | `// ADR-0007` comments in code | `areas` globs in the decision |
|---|---|---|---|
| Where the scope lives | separate file | spread across the code | next to the reasoning |
| Reviewed with the decision | no | no | yes |
| Survives file moves | needs editing | yes | needs editing |
| Detects dead links | possible | hard | yes, globs that match nothing |

## Decision

Each decision lists glob patterns in `areas`. Matching uses picomatch with `dot: true`. `check` warns when a glob matches no tracked file, which is what usually happens after a refactor moves code.

## Consequences

- Good: the person who writes the decision also decides its scope, in the same review.
- Bad: globs are coarse. A decision about one function covers its whole file.
- To watch: if teams ask for function-level scope, revisit code comments as a second source.
