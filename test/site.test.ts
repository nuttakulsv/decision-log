import { expect, test } from 'vitest'
import { buildSite } from '../src/site.js'
import { decision } from './helpers.js'

const all = [
  decision(1, 'status: superseded\ndate: 2026-01-01\nsuperseded_by: [2]\nareas: [src/a/**]', 'Use <script> tags'),
  decision(
    2,
    'status: accepted\ndate: 2026-02-01\nsupersedes: [1]\ntags: [api]\nareas: [src/a/**]',
    'เก็บเงินเป็นสตางค์',
  ),
]
all[1]!.body = '\n# เก็บเงินเป็นสตางค์\n\n## Options\n\n| | A | B |\n|---|---|---|\n| cost | low | high |\n'

test('one self-contained page with every decision', () => {
  const html = buildSite(all, { title: 'Shop decisions', sourceUrl: 'https://github.com/o/r/blob/main/' })
  expect(html).toMatch(/^<!doctype html>/)
  expect(html).toContain('<title>Shop decisions</title>')
  expect(html).toContain('2 decisions: 1 accepted, 1 superseded')
  expect(html).not.toMatch(/<(?:link|script)[^>]+(?:href|src)=/)
  // newest first
  expect(html.indexOf('id="ADR-0002"')).toBeLessThan(html.indexOf('id="ADR-0001"'))
})

test('titles are escaped, bodies rendered, chains linked', () => {
  const html = buildSite(all)
  expect(html).toContain('Use &lt;script&gt; tags')
  expect(html).toContain('<td>cost</td>')
  expect(html).not.toContain('<h1>เก็บเงินเป็นสตางค์</h1>')
  expect(html).toContain('Superseded by <a href="#ADR-0002">ADR-0002</a>')
  expect(html).toContain('Supersedes <a href="#ADR-0001">ADR-0001</a>')
  expect(html).toContain('<option>src/a/**</option>')
})

test('source links when a base URL is given', () => {
  expect(buildSite(all, { sourceUrl: 'https://github.com/o/r/blob/main/' })).toContain(
    'href="https://github.com/o/r/blob/main/docs/decisions/0002-d.md"',
  )
})

test('the inline script parses', () => {
  const js = /<script>([\s\S]*)<\/script>/.exec(buildSite(all))?.[1] ?? ''
  expect(() => new Function(js)).not.toThrow()
})
