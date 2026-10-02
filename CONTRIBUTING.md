# Contributing

Thanks for helping. Bug reports that include the decision file (or a trimmed copy) and the command you ran are the easiest to fix.

## Setup

```bash
git clone https://github.com/nuttakulsv/decision-log.git
cd decision-log
npm install
npm test
npx tsx src/cli.ts --help     # run the CLI from source
```

Node.js 22 or newer is needed for development. The published package runs on Node.js 20.

## Before opening a pull request

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
```

- `npm run build` also rebuilds `action/index.cjs`, the bundled GitHub Action. Commit it together with your change to `src/`. CI fails if the committed bundle is out of date.
- If your change touches a design choice recorded in `docs/decisions`, say so in the description (for example "follows ADR-0003") or add a new decision. This repository runs its own Action on pull requests.
- Parser changes need a test in `test/decision.test.ts`. If you hit a file layout from another ADR tool that we don't read, a sample file is the most useful thing you can attach.

## Releasing

1. Update `version` in `package.json` and `src/version.ts`, and add a section to `CHANGELOG.md`.
2. `npm run build`, commit, tag `vX.Y.Z`, push the tag.
3. Move the major tag so `uses: nuttakulsv/decision-log@v0` picks up the release: `git tag -f v0 && git push -f origin v0`.
4. `npm publish`.
