import { label, type Affected, type Violation } from './affected.js'
import type { Decision } from './decision.js'
import type { Lang } from './templates.js'

export const MARKER = '<!-- decision-log -->'

const text = {
  en: {
    title: 'Architecture decisions for this change',
    intro: (n: number) => `This pull request changes code covered by ${n === 1 ? '1 decision' : `${n} decisions`}.`,
    none: 'This pull request no longer changes code covered by a decision.',
    decision: 'Decision',
    status: 'Status',
    files: 'Files in this PR',
    more: (n: number) => `and ${n} more`,
    supersededBy: 'superseded by',
    edited: 'Decisions edited in this PR',
    outdated: (old: string, cur: string) =>
      `${old} is no longer current. If this change follows ${cur}, mention ${cur} in the description.`,
    deprecated: (old: string) =>
      `${old} is deprecated. Mention ${old} in the description to confirm the change is intended.`,
    footer: 'Posted by decision-log. Areas come from the `areas` field of each decision.',
    statuses: {} as Record<string, string>,
  },
  th: {
    title: 'การตัดสินใจเชิงสถาปัตยกรรมที่เกี่ยวกับ PR นี้',
    intro: (n: number) => `PR นี้แก้โค้ดในส่วนที่มีการตัดสินใจกำกับอยู่ ${n} เรื่อง`,
    none: 'PR นี้ไม่ได้แก้โค้ดในส่วนที่มีการตัดสินใจกำกับแล้ว',
    decision: 'การตัดสินใจ',
    status: 'สถานะ',
    files: 'ไฟล์ใน PR นี้',
    more: (n: number) => `และอีก ${n} ไฟล์`,
    supersededBy: 'ถูกแทนที่ด้วย',
    edited: 'การตัดสินใจที่ถูกแก้ใน PR นี้',
    outdated: (old: string, cur: string) =>
      `${old} ไม่ใช่ข้อตกลงล่าสุดแล้ว ถ้าการแก้ไขนี้ทำตาม ${cur} ให้อ้างถึง ${cur} ในคำอธิบาย PR`,
    deprecated: (old: string) => `${old} ถูกยกเลิกแล้ว ให้อ้างถึง ${old} ในคำอธิบาย PR เพื่อยืนยันว่าตั้งใจแก้ส่วนนี้`,
    footer: 'สร้างโดย decision-log ส่วนของโค้ดที่ผูกกับแต่ละเรื่องมาจากช่อง `areas` ในไฟล์การตัดสินใจ',
    statuses: {
      proposed: 'เสนอแล้ว',
      accepted: 'ใช้อยู่',
      rejected: 'ไม่ใช้',
      deprecated: 'เลิกใช้แล้ว',
      superseded: 'ถูกแทนที่แล้ว',
    } as Record<string, string>,
  },
}

export interface CommentOptions {
  lang: Lang
  /** Builds a link to a decision file, e.g. on github.com at the PR head */
  link?: (d: Decision) => string
  violations?: Violation[]
}

export function renderComment(result: Affected, opts: CommentOptions): string {
  const t = text[opts.lang]
  const name = (d: Decision) => {
    const title = `${label(d)} ${escapeCell(d.title)}`
    return opts.link ? `[${title}](${opts.link(d)})` : title
  }
  const lines = [MARKER, `### ${t.title}`, '']

  if (!result.matches.length && !result.edited.length) {
    lines.push(t.none)
    return lines.join('\n') + '\n'
  }

  if (result.matches.length) {
    lines.push(t.intro(result.matches.length), '', `| ${t.decision} | ${t.status} | ${t.files} |`, '|---|---|---|')
    for (const m of result.matches) {
      const status = m.current
        ? `${t.supersededBy} ${name(m.current)}`
        : (t.statuses[m.decision.status] ?? m.decision.status)
      const shown = m.files.slice(0, 3).map((f) => `\`${f}\``)
      if (m.files.length > 3) shown.push(t.more(m.files.length - 3))
      lines.push(`| ${name(m.decision)} | ${status} | ${shown.join(', ')} |`)
    }
    lines.push('')
  }

  for (const v of opts.violations ?? []) {
    lines.push(
      `> [!WARNING]`,
      `> ${v.expected === v.decision ? t.deprecated(label(v.decision)) : t.outdated(label(v.decision), label(v.expected))}`,
      '',
    )
  }

  if (result.edited.length) {
    lines.push(`${t.edited}: ${result.edited.map(name).join(', ')}`, '')
  }

  lines.push(`<sub>${t.footer}</sub>`)
  return lines.join('\n') + '\n'
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|')
}
