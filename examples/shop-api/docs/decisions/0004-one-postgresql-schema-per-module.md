---
status: accepted
date: 2024-08-12
deciders: [Ploy, Bank]
areas:
  - src/db/**
  - src/**/*.repository.ts
tags: [database, modular-monolith]
---

# One PostgreSQL schema per module

## Context

We run one database for the whole API. Modules started joining each other's tables directly, which makes it impossible to split a module out later.

## Options

| | Shared tables | Schema per module | Database per module |
|---|---|---|---|
| Effort to build | none | move tables, add grants | new instances, data sync |
| Cost to run | 1 instance | 1 instance | 1 instance per module |
| Keeps modules separate | no | yes, enforced by grants | yes |
| Reversibility | - | easy | hard |

## Decision

Each module owns a PostgreSQL schema (`orders`, `payments`, `catalog`). A module reads another module's data through that module's service, not its tables.

## Consequences

- Good: one instance to run and back up, but clear ownership.
- Bad: reports that join across modules need a read model.
- To watch: if a module needs its own scaling, this is where we split it out.
