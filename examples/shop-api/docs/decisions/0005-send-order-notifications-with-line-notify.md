---
status: superseded
date: 2024-09-02
deciders: [Bank]
superseded_by: [7]
areas:
  - src/notifications/**
---

# Send order notifications with LINE Notify

## Context

Shop owners want a message on their phone when an order comes in.

## Decision

Use LINE Notify. Each shop owner connects their account once and we store the token.

## Consequences

- Very little code.
- We depend on a free service with no SLA.
