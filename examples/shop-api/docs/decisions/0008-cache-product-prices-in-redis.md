---
status: deprecated
date: 2026-05-18
deciders: [Ploy]
areas:
  - src/catalog/**
tags: [cache]
---

# Cache product prices in Redis

## Context

Catalog pages were slow, so we cached prices in Redis for 10 minutes.

## Decision

Deprecated in May 2026. A price change took up to 10 minutes to reach checkout and we charged a few customers the old price. Checkout now reads prices from the database. The cache is only used for the admin "recently viewed" widget and will be removed.

## Consequences

- Checkout is about 15 ms slower.
- Anyone touching `src/catalog` should not bring the cache back into the checkout path.
