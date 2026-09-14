import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { AppProvider } from "../../state/AppContext";
import { OverlayChart } from "./OverlayChart";
import { ChartFallback } from "./ChartFallback";

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

const Plain = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
);

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>
    <AppProvider>{children}</AppProvider>
  </ChakraProvider>
);

afterEach(() => {
  window.localStorage.clear();
});

interface SeededExpr {
  id: string;
  name: string;
  parts: { id: string; count: number; sides: number }[];
  flatModifier: number;
  rollMode: "normal" | "advantage" | "disadvantage";
}

function seed(expressions: SeededExpr[], chartView: string = "pmf") {
  const state = {
    version: 2,
    expressions,
    ui: {
      expandedId: null,
      chartView,
      target: { values: [] as number[], ruling: "gte" as const },
    },
  };
  window.localStorage.setItem(
    "dicetable.v2",
    JSON.stringify({ version: 2, value: state }),
  );
}

function oneValidExpr(): SeededExpr[] {
  return [
    {
      id: "e1",
      name: "Seed",
      parts: [{ id: "p1", count: 1, sides: 6 }],
      flatModifier: 0,
      rollMode: "normal",
    },
  ];
}

function manyExprs(count: number): SeededExpr[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    name: `Row ${i}`,
    parts: [{ id: `p${i}`, count: 1, sides: 6 }],
    flatModifier: 0,
    rollMode: "normal" as const,
  }));
}

describe("ChartFallback", () => {
  it('renders an accessible "loading chart" status for the overlay variant', () => {
    render(
      <Plain>
        <ChartFallback variant="overlay" />
      </Plain>,
    );
    expect(
      screen.getByRole("status", { name: /loading chart/i }),
    ).toBeInTheDocument();
  });

  it('renders an accessible "loading chart" status for the inspect variant', () => {
    render(
      <Plain>
        <ChartFallback variant="inspect" />
      </Plain>,
    );
    expect(
      screen.getByRole("status", { name: /loading chart/i }),
    ).toBeInTheDocument();
  });
});

describe("OverlayChart lazy loading", () => {
  it("lazy-loads the chart impl after rendering the fallback when at least one row is valid", async () => {
    seed(oneValidExpr());
    render(
      <AllProviders>
        <OverlayChart />
      </AllProviders>,
    );

    expect(
      screen.getByRole("status", { name: /loading chart/i }),
    ).toBeInTheDocument();

    await waitForElementToBeRemoved(
      () => screen.queryByRole("status", { name: /loading chart/i }),
      { timeout: 10000 },
    );
  });

  // The lazy chunk is resolved by the test above and React.lazy caches it, so
  // these two assert on the mounted surface rather than on a fallback that only
  // appears the first time the module is imported.
  it("draws its share of a 21-row table and says what it left out", async () => {
    seed(manyExprs(21));
    const { container } = render(
      <AllProviders>
        <OverlayChart />
      </AllProviders>,
    );

    // It mounts rather than refusing, which is the whole change: this table
    // used to get an empty card and pay no chart cost at all.
    await waitFor(() => {
      expect(
        container.querySelector(".recharts-responsive-container"),
      ).not.toBeNull();
    });
    expect(screen.getByText(/showing 1 to 20 of 21 rolls/i)).toBeInTheDocument();
    expect(screen.queryByText(/disabled past/i)).toBeNull();

    // The twenty-first roll is a page away rather than unreachable.
    const next = screen.getByRole('button', { name: /more rolls on the totals chart/i });
    expect(next).toBeEnabled();
    fireEvent.click(next);
    expect(screen.getByText(/showing 21 to 21 of 21 rolls/i)).toBeInTheDocument();
  });

  it("says nothing about a cut when every roll is drawn", async () => {
    seed(manyExprs(20));
    const { container } = render(
      <AllProviders>
        <OverlayChart />
      </AllProviders>,
    );

    await waitFor(() => {
      expect(
        container.querySelector(".recharts-responsive-container"),
      ).not.toBeNull();
    });
    expect(screen.queryByText(/showing \d+ to/i)).toBeNull();
  });
});
