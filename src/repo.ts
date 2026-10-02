import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { parse as parseYaml, stringify } from 'yaml'
import { formatId, parseDecision, setFrontmatter, type Decision } from './decision.js'
import { template, type Lang } from './templates.js'

export const CONFIG_FILE = 'decision-log.json'
export const DEFAULT_DIR = 'docs/decisions'

export interface Config {
  dir: string
  lang: Lang
}

export const toPosix = (p: string) => p.split(sep).join('/')

/** decision-log.json, then adr-tools' .adr-dir, then log4brains' .log4brains.yml, then common folders. */
export function loadConfig(root: string): Config {
  const file = join(root, CONFIG_FILE)
  if (existsSync(file)) {
    const data = JSON.parse(readFileSync(file, 'utf8')) as Partial<Config>
    return { dir: data.dir ?? DEFAULT_DIR, lang: data.lang === 'th' ? 'th' : 'en' }
  }
  const adrDir = join(root, '.adr-dir')
  if (existsSync(adrDir)) return { dir: readFileSync(adrDir, 'utf8').trim(), lang: 'en' }
  const l4b = join(root, '.log4brains.yml')
  if (existsSync(l4b)) {
    const data = parseYaml(readFileSync(l4b, 'utf8')) as { project?: { adrFolder?: string } } | null
    if (data?.project?.adrFolder) return { dir: data.project.adrFolder.replace(/^\.\//, ''), lang: 'en' }
  }
  const found = ['docs/decisions', 'docs/adr', 'doc/adr', 'docs/architecture/decisions'].find((d) =>
    existsSync(join(root, d)),
  )
  return { dir: found ?? DEFAULT_DIR, lang: 'en' }
}

export function loadDecisions(root: string, dir: string): Decision[] {
  const abs = join(root, dir)
  if (!existsSync(abs)) return []
  return readdirSync(abs)
    .filter((name) => name.endsWith('.md') && /^\d/.test(name))
    .map((name) => parseDecision(toPosix(join(dir, name)), readFileSync(join(abs, name), 'utf8')))
    .sort((a, b) => a.id - b.id || a.file.localeCompare(b.file))
}

export function slugify(title: string): string {
  const slug = title
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return Array.from(slug).slice(0, 60).join('').replace(/-+$/, '') || 'decision'
}

export interface NewDecision {
  title: string
  status?: string
  supersedes?: number[]
  areas?: string[]
  tags?: string[]
  deciders?: string[]
  date?: string
  body?: string
}

export function createDecision(root: string, config: Config, input: NewDecision): Decision {
  const existing = loadDecisions(root, config.dir)
  const id = Math.max(0, ...existing.map((d) => d.id)) + 1
  const supersedes = input.supersedes ?? []
  for (const old of supersedes) {
    if (!existing.some((d) => d.id === old)) throw new Error(`decision ${old} does not exist`)
  }

  const meta: Record<string, unknown> = {
    status: input.status ?? 'proposed',
    date: input.date ?? today(),
  }
  if (input.deciders?.length) meta.deciders = input.deciders
  if (supersedes.length) meta.supersedes = supersedes
  if (input.areas?.length) meta.areas = input.areas
  if (input.tags?.length) meta.tags = input.tags

  const file = toPosix(join(config.dir, `${formatId(id)}-${slugify(input.title)}.md`))
  const content = `---\n${stringify(meta, { flowCollectionPadding: false }).trimEnd()}\n---\n\n# ${input.title}\n\n${input.body ?? template(config.lang)}`
  mkdirSync(join(root, config.dir), { recursive: true })
  writeFileSync(join(root, file), content, { flag: 'wx' })

  for (const old of supersedes) supersede(root, config, old, id)
  return parseDecision(file, content)
}

export function updateDecision(root: string, decision: Decision, values: Record<string, unknown>): void {
  if (decision.format === 'legacy') {
    throw new Error(`${decision.file} has no frontmatter. Run "decision-log migrate --write" first.`)
  }
  const path = join(root, decision.file)
  writeFileSync(path, setFrontmatter(readFileSync(path, 'utf8'), values))
}

/** Marks `oldId` as superseded by `newId` and links both files. */
export function supersede(root: string, config: Config, oldId: number, newId: number): void {
  const all = loadDecisions(root, config.dir)
  const oldD = find(all, oldId)
  const newD = find(all, newId)
  updateDecision(root, oldD, {
    status: 'superseded',
    superseded_by: [...new Set([...oldD.supersededBy, newId])],
  })
  if (!newD.supersedes.includes(oldId)) updateDecision(root, newD, { supersedes: [...newD.supersedes, oldId] })
}

export function find(all: Decision[], id: number): Decision {
  const d = all.find((x) => x.id === id)
  if (!d) throw new Error(`decision ${id} does not exist`)
  return d
}

/** Tracked files from git, or a plain directory walk outside a repository. */
export function projectFiles(root: string): string[] {
  try {
    return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    })
      .split('\n')
      .filter(Boolean)
  } catch {
    return walk(root, root)
  }
}

function walk(root: string, dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === 'node_modules' || e.name === '.git') return []
    const full = join(dir, e.name)
    return e.isDirectory() ? walk(root, full) : [toPosix(relative(root, full))]
  })
}

export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
