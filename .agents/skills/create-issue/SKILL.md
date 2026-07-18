---
name: create-issue
description: How to file a bug or documentation issue for DiceTable. Use when the user wants to report a bug, a wrong probability result, a crash, or a docs problem. For feature ideas, use suggest-feature instead.
---

# Filing an issue

## Before filing anything

1. **Search first.** Check open and closed issues for the same problem (`gh issue list --search "<keywords>" --state all` or the GitHub search UI). If a match exists, do not file a duplicate; point the user at it and suggest adding a 👍 or a comment with new information.
2. **Reproduce if you can.** For probability or UI bugs, try the dice expression in the running app (`npm run dev`) before filing. An issue that says "confirmed on local dev" is worth more than a guess. If you cannot reproduce, say so in the issue rather than overstating.
3. **Security bugs are never public issues.** Anything security-related goes through GitHub's private advisory form (see [SECURITY.md](../../../SECURITY.md)). Stop and redirect the user there.

## Pick the right template

Blank issues are disabled; every issue goes through a form:

- **Bug report** for wrong results, crashes, or broken UI.
- **Documentation** for gaps or errors in the docs.
- **Feature request** is not yours: switch to the `suggest-feature` playbook.
- Questions and open-ended ideas belong in [Discussions](https://github.com/a1clark1a/diceTable/discussions), not issues.

Prefer `gh issue create --web` so the form renders and the user submits it themselves. If filing from the CLI on the user's behalf, mirror the form's sections in the body.

## What a good bug report contains

The form requires these; collect them from the user before filing, and do not invent any of them:

- Steps to reproduce, expected result, actual result. One problem per issue.
- The dice expression(s) involved, exactly as entered (for example `4d6kh3 + 2`, advantage on).
- Where it happens: hosted version, local dev, or production build.
- Browser and OS (for example "Chrome 132 on Windows 11").
- Viewport: mobile (≤ 720 px), tablet, or desktop. DiceTable's mobile layout is a first-class citizen, so this matters.
- Screenshots and console errors when the bug is visual or a crash.

Title format follows the template prefix, for example `[Bug]: CCDF chart ignores modifier on kept dice`. Make the title the symptom, not the suspected cause.

## Tone

Factual and reproducible beats long. Do not speculate about the fix inside the report unless the user has actually diagnosed it; if they have, put the diagnosis in a clearly labeled paragraph at the end.
