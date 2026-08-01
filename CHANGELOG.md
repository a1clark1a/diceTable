# Changelog

All notable changes to DiceTable are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Dice pools (counting successes): every roll now has a Sum / Pool toggle in its Dice cell. A Pool roll counts how many dice meet a success threshold (direction and number editable inline, e.g. `count ≥8` on d10s) instead of adding faces into a total. Per-die odds stay exact, including rerolls. Keep and explode are stripped when a roll switches to Pool, so notation and math always agree; advantage/disadvantage is kept on the roll but has no effect while pooled.
- Auto-successes: on a Pool roll the flat modifier adds or removes successes directly (shown as `+2 auto`), and a result never drops below zero successes.
- Pool target: a shared "at least n successes" control in the target toolbar. Pool rolls' Hit % reads against it, while Sum rolls keep using the numeric targets.
- Successes chart: Pool rolls compare on their own panel with a success-count axis, beside the totals chart on desktop and stacked on mobile. Row colors still match the table swatches.
- Pool docs: glossary entries (dice pool, success, success threshold, auto-successes), a new "The Math" section on counting successes, a quickstart note on the Sum / Pool toggle, and an updated `public/llms.txt`.
- Share/export format v2 carries the new pool fields; v1 links and files still import, with their rolls defaulting to Sum.

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

[Unreleased]: https://github.com/a1clark1a/diceTable/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.3.0
[1.2.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.2.0
[1.1.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.1.0
