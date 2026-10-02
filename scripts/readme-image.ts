// Draws the PR comment the Action would post on examples/shop-api, as docs/pr-comment(.th).png.
import { writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
import { affected, label, outdatedWithoutReference } from '../src/affected.js'
import { loadDecisions } from '../src/repo.js'

const root = new URL('../examples/shop-api/', import.meta.url).pathname
const changed = ['src/clients/stock.client.ts', 'src/orders/order.service.ts', 'src/orders/order.repository.ts']
const result = affected(loadDecisions(root, 'docs/decisions'), changed)
const violations = outdatedWithoutReference(result, 'Retry stock reservations once')

const copy = {
  en: {
    who: 'decision-log',
    did: 'commented',
    title: 'Architecture decisions for this change',
    intro: `This pull request changes code covered by ${result.matches.length} decisions.`,
    head: ['Decision', 'Status', 'Files in this PR'],
    superseded: (id: string) => `superseded by ${id}`,
    warn: (old: string, cur: string) => `${old} is no longer current. If this change follows ${cur}, mention ${cur}.`,
    statuses: {} as Record<string, string>,
  },
  th: {
    who: 'decision-log',
    did: 'แสดงความคิดเห็น',
    title: 'การตัดสินใจเชิงสถาปัตยกรรมที่เกี่ยวกับ PR นี้',
    intro: `PR นี้แก้โค้ดในส่วนที่มีการตัดสินใจกำกับอยู่ ${result.matches.length} เรื่อง`,
    head: ['การตัดสินใจ', 'สถานะ', 'ไฟล์ใน PR นี้'],
    superseded: (id: string) => `ถูกแทนที่ด้วย ${id}`,
    warn: (old: string, cur: string) => `${old} ไม่ใช่ข้อตกลงล่าสุดแล้ว ถ้าทำตาม ${cur} ให้อ้างถึง ${cur} ใน PR`,
    statuses: { accepted: 'ใช้อยู่', proposed: 'เสนอแล้ว', deprecated: 'เลิกใช้แล้ว' } as Record<string, string>,
  },
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const cut = (s: string, n: number) =>
  Array.from(s).length > n
    ? Array.from(s)
        .slice(0, n - 1)
        .join('') + '…'
    : s

function draw(lang: 'en' | 'th'): string {
  const t = copy[lang]
  const W = 1200
  const x0 = 40
  const rowH = 52
  const cols = [x0 + 24, x0 + 610, x0 + 830]
  const rows = result.matches.map((m) => ({
    name: `${label(m.decision)} ${cut(m.decision.title, 42)}`,
    status: m.current ? t.superseded(label(m.current)) : (t.statuses[m.decision.status] ?? m.decision.status),
    files: cut(m.files.map((f) => f.split('/').pop()).join(', '), 30),
    old: Boolean(m.current),
  }))
  const tableY = 220
  const warnY = tableY + rowH * (rows.length + 1) + 28
  const H = warnY + (violations.length ? 96 : 0) + 40
  const font = `font-family="Helvetica Neue, Helvetica, Sukhumvit Set, Thonburi, sans-serif"`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#f6f8fa"/>
<rect x="${x0 - 20}" y="20" width="${W - 2 * (x0 - 20)}" height="${H - 40}" rx="10" fill="#fff" stroke="#d0d7de"/>
<path d="M${x0 - 20} 30 a10 10 0 0 1 10 -10 H${W - x0 + 10} a10 10 0 0 1 10 10 V76 H${x0 - 20} Z" fill="#f6f8fa"/>
<line x1="${x0 - 20}" y1="76" x2="${W - x0 + 20}" y2="76" stroke="#d0d7de"/>
<circle cx="${x0 + 8}" cy="48" r="14" fill="#0f766e"/>
<text x="${x0 + 8}" y="53" text-anchor="middle" font-size="15" font-weight="700" fill="#fff" ${font}>d</text>
<text x="${x0 + 34}" y="54" font-size="17" ${font}><tspan font-weight="700" fill="#1f2328">${t.who}</tspan><tspan fill="#59636e"> ${t.did}</tspan></text>
<text x="${x0}" y="128" font-size="26" font-weight="700" fill="#1f2328" ${font}>${esc(t.title)}</text>
<text x="${x0}" y="172" font-size="18" fill="#1f2328" ${font}>${esc(t.intro)}</text>
<rect x="${x0}" y="${tableY}" width="${W - 2 * x0}" height="${rowH * (rows.length + 1)}" fill="none" stroke="#d0d7de"/>
<rect x="${x0}" y="${tableY}" width="${W - 2 * x0}" height="${rowH}" fill="#f6f8fa" stroke="#d0d7de"/>
${t.head.map((h, i) => `<text x="${cols[i]}" y="${tableY + 33}" font-size="17" font-weight="700" fill="#1f2328" ${font}>${esc(h)}</text>`).join('\n')}
${rows
  .map((r, i) => {
    const y = tableY + rowH * (i + 1)
    return `<line x1="${x0}" y1="${y}" x2="${W - x0}" y2="${y}" stroke="#d0d7de"/>
<text x="${cols[0]}" y="${y + 33}" font-size="17" fill="#0969da" ${font}>${esc(r.name)}</text>
<text x="${cols[1]}" y="${y + 33}" font-size="17" fill="${r.old ? '#8250df' : '#1a7f37'}" ${font}>${esc(r.status)}</text>
<text x="${cols[2]}" y="${y + 33}" font-size="15" fill="#1f2328" font-family="Menlo, monospace">${esc(r.files)}</text>`
  })
  .join('\n')}
${
  violations.length
    ? `<rect x="${x0}" y="${warnY}" width="${W - 2 * x0}" height="72" rx="6" fill="#fff8c5" stroke="#d4a72c"/>
<rect x="${x0}" y="${warnY}" width="5" height="72" fill="#9a6700"/>
<text x="${x0 + 24}" y="${warnY + 30}" font-size="16" font-weight="700" fill="#9a6700" ${font}>Warning</text>
<text x="${x0 + 24}" y="${warnY + 56}" font-size="17" fill="#1f2328" ${font}>${esc(t.warn(label(violations[0]!.decision), label(violations[0]!.expected)))}</text>`
    : ''
}
</svg>`
}

for (const lang of ['en', 'th'] as const) {
  const png = new Resvg(draw(lang), { font: { loadSystemFonts: true, defaultFontFamily: 'Helvetica Neue' } })
    .render()
    .asPng()
  const out = new URL(`../docs/pr-comment${lang === 'th' ? '.th' : ''}.png`, import.meta.url)
  writeFileSync(out, png)
  console.log(`${out.pathname} ${png.length} bytes`)
}
