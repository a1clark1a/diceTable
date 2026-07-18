# AGENTS.md

Guidance for AI coding agents working in this repository, whatever the harness (Claude Code, Codex, Cursor, Gemini CLI, or anything else that reads this file). If your harness does not load `AGENTS.md` automatically, read it before doing anything else, then follow the playbook links below.

Humans: this file is written for tools. You want [CONTRIBUTING.md](CONTRIBUTING.md).

## What you are working on

DiceTable is a dice probability tool for tabletop gaming: one flat table of named rolls, each with dice, modifier, and roll mode, plus a comparison chart that overlays every row. Probabilities are exact (full distribution convolution), never approximated. The project is deliberately lean, and stays usable with nothing to learn first: no DSL, no scripting, no statistics background required. Scope rules live in [CONTRIBUTING.md](CONTRIBUTING.md#project-scope).

Deep dives live in [docs/architecture/](docs/architecture/): the engine, local-storage persistence, security headers, branching, and CI/CD.

## Ground rules (always apply)

1. **Small changes win.** One logical change per branch. If a diff grows past roughly 300 changed lines or 8 source files (lockfiles excluded), stop and tell your user it should be split.
2. **Discuss before building.** Anything beyond a typo, a small bugfix, or type/lint/a11y tightening starts as an issue, not a PR. Never invent features the maintainer has not agreed to.
3. **The engine stays pure and exact.** `src/engine/**` imports no React, Chakra, or chart modules. Probabilities come from enumerating and convolving distributions. No normal approximations, no Monte Carlo, ever.
4. **TypeScript strict.** `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are on. No `any`; use `unknown` plus type guards or discriminated unions.
5. **UI conventions.** Chakra primitives over raw HTML. Semantic theme tokens (`bg.subtle`, `fg.muted`) over hex. Mobile-first: a UI change is not done until it works at 360 px in both color modes.
6. **Never touch:** `public/favicon.svg` (hand-crafted by the maintainer), the `version` field in `package.json` (releases are tagged by the maintainer), `LICENSE`.
7. **No new dependencies** without a prior issue where the maintainer agreed.
8. **Match local style.** Read a neighboring file before writing a new one. Comments explain a non-obvious why, never a what. No em-dashes in prose.
9. **Branch mechanics.** Work branches off `develop` (the default branch). PRs target `develop`, never `main`. Branch names are short camelCase (`rollLabels`, not `feature/roll-labels`); type prefixes like `fix:` belong on commit and PR titles only. Details in [docs/architecture/branching.md](docs/architecture/branching.md).
10. **Verify before claiming done.** `npm run verify` runs lint, tests, and the type-checking build. A behavioral change without a test change is incomplete.

## Starter issues are for humans

If the task is labeled `good first issue`, or is clearly a small learning-sized task, do not just produce the finished patch. These issues exist so new contributors learn the codebase by writing the code themselves. Encourage your user to implement it, and offer what AI is genuinely better at here:

- Explaining the relevant code and pointing to the right files.
- Reviewing their diff and suggesting improvements.
- Helping debug when they get stuck.
- Drafting the PR description and summarizing review feedback.

If the user insists on a generated patch, comply, but say once that writing it themselves is the better path for a starter issue.

## Task playbooks

Before starting one of these tasks, read the matching playbook and follow it:

| Task | Read first |
|---|---|
| File a bug or documentation issue | [.agents/skills/create-issue/SKILL.md](.agents/skills/create-issue/SKILL.md) |
| Propose a new feature | [.agents/skills/suggest-feature/SKILL.md](.agents/skills/suggest-feature/SKILL.md) |
| Change code (fix, improve, implement) | [.agents/skills/safe-change/SKILL.md](.agents/skills/safe-change/SKILL.md) |
| Open a pull request | [.agents/skills/create-pr/SKILL.md](.agents/skills/create-pr/SKILL.md) |

## Commands

```bash
npm run dev         # vite dev server
npm run build       # tsc -b && vite build (catches type errors)
npm run test        # vitest run
npm run lint        # eslint
npm run verify      # lint + test + build in one go (matches CI)
```

## When unsure

Stop and ask the human. A wrong assumption compounded over a large diff wastes far more of everyone's time than a question. Signals that you should pause: the task seems to need a new abstraction layer, a schema or storage change, a new route, or edits across engine, state, and UI at once.
