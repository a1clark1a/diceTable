import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// Three components sit behind React.lazy, and the heaviest of them pulls in
// recharts. A cold dynamic import of that chunk inside a worker competing with
// 97 other test files routinely outlasts Testing Library's one-second default,
// so a findBy* across a lazy boundary reports import latency as a missing
// element. This raises only the ceiling on waiting: a query that resolves
// immediately still resolves immediately, so passing tests are not slowed.
configure({ asyncUtilTimeout: 5000 });

// jsdom ships no ResizeObserver, and every floating Chakra surface (Menu,
// Popover, Tooltip) reaches for one through @floating-ui the moment it opens.
// Without this the observer throws inside a rAF callback, which surfaces as an
// unhandled rejection rather than a test failure.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
