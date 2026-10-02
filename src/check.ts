import picomatch from 'picomatch'
import { STATUSES, formatId, type Decision } from './decision.js'

export interface Problem {
  file: string
  level: 'error' | 'warning'
  message: string
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

function validDate(s: string): boolean {
  if (!DATE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s)
}

export function check(all: Decision[], files: string[], today: string): Problem[] {
  const out: Problem[] = []
  const err = (d: Decision, message: string) => out.push({ file: d.file, level: 'error', message })
  const warn = (d: Decision, message: string) => out.push({ file: d.file, level: 'warning', message })
  const byId = new Map<number, Decision[]>()
  for (const d of all) byId.set(d.id, [...(byId.get(d.id) ?? []), d])

  for (const d of all) {
    d.problems.forEach((p) => err(d, p))
    if (d.format === 'legacy')
      warn(d, 'no frontmatter (adr-tools/log4brains style); run "decision-log migrate" to convert')

    if (!d.status) err(d, 'missing status')
    else if (!(STATUSES as readonly string[]).includes(d.status))
      err(d, `unknown status "${d.status}", use one of: ${STATUSES.join(', ')}`)

    if (!d.date) err(d, 'missing date')
    else if (!validDate(d.date)) err(d, `date "${d.date}" is not YYYY-MM-DD`)
    if (d.review) {
      if (!validDate(d.review)) err(d, `review date "${d.review}" is not YYYY-MM-DD`)
      else if (d.review < today && d.status === 'accepted') warn(d, `review date ${d.review} has passed`)
    }

    if ((byId.get(d.id)?.length ?? 0) > 1) err(d, `number ${formatId(d.id)} is used by more than one file`)

    for (const n of d.supersedes) {
      const other = byId.get(n)?.[0]
      if (!other) err(d, `supersedes ${formatId(n)}, which does not exist`)
      else if (n === d.id) err(d, 'supersedes itself')
      else if (!other.supersededBy.includes(d.id))
        warn(d, `supersedes ${formatId(n)}, but ${other.file} does not list superseded_by ${d.id}`)
    }
    for (const n of d.supersededBy) {
      if (!byId.has(n)) err(d, `superseded_by ${formatId(n)}, which does not exist`)
    }
    if (d.status === 'superseded' && !d.supersededBy.length) err(d, 'status is superseded but superseded_by is empty')
    if (d.supersededBy.length && d.status !== 'superseded') err(d, `has superseded_by but status is "${d.status}"`)

    for (const glob of d.areas) {
      const isMatch = picomatch(glob, { dot: true })
      if (!files.some((f) => isMatch(f))) warn(d, `area "${glob}" matches no files`)
    }
  }

  const ids = [...byId.keys()].sort((a, b) => a - b)
  for (let i = 1; i < ids.length; i++) {
    const prev = ids[i - 1] ?? 0
    const cur = ids[i] ?? 0
    if (cur - prev > 1) {
      const missing = cur - prev === 2 ? formatId(prev + 1) : `${formatId(prev + 1)}-${formatId(cur - 1)}`
      const d = byId.get(cur)?.[0]
      if (d) warn(d, `numbering gap: ${missing} missing`)
    }
  }
  return out
}
