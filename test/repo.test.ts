import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { createDecision, loadConfig, loadDecisions, slugify, supersede, updateDecision } from '../src/repo.js'
import { copyFixture, tempProject } from './helpers.js'

const config = { dir: 'docs/decisions', lang: 'en' as const }

describe('createDecision', () => {
  test('numbers files after the highest existing number', () => {
    const root = tempProject({ 'docs/decisions/0004-old.md': '---\nstatus: accepted\ndate: 2026-01-01\n---\n# Old\n' })
    const d = createDecision(root, config, {
      title: 'Use PostgreSQL for orders',
      areas: ['src/orders/**'],
      date: '2026-02-01',
    })
    expect(d.file).toBe('docs/decisions/0005-use-postgresql-for-orders.md')
    expect(readFileSync(join(root, d.file), 'utf8')).toMatch(
      /^---\nstatus: proposed\ndate: 2026-02-01\nareas:\n  - src\/orders\/\*\*\n---\n\n# Use PostgreSQL for orders\n\n## Context\n/,
    )
  })

  test('Thai template and Thai file name', () => {
    const root = tempProject()
    const d = createDecision(root, { ...config, lang: 'th' }, { title: 'เก็บเงินเป็นสตางค์ (integer)' })
    expect(d.file).toBe('docs/decisions/0001-เก็บเงินเป็นสตางค์-integer.md')
    expect(readFileSync(join(root, d.file), 'utf8')).toContain('## บริบท')
  })

  test('--supersedes updates both files', () => {
    const root = tempProject({
      'docs/decisions/0001-rest.md': '---\nstatus: accepted\ndate: 2026-01-01\n---\n# REST\n',
    })
    createDecision(root, config, { title: 'gRPC', supersedes: [1] })
    const [old, cur] = loadDecisions(root, config.dir)
    expect(old).toMatchObject({ status: 'superseded', supersededBy: [2] })
    expect(cur).toMatchObject({ supersedes: [1] })
  })

  test('refuses to supersede a decision that does not exist', () => {
    expect(() => createDecision(tempProject(), config, { title: 'x', supersedes: [9] })).toThrow(/does not exist/)
  })
})

test('supersede twice does not duplicate links', () => {
  const root = tempProject({
    'docs/decisions/0001-a.md': '---\nstatus: accepted\ndate: 2026-01-01\n---\n# A\n',
    'docs/decisions/0002-b.md': '---\nstatus: accepted\ndate: 2026-01-01\n---\n# B\n',
  })
  supersede(root, config, 1, 2)
  supersede(root, config, 1, 2)
  const [a, b] = loadDecisions(root, config.dir)
  expect(a?.supersededBy).toEqual([2])
  expect(b?.supersedes).toEqual([1])
})

test('legacy files must be migrated before they are edited', () => {
  const root = copyFixture('adr-tools')
  const [first] = loadDecisions(root, 'doc/adr')
  expect(() => updateDecision(root, first!, { status: 'deprecated' })).toThrow(/migrate --write/)
})

describe('loadConfig', () => {
  test('adr-tools .adr-dir', () => {
    expect(loadConfig(copyFixture('adr-tools'))).toEqual({ dir: 'doc/adr', lang: 'en' })
  })
  test('log4brains .log4brains.yml', () => {
    const root = tempProject({ '.log4brains.yml': '---\nproject:\n  name: x\n  adrFolder: ./docs/adr\n' })
    expect(loadConfig(root).dir).toBe('docs/adr')
  })
  test('decision-log.json wins', () => {
    const root = tempProject({ 'decision-log.json': '{"dir":"adr","lang":"th"}', '.adr-dir': 'doc/adr' })
    expect(loadConfig(root)).toEqual({ dir: 'adr', lang: 'th' })
  })
  test('finds docs/adr when nothing is configured', () => {
    expect(loadConfig(tempProject({ 'docs/adr/0001-a.md': '# A' })).dir).toBe('docs/adr')
  })
})

test('slugify', () => {
  expect(slugify('Use PostgreSQL for orders!')).toBe('use-postgresql-for-orders')
  expect(slugify('ใช้ Redis ทำ cache')).toBe('ใช้-redis-ทำ-cache')
  expect(slugify('***')).toBe('decision')
  expect(Array.from(slugify('a'.repeat(100))).length).toBe(60)
})
