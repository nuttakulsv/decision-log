export type Lang = 'en' | 'th'

// Section layout follows MADR (https://adr.github.io/madr/), trimmed to what reviewers read.
const en = `## Context

What is the problem, and why does it need a decision now? Mention the constraints (deadline, team size, budget, existing systems).

## Options

| | Option A | Option B | Option C |
|---|---|---|---|
| Effort to build | | | |
| Cost to run | | | |
| Operational risk | | | |
| Reversibility | | | |

## Decision

We will ... because ...

## Consequences

- Good: ...
- Bad: ...
- To watch: what would make us revisit this?

## Review

Revisit by: YYYY-MM-DD (or when ... happens)
`

const th = `## บริบท

ปัญหาคืออะไร ทำไมต้องตัดสินใจตอนนี้ มีข้อจำกัดอะไรบ้าง (เวลา ขนาดทีม งบ ระบบเดิม)

## ทางเลือก

| | ทางเลือก A | ทางเลือก B | ทางเลือก C |
|---|---|---|---|
| แรงที่ต้องใช้สร้าง | | | |
| ค่าใช้จ่ายตอนรัน | | | |
| ความเสี่ยงตอนใช้งานจริง | | | |
| ถอยกลับได้ง่ายแค่ไหน | | | |

## สิ่งที่ตัดสินใจ

เราจะ ... เพราะ ...

## ผลที่ตามมา

- ข้อดี: ...
- ข้อเสีย: ...
- ต้องคอยดู: ถ้าเกิดอะไรขึ้น เราจะกลับมาทบทวนเรื่องนี้

## ทบทวน

ทบทวนภายใน: YYYY-MM-DD (หรือเมื่อ ... เกิดขึ้น)
`

export function template(lang: Lang): string {
  return lang === 'th' ? th : en
}

export function firstDecision(lang: Lang): { title: string; body: string } {
  return lang === 'th'
    ? {
        title: 'บันทึกการตัดสินใจเชิงสถาปัตยกรรม',
        body: `## บริบท

ทีมต้องจำได้ว่าเคยตัดสินใจเรื่องสำคัญอะไรไว้ และตัดสินใจด้วยเหตุผลอะไร โดยเฉพาะตอนที่คนที่ตัดสินใจไม่ได้อยู่ในทีมแล้ว

## สิ่งที่ตัดสินใจ

เราจะเขียน Architecture Decision Record (ADR) ไว้ใน repo นี้ ไฟล์ละหนึ่งเรื่อง ใช้ decision-log สร้างไฟล์และตรวจรูปแบบ ADR ที่ระบุ \`areas\` จะถูกแสดงใน pull request ที่แก้โค้ดส่วนนั้น

## ผลที่ตามมา

- เหตุผลของการตัดสินใจอยู่คู่กับโค้ด และถูก review ผ่าน pull request เหมือนโค้ด
- ต้องมีวินัยเขียน ADR ตอนตัดสินใจเรื่องที่ย้อนกลับยาก
`,
      }
    : {
        title: 'Record architecture decisions',
        body: `## Context

We need to remember which significant decisions were made and why, especially after the people who made them have moved on.

## Decision

We will keep Architecture Decision Records in this repository, one file per decision, created and checked with decision-log. Decisions with \`areas\` are shown on pull requests that change those files.

## Consequences

- The reasoning lives next to the code and goes through review like code.
- Someone has to write the record when a hard-to-reverse decision is made.
`,
      }
}
