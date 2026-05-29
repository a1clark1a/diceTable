# DiceTable

A focused dice probability tool. Build a single table of named dice rolls — each row is a dice expression with optional modifiers, keep / reroll / explode rules, and a roll mode (normal / advantage / disadvantage). Stat columns show mean, min, max, mode, σ, and an optional Hit % against a target. A chart below the table overlays every row's distribution (PMF / CDF / CCDF) for direct comparison.

## Stack

- **React 19** + **TypeScript** (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- **Vite** for dev / build
- **Chakra UI v3** for primitives and theming
- **Recharts** for the comparison chart
- **vitest** + **React Testing Library** for tests
- Pure-function probability engine in `src/engine/` (no UI imports)

## Getting started

```bash
npm install
npm run dev          # http://localhost:5173
npm run test         # full vitest suite
npm run test:watch
npm run build        # tsc -b && vite build
npm run lint
```

## Project layout

```
src/
  engine/                 # pure probability math — no React, no Chakra, no recharts
    distribution.ts       # uniform, convolve, shift, normalise
    parts.ts              # single die + count, keep, reroll, explode
    expression.ts         # multi-part sum, modifier, roll-mode (adv/dis)
    stats.ts              # mean, variance, mode, cdf, ccdf, hitProbability, …
  state/
    AppContext.tsx        # the only stateful component; persists to localStorage v2
  hooks/
    useLocalStorage.ts    # versioned envelope persistence with optional migrator
  components/
    RollsTable.tsx        # desktop table view
    RollsCards.tsx        # mobile card view (≤ 720 px)
    RollExpand.tsx        # per-row editor (parts + roll mode)
    TargetToolbar.tsx     # target value + ruling, drives Hit % column
    chart/
      OverlayChart.tsx    # PMF/CDF/CCDF toggle, legend, all rows overlaid
      palette.ts          # 8-colour series palette + status colours
      format.ts           # number / percent formatting helpers
    editor/
      DicePartRow.tsx     # count, sides, keep/reroll/explode controls
      ExpressionRender.tsx # dice-text rendering with kh/kl tooltip tokens
    ui/                   # tooltip, help-term, color-mode (Chakra plumbing)
  types.ts                # all shared types
```

## Data model

One flat `Expression[]`. No groups, no categories, no per-row "type" field.

```ts
type RollMode = "normal" | "advantage" | "disadvantage";

interface DicePart {
  id: string;
  count: number; // ≥ 1
  sides: number; // ≥ 2
  keep?: { type: "highest" | "lowest"; n: number };
  reroll?: { values: number[]; mode: "once" | "always" };
  explode?: { onFaces: number[]; depthCap: number };
}

interface Expression {
  id: string;
  name: string;
  parts: DicePart[]; // summed
  flatModifier: number;
  rollMode: RollMode;
}
```

Persisted shape (`localStorage` key `dicetable.v2`):

```ts
type ChartView = "pmf" | "cdf" | "ccdf" | "target";
type TargetRuling = "gte" | "gt" | "lte" | "lt" | "eq";

interface TargetState {
  values: number[]; // up to MAX_TARGETS (5)
  ruling: TargetRuling;
}

interface PersistedState {
  version: 2;
  expressions: Expression[];
  ui: {
    expandedId: string | null;
    chartView: ChartView;
    target: TargetState;
  };
}
```

The envelope is schema-validated on load via `validatePersistedState`
(`src/state/persistedSchema.ts`); malformed entries fall back to the initial
state instead of throwing.
