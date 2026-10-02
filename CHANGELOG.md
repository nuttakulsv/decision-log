# Changelog

## 0.1.0 - 2026-10-02

First release.

- CLI: `init`, `new`, `list`, `status`, `supersede`, `check`, `affected`, `site`, `migrate`.
- Frontmatter format with `areas` globs that link a decision to the code it governs. Reads adr-tools, log4brains and MADR files as they are.
- Templates in English and Thai, based on MADR, with a trade-off table.
- `check` lints statuses, dates, numbering, supersede links, review dates and globs that no longer match any file.
- Self-contained static site with search and status/area filters.
- GitHub Action that keeps one comment on each pull request listing the decisions for the changed files, with an optional `fail-on-deprecated` check.
