import { run } from './action.js'

run(process.env).then(
  (r) => {
    console.log(`decision-log: ${r.decisions.length} decisions matched, comment ${r.comment}`)
    if (r.failed) process.exitCode = 1
  },
  (err: unknown) => {
    console.log(`::error::${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
  },
)
