---
status: accepted
date: 2026-10-02
deciders: [nuttakulsv]
areas:
  - src/decision.ts
  - src/repo.ts
---

# Number and title come from the file name and heading

## Context

A decision needs a number and a title. They can live in the frontmatter, in the file name and first heading, or in both. Existing records written with adr-tools, log4brains or MADR already put the number in the file name and the title in the first heading.

## Options

| | Frontmatter `id` and `title` | File name and heading | Both |
|---|---|---|---|
| Works with existing adr-tools/MADR files | no, needs migration | yes | yes |
| Single source of truth | yes | yes | no, they can drift |
| Readable on GitHub without tools | heading may be missing | yes | yes |
| Renaming changes the number | no | yes | no |

## Decision

The number is the leading digits of the file name and the title is the first `#` heading. `id` and `title` are accepted in the frontmatter for files that already have them, and `check` reports when they disagree with the file.

## Consequences

- Good: thousands of existing records work without changes, and the file reads well on GitHub.
- Bad: renaming a file renumbers the decision. `check` catches the duplicates and broken `supersedes` links that follow.
