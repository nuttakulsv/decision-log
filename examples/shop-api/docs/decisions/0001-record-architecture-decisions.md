---
status: accepted
date: 2024-05-06
deciders: [Ploy, Arm]
---

# Record architecture decisions

## Context

The shop API grew from two developers to seven in a year. Questions like "why is money an integer?" kept coming back in code review, and the answer usually lived in someone's memory.

## Decision

We keep decisions in `docs/decisions`, one Markdown file each, created with `decision-log new`. A decision that constrains a part of the code lists it in `areas`, so it shows up on pull requests that change that part.

## Consequences

- New people can read the history instead of asking.
- Writing a record takes ten minutes. We only do it for choices that are expensive to undo.
