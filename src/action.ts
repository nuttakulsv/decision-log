import { appendFileSync, readFileSync } from 'node:fs'
import { affected, label, outdatedWithoutReference } from './affected.js'
import { MARKER, renderComment } from './comment.js'
import { loadConfig, loadDecisions } from './repo.js'

type Env = Record<string, string | undefined>
type Fetch = typeof fetch

interface PullRequest {
  number: number
  title?: string
  body?: string | null
  head: { sha: string }
}

export interface ActionResult {
  decisions: number[]
  violations: string[]
  comment: 'created' | 'updated' | 'skipped' | 'failed'
  failed: boolean
}

const input = (env: Env, name: string) => env[`INPUT_${name.toUpperCase()}`]?.trim() ?? ''

export async function run(env: Env, fetchImpl: Fetch = fetch): Promise<ActionResult> {
  const result: ActionResult = { decisions: [], violations: [], comment: 'skipped', failed: false }
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH ?? '', 'utf8')) as { pull_request?: PullRequest }
  const pr = event.pull_request
  if (!pr) {
    log(env, 'notice', 'decision-log only runs on pull_request events, nothing to do')
    return result
  }

  const token = input(env, 'github-token')
  const repo = env.GITHUB_REPOSITORY ?? ''
  const api = (env.GITHUB_API_URL ?? 'https://api.github.com').replace(/\/$/, '')
  const server = (env.GITHUB_SERVER_URL ?? 'https://github.com').replace(/\/$/, '')
  const root = env.GITHUB_WORKSPACE ?? process.cwd()
  const config = loadConfig(root)
  if (input(env, 'dir')) config.dir = input(env, 'dir')
  const lang = input(env, 'lang') === 'th' ? 'th' : input(env, 'lang') === 'en' ? 'en' : config.lang

  const gh = async (method: string, path: string, body?: unknown) => {
    const res = await fetchImpl(`${api}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new ApiError(res.status, `${method} ${path}: ${res.status} ${await res.text()}`)
    return res.json() as Promise<unknown>
  }
  const all = async <T>(path: string): Promise<T[]> => {
    const items: T[] = []
    for (let page = 1; page <= 30; page++) {
      const batch = (await gh('GET', `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`)) as T[]
      items.push(...batch)
      if (batch.length < 100) break
    }
    return items
  }

  const files = await all<{ filename: string; previous_filename?: string }>(`/repos/${repo}/pulls/${pr.number}/files`)
  const changed = files.flatMap((f) => (f.previous_filename ? [f.filename, f.previous_filename] : [f.filename]))
  const decisions = loadDecisions(root, config.dir)
  const found = affected(decisions, changed)
  const violations = outdatedWithoutReference(found, `${pr.title ?? ''}\n${pr.body ?? ''}`)
  result.decisions = found.matches.map((m) => m.decision.id)
  result.violations = violations.map((v) => `${label(v.decision)} -> ${label(v.expected)}`)

  const comment = renderComment(found, {
    lang,
    link: (d) => `${server}/${repo}/blob/${pr.head.sha}/${encodeURI(d.file)}`,
    violations,
  })

  try {
    const comments = await all<{ id: number; body?: string }>(`/repos/${repo}/issues/${pr.number}/comments`)
    const mine = comments.find((c) => c.body?.startsWith(MARKER))
    const relevant = found.matches.length > 0 || found.edited.length > 0
    if (mine && mine.body !== comment) {
      await gh('PATCH', `/repos/${repo}/issues/comments/${mine.id}`, { body: comment })
      result.comment = 'updated'
    } else if (!mine && relevant) {
      await gh('POST', `/repos/${repo}/issues/${pr.number}/comments`, { body: comment })
      result.comment = 'created'
    }
  } catch (err) {
    if (!(err instanceof ApiError) || (err.status !== 403 && err.status !== 404)) throw err
    // Pull requests from forks get a read-only token.
    log(env, 'warning', `could not post the comment (${err.status}). The summary below has the same content.`)
    result.comment = 'failed'
  }

  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, comment.replace(MARKER, '').trimStart() + '\n')
  if (env.GITHUB_OUTPUT) {
    appendFileSync(
      env.GITHUB_OUTPUT,
      `decisions=${JSON.stringify(result.decisions)}\ncount=${result.decisions.length}\n`,
    )
  }

  if (input(env, 'fail-on-deprecated') === 'true' && violations.length) {
    for (const v of violations) {
      log(
        env,
        'error',
        `${label(v.decision)} (${v.decision.status}) covers files in this PR. Mention ${label(v.expected)} in the description or update the decision.`,
      )
    }
    result.failed = true
  }
  return result
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

function log(env: Env, level: 'notice' | 'warning' | 'error', message: string) {
  console.log(env.GITHUB_ACTIONS === 'true' ? `::${level}::${message}` : `${level}: ${message}`)
}
