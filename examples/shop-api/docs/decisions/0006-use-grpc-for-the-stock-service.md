---
status: accepted
date: 2025-01-20
deciders: [Arm, Ploy]
supersedes: [3]
areas:
  - src/clients/**
tags: [integration]
---

# Use gRPC for the stock service

## Context

Twice this year the stock team renamed a field and our REST client failed in production (see ADR-0003). They now publish protobuf definitions for every service.

## Options

| | Keep REST + contract tests | gRPC with shared protos |
|---|---|---|
| Effort to build | write Pact tests | generate client, change transport |
| Breaking changes caught | in CI, if tests exist | at compile time |
| Debugging | curl works | needs grpcurl |

## Decision

Call the stock service with the generated gRPC client. Keep timeouts at 2 seconds and retry reservations once with the same idempotency key.

## Consequences

- Good: renames fail the build instead of production.
- Bad: one more toolchain step and harder manual debugging.
