import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { parseDecision, type Decision } from '../src/decision.js'

export function tempProject(files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'decision-log-'))
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return root
}

export function copyFixture(name: string): string {
  const root = mkdtempSync(join(tmpdir(), 'decision-log-'))
  cpSync(new URL(`fixtures/${name}`, import.meta.url), root, { recursive: true })
  return root
}

export function decision(id: number, fm: string, title = `Decision ${id}`): Decision {
  return parseDecision(`docs/decisions/${String(id).padStart(4, '0')}-d.md`, `---\n${fm}\n---\n\n# ${title}\n`)
}
