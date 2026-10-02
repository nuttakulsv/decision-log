import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { run } from '../src/action.js'
import { MARKER } from '../src/comment.js'
import { tempProject } from './helpers.js'

interface Call {
  method: string
  url: string
  body?: { body: string }
}

function setup(opts: {
  files: string[]
  comments?: { id: number; body: string }[]
  prBody?: string
  denyWrite?: boolean
}) {
  const root = tempProject({
    'docs/decisions/0001-rest.md':
      '---\nstatus: superseded\ndate: 2026-01-01\nsuperseded_by: [2]\nareas: [src/clients/**]\n---\n# REST\n',
    'docs/decisions/0002-grpc.md':
      '---\nstatus: accepted\ndate: 2026-01-02\nsupersedes: [1]\nareas: [src/clients/**]\n---\n# gRPC\n',
    'event.json': JSON.stringify({
      pull_request: { number: 7, title: 'Retry reservations', body: opts.prBody ?? '', head: { sha: 'abc123' } },
    }),
    'summary.md': '',
    'output.txt': '',
  })
  const calls: Call[] = []
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const call: Call = {
      method: init.method ?? 'GET',
      url,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    }
    calls.push(call)
    const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status })
    if (call.method === 'GET' && url.includes('/pulls/7/files')) {
      const page = Number(new URL(url).searchParams.get('page'))
      const all = opts.files.map((filename) => ({ filename }))
      return json(200, all.slice((page - 1) * 100, page * 100))
    }
    if (call.method === 'GET' && url.includes('/issues/7/comments')) return json(200, opts.comments ?? [])
    if (opts.denyWrite) return json(403, { message: 'Resource not accessible by integration' })
    return json(call.method === 'POST' ? 201 : 200, {})
  }) as typeof fetch
  const env = {
    GITHUB_EVENT_PATH: join(root, 'event.json'),
    GITHUB_REPOSITORY: 'o/r',
    GITHUB_WORKSPACE: root,
    GITHUB_STEP_SUMMARY: join(root, 'summary.md'),
    GITHUB_OUTPUT: join(root, 'output.txt'),
    'INPUT_GITHUB-TOKEN': 'secret',
  }
  return { root, calls, fetchImpl, env }
}

describe('action', () => {
  test('posts one comment, writes the summary and outputs', async () => {
    const s = setup({ files: ['src/clients/stock.ts', 'README.md'] })
    const r = await run(s.env, s.fetchImpl)
    expect(r).toMatchObject({
      decisions: [2, 1],
      violations: ['ADR-0001 -> ADR-0002'],
      comment: 'created',
      failed: false,
    })
    const post = s.calls.find((c) => c.method === 'POST')
    expect(post?.url).toBe('https://api.github.com/repos/o/r/issues/7/comments')
    expect(post?.body?.body).toContain(
      '[ADR-0002 gRPC](https://github.com/o/r/blob/abc123/docs/decisions/0002-grpc.md)',
    )
    expect(readFileSync(join(s.root, 'output.txt'), 'utf8')).toBe('decisions=[2,1]\ncount=2\n')
    expect(readFileSync(join(s.root, 'summary.md'), 'utf8')).toMatch(/^### Architecture decisions/)
  })

  test('updates its own comment instead of adding another', async () => {
    const s = setup({
      files: ['src/clients/stock.ts'],
      comments: [
        { id: 1, body: 'LGTM' },
        { id: 55, body: `${MARKER}\nold` },
      ],
    })
    expect((await run(s.env, s.fetchImpl)).comment).toBe('updated')
    expect(s.calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.url}`)).toEqual([
      'PATCH https://api.github.com/repos/o/r/issues/comments/55',
    ])
  })

  test('stays quiet when nothing matches and there is no earlier comment', async () => {
    const s = setup({ files: ['README.md'] })
    expect((await run(s.env, s.fetchImpl)).comment).toBe('skipped')
    expect(s.calls.every((c) => c.method === 'GET')).toBe(true)
  })

  test('reads every page of changed files', async () => {
    const files = [...Array.from({ length: 150 }, (_, i) => `docs/file-${i}.md`), 'src/clients/late.ts']
    const s = setup({ files })
    expect((await run(s.env, s.fetchImpl)).decisions).toEqual([2, 1])
    expect(s.calls.filter((c) => c.url.includes('/files')).length).toBe(2)
  })

  test('fail-on-deprecated fails unless the PR mentions the current decision', async () => {
    const s = setup({ files: ['src/clients/stock.ts'] })
    expect((await run({ ...s.env, 'INPUT_FAIL-ON-DEPRECATED': 'true' }, s.fetchImpl)).failed).toBe(true)
    const ok = setup({ files: ['src/clients/stock.ts'], prBody: 'Follows ADR-0002' })
    expect((await run({ ...ok.env, 'INPUT_FAIL-ON-DEPRECATED': 'true' }, ok.fetchImpl)).failed).toBe(false)
  })

  test('a read-only token (fork PR) does not fail the job', async () => {
    const s = setup({ files: ['src/clients/stock.ts'], denyWrite: true })
    const r = await run(s.env, s.fetchImpl)
    expect(r.comment).toBe('failed')
    expect(readFileSync(join(s.root, 'summary.md'), 'utf8')).toContain('ADR-0002')
  })

  test('ignores events that are not pull requests', async () => {
    const s = setup({ files: [] })
    writeFileSync(s.env.GITHUB_EVENT_PATH, '{"push":{}}')
    expect(await run(s.env, s.fetchImpl)).toMatchObject({ comment: 'skipped', decisions: [] })
    expect(s.calls).toEqual([])
  })

  test('sends the token only to the API', async () => {
    const s = setup({ files: ['src/clients/stock.ts'] })
    await run(s.env, s.fetchImpl)
    expect(s.calls.every((c) => c.url.startsWith('https://api.github.com/'))).toBe(true)
  })
})
