import { expect, test } from 'vitest'
import { affected, outdatedWithoutReference } from '../src/affected.js'
import { MARKER, renderComment } from '../src/comment.js'
import { decision } from './helpers.js'

const all = [
  decision(
    2,
    'status: superseded\ndate: 2026-01-01\nsuperseded_by: [6]\nareas: [src/clients/**]',
    'Call stock over REST',
  ),
  decision(4, 'status: accepted\ndate: 2026-01-01\nareas: ["src/**/*.repository.ts"]', 'Schema per module | Postgres'),
  decision(6, 'status: accepted\ndate: 2026-01-01\nsupersedes: [2]\nareas: [src/clients/**]', 'Use gRPC for stock'),
]
const changed = [
  'src/clients/stock.ts',
  'src/orders/a.repository.ts',
  'src/orders/b.repository.ts',
  'src/payments/c.repository.ts',
  'src/x/d.repository.ts',
]

test('English comment with links, overflow and a warning', () => {
  const r = affected(all, changed)
  const md = renderComment(r, {
    lang: 'en',
    link: (d) => `https://github.com/o/r/blob/abc/${d.file}`,
    violations: outdatedWithoutReference(r, 'no mention'),
  })
  expect(md).toBe(`${MARKER}
### Architecture decisions for this change

This pull request changes code covered by 3 decisions.

| Decision | Status | Files in this PR |
|---|---|---|
| [ADR-0006 Use gRPC for stock](https://github.com/o/r/blob/abc/docs/decisions/0006-d.md) | accepted | \`src/clients/stock.ts\` |
| [ADR-0004 Schema per module \\| Postgres](https://github.com/o/r/blob/abc/docs/decisions/0004-d.md) | accepted | \`src/orders/a.repository.ts\`, \`src/orders/b.repository.ts\`, \`src/payments/c.repository.ts\`, and 1 more |
| [ADR-0002 Call stock over REST](https://github.com/o/r/blob/abc/docs/decisions/0002-d.md) | superseded by [ADR-0006 Use gRPC for stock](https://github.com/o/r/blob/abc/docs/decisions/0006-d.md) | \`src/clients/stock.ts\` |

> [!WARNING]
> ADR-0002 is no longer current. If this change follows ADR-0006, mention ADR-0006 in the description.

<sub>Posted by decision-log. Areas come from the \`areas\` field of each decision.</sub>
`)
})

test('Thai comment translates statuses', () => {
  const md = renderComment(affected(all, ['src/clients/stock.ts']), { lang: 'th' })
  expect(md).toContain('PR นี้แก้โค้ดในส่วนที่มีการตัดสินใจกำกับอยู่ 2 เรื่อง')
  expect(md).toContain('| ADR-0006 Use gRPC for stock | ใช้อยู่ |')
  expect(md).toContain('| ADR-0002 Call stock over REST | ถูกแทนที่ด้วย ADR-0006 Use gRPC for stock |')
})

test('nothing matched', () => {
  expect(renderComment(affected(all, ['README.md']), { lang: 'en' })).toBe(
    `${MARKER}\n### Architecture decisions for this change\n\nThis pull request no longer changes code covered by a decision.\n`,
  )
})

test('decision files edited in the PR are listed', () => {
  const md = renderComment(affected(all, ['docs/decisions/0004-d.md']), { lang: 'en' })
  expect(md).toContain('Decisions edited in this PR: ADR-0004 Schema per module \\| Postgres')
})
