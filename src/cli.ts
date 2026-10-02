#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { affected, label } from './affected.js'
import { check } from './check.js'
import { renderComment } from './comment.js'
import { STATUSES, formatId, migrateLegacy } from './decision.js'
import {
  CONFIG_FILE,
  createDecision,
  find,
  loadConfig,
  loadDecisions,
  projectFiles,
  supersede,
  today,
  updateDecision,
} from './repo.js'
import { buildSite } from './site.js'
import { firstDecision, type Lang } from './templates.js'
import { VERSION } from './version.js'

const HELP = `decision-log ${VERSION}

Usage:
  decision-log init [--lang en|th] [--dir docs/decisions]
  decision-log new "<title>" [--area <glob>]... [--tag <tag>]... [--decider <name>]... [--supersedes <n>]...
  decision-log list [--status <status>] [--json]
  decision-log status <n> <proposed|accepted|rejected|deprecated>
  decision-log supersede <old> <new>
  decision-log check [--strict]
  decision-log affected <file>... | --base <git-ref> [--json] [--markdown] [--lang en|th]
  decision-log site [-o dist] [--title "<title>"] [--source-url <url>]
  decision-log migrate [--write]

Options:
  -C, --cwd <dir>   project root (default: current directory)
  -h, --help        show this help
  -v, --version     show the version
`

class UsageError extends Error {}

