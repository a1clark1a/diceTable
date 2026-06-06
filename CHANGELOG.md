# Changelog

All notable changes to DiceTable are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Open source project scaffolding: `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md` (with DCO sign-off), `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1).
- GitHub community templates: issue templates (bug report, feature request), pull request template with verification checklist.
- `.github/dependabot.yml`: monthly grouped npm and GitHub Actions updates, targeting the `develop` branch, with `@types/node` major bumps ignored until `engines.node` is upgraded.

### Changed

- Pull request template now includes a "Dependencies" type-of-change option for Dependabot and manual dependency bumps.

### Fixed

- Feature request template's intro now correctly references the "Project scope" section of CONTRIBUTING.md (previously called out a "What it is / What it isn't" section that no longer exists).

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

[Unreleased]: https://github.com/a1clark1a/diceTable/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/a1clark1a/diceTable/releases/tag/v1.1.0
