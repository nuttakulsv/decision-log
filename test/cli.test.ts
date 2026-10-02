import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { VERSION } from '../src/version.js'
import { copyFixture, tempProject } from './helpers.js'

const cli = new URL('../src/cli.ts', import.meta.url).pathname
const tsx = new URL('../node_modules/tsx/dist/loader.mjs', import.meta.url).href

function dl(cwd: string, ...args: string[]) {
  const r = spawnSync(process.execPath, ['--import', tsx, cli, ...args], { cwd, encoding: 'utf8' })
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() }
}

test('version matches package.json', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
  expect(VERSION).toBe(pkg.version)
})

test('init, new, supersede, list, check, affected', { timeout: 30_000 }, () => {
  const root = tempProject({ 'src/orders/service.ts': '', 'src/clients/stock.ts': '' })
  execFileSync('git', ['init', '-q'], { cwd: root })

  expect(dl(root, 'init', '--lang', 'th').out).toBe(
    'Created decision-log.json and docs/decisions/0001-บันทึกการตัดสินใจเชิงสถาปัตยกรรม.md',
  )
  expect(dl(root, 'new', 'Use REST between services', '--area', 'src/clients/**').out).toBe(
    'docs/decisions/0002-use-rest-between-services.md',
  )
  dl(root, 'new', 'Use gRPC between services', '--area', 'src/clients/**')
  expect(dl(root, 'supersede', '2', '3').out).toBe('ADR-0002 is superseded by ADR-0003')
  expect(dl(root, 'status', '3', 'accepted').out).toBe('ADR-0003 is now accepted')

  const list = dl(root, 'list').out.split('\n')
  expect(list[0]).toMatch(/^ID\s+STATUS\s+DATE\s+TITLE$/)
  expect(list.slice(1).map((l) => l.split(/\s{2,}/)[1])).toEqual(['accepted', 'superseded', 'accepted'])

  expect(dl(root, 'check')).toMatchObject({ code: 0, out: '3 decisions, 0 errors, 0 warnings' })
  expect(dl(root, 'affected', 'src/clients/stock.ts').out).toBe(
    [
      'ADR-0003  accepted  Use gRPC between services',
      '    src/clients/stock.ts',
      'ADR-0002  superseded by ADR-0003  Use REST between services',
      '    src/clients/stock.ts',
    ].join('\n'),
  )
  const json = JSON.parse(dl(root, 'affected', 'src/clients/stock.ts', '--json').out) as {
    id: number
    current?: number
  }[]
  expect(json.map((j) => [j.id, j.current])).toEqual([
    [3, undefined],
    [2, 3],
  ])
})

test('check exits 1 on errors and --strict fails on warnings', () => {
  const root = tempProject({
    'docs/decisions/0001-a.md': '---\nstatus: maybe\ndate: 2026-01-01\n---\n# A\n',
    'docs/decisions/0003-b.md': '---\nstatus: accepted\ndate: 2026-01-01\n---\n# B\n',
  })
  expect(dl(root, 'check')).toMatchObject({ code: 1 })
  const warnOnly = tempProject({
    'docs/decisions/0002-b.md': '---\nstatus: accepted\ndate: 2026-01-01\nareas: [nope/**]\n---\n# B\n',
  })
  expect(dl(warnOnly, 'check').code).toBe(0)
  expect(dl(warnOnly, 'check', '--strict').code).toBe(1)
})

test('migrate converts an adr-tools project in place', () => {
  const root = copyFixture('adr-tools')
  expect(dl(root, 'migrate').out).toContain('would migrate doc/adr/0002-use-rest-for-http-2-clients.md (superseded)')
  dl(root, 'migrate', '--write')
  expect(readFileSync(join(root, 'doc/adr/0002-use-rest-for-http-2-clients.md'), 'utf8')).toMatch(
    /^---\nstatus: superseded\ndate: 2018-04-13\nsuperseded_by:\n {2}- 3\n---\n\n# Use REST for HTTP 2 clients\n\n## Context/,
  )
  expect(dl(root, 'check').out).toBe('3 decisions, 0 errors, 0 warnings')
})

test('site writes one html file', () => {
  const root = copyFixture('adr-tools')
  expect(dl(root, 'site', '-o', 'out').out).toBe('Wrote out/index.html (3 decisions)')
  expect(readdirSync(join(root, 'out'))).toEqual(['index.html'])
  const abs = tempProject()
  dl(root, 'site', '-o', abs)
  expect(readdirSync(abs)).toEqual(['index.html'])
})

test('usage errors exit 2', () => {
  const root = tempProject()
  expect(dl(root, 'status', 'x', 'accepted')).toMatchObject({ code: 2 })
  expect(dl(root, 'nope').err).toContain('unknown command "nope"')
})
