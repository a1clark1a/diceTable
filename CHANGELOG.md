# Changelog

All notable changes to DiceTable are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Open source project scaffolding: `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md` (with DCO), `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1).

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
