import { expect, test } from 'vitest'
import { affected, currentOf, mentions, outdatedWithoutReference } from '../src/affected.js'
import { decision } from './helpers.js'

const all = [
  decision(1, 'status: accepted\ndate: 2026-01-01\nareas: [src/orders/**]'),
  decision(2, 'status: superseded\ndate: 2026-01-01\nsuperseded_by: [4]\nareas: [src/clients/**]'),
  decision(3, 'status: rejected\ndate: 2026-01-01\nareas: ["src/**"]'),
  decision(4, 'status: superseded\ndate: 2026-01-01\nsupersedes: [2]\nsuperseded_by: [5]\nareas: [src/clients/**]'),
  decision(5, 'status: accepted\ndate: 2026-01-01\nsupersedes: [4]\nareas: [src/clients/**, "**/*.proto"]'),
  decision(6, 'status: deprecated\ndate: 2026-01-01\nareas: [src/catalog/cache.ts, .github/**]'),
]

test('matches files to decisions, accepted first, rejected ignored', () => {
  const r = affected(all, [
    './src/orders/a.ts',
    'src/clients/stock.ts',
    'proto/stock.proto',
    '.github/workflows/ci.yml',
  ])
  expect(r.matches.map((m) => [m.decision.id, m.files, m.current?.id])).toEqual([
    [5, ['src/clients/stock.ts', 'proto/stock.proto'], undefined],
    [1, ['src/orders/a.ts'], undefined],
    [6, ['.github/workflows/ci.yml'], undefined],
    [4, ['src/clients/stock.ts'], 5],
    [2, ['src/clients/stock.ts'], 5],
  ])
  expect(r.edited).toEqual([])
})

test('currentOf follows the chain and stops on cycles', () => {
  expect(currentOf(all, all[1]!)?.id).toBe(5)
  expect(currentOf(all, all[0]!)).toBeUndefined()
  const loop = [
    decision(1, 'status: superseded\nsuperseded_by: [2]'),
    decision(2, 'status: superseded\nsuperseded_by: [1]'),
  ]
  expect(currentOf(loop, loop[0]!)).toBeUndefined()
})

test('outdated decisions need a mention of the current one', () => {
  const r = affected(all, ['src/clients/stock.ts', 'src/catalog/cache.ts'])
  const ids = (text: string) => outdatedWithoutReference(r, text).map((v) => `${v.decision.id}->${v.expected.id}`)
  expect(ids('Retry stock reservations')).toEqual(['6->6', '4->5', '2->5'])
  expect(ids('Follows ADR-0005. Also touches decision 6.')).toEqual([])
  expect(ids('see adr 5')).toEqual(['6->6'])
})

test('editing the current decision counts as a reference', () => {
  const r = affected(all, ['src/clients/stock.ts', 'docs/decisions/0005-d.md'])
  expect(r.edited.map((d) => d.id)).toEqual([5])
  expect(outdatedWithoutReference(r, '')).toEqual([])
})

test('mentions', () => {
  expect(mentions('ADR-0012', 12)).toBe(true)
  expect(mentions('ADR-12', 12)).toBe(true)
  expect(mentions('decision #12', 12)).toBe(true)
  expect(mentions('ADR-0120', 12)).toBe(false)
  expect(mentions('issue 12', 12)).toBe(false)
})
