import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { migrateLegacy, parseDecision, refs, setFrontmatter } from '../src/decision.js'

const fixture = (name: string) => readFileSync(new URL(`fixtures/adr-tools/doc/adr/${name}`, import.meta.url), 'utf8')

describe('frontmatter files', () => {
  test('reads fields, number from the file name and title from the heading', () => {
    const d = parseDecision(
      'docs/decisions/0007-use-postgres.md',
      `---
status: Accepted
date: 2026-01-05
deciders: Ploy, Arm
areas:
  - src/orders/**
tags: [database]
supersedes: [3]
---

# Use PostgreSQL for orders

## Context
`,
    )
    expect(d).toMatchObject({
      id: 7,
      title: 'Use PostgreSQL for orders',
      status: 'accepted',
      date: '2026-01-05',
      deciders: ['Ploy', 'Arm'],
      areas: ['src/orders/**'],
      tags: ['database'],
      supersedes: [3],
      supersededBy: [],
      format: 'frontmatter',
      problems: [],
    })
    expect(d.body.startsWith('\n# Use PostgreSQL')).toBe(true)
  })

  test('understands MADR status "superseded by ADR-0012" and decision-makers', () => {
    const d = parseDecision(
      'docs/adr/0004-x.md',
      '---\nstatus: "superseded by ADR-0012"\ndate: 2024-02-02\ndecision-makers: [Ann]\n---\n# X\n',
    )
    expect(d.status).toBe('superseded')
    expect(d.supersededBy).toEqual([12])
    expect(d.deciders).toEqual(['Ann'])
  })

  test('reports bad YAML and id/title that disagree with the file', () => {
    expect(parseDecision('d/0001-a.md', '---\nstatus: [\n---\n# A\n').problems[0]).toMatch(/not valid YAML/)
    const d = parseDecision('d/0002-a.md', '---\nid: 3\ntitle: Other\nstatus: accepted\n---\n# A\n')
    expect(d.problems).toEqual([
      'frontmatter id 3 does not match the file name (2)',
      'frontmatter title "Other" differs from the heading "A"',
    ])
  })

  test('a Thai title and file name', () => {
    const d = parseDecision(
      'docs/decisions/0002-เก็บเงินเป็นสตางค์.md',
      '---\nstatus: accepted\n---\n\n# เก็บเงินเป็นสตางค์\n',
    )
    expect(d).toMatchObject({ id: 2, title: 'เก็บเงินเป็นสตางค์' })
  })
})

describe('legacy files', () => {
  test('adr-tools: status section, Date line and numbered heading', () => {
    expect(
      parseDecision('doc/adr/0001-record-architecture-decisions.md', fixture('0001-record-architecture-decisions.md')),
    ).toMatchObject({
      id: 1,
      title: 'Record architecture decisions',
      status: 'accepted',
      date: '2018-04-12',
      format: 'legacy',
    })
  })

  test('adr-tools supersede links, without reading numbers from link titles', () => {
    const old = parseDecision(
      'doc/adr/0002-use-rest-for-http-2-clients.md',
      fixture('0002-use-rest-for-http-2-clients.md'),
    )
    expect(old).toMatchObject({ title: 'Use REST for HTTP 2 clients', status: 'superseded', supersededBy: [3] })
    const cur = parseDecision('doc/adr/0003-use-grpc.md', fixture('0003-use-grpc.md'))
    expect(cur).toMatchObject({ status: 'accepted', supersedes: [2] })
  })

  test('log4brains / MADR 2 list metadata', () => {
    const d = parseDecision(
      'docs/adr/20200202-use-markdown.md',
      `# Use Markdown Architectural Decision Records

- Status: superseded by [ADR-0005](0005-use-madr-3.md)
- Deciders: Alice, Bob
- Date: 2020-02-02
- Tags: doc, process

## Context and Problem Statement
`,
    )
    expect(d).toMatchObject({
      status: 'superseded',
      supersededBy: [5],
      deciders: ['Alice', 'Bob'],
      date: '2020-02-02',
      tags: ['doc', 'process'],
    })
  })
})

test('refs', () => {
  expect(refs(3)).toEqual([3])
  expect(refs([3, '4'])).toEqual([3, 4])
  expect(refs('ADR-0012')).toEqual([12])
  expect(refs('3, 4')).toEqual([3, 4])
  expect(refs('[3. Use HTTP 2](0003-use-http-2.md)')).toEqual([3])
  expect(refs('see the meeting notes')).toEqual([])
})

test('setFrontmatter keeps comments and order, removes empty values', () => {
  const src = '---\n# owner: platform team\nstatus: proposed\ndate: 2026-01-01\ntags: [a]\n---\n\n# T\n'
  const out = setFrontmatter(src, { status: 'superseded', superseded_by: [9], tags: [] })
  expect(out).toBe(
    '---\n# owner: platform team\nstatus: superseded\ndate: 2026-01-01\nsuperseded_by:\n  - 9\n---\n\n# T\n',
  )
})

test('migrateLegacy moves adr-tools metadata into frontmatter and keeps the rest', () => {
  const d = parseDecision('doc/adr/0003-use-grpc.md', fixture('0003-use-grpc.md'))
  const out = migrateLegacy(d)
  expect(out).toBe(`---
status: accepted
date: 2018-05-02
supersedes:
  - 2
---

# Use gRPC

## Context

REST contracts drifted.

## Decision

Use gRPC with shared protobuf files.

## Consequences

Contracts are checked at build time.
`)
  expect(parseDecision(d.file, out)).toMatchObject({
    id: 3,
    title: 'Use gRPC',
    status: 'accepted',
    supersedes: [2],
    format: 'frontmatter',
  })
})
