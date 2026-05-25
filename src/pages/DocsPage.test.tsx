import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import DocsPage from './DocsPage';

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location" data-search={location.search} data-pathname={location.pathname} />
  );
}

function renderAt(initialEntry: string) {
  return render(
    <ChakraProvider value={defaultSystem}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </ChakraProvider>,
  );
}

function currentSearch(): string {
  return screen.getByTestId('location').getAttribute('data-search') ?? '';
}

describe('DocsPage routing', () => {
  it('renders the Quickstart panel when ?tab=quickstart', () => {
    renderAt('/docs?tab=quickstart');
    expect(
      screen.getByRole('heading', { name: 'Add your first roll' }),
    ).toBeInTheDocument();
  });

  it('renders the Glossary panel when ?tab=glossary', () => {
    renderAt('/docs?tab=glossary');
    expect(screen.getByText('Dice expression')).toBeInTheDocument();
  });

  it('renders the Math panel when ?tab=math', () => {
    renderAt('/docs?tab=math');
    expect(
      screen.getByRole('heading', {
        name: '1 · A single die: every face equally likely',
      }),
    ).toBeInTheDocument();
  });

  it('defaults to Quickstart when ?tab is missing', () => {
    renderAt('/docs');
    expect(
      screen.getByRole('heading', { name: 'Add your first roll' }),
    ).toBeInTheDocument();
  });

  it('defaults to Quickstart when ?tab is unknown', () => {
    renderAt('/docs?tab=banana');
    expect(
      screen.getByRole('heading', { name: 'Add your first roll' }),
    ).toBeInTheDocument();
  });

  it('updates the URL search param when a tab is clicked', () => {
    renderAt('/docs');
    expect(currentSearch()).toBe('');

    fireEvent.click(screen.getAllByRole('tab', { name: /Glossary/ })[0]!);
    expect(currentSearch()).toBe('?tab=glossary');
    expect(screen.getByText('Dice expression')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('tab', { name: /The Math/ })[0]!);
    expect(currentSearch()).toBe('?tab=math');
    expect(
      screen.getByRole('heading', {
        name: '1 · A single die: every face equally likely',
      }),
    ).toBeInTheDocument();
  });
});
