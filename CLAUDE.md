# CLAUDE.md

Project conventions for Claude Code working on **DiceTable**. This file is loaded into context for every conversation. Skills under `.claude/skills/` extend it with task-specific workflows — see the bottom of this file for which skill to use when.

---

## What this project is

A dice probability tool for tabletop / strategy gaming. One flat table of named rolls, each with dice / modifier / roll-mode and computed stats. A comparison chart overlays every row.

**The table is the editor is the compare view.** There is no sidebar. There is no separate detail pane. There are no rule-pack abstractions.

## What this project is NOT

- **Not AnyDice.** No DSL, no scripting, no `output` / `loop` syntax.
- **Not a TTRPG balance workshop.** No multiple tables, no presets, no rule packs, no shareable fragments, no per-row "type" / "category" fields, no per-type behavior.
- **Not a sidebar app.** The previous design used a sidebar + editor + compare panel. That was wrong for the use case and was deleted. Don't reintroduce it.

If a request seems to push toward any of the above, stop and confirm before implementing.

---

## Hard rules

### Engine purity
`src/engine/**` contains pure functions only. No imports from `react`, `@chakra-ui/*`, `recharts`, `next-themes`, `lucide-react`, or any other UI module. Math runs in tests with no DOM. **Why:** the engine is the asset of last resort — if it stays portable, we can reuse it in a worker, a CLI, or a different UI without rewrites.

### Math via full convolution
Probabilities are computed by enumerating distributions and convolving them. **No** uniform / normal approximations, **no** Monte Carlo shortcuts. Speed is bought through bounding inputs (UI caps, complexity guards), not through giving up exactness. **Why:** users compare numbers across rows and trust them. Approximations would silently break that trust.

### TypeScript strict
- `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are on.
- No `any`. Use `unknown` + type guards or discriminated unions.
- Prefer narrow patches with `'key' in patch` for "explicitly clear this optional" semantics. See `applyPartPatch` in `src/state/AppContext.tsx`.
- Type assertions (`x as Foo`) are smell — comment why or refactor.

### Mobile-first
The card layout (`< 720 px`) is real, not an afterthought. Test at 360 px before claiming a UI change is done. New desktop controls get a card-equivalent in the same edit.

### Theme tokens, not hex
Use semantic tokens (`bg.subtle`, `fg.muted`, `border.subtle`, `colorPalette.*`). Hex is allowed only inside `src/components/chart/palette.ts` for chart fills. Anywhere else a hex string appears is a bug.

### Chakra primitives, not raw HTML
`<Box>`, `<HStack>`, `<Field>`, `<Table>`, `<Input>`, etc. Raw `<div>` only when no primitive fits — and document why.

### One flat data model
`Expression[]` is the world. No registries, no plugin systems, no effect vocabularies, no schema-driven derived columns, no calc graphs. **Why:** the previous SS-DiceTable project died of premature abstraction. None of those layers are needed to compute `4d6kh3 + 2`.

### Comments explain WHY, not WHAT
Default to no comments. A comment earns its place by explaining a non-obvious constraint, a workaround, or an invariant. Don't reference the current task / PR / issue in source code.

---

## Architecture at a glance

```
User input
   ↓ (Chakra controls)
RollsTable / RollsCards / TargetToolbar / RollExpand
   ↓ (action callbacks)
AppContext  ──persist──▶  useLocalStorage  ◀──hydrate──  localStorage
   ↓ (expressions)
expressionDistribution  →  partDistribution  →  uniformDistribution / convolve / keep / reroll / explode
   ↓ (Distribution)
