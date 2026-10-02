import { basename } from 'node:path'
import { expect, test } from 'vitest'
import { check } from '../src/check.js'
import { parseDecision } from '../src/decision.js'
import { decision } from './helpers.js'

const files = ['src/orders/service.ts', 'src/clients/stock.ts']
const messages = (all: ReturnType<typeof decision>[]) =>
  check(all, files, '2026-10-02').map((p) => `${p.level} ${basename(p.file)}: ${p.message}`)

test('a clean set has no problems', () => {
  const all = [
    decision(1, 'status: accepted\ndate: 2026-01-01\nareas: [src/orders/**]'),
    decision(2, 'status: superseded\ndate: 2026-01-02\nsuperseded_by: [3]'),
    decision(3, 'status: accepted\ndate: 2026-01-03\nsupersedes: [2]\nreview: 2027-01-01'),
  ]
  expect(messages(all)).toEqual([])
})

test('schema problems', () => {
  expect(
    messages([
      decision(1, 'date: 2026-01-01'),
      decision(2, 'status: approved\ndate: 2026-13-01'),
      decision(3, 'status: accepted\ndate: 2026-02-30'),
      decision(4, 'status: accepted\ndate: 2026-01-01\nreview: 2026-06-01'),
    ]),
  ).toEqual([
    'error 0001-d.md: missing status',
    'error 0002-d.md: unknown status "approved", use one of: proposed, accepted, rejected, deprecated, superseded',
    'error 0002-d.md: date "2026-13-01" is not YYYY-MM-DD',
    'error 0003-d.md: date "2026-02-30" is not YYYY-MM-DD',
    'warning 0004-d.md: review date 2026-06-01 has passed',
  ])
})

test('numbering: duplicates and gaps', () => {
  const dup = parseDecision('docs/decisions/0001-other.md', '---\nstatus: accepted\ndate: 2026-01-01\n---\n# Other\n')
  expect(
    messages([
      decision(1, 'status: accepted\ndate: 2026-01-01'),
      dup,
      decision(5, 'status: accepted\ndate: 2026-01-01'),
    ]),
  ).toEqual([
    'error 0001-d.md: number 0001 is used by more than one file',
    'error 0001-other.md: number 0001 is used by more than one file',
    'warning 0005-d.md: numbering gap: 0002-0004 missing',
  ])
})

test('supersede links', () => {
  expect(
    messages([
      decision(1, 'status: superseded\ndate: 2026-01-01'),
      decision(2, 'status: accepted\ndate: 2026-01-01\nsuperseded_by: [3]\nsupersedes: [1, 9]'),
      decision(3, 'status: accepted\ndate: 2026-01-01'),
    ]),
  ).toEqual([
    'error 0001-d.md: status is superseded but superseded_by is empty',
    'warning 0002-d.md: supersedes 0001, but docs/decisions/0001-d.md does not list superseded_by 2',
    'error 0002-d.md: supersedes 0009, which does not exist',
    'error 0002-d.md: has superseded_by but status is "accepted"',
  ])
})

test('areas that match nothing and legacy files', () => {
  const legacy = parseDecision('doc/adr/0002-legacy.md', '# 2. Legacy\n\nDate: 2020-01-01\n\n## Status\n\nAccepted\n')
  expect(
    messages([decision(1, 'status: accepted\ndate: 2026-01-01\nareas: [src/payments/**, src/orders/*.ts]'), legacy]),
  ).toEqual([
    'warning 0001-d.md: area "src/payments/**" matches no files',
    'warning 0002-legacy.md: no frontmatter (adr-tools/log4brains style); run "decision-log migrate" to convert',
  ])
})
