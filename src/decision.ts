import { basename } from 'node:path'
import { parse as parseYaml, parseDocument, stringify as stringifyYaml } from 'yaml'

export const STATUSES = ['proposed', 'accepted', 'rejected', 'deprecated', 'superseded'] as const
export type Status = (typeof STATUSES)[number]

export interface Decision {
  id: number
  title: string
  /** Lower-cased as written. `check` reports values outside STATUSES. */
  status: string
  date?: string
  review?: string
  deciders: string[]
  supersedes: number[]
  supersededBy: number[]
  areas: string[]
  tags: string[]
  /** Path relative to the project root, with forward slashes */
  file: string
  /** Markdown after the frontmatter */
  body: string
  format: 'frontmatter' | 'legacy'
  problems: string[]
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/
const ID_IN_NAME = /^(\d+)[-_.]/

export function idFromFilename(file: string): number | undefined {
  const m = ID_IN_NAME.exec(basename(file))
  return m ? Number(m[1]) : undefined
}

export function parseDecision(file: string, text: string): Decision {
  const fm = FRONTMATTER.exec(text)
  return fm ? fromFrontmatter(file, fm[1] ?? '', text.slice(fm[0].length)) : fromLegacy(file, text)
}

function fromFrontmatter(file: string, yaml: string, body: string): Decision {
  const problems: string[] = []
  let data: Record<string, unknown> = {}
  try {
    const parsed: unknown = parseYaml(yaml) ?? {}
    if (typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>
    else problems.push('frontmatter is not a key/value map')
  } catch (err) {
    problems.push(`frontmatter is not valid YAML: ${(err as Error).message.split('\n')[0]}`)
  }

  const fileId = idFromFilename(file)
  const id = data.id === undefined ? fileId : Number(data.id)
  if (id === undefined || !Number.isInteger(id))
    problems.push('no decision number in the file name (e.g. 0007-use-postgres.md)')
  else if (fileId !== undefined && id !== fileId)
    problems.push(`frontmatter id ${id} does not match the file name (${fileId})`)

  const heading = firstHeading(body)
  if (typeof data.title === 'string' && heading && data.title.trim() !== heading) {
    problems.push(`frontmatter title "${data.title}" differs from the heading "${heading}"`)
  }

  const supersededBy = refs(data.superseded_by ?? data.supersededBy)
  let status = text(data.status)?.toLowerCase() ?? ''
  // MADR writes `status: superseded by ADR-0012`
  const madr = /^superseded by\s+(.+)$/.exec(status)
  if (madr?.[1]) {
    status = 'superseded'
    for (const n of refs(madr[1])) if (!supersededBy.includes(n)) supersededBy.push(n)
  }

  return {
    id: id ?? 0,
    title: heading ?? text(data.title) ?? basename(file, '.md'),
    status,
    date: dateText(data.date),
    review: dateText(data.review),
    deciders: list(data.deciders ?? data['decision-makers']),
    supersedes: refs(data.supersedes),
    supersededBy,
    areas: list(data.areas),
    tags: list(data.tags),
    file,
    body,
    format: 'frontmatter',
    problems,
  }
}

/** adr-tools (`## Status` section, `Date:` line) and log4brains/MADR 2 (`- Status: x` list) files. */
function fromLegacy(file: string, body: string): Decision {
  const lines = body.split(/\r?\n/)
  const meta = (key: string) => {
    const re = new RegExp(`^\\s*(?:[-*]\\s*)?${key}:\\s*(.+?)\\s*$`, 'i')
    for (const line of lines) {
      const m = re.exec(line)
      if (m?.[1]) return m[1]
    }
    return undefined
  }

  let status = meta('status')?.toLowerCase() ?? ''
  const supersedes: number[] = []
  const supersededBy: number[] = []
  const section = statusSection(lines)
  for (const line of section) {
    if (/^superseded by\b/i.test(line)) supersededBy.push(...refs(line))
    else if (/^supersedes\b/i.test(line)) supersedes.push(...refs(line))
    else if (!status && /^[a-z]/i.test(line)) status = line.toLowerCase()
  }
  const inline = /^superseded by\s+(.+)$/.exec(status)
  if (inline?.[1]) supersededBy.push(...refs(inline[1]))
  if (supersededBy.length || /^superseded\b/.test(status)) status = 'superseded'

  const id = idFromFilename(file)
  return {
    id: id ?? 0,
    title: firstHeading(body) ?? basename(file, '.md'),
    status,
    date: meta('date'),
    deciders: list(meta('deciders')),
    supersedes: [...new Set(supersedes)],
    supersededBy: [...new Set(supersededBy)],
    areas: [],
    tags: list(meta('tags')),
    file,
    body,
    format: 'legacy',
    problems: id === undefined ? ['no decision number in the file name (e.g. 0007-use-postgres.md)'] : [],
  }
}

function statusSection(lines: string[]): string[] {
  const start = lines.findIndex((l) => /^#{2,}\s*status\s*$/i.test(l))
  if (start < 0) return []
  const out: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,}\s/.test(line)) break
    if (line.trim()) out.push(line.trim())
  }
  return out
}