stats (mean, σ, hitProbability, …)   /   OverlayChart (PMF / CDF / CCDF overlay)
```

Single source of truth: `AppContext`. Persistence: `useLocalStorage` with versioned envelopes. UI is mostly stateless — local state appears only for transient input buffering (when added).

---

## Conventions worth knowing before editing

### Per-row distributions are recomputed in multiple consumers
`RollsTable`, `RollsCards`, and `OverlayChart` each call `expressionDistribution(expr)` inside their own `useMemo([expressions])`. Because every state edit replaces the array, every consumer recomputes every row on every keystroke. This is acceptable today but is the first thing to fix if perf becomes a concern — see `.claude/plans/` for any active work.

### Patch semantics
`PartPatch` and `ExpressionPatch` use the `'key' in patch` idiom to differentiate "leave alone" from "explicitly clear":

```ts
if ('keep' in patch) {
  if (patch.keep) next.keep = patch.keep;
  else delete next.keep;
}
```

When adding a new optional field, follow the same shape.

### Tooltips on jargon
Every abbreviation, column header, or term that isn't self-evident gets a tooltip via `<HelpTerm tip={TIPS.x}>` (visual cue: dotted underline). Tip strings live in `src/components/ui/tips.tsx` — never inline. Add new entries there as you introduce new terms.

**Tooltip voice:** plain language, not math jargon. Lead with what the user sees ("How spread out the results are"), not the formal name ("Standard deviation"). Second person where it fits, one idea per sentence, two sentences max, mention interaction if the cell is clickable. Full rules in `/ui-design` under "Tooltip / micro-copy voice."

### Color palette
Row swatches and chart series use `ROW_PALETTE` in `src/components/chart/palette.ts` indexed by row position. Swatches in the table match the chart legend by index. Don't expand the palette without a reason.

### IDs
`newId(prefix)` in `AppContext.tsx` prefers `crypto.randomUUID` and falls back to `Math.random + Date.now`. **`crypto.randomUUID` is only available in secure contexts (HTTPS / localhost).** If we deploy to non-HTTPS, the fallback path activates — currently fine because IDs are row keys, not security tokens.

### LocalStorage trust
`useLocalStorage` accepts an optional `validate` function and `AppContext` wires `validatePersistedState` (`src/state/persistedSchema.ts`). Malformed envelopes fall back to the initial state. When adding a new persisted field, extend the validator in the same edit — consumers below the hook can trust the shape.

### Favicon is a hand-crafted asset
`public/favicon.svg` is custom-designed by the user (gold lightning-bolt motif with blue accents). **Never overwrite, regenerate, or replace it.** If launch work later needs PNG fallbacks or `apple-touch-icon`, generate them *from* the existing SVG — don't replace the source.

---

## Commands

```bash
npm run dev         # vite dev server
npm run build       # tsc -b && vite build (also catches type errors)
npm run test        # vitest run
npm run test:watch  # vitest watch
npm run lint        # eslint
```

Always run `npm run build` before claiming a code change is done. `npm run test` if you touched anything math, state, or persistence-related.

---

## When to use which skill

- **Implementing a feature?** Invoke `/implement-feature`. It enforces the React / TS / perf / security rules above and refuses to write tests or visual styling.
- **Writing or fixing tests?** Invoke `/test`. It picks the right test level and runs the suite when done.
- **Planning a non-trivial change?** Invoke `/plan-feature`. It produces a phased markdown plan with a Mermaid diagram, written to `.claude/plans/<slug>.plan.md`. The plan is portable to a new conversation.
- **Designing or restyling UI?** Invoke `/ui-design`. It applies Chakra v3 patterns and a tabletop-game-tool aesthetic (calm, tactile, franchise-agnostic — no parchment, no dragons).
- **Verifying a UI change actually looks right rendered?** Invoke `/design-review`. It screenshots the running app (Playwright MCP) at 360 / 720 / 1200 px in both color modes and grades it against the design system, emitting a severity-ranked punch list. Read-only — it reports, then `/ui-design` applies the fixes. Requires the `playwright` MCP server.
- **About to open a PR that touched engine, chart, or row-edit code?** Invoke `/check-docs-drift`. It diffs the branch against `main`, intersects changed files with `docs/docs-manifest.json`, and prints which `/docs` sections (Quickstart steps, Glossary entries, Math snippets) likely need a re-read. Read-only — does not edit docs or the manifest.
- **Final green-check before opening a PR?** Invoke `/pre-pr`. It runs the test suite, runs eslint with `--fix`, resolves the remaining lint errors by hand, then re-verifies both. Does not run the type-check (`npm run build`); the user runs that themselves.

If a request crosses skills (e.g. "add a feature with tests and styling"), call them in order: plan-feature (if non-trivial) → implement-feature → ui-design → design-review → test. Run `/check-docs-drift` and `/pre-pr` last, just before the PR.

---

## Deferred / extension points

These are explicit "we know we'll want this someday — here's the shape so it can land additively." None of them is built today; **do not** start implementing one without the user asking.

### Multiple tables

The single-table rule still stands. When multi-table eventually lands, these decisions in the current code are designed to absorb it without a rewrite:

- **URL space.** `/` is the current single table. `/tables/:id` is reserved for the future. When multi-table ships, `/` redirects to the most recently used table.
- **Persistence.** Today everything lives in one envelope `dicetable.v2`. Future shape (NOT built):
  - Index at `dicetable.index.v3` listing the tables.
  - Per-table envelope at `dicetable.table.{id}.v3`.
  - The migrator reads the v2 envelope and seeds it as the first table.
- **Per-table vs. global UI prefs.** Today `chartView`, `target`, and `expandedId` are global. In a multi-table world they belong to the active table — they'd move into the per-table envelope, with truly global prefs (color mode, last-opened table) staying separate.
- **`AppContext` shape.** Stays single-table-flat for now. Adding tables later means an outer `TablesContext` listing `{ id, name }` plus the active id; `AppContext` becomes per-table and is keyed by `id`.

### Drift checking

- `/check-docs-drift` is pre-PR / opt-in only. No git hook, no CI hook. When a remote eventually exists, a CI job can call the same logic against the merge base — until then, the skill is the only entry point.
- The manifest `docs/docs-manifest.json` is hand-maintained. Adding a new `/docs` section means adding its entry to the manifest in the same edit.

---

## Lessons carried from previous attempts

- **Premature abstraction killed the previous SS-DiceTable project.** Don't add effect vocabularies, calc graphs, fragment composition, schema-driven columns, or soft-fail diagnostics. None of them are needed.
- **Sidebar + editor was wrong for this use case.** The user wants to scan and compare many rolls at once. That's a table, not a list-and-detail.
- **Type / category fields invite per-type behavior.** Rows are intentionally agnostic.
- **TS strictness up front.** `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` stay on.
