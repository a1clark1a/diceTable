# Security Policy

## Supported Versions

Only the latest released version of DiceTable receives security updates.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| Older   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, report them privately through GitHub's Private Vulnerability Reporting:

1. Go to the [Security tab](../../security) of this repository.
2. Click **Report a vulnerability**.
3. Fill in the form with as much detail as you can: affected version, reproduction steps, and impact.

You should receive an acknowledgement within **7 days**. If the issue is confirmed, a fix will be prepared and released, and you will be credited in the advisory unless you prefer to remain anonymous.

## Scope

DiceTable is primarily a client-side React application that stores data in the browser's `localStorage`, with no user accounts. The one server-side component is a single serverless function, `api/errors.ts`, which accepts anonymous crash reports (error message, stack trace, page path, coarse browser name); it persists nothing and writes to logs only. There is no other remote data exchange beyond the static assets served by the host.

In-scope concerns include:

- XSS or injection via persisted state or URL parameters.
- Prototype pollution or supply-chain issues in dependencies.
- Logic errors in the probability engine that could be triggered by crafted input to crash or hang the app.
- Issues in the crash-report endpoint (`api/errors.ts`): unauthenticated input handling, log injection, or resource exhaustion.

Out of scope:

- Vulnerabilities in third-party hosting platforms (e.g., Vercel) — report those to the platform vendor.
- Self-XSS that requires the victim to paste attacker-supplied code into their own DevTools.
- Denial-of-service caused by deliberately large dice expressions; input bounds are enforced in the UI.

## Disclosure

This project follows coordinated disclosure. Please give the maintainer reasonable time to release a fix before public disclosure. A typical timeline is 90 days from the initial report, shortened if a fix ships sooner.
