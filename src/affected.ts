import picomatch from 'picomatch'
import { formatId, type Decision } from './decision.js'

export interface Match {
  decision: Decision
  files: string[]
  /** For superseded decisions: the end of the supersede chain */
  current?: Decision
}

export interface Affected {
  matches: Match[]
  /** Decision files edited by the change itself */
  edited: Decision[]
}

const matchers = new WeakMap<Decision, (file: string) => boolean>()

function matcherFor(d: Decision): (file: string) => boolean {
  let m = matchers.get(d)
  if (!m) {
    m = d.areas.length ? picomatch(d.areas, { dot: true }) : () => false
    matchers.set(d, m)
  }
  return m
}

export function areaMatches(d: Decision, file: string): boolean {
  return matcherFor(d)(file.replace(/^\.\//, ''))
}

/** Follows superseded_by until it reaches a decision that is not superseded. */
export function currentOf(all: Decision[], d: Decision): Decision | undefined {
  const seen = new Set<number>()
  let at: Decision | undefined = d
  while (at && at.status === 'superseded' && at.supersededBy.length) {
    if (seen.has(at.id)) return undefined
    seen.add(at.id)
    const next: number | undefined = at.supersededBy[at.supersededBy.length - 1]
    at = all.find((x) => x.id === next)
  }
  return at === d ? undefined : at
}

export function affected(all: Decision[], changed: string[]): Affected {
  const files = changed.map((f) => f.replace(/^\.\//, ''))
  const matches: Match[] = []
  for (const decision of all) {
    if (decision.status === 'rejected') continue
    const hit = files.filter((f) => areaMatches(decision, f))
    if (hit.length) matches.push({ decision, files: hit, current: currentOf(all, decision) })
  }
  matches.sort((a, b) => rank(a.decision) - rank(b.decision) || b.decision.id - a.decision.id)
  const edited = all.filter((d) => files.includes(d.file))
  return { matches, edited }
}

const rank = (d: Decision) => (d.status === 'accepted' ? 0 : d.status === 'proposed' ? 1 : 2)

export interface Violation {
  decision: Decision
  /** The decision the pull request should mention */
  expected: Decision
}

/**
 * A change that touches an area governed by a superseded or deprecated decision should say so,
 * by mentioning the current decision (ADR-12, ADR-0012 or "decision 12") or by editing it.
 */
export function outdatedWithoutReference(result: Affected, text: string): Violation[] {
  const out: Violation[] = []
  for (const m of result.matches) {
    const { status } = m.decision
    if (status !== 'superseded' && status !== 'deprecated') continue
    const expected = m.current ?? m.decision
    const editedIt = result.edited.some((d) => d.id === expected.id || d.id === m.decision.id)
    if (!editedIt && !mentions(text, expected.id)) out.push({ decision: m.decision, expected })
  }
  return out
}

export function mentions(text: string, id: number): boolean {
  return new RegExp(`\\b(?:ADR|decision)[-\\s#]*0*${id}\\b`, 'i').test(text)
}

export const label = (d: Decision) => `ADR-${formatId(d.id)}`
