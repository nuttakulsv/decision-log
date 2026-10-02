---
status: accepted
date: 2025-02-10
deciders: [Bank]
supersedes: [5]
areas:
  - src/notifications/**
---

# Send notifications with the LINE Messaging API

## Context

LINE Notify ended on 31 March 2025. ADR-0005 depends on it.

## Decision

Send notifications as push messages from the shop's LINE Official Account through the Messaging API.

## Consequences

- Good: supported product, richer messages.
- Bad: push messages have a monthly quota on the free plan, so we only notify for new orders.
