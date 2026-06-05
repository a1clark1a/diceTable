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

## Developer Certificate of Origin (DCO)

This project uses the [Developer Certificate of Origin](https://developercertificate.org) instead of a CLA. The DCO is a lightweight statement that the code you're contributing is yours to contribute, or that you have the right to contribute it under the project's license.

To sign off on a commit, add the `-s` flag:

```bash
git commit -s -m "Fix off-by-one in keep-highest logic"
```

This appends a `Signed-off-by: Your Name <your-email>` line to the commit message. By doing so you certify the full text of the DCO (reproduced below). PRs without sign-offs may be asked to amend their commits before being merged.

Set your git identity once:

```bash
git config user.name "Your Name"
git config user.email "your-email@example.com"
```

## Development workflow

```bash
npm install
npm run dev         # vite dev server
npm run build       # tsc -b && vite build (catches type errors)
npm run test        # vitest run
npm run lint        # eslint
```

Before opening a PR:

1. `npm run lint` is clean.
2. `npm run test` is green.
3. `npm run build` succeeds (this is the type-check).
4. If you touched UI, you've at least eyeballed it at 360 px width and in dark mode.
5. Commits are signed off (`git commit -s`).

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

By submitting a contribution, you agree that your contribution is licensed under the [MIT License](LICENSE), the same license that covers the rest of the project.

---

## Developer Certificate of Origin 1.1

```
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.
1 Letterman Drive
Suite D4700
San Francisco, CA, 94129

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and the contribution is a record of the project,
    (including all personal information I submit with it, including
    my sign-off) is a record maintained indefinitely and may be
    used, redistributed in accordance with this project or the
    open source license(s) involved.
```
