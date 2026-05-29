// THROWAWAY — measurement-only config used by row-edit-perf.plan.md.
// Aliases react-dom/client -> react-dom/profiling so a prod build still
// includes React DevTools Profiler instrumentation. Delete after Phase 5.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-dom/client': 'react-dom/profiling',
    },
  },
});
