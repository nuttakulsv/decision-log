---
status: accepted
date: 2026-10-02
deciders: [nuttakulsv]
areas:
  - action.yml
  - action/**
  - src/action.ts
  - src/action-main.ts
  - tsup.config.ts
---

# Ship the GitHub Action as a committed single-file bundle

## Context

The Action runs on every pull request in every repository that uses it, so start-up time and supply chain matter more than for the CLI.

## Options

| | Composite action running `npx decision-log-cli` | Docker action | JavaScript action with a committed bundle |
|---|---|---|---|
| Start-up time | npm download on every run | image pull or build | none |
| Version pinned by the tag | only if the tag also pins npm | yes | yes |
| Runner support | all | Linux only | all |
| Cost for maintainers | none | Dockerfile | bundle must be rebuilt and committed |

## Decision

`action/index.cjs` is built from `src/` by `npm run build` with all dependencies inlined, committed, and referenced from `action.yml` with `using: node24`. CI rebuilds it and fails if the committed file differs.

## Consequences

- Good: the Action starts in well under a second and runs exactly the code at the tag.
- Bad: a generated file in git. Pull requests that change `src/` must include the rebuilt bundle.
