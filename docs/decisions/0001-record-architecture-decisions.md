---
status: accepted
date: 2026-10-02
deciders: [nuttakulsv]
---

# Record architecture decisions

## Context

A tool for decision records should keep its own. It is also the quickest way for a contributor to see why the code looks the way it does.

## Decision

The design choices of decision-log live in this folder and are written with decision-log itself. Each one lists the source files it governs in `areas`, and the decision-log Action comments on pull requests that change them.

## Consequences

- Every feature of the tool gets used on a real project before release.
- Pull requests to this repository show which design decision they touch.
