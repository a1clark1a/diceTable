# Changelog

All notable changes to DiceTable are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Open source project scaffolding: `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md` (with DCO sign-off), `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1).
- GitHub community templates: issue templates (bug report, feature request, documentation), pull request template with verification checklist.
- `.github/dependabot.yml`: monthly grouped npm and GitHub Actions updates, targeting the `develop` branch, with `@types/node` major bumps ignored until `engines.node` is upgraded.
- `.editorconfig`: shared editor defaults (UTF-8, LF, final newline, 2-space indent; Markdown exempt from trailing-whitespace trimming).
- `npm run verify` script: runs lint, tests, and the type-check (build) in one command, matching CI.
- Architecture docs for the probability engine and security headers (`docs/architecture/`), linked from the README and CONTRIBUTING.

### Changed

- Pull request template now includes a "Dependencies" type-of-change option for Dependabot and manual dependency bumps.
- Slimmed the pull request template to a single checklist, dropping the local lint/test/build attestations in favor of the CI gate.
- Reworked the feature-request flow to a welcoming, demand-led stance and added a "Feature requests" section to CONTRIBUTING; the README and CONTRIBUTING now note `nvm use` for onboarding and the `verify` script for the pre-PR check.

### Fixed

- Feature request template's intro now correctly references the "Project scope" section of CONTRIBUTING.md (previously called out a "What it is / What it isn't" section that no longer exists).
- README Privacy and SECURITY.md now accurately describe the anonymous crash-report endpoint (`api/errors.ts`); both previously stated there was no server-side component or application telemetry.

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
