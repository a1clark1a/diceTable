# Changelog

All notable changes to DiceTable are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.7.0] - 2026-08-16

### Added

- Roll-off view: the third workshop view. If every roll rolled once, it shows each roll's exact chance of producing the single highest result, as win bars scaled against the favorite with a headline sentence ("Sneak attack is most likely to come out on top." or "It's nearly a coin flip between…"), per-roll "ties X%" notes, and a Win chance / Table order sort toggle. Ties are counted separately because nobody wins them outright.
- Head-to-head view: the fourth workshop view. A matrix of one-on-one odds where each cell is how often the row roll strictly beats the column roll, ignoring every other row, colored by the hit-chance scale and bold at 50% or better. Hover or tap a cell for the full sentence including the tie chance. On mobile the matrix scrolls sideways inside its own container.
- Both views compute exactly from the distributions already on hand (a new pure `compare` engine module, no simulation), require at least two rolls with valid dice, and include Pool rolls on their success-count scale with a caption explaining why cross-scale match-ups are usually lopsided.
- Comparison docs: glossary entries (Roll-off, Head-to-head, Tie), a new "The Math" section on exact win and tie chances, an updated `public/llms.txt`, and a new Quickstart step introducing the four workshop views (the Roll and Share steps renumbered to 9 and 10).

## [1.6.0] - 2026-08-11

### Added

- Baseline comparisons: pin any roll as the baseline with the pin button on its row. The pinned roll keeps its own numbers, wears a Baseline badge, and gets a tinted row with an accent band. Every other roll then shows how it differs instead of its own totals: labeled avg and spread delta lines with small direction bars, signed Hit % differences in percentage points, and a plain-language verdict under the name ("Averages 3.5 higher · swingier · hits 46% more often"). Green means better, red worse, and spread changes stay neutral because more or less swing is not automatically better. Rolls on a different scale (Pool vs Sum) keep their own totals and compare by Hit % only. Pinning another roll moves the baseline, tapping the pin again clears it, and the choice survives reload. A caption above the table explains the state either way, and a new "Baseline" glossary entry covers the concept on the docs page.
- Community dice vocabulary: the glossary's "Target ruling" entry now ends with a small map from each ruling to its community name (≥ is "roll over" or "meet or beat" as in D&D and Pathfinder, ≤ is "roll under" as in Call of Cthulhu and GURPS, and the strict `>` `<` `=` readings are marked as having no common name).

### Changed

- The ≥ and ≤ ruling tooltips (on target chips, the Hit % header, and the target hit view) gained a second sentence naming the same community terms.

### Fixed

- TARGET view bar labels no longer overlap. Labels drop a redundant trailing ".0" (100.0% reads 100%), hide as a group when the bars are too narrow to fit them (hover or tap a bar for the exact value), and the chart claims a little more width per bar so labels fit at desktop sizes.

## [1.5.0] - 2026-08-02

### Added

- Target hit view: the second workshop view, registered beside "Table & chart" in the view switcher. It answers "how reliably does each roll meet the targets?" three ways. Grid shows a rolls × targets matrix of hit chances, color-coded from reliable (green) to long shot (red) and sortable by any target column (click to sort, click again to flip, once more to clear). Curves plots each Sum roll's hit chance for every possible target value at once, with dashed markers at the current targets. Bars shows one panel per target with rolls ranked by hit chance. The target toolbar is shared with the Table & chart view, which is unchanged visually.
- Pool rolls in the Target hit view: Grid and Bars show them against the shared pool target (marked with `*` and a footnote), and an All / Sum / Pools filter appears whenever both kinds of roll exist. Curves compares Sum rolls only.
- `public/llms.txt` now describes the Target hit view.

### Fixed

- Vercel API build: `api/tsconfig.json` now includes the Node type definitions, so the serverless error-report endpoint type-checks correctly on Vercel.

## [1.4.0] - 2026-07-31

### Added

- Dice pools (counting successes): every roll now has a Sum / Pool toggle in its Dice cell. A Pool roll counts how many dice meet a success threshold (direction and number editable inline, e.g. `count ≥8` on d10s) instead of adding faces into a total. Per-die odds stay exact, including rerolls. Keep and explode are stripped when a roll switches to Pool, so notation and math always agree; advantage/disadvantage is kept on the roll but has no effect while pooled.
- Auto-successes: on a Pool roll the flat modifier adds or removes successes directly (shown as `+2 auto`), and a result never drops below zero successes.
- Pool target: a shared "at least n successes" control in the target toolbar. Pool rolls' Hit % reads against it, while Sum rolls keep using the numeric targets.
- Successes chart: Pool rolls compare on their own panel with a success-count axis, beside the totals chart on desktop and stacked on mobile. Row colors still match the table swatches.
- Pool docs: glossary entries (dice pool, success, success threshold, auto-successes), a new "The Math" section on counting successes, a quickstart note on the Sum / Pool toggle, and an updated `public/llms.txt`.
- Share/export format v2 carries the new pool fields; v1 links and files still import, with their rolls defaulting to Sum.

