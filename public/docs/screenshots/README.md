# Quickstart screenshots

These PNGs back the Quickstart tab on `/docs`. Eight slots, one per step.

| File                  | Step                                         |
| --------------------- | -------------------------------------------- |
| `quickstart-01.png`   | Add your first roll                          |
| `quickstart-02.png`   | Read dice notation (4d6kh3+2 close-up)       |
| `quickstart-03.png`   | Read the chart (PMF / CDF / CCDF)            |
| `quickstart-04.png`   | Roll modes — advantage / disadvantage        |
| `quickstart-05.png`   | Keep, reroll, and explode                    |
| `quickstart-06.png`   | Compare rolls                                |
| `quickstart-07.png`   | Set targets and read Hit %                   |
| `quickstart-08.png`   | Share and import                             |

Files referenced by `Quickstart.tsx` that are missing from this folder render a labeled placeholder, not a broken image — so the docs page still ships cleanly while assets are being captured.

## How to capture

1. Run `npm run build && npm run preview` (production build — dev mode is visually noisier and slower; see the "Test perf in prod" project rule).
2. Open Chrome devtools → device toolbar.
3. Capture the **desktop** flavor at **1200 × 800** for steps 1, 6, 7, 8 (full-table shots benefit from width).
4. Capture **close-ups** at the natural element size for steps 2, 4, 5 (zoom in on the affected control).
5. Capture step 3 at a width that fits the chart and its legend without horizontal scroll — typically 1000–1200 px wide.
6. Use **light mode** for v1 — the docs page renders both modes, but a single screenshot per step keeps the page light. (If we add dark-mode variants later, suffix them `quickstart-01.dark.png` and update `Quickstart.tsx` to switch on `useColorMode`.)
7. Save with `pngcrush` or similar; the goal is < 200 KB per file. Hand-authored annotations (numbered chips, callouts) live in JSX, not in the PNG — keep the screenshot itself clean.

## Drift

When the underlying UI changes in a way that visibly affects a screenshot, the `/check-docs-drift` skill flags it. Re-capture, replace the PNG, commit. The manifest at `docs/docs-manifest.json` is the source of truth for which components back which screenshot.

## Why no auto-capture

Playwright + a headless build would automate this. Rejected for v1: the manual workflow is fine while content volume is small, and adding CI/build complexity now is not worth it. Revisit if the manual workflow actually starts hurting.
