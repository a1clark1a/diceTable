# Contributing to DiceTable

Thanks for considering a contribution. A few things up front so we can both spend time well.

## Maintainer bandwidth

DiceTable is maintained by one person in spare time. There is no SLA on issues or pull requests. I will get to things when I can, and I may decline contributions that don't fit the project's scope even if the code is good. Please don't take that personally.

## Before you open a pull request

For anything beyond a small fix (typo, obvious bug, doc tweak), please open an issue first describing what you want to change and why. A brief discussion up front is much cheaper than a closed PR after you've already written the code.

Good candidates for a "just send the PR" change:

- Typos and broken links.
- A clear bug fix with a failing test that now passes.
- Tightening types, lint, or a11y in an existing component without changing behavior.

Things that should always start as an issue:

- New features or new UI surfaces.
- Refactors that touch the engine, state, or persistence layers.
- Anything that changes the URL space, the storage envelope, or the data model.
- New dependencies.

## Project scope

DiceTable has a deliberately tight scope. The short version:

- One flat table of named rolls. The table is the editor is the compare view.
- Probabilities are computed via full convolution. No approximations, no Monte Carlo.
- The engine under `src/engine/` is pure. No React, no Chakra, no chart library imports.
- TypeScript strict, mobile-first, theme tokens not hex.

If a change pushes toward multiple tables, a DSL, rule packs, a sidebar, or per-row "type" fields, it is almost certainly out of scope. Open an issue and let's talk before you spend time on it.

## Feature requests

Feature ideas are welcome, and opening an issue to propose one is encouraged. Two things keep the app from bloating over time:

- **Lean by default.** A feature has to earn its place. The question is "does this help the core job of building and comparing dice rolls," not "is this a neat idea." Some genuinely good ideas get declined just to keep the surface small.
- **Demand is the strongest signal.** The features most likely to ship are the ones several people ask for. If a request already exists, add a 👍 reaction instead of filing a duplicate. That reaction count is what I watch when deciding what is worth building.

Speculative or "what if" ideas are a great fit for [Discussions](https://github.com/a1clark1a/diceTable/discussions). Once an idea shows clear interest there, it can graduate to a tracked issue.

## Branching

DiceTable uses a two-branch model: `feature → develop (staging) → main (production)`.

- **`develop`** is the integration branch and the repository default. It deploys to staging, and it's where contributions land. A fresh clone starts on `develop`, and GitHub pre-selects it as the PR base.
- **`main`** is the production branch. It's protected, and the maintainer promotes `develop` to `main` with a release PR. After each release, `main` is merged back into `develop` automatically. Contributors don't open PRs against `main`.

```bash
git clone https://github.com/a1clark1a/diceTable.git
cd diceTable                 # a fresh clone starts on develop
git checkout -b myChange     # branch off develop
```

Branch names are short camelCase describing the change (`rollLabels`, `workflowUpdate`). Type prefixes like `chore:` or `feat:` go on commit messages and PR titles, not branch names.

When you open the pull request, the base branch defaults to `develop`. Leave it there. A PR opened against `main` will be asked to retarget.

For a visual walkthrough of the full flow, see [docs/architecture/branching.md](docs/architecture/branching.md).

## Development workflow

```bash
npm install
npm run dev         # vite dev server
npm run build       # tsc -b && vite build (catches type errors)
npm run test        # vitest run
npm run lint        # eslint
npm run verify      # lint + test + build in one go (matches CI)
```

CI runs lint, the test suite, and the type-check (build) on every PR, so those gates are enforced for you. Running them locally is about faster feedback, not clearing a hurdle. Before opening a PR:

1. `npm run verify` is green.
2. If you touched UI, eyeball it at 360 px width and in dark mode.
3. Add or update tests for behavioral changes.

## AI-assisted contributions

Using an AI coding assistant here is welcome. The repository ships guidance so any harness behaves like a good contributor: [AGENTS.md](AGENTS.md) holds the ground rules, and [.agents/skills/](.agents/skills/) contains task playbooks (filing issues, proposing features, making changes, opening PRs). Most current tools read `AGENTS.md` automatically; if yours doesn't, point it there before starting.

Two expectations come with it:

- **You own what you submit.** Review every line before pushing, and be able to explain the diff in your own words. "The AI wrote it" is not an answer a review can work with.
- **On `good first issue` tasks, write the code yourself.** Those issues exist so new contributors learn the codebase. AI is genuinely useful there for explaining code, reviewing your diff, drafting the PR description, and summarizing review threads. Generating the whole patch skips the part that was the point.

Keep AI-assisted changes small and focused. Assistants tend to over-produce; the scope rules above and the size guardrails in `AGENTS.md` are the antidote.

## Pull request guidelines

- Keep PRs focused. One logical change per PR.
- Update or add tests for behavioral changes.
- Update [CHANGELOG.md](CHANGELOG.md) under "Unreleased" if your change is user-visible.
- Don't bump the version in `package.json`. Releases are tagged by the maintainer.
- Don't add dependencies without discussion.

## Code style

The codebase already encodes its conventions. Read a neighboring file before writing a new one. The big ones:

- Default to no comments. A comment earns its place by explaining a non-obvious WHY, not the WHAT.
- Chakra primitives over raw `<div>`.
- Semantic theme tokens (`bg.subtle`, `fg.muted`) over hex.
- No `any`. Use `unknown` + type guards or discriminated unions.

For deeper context on specific subsystems, see [`docs/architecture/`](docs/architecture/): the [engine](docs/architecture/engine.md), [local-storage persistence](docs/architecture/local-storage.md), and [security headers](docs/architecture/security-headers.md).

## Reporting bugs

Use the bug report issue template. Include:

- What you did, what you expected, what happened instead.
- A minimal repro (the dice expression, the row count, browser + OS).
- Screenshots help, especially for UI bugs.

## Reporting security issues

Do not file public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md) for the private reporting channel.

## Code of Conduct

Participation in this project is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). Be kind. Disagreements about technical direction are fine; personal attacks are not.

## License

By submitting a contribution, you agree that your contribution is licensed under the [MIT License](LICENSE), the same license that covers the rest of the project. No separate Contributor License Agreement is required.
