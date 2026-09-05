import '@testing-library/jest-dom/vitest';

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