function main(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      cwd: { type: 'string', short: 'C' },
      lang: { type: 'string' },
      dir: { type: 'string' },
      area: { type: 'string', multiple: true },
      tag: { type: 'string', multiple: true },
      decider: { type: 'string', multiple: true },
      supersedes: { type: 'string', multiple: true },
      status: { type: 'string' },
      json: { type: 'boolean' },
      markdown: { type: 'boolean' },
      strict: { type: 'boolean' },
      base: { type: 'string' },
      output: { type: 'string', short: 'o' },
      title: { type: 'string' },
      'source-url': { type: 'string' },
      write: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  })
  if (values.version) return out(VERSION)
  const [command, ...args] = positionals
  if (values.help || !command) return out(HELP)

  const root = values.cwd ?? process.cwd()
  const config = loadConfig(root)
  if (values.dir) config.dir = values.dir
  const lang: Lang = values.lang === 'th' ? 'th' : values.lang === 'en' ? 'en' : config.lang
  const num = (s: string | undefined, what: string) => {
    const n = Number(s)
    if (!s || !Number.isInteger(n) || n < 1)
      throw new UsageError(`expected a decision number for ${what}, got "${s ?? ''}"`)
    return n
  }

  switch (command) {
    case 'init': {
      const cfg = { dir: values.dir ?? config.dir, lang }
      const cfgPath = join(root, CONFIG_FILE)
      if (!existsSync(cfgPath)) writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n')
      mkdirSync(join(root, cfg.dir), { recursive: true })
      if (loadDecisions(root, cfg.dir).length) return out(`${cfg.dir} already has decisions, wrote ${CONFIG_FILE}`)
      const first = firstDecision(lang)
      const d = createDecision(root, cfg, { title: first.title, status: 'accepted', body: first.body })
      return out(`Created ${CONFIG_FILE} and ${d.file}`)
    }

    case 'new': {
      const title = args.join(' ').trim()
      if (!title) throw new UsageError('new needs a title, e.g. decision-log new "Use PostgreSQL for orders"')
      const status = values.status ?? 'proposed'
      if (!(STATUSES as readonly string[]).includes(status)) throw new UsageError(`unknown status "${status}"`)
      const d = createDecision(
        root,
        { ...config, lang },
        {
          title,
          status,
          areas: values.area,
          tags: values.tag,
          deciders: values.decider,
          supersedes: values.supersedes?.map((s) => num(s, '--supersedes')),
        },
      )
      return out(d.file)
    }

    case 'list': {
      let all = loadDecisions(root, config.dir)
      if (values.status) all = all.filter((d) => d.status === values.status)
      if (values.json)
        return out(
          JSON.stringify(
            all.map(({ body: _body, ...d }) => d),
            null,
            2,
          ),
        )
      if (!all.length) return out(`No decisions in ${config.dir}. Run "decision-log init" to start.`)
      const rows = all.map((d) => [label(d), d.status || '-', d.date ?? '-', d.title])
      return out(table(['ID', 'STATUS', 'DATE', 'TITLE'], rows))
    }

    case 'status': {
      const id = num(args[0], 'status')
      const status = args[1]
      if (!status || !(STATUSES as readonly string[]).includes(status))
        throw new UsageError(`status must be one of: ${STATUSES.join(', ')}`)
      if (status === 'superseded') throw new UsageError('use "decision-log supersede <old> <new>" to supersede')
      const d = find(loadDecisions(root, config.dir), id)
      updateDecision(root, d, { status, date: today() })
      return out(`${label(d)} is now ${status}`)
    }

    case 'supersede': {
      const oldId = num(args[0], 'the old decision')
      const newId = num(args[1], 'the new decision')
      if (oldId === newId) throw new UsageError('a decision cannot supersede itself')
      supersede(root, config, oldId, newId)
      return out(`ADR-${formatId(oldId)} is superseded by ADR-${formatId(newId)}`)
    }

    case 'check': {
      const all = loadDecisions(root, config.dir)
      const problems = check(all, projectFiles(root), today())
      const gha = process.env.GITHUB_ACTIONS === 'true'
      for (const p of problems) {
        console.log(gha ? `::${p.level} file=${p.file}::${p.message}` : `${p.file}: ${p.level}: ${p.message}`)
      }
      const errors = problems.filter((p) => p.level === 'error').length
      const warnings = problems.length - errors
      console.log(`${all.length} decisions, ${errors} errors, ${warnings} warnings`)
      return errors || (values.strict && warnings) ? 1 : 0
    }

    case 'affected': {
      const files = values.base ? changedSince(root, values.base) : args
      if (!files.length) throw new UsageError('affected needs file paths or --base <git-ref>')
      const result = affected(loadDecisions(root, config.dir), files)
      if (values.json) {
        return out(
          JSON.stringify(
            result.matches.map((m) => ({
              id: m.decision.id,
              title: m.decision.title,
              status: m.decision.status,
              file: m.decision.file,
              current: m.current?.id,
              files: m.files,
            })),
            null,
            2,
          ),
        )
      }
      if (values.markdown) return out(renderComment(result, { lang }).trimEnd())
      if (!result.matches.length) return out('No decisions cover these files.')
      for (const m of result.matches) {
        const status = m.current ? `superseded by ${label(m.current)}` : m.decision.status
        console.log(`${label(m.decision)}  ${status}  ${m.decision.title}`)
        for (const f of m.files) console.log(`    ${f}`)
      }
      return 0
    }

    case 'site': {
      const dir = resolve(root, values.output ?? 'dist')
      mkdirSync(dir, { recursive: true })
      const all = loadDecisions(root, config.dir)
      writeFileSync(join(dir, 'index.html'), buildSite(all, { title: values.title, sourceUrl: values['source-url'] }))
      return out(`Wrote ${relative(root, join(dir, 'index.html'))} (${all.length} decisions)`)
    }

    case 'migrate': {
      const legacy = loadDecisions(root, config.dir).filter((d) => d.format === 'legacy')
      if (!legacy.length) return out('Nothing to migrate.')
      for (const d of legacy) {
        if (values.write) writeFileSync(join(root, d.file), migrateLegacy(d))
        console.log(`${values.write ? 'migrated' : 'would migrate'} ${d.file} (${d.status || 'no status'})`)
      }
      if (!values.write) console.log('Run again with --write to change the files.')
      return 0
    }

    default:
      throw new UsageError(`unknown command "${command}"`)
  }
}

function changedSince(root: string, base: string): string[] {
  return execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
}

function table(head: string[], rows: string[][]): string {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)))
  const line = (r: string[]) =>
    r
      .map((c, i) => (i === r.length - 1 ? c : c.padEnd(widths[i] ?? 0)))
      .join('  ')
      .trimEnd()
  return [line(head), ...rows.map(line)].join('\n')
}

function out(s: string): number {
  console.log(s)
  return 0
}

try {
  process.exitCode = main(process.argv.slice(2))
} catch (err) {
  console.error(`decision-log: ${(err as Error).message}`)
  if (err instanceof UsageError) console.error('Run "decision-log --help" for usage.')
  process.exitCode = err instanceof UsageError ? 2 : 1
}
