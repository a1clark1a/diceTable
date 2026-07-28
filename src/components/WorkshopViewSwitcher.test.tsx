import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import {
  WorkshopViewSwitcher,
  type WorkshopViewChip,
} from './WorkshopViewSwitcher';

const Provider = ({ children }: { children: React.ReactNode }) => (
  <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
);

const VIEWS: WorkshopViewChip[] = [
  { id: 'table', label: 'Table & chart', mobileLabel: 'Rolls' },
  { id: 'target', label: 'Target hit' },
];

// jsdom has no matchMedia, so useIsDesktop defaults to the desktop branch.
function mockViewport(isDesktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: isDesktop,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('WorkshopViewSwitcher', () => {
  it('renders one chip per view using desktop labels', () => {
    render(
      <Provider>
        <WorkshopViewSwitcher views={VIEWS} active="table" onSelect={vi.fn()} />
      </Provider>,
    );
    expect(
      screen.getByRole('button', { name: 'Table & chart' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Target hit' }),
    ).toBeInTheDocument();
  });

  it('marks only the active view chip as pressed', () => {
    render(
      <Provider>
        <WorkshopViewSwitcher views={VIEWS} active="target" onSelect={vi.fn()} />
      </Provider>,
    );
    expect(screen.getByRole('button', { name: 'Target hit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('button', { name: 'Table & chart' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onSelect with the chip id when an inactive chip is clicked', () => {
    const onSelect = vi.fn();
    render(
      <Provider>
        <WorkshopViewSwitcher views={VIEWS} active="table" onSelect={onSelect} />
      </Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Target hit' }));
    expect(onSelect).toHaveBeenCalledWith('target');
  });

  it('uses the mobile label when set and falls back to the full label otherwise', () => {
    mockViewport(false);
    render(
      <Provider>
        <WorkshopViewSwitcher views={VIEWS} active="table" onSelect={vi.fn()} />
      </Provider>,
    );
    expect(screen.getByRole('button', { name: 'Rolls' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Table & chart' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Target hit' }),
    ).toBeInTheDocument();
  });
});
