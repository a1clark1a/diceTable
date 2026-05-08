import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { AppProvider } from '../../state/AppContext';
import { Sparkline, ShapeHeaderLabel } from './Sparkline';
import { uniformDistribution } from '../../engine/distribution';
import type { TargetState } from '../../types';

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

describe('Sparkline', () => {
  it('renders nothing for an empty distribution', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={new Map()} color="#000" />
      </Plain>,
    );
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders one visible bar per integer in the support range', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(6)} color="#000" />
      </Plain>,
    );
    expect(
      container.querySelectorAll('rect:not([fill="transparent"])'),
    ).toHaveLength(6);
  });

  it('renders one hit zone per integer for hover', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(6)} color="#000" />
      </Plain>,
    );
    expect(
      container.querySelectorAll('rect[fill="transparent"]'),
    ).toHaveLength(6);
  });

  it('does not fade any bars in PMF view', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(6)} color="#000" view="pmf" />
      </Plain>,
    );
    const rects = container.querySelectorAll(
      'rect:not([fill="transparent"])',
    );
    rects.forEach((rect) => {
      expect(rect.getAttribute('fill-opacity')).toBe('0.75');
    });
  });

  it('fades bars below the target in target view with ruling gte', () => {
    const target: TargetState = { value: 4, ruling: 'gte' };
    const { container } = render(
      <Plain>
        <Sparkline
          dist={uniformDistribution(6)}
          color="#000"
          view="target"
          target={target}
        />
      </Plain>,
    );
    const opacities = Array.from(
      container.querySelectorAll('rect:not([fill="transparent"])'),
    ).map((r) => r.getAttribute('fill-opacity'));
    expect(opacities).toEqual(['0.18', '0.18', '0.18', '0.75', '0.75', '0.75']);
  });

  it('does not fade any bars in target view when no target value is set', () => {
    const target: TargetState = { value: null, ruling: 'gte' };
    const { container } = render(
      <Plain>
        <Sparkline
          dist={uniformDistribution(6)}
          color="#000"
          view="target"
          target={target}
        />
      </Plain>,
    );
    Array.from(
      container.querySelectorAll('rect:not([fill="transparent"])'),
    ).forEach((r) => {
      expect(r.getAttribute('fill-opacity')).toBe('0.75');
    });
  });

  it('shows PMF tooltip text "value: percent" for each bar', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(6)} color="#000" view="pmf" />
      </Plain>,
    );
    const titles = Array.from(container.querySelectorAll('title')).map(
      (t) => t.textContent,
    );
    expect(titles[0]).toBe('1: 16.7%');
    expect(titles[5]).toBe('6: 16.7%');
  });

  it('shows CDF tooltip text "≤ value: cumulative percent" climbing to 100%', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(6)} color="#000" view="cdf" />
      </Plain>,
    );
    const titles = Array.from(container.querySelectorAll('title')).map(
      (t) => t.textContent,
    );
    expect(titles[0]).toBe('≤ 1: 16.7%');
    expect(titles[5]).toBe('≤ 6: 100%');
  });

  it('shows CCDF tooltip text "≥ value: cumulative percent" descending from 100%', () => {
    const { container } = render(
      <Plain>
        <Sparkline dist={uniformDistribution(6)} color="#000" view="ccdf" />
      </Plain>,
    );
    const titles = Array.from(container.querySelectorAll('title')).map(
      (t) => t.textContent,
    );
    expect(titles[0]).toBe('≥ 1: 100%');
    expect(titles[5]).toBe('≥ 6: 16.7%');
  });
});

describe('ShapeHeaderLabel', () => {
  function seed(chartView: string, targetValue: number | null = null) {
    const state = {
      version: 2,
      expressions: [
        {
          id: 'e1',
          name: 'Test',
          parts: [{ id: 'p1', count: 1, sides: 6 }],
          flatModifier: 0,
          rollMode: 'normal',
        },
      ],
      ui: {
        expandedId: null,
        chartView,
        target: { value: targetValue, ruling: 'gte' },
      },
    };
    window.localStorage.setItem(
      'dicetable.v2',
      JSON.stringify({ version: 2, value: state }),
    );
  }

  it('shows PMF when chartView is pmf', () => {
    seed('pmf');
    render(
      <AllProviders>
        <ShapeHeaderLabel />
      </AllProviders>,
    );
    expect(screen.getByText('PMF')).toBeInTheDocument();
  });

  it('shows CDF when chartView is cdf', () => {
    seed('cdf');
    render(
      <AllProviders>
        <ShapeHeaderLabel />
      </AllProviders>,
    );
    expect(screen.getByText('CDF')).toBeInTheDocument();
  });

  it('shows CCDF when chartView is ccdf', () => {
    seed('ccdf');
    render(
      <AllProviders>
        <ShapeHeaderLabel />
      </AllProviders>,
    );
    expect(screen.getByText('CCDF')).toBeInTheDocument();
  });

  it('shows Target when chartView is target and a target value is set', () => {
    seed('target', 10);
    render(
      <AllProviders>
        <ShapeHeaderLabel />
      </AllProviders>,
    );
    expect(screen.getByText('Target')).toBeInTheDocument();
  });

  it('falls back to PMF when chartView is target but no target value is set', () => {
    seed('target', null);
    render(
      <AllProviders>
        <ShapeHeaderLabel />
      </AllProviders>,
    );
    expect(screen.getByText('PMF')).toBeInTheDocument();
  });
});