### Fixed

- Removed the leftover commit sign-off checkbox from the PR template and the create-pr playbook. The DCO requirement itself was dropped in 1.2.0; these two references had survived that cleanup.

## [1.3.0] - 2026-07-27

### Added

- Workshop view switcher: a chip group above the table for switching between workshop views. This release registers only the existing "Table & chart" view; additional views (target hit, roll-off, head-to-head) register their chips as they land.
- Global roll mode: a Normal / Advantage / Disadvantage control in the header that applies one roll mode to every roll at once, with a "mixed" state shown when rows currently differ.
- "Add roll" button in the header, alongside the existing add row at the bottom of the table.

## [1.2.0] - 2026-07-17

### Added

- Open source project scaffolding: `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1).
- GitHub community templates: issue templates (bug report, feature request, documentation), pull request template with verification checklist.
- `.github/dependabot.yml`: monthly grouped npm and GitHub Actions updates, targeting the `develop` branch, with `@types/node` major bumps ignored until `engines.node` is upgraded.
- `.editorconfig`: shared editor defaults (UTF-8, LF, final newline, 2-space indent; Markdown exempt from trailing-whitespace trimming).
- `npm run verify` script: runs lint, tests, and the type-check (build) in one command, matching CI.
- Architecture docs for the probability engine and security headers (`docs/architecture/`), linked from the README and CONTRIBUTING.
- Crawlable, indexable homepage: a static `<h1>` and lead sentence shown above the roll table and baked into `index.html`, plus `WebApplication` structured data (JSON-LD), so search engines and non-JavaScript crawlers can read the homepage.
- Per-route SEO metadata via a `RouteHead` component: each route sets its own `<title>`, description, canonical URL, robots directive, and Open Graph / Twitter tags (the not-found page is `noindex`).
- `HowTo` structured data (JSON-LD) on the Docs quickstart, describing the getting-started steps for search engines and language models.
- `public/llms.txt`: a plain-language summary of what DiceTable is and computes (exact distributions via full convolution, dice notation, roll modes, stats, targets and hit rates) for large language model crawlers.

### Changed

- Pull request template now includes a "Dependencies" type-of-change option for Dependabot and manual dependency bumps.
- Slimmed the pull request template to a single checklist, dropping the local lint/test/build attestations in favor of the CI gate.
- Reworked the feature-request flow to a welcoming, demand-led stance and added a "Feature requests" section to CONTRIBUTING; the README and CONTRIBUTING now note `nvm use` for onboarding and the `verify` script for the pre-PR check.

### Fixed

- Feature request template's intro now correctly references the "Project scope" section of CONTRIBUTING.md (previously called out a "What it is / What it isn't" section that no longer exists).
- README Privacy and SECURITY.md now accurately describe the anonymous crash-report endpoint (`api/errors.ts`); both previously stated there was no server-side component or application telemetry.

### Removed

- Developer Certificate of Origin (DCO) sign-off requirement. Contributions remain MIT-licensed by the inbound=outbound rule, so an explicit `Signed-off-by:` trailer is no longer required. CONTRIBUTING.md, PR template, and README updated accordingly.

## [1.1.0] - 2026-06-03

Initial public release. Prior development history is preserved in the git commit log.

### Highlights

- Single flat table of named dice expressions with stats (mean, min, max, mode, σ, Hit %).
- Overlay chart for PMF / CDF / CCDF across all rows.
- Pure-function probability engine in `src/engine/` (full convolution, no approximations).
- Mobile-first card layout for screens under 720 px.
- Light and dark color modes.
- Versioned `localStorage` persistence with schema validation.
- PWA with offline support.

[Unreleased]: https://github.com/a1clark1a/diceTable/compare/v1.7.0...HEAD
[1.7.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.7.0
[1.6.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.6.0
[1.5.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.5.0
[1.4.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.4.0
[1.3.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.3.0
[1.2.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.2.0
[1.1.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.1.0
