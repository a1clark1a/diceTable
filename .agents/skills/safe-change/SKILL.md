---
name: safe-change
description: How to make a code change in DiceTable without breaking conventions or over-building. Use for any edit to source code, whether a bugfix, an improvement, or an agreed feature.
---

# Making a code change safely

## Before touching code

1. **Confirm the change is wanted.** Typos, small bugfixes, and type/lint/a11y tightening can go straight to code. Anything else needs an existing issue where the maintainer agreed. No issue means your first step is the `create-issue` or `suggest-feature` playbook, not an editor.
2. **Read the terrain.** Skim the relevant file in [docs/architecture/](../../../docs/architecture/) (engine, local-storage, branching, ci-cd) and read a neighboring source file to absorb local style. The codebase encodes its conventions; copy them.
3. **Start from fresh `develop`.** It is the default branch; branch off it.

## The change itself

**Smallest diff that solves the problem.** Concretely:

- Do not reformat, reorder, or "clean up" code you are not otherwise changing.
- Do not rename or move files unless that is the task.
- Do not add abstraction layers, registries, plugin systems, or config vocabularies. A previous incarnation of this project died of premature abstraction; the maintainer treats new abstractions as a cost, not a gift.
- Do not mix a refactor and a behavior change in one branch.

**Hard constraints that CI and review will enforce:**

- `src/engine/**` is pure: no React, Chakra, recharts, or any UI import. Math is exact, via distribution enumeration and convolution. Never approximate, never simulate.
- TypeScript strict: no `any`; `unknown` plus type guards or discriminated unions. Optional-field patches use the `'key' in patch` idiom (see `applyPartPatch` in `src/state/AppContext.tsx`).
- UI: Chakra primitives, semantic theme tokens (`bg.subtle`, `fg.muted`), never hex outside `src/components/chart/palette.ts`. New jargon gets a tooltip via the existing tips system (`src/components/ui/tips.tsx`).
- Mobile-first: desktop table changes need the card-layout equivalent (< 720 px) in the same edit, checked at 360 px in both color modes.
- Persistence: a new persisted field extends the validator in `src/state/persistedSchema.ts` in the same edit.
- Never touch `public/favicon.svg`, the package.json `version`, or `LICENSE`.

## Stop and ask the human

Pause and check with your user (who may need to check with the maintainer) when any of these appear:

- The diff is heading past roughly 300 changed lines or 8 source files.
- You need a new dependency.
- You need to change the storage envelope, the URL space, or the `Expression[]` data model.
- The change spans engine, state, and UI at once.
- The clean solution seems to require an abstraction the codebase does not have yet.

Being asked is always cheaper than reviewing an overgrown PR.

## Definition of done

1. `npm run verify` passes (lint, tests, type-checking build).
2. Behavioral changes have new or updated tests. Engine and math changes especially: tests are the trust anchor for a tool whose whole point is exact numbers.
3. UI changes eyeballed at 360 px and in dark mode.
4. User-visible changes noted under `[Unreleased]` in [CHANGELOG.md](../../../CHANGELOG.md).

Then move to the `create-pr` playbook.
