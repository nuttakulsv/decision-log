import { marked } from 'marked'
import { currentOf, label } from './affected.js'
import { STATUSES, type Decision } from './decision.js'

export interface SiteOptions {
  title?: string
  /** Base URL for "view source" links, e.g. https://github.com/org/repo/blob/main */
  sourceUrl?: string
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)

export function buildSite(all: Decision[], opts: SiteOptions = {}): string {
  const title = opts.title ?? 'Architecture decisions'
  const byId = new Map(all.map((d) => [d.id, d]))
  const ref = (n: number) => {
    const d = byId.get(n)
    return d ? `<a href="#${label(d)}">${label(d)}</a>` : `ADR-${String(n).padStart(4, '0')}`
  }
  const sorted = [...all].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.id - a.id)
  const counts = STATUSES.map((s) => [s, all.filter((d) => d.status === s).length] as const).filter(([, n]) => n)

  const cards = sorted.map((d) => {
    const current = currentOf(all, d)
    const links = [
      d.supersedes.length ? `<span>Supersedes ${d.supersedes.map(ref).join(', ')}</span>` : '',
      d.supersededBy.length ? `<span>Superseded by ${d.supersededBy.map(ref).join(', ')}</span>` : '',
      current && !d.supersededBy.includes(current.id) ? `<span>Current: ${ref(current.id)}</span>` : '',
    ].join('')
    const body = marked.parse(d.body.replace(/^\s*#\s+.*\n/, ''), { async: false })
    const search = [label(d), d.title, d.status, ...d.tags, ...d.areas, ...d.deciders].join(' ').toLowerCase()
    return `<article id="${label(d)}" data-status="${esc(d.status)}" data-areas="${esc(JSON.stringify(d.areas))}" data-search="${esc(search)}">
<header>
<div class="row"><span class="id">${label(d)}</span><span class="status s-${esc(d.status)}">${esc(d.status || 'no status')}</span>${d.date ? `<time>${esc(d.date)}</time>` : ''}</div>
<h2><a href="#${label(d)}">${esc(d.title)}</a></h2>
<div class="meta">${d.deciders.length ? `<span>${d.deciders.map(esc).join(', ')}</span>` : ''}${links}${d.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
${d.areas.length ? `<div class="areas">${d.areas.map((a) => `<code>${esc(a)}</code>`).join(' ')}</div>` : ''}
</header>
<details><summary>Read</summary><div class="body">${body}</div>${opts.sourceUrl ? `<p class="src"><a href="${esc(`${opts.sourceUrl.replace(/\/$/, '')}/${encodeURI(d.file)}`)}">${esc(d.file)}</a></p>` : ''}</details>
</article>`
  })

  const areas = [...new Set(all.flatMap((d) => d.areas))].sort()

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="decision-log">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
<h1>${esc(title)}</h1>
<p class="summary">${all.length} decisions${counts.length ? ': ' + counts.map(([s, n]) => `${n} ${s}`).join(', ') : ''}</p>
<div class="controls">
<input type="search" id="q" placeholder="Search titles, tags, areas" aria-label="Search">
<select id="area" aria-label="Area"><option value="">All areas</option>${areas.map((a) => `<option>${esc(a)}</option>`).join('')}</select>
<div class="chips" role="group" aria-label="Status">${counts.map(([s]) => `<label><input type="checkbox" value="${s}" checked> ${s}</label>`).join('')}</div>
</div>
<div id="list">
${cards.join('\n')}
</div>
<p id="empty" hidden>No decisions match.</p>
</main>
<script>${JS}</script>
</body>
</html>
`
}

const CSS = `
:root{--bg:#fafaf9;--fg:#1c1917;--muted:#78716c;--card:#fff;--line:#e7e5e4;--accent:#0f766e;
--accepted:#15803d;--proposed:#a16207;--rejected:#b91c1c;--deprecated:#6b7280;--superseded:#6d28d9}
@media (prefers-color-scheme:dark){:root{--bg:#1c1917;--fg:#f5f5f4;--muted:#a8a29e;--card:#292524;--line:#44403c;--accent:#5eead4;
--accepted:#4ade80;--proposed:#facc15;--rejected:#f87171;--deprecated:#9ca3af;--superseded:#c4b5fd}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 system-ui,-apple-system,"Segoe UI","Noto Sans Thai","Sukhumvit Set","Leelawadee UI",sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 16px 64px}
h1{margin:0 0 4px;font-size:28px}
.summary{color:var(--muted);margin:0 0 20px}
.controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:20px}
input[type=search],select{font:inherit;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--fg)}
input[type=search]{flex:1 1 240px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chips label{font-size:14px;padding:4px 10px;border:1px solid var(--line);border-radius:999px;background:var(--card);cursor:pointer}
article{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 20px;margin-bottom:12px}
article:target{outline:2px solid var(--accent)}
.row{display:flex;gap:10px;align-items:center;font-size:14px;color:var(--muted)}
.id{font-family:ui-monospace,Menlo,monospace}
.status{font-weight:600;text-transform:capitalize}
.s-accepted{color:var(--accepted)}.s-proposed{color:var(--proposed)}.s-rejected{color:var(--rejected)}.s-deprecated{color:var(--deprecated)}.s-superseded{color:var(--superseded)}
h2{margin:4px 0 6px;font-size:20px;line-height:1.35}
h2 a{color:inherit;text-decoration:none}
.meta{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:14px;color:var(--muted)}
.tag{background:var(--bg);border-radius:6px;padding:0 8px}
.areas{margin-top:6px;font-size:13px}
code{font-family:ui-monospace,Menlo,monospace;font-size:.9em;background:var(--bg);padding:1px 5px;border-radius:4px}
a{color:var(--accent)}
details{margin-top:8px}
summary{cursor:pointer;color:var(--accent);font-size:14px}
.body table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}
.body th,.body td{border:1px solid var(--line);padding:6px 10px;text-align:left}
.body pre{overflow-x:auto;background:var(--bg);padding:12px;border-radius:8px}
.src{font-size:13px}
`

const JS = `
const q=document.getElementById('q'),area=document.getElementById('area'),boxes=[...document.querySelectorAll('.chips input')];
const cards=[...document.querySelectorAll('article')],empty=document.getElementById('empty');
function apply(){const s=q.value.trim().toLowerCase(),a=area.value,on=new Set(boxes.filter(b=>b.checked).map(b=>b.value));let shown=0;
for(const c of cards){const ok=(!s||c.dataset.search.includes(s))&&(on.has(c.dataset.status)||!boxes.some(b=>b.value===c.dataset.status))&&(!a||JSON.parse(c.dataset.areas).includes(a));c.hidden=!ok;if(ok)shown++}
empty.hidden=shown>0}
q.addEventListener('input',apply);area.addEventListener('change',apply);boxes.forEach(b=>b.addEventListener('change',apply));
if(location.hash){const t=document.getElementById(location.hash.slice(1));if(t)t.querySelector('details').open=true}
`