function firstHeading(body: string): string | undefined {
  const m = /^#\s+(.+?)\s*#*\s*$/m.exec(body)
  // adr-tools titles look like "# 3. Use PostgreSQL"
  return m?.[1]?.replace(/^(?:ADR[-\s]?)?\d+[.:]\s+/i, '')
}

function text(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined
  if (typeof v === 'number') return String(v)
  return undefined
}

function dateText(v: unknown): string | undefined {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return text(v)
}

function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
  if (typeof v === 'string')
    return v
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  return []
}

/** Decision numbers from `3`, `[3, 4]`, `ADR-0003`, `[3. Use X](0003-use-x.md)` and similar. */
export function refs(v: unknown): number[] {
  if (v === undefined || v === null) return []
  const parts = Array.isArray(v) ? v : [v]
  const out: number[] = []
  const add = (n: number) => {
    if (Number.isInteger(n) && !out.includes(n)) out.push(n)
  }
  for (const part of parts) {
    if (typeof part === 'number') {
      add(part)
      continue
    }
    const s = String(part)
    // Link targets first, so a number inside a link title ("Use HTTP 2") is not taken.
    const links = [...s.matchAll(/\]\(([^)]*)\)/g)].map((m) => /(?:^|\/)(\d+)[-_.]/.exec(m[1] ?? '')?.[1])
    const named = [...s.matchAll(/\bADR[-\s]?(\d+)\b/gi)].map((m) => m[1])
    const found = [...links, ...named].filter((x): x is string => x !== undefined)
    if (found.length) found.forEach((x) => add(Number(x)))
    else if (/^[\d\s,#]+$/.test(s)) s.match(/\d+/g)?.forEach((x) => add(Number(x)))
  }
  return out
}

export function formatId(id: number): string {
  return String(id).padStart(4, '0')
}

/** Returns new file content with frontmatter keys set (undefined removes the key). Comments and order are kept. */
export function setFrontmatter(content: string, values: Record<string, unknown>): string {
  const fm = FRONTMATTER.exec(content)
  if (!fm) throw new Error('file has no frontmatter')
  const doc = parseDocument(fm[1] ?? '')
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || (Array.isArray(value) && value.length === 0)) doc.delete(key)
    else doc.set(key, value)
  }
  const yaml = doc.toString({ flowCollectionPadding: false }).trimEnd()
  return `---\n${yaml}\n---\n${content.slice(fm[0].length)}`
}

/** Rewrites an adr-tools or log4brains file with frontmatter, moving the metadata out of the body. */
export function migrateLegacy(d: Decision): string {
  const meta: Record<string, unknown> = { status: d.status || 'accepted' }
  if (d.date) meta.date = d.date
  if (d.deciders.length) meta.deciders = d.deciders
  if (d.supersedes.length) meta.supersedes = d.supersedes
  if (d.supersededBy.length) meta.superseded_by = d.supersededBy
  if (d.tags.length) meta.tags = d.tags

  const lines = d.body.split(/\r?\n/)
  const out: string[] = []
  let inStatus = false
  let header = true
  for (const line of lines) {
    if (/^#{2,}\s*status\s*$/i.test(line)) {
      inStatus = true
      continue
    }
    if (inStatus) {
      if (!/^#{1,}\s/.test(line)) continue
      inStatus = false
    }
    if (/^##\s/.test(line)) header = false
    if (header && /^\s*(?:[-*]\s*)?(?:status|date|deciders|tags):\s/i.test(line)) continue
    out.push(/^#\s/.test(line) && out.every((l) => !/^#\s/.test(l)) ? `# ${d.title}` : line)
  }
  const body = out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
  return `---\n${stringifyYaml(meta, { flowCollectionPadding: false }).trimEnd()}\n---\n\n${body}`
}
