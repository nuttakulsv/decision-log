---
status: superseded
date: 2024-06-03
deciders: [Arm]
superseded_by: [6]
areas:
  - src/clients/**
---

# Call the stock service over REST

## Context

Orders need to reserve stock before payment. The stock team already exposes a JSON API.

## Decision

Use the existing REST endpoints with a 2 second timeout and no retries.

## Consequences

- Nothing new to deploy.
- No contract checks between the two services. Field renames break us at runtime.
