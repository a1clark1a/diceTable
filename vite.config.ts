import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function readCommitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

function readAppVersion(): string {
  try {
    const pkgUrl = new URL('./package.json', import.meta.url);
    const pkg = JSON.parse(readFileSync(fileURLToPath(pkgUrl), 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Serve the generated manifest (and a dev service worker) at /manifest.webmanifest
      // during `vite dev`. Without this the dev server has no PWA route, so index.html's
      // <link rel="manifest"> falls through to the SPA fallback and the browser's manifest
      // parser chokes on the returned HTML ("Manifest: Line 1, column 1, Syntax error").
      // suppressWarnings: the prod `workbox.globPatterns` below find nothing to precache in
      // the dev output dir, which otherwise logs a "glob doesn't match any files" warning.
      devOptions: { enabled: true, type: 'module', suppressWarnings: true },
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'apple-touch-icon.png',
        'icon-192.png',
        'icon-512.png',
        'og-image.png',
      ],
      manifest: {
        name: 'DiceTable',
        short_name: 'DiceTable',
        description:
          'Compare named dice rolls side by side. Build a table of expressions, set a target, and read the math behind every distribution.',
        theme_color: '#f2f1ed',
        background_color: '#f2f1ed',
        display: 'minimal-ui',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
    }),
  ],
  define: {
    __COMMIT_SHA__: JSON.stringify(readCommitSha()),
    __APP_VERSION__: JSON.stringify(readAppVersion()),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    pool: 'forks',
    // .claude holds agent worktrees, which are whole copies of this repo, test
    // files and all. It is gitignored, so a copy left behind by a crashed run
    // is invisible to git status while vitest happily collects it: the suite
    // reports double the files, and a stale copy fails a test that passes on
    // its own. Vitest's exclude REPLACES its defaults rather than extending
    // them, so spread them or node_modules comes back into the glob.
    exclude: [...configDefaults.exclude, '.claude/**'],
    // Vitest defaults to 5s, which suits a pure unit test and is too tight for
    // the component tests here: each one mounts the whole provider tree in
    // jsdom, and the chart tests pull recharts through the transform pipeline.
    // Those take about a second and a half idle and several times that whenever
    // the machine is busy, so the default turned a slow test into a coin flip.
    // A hung test still fails, just later.
    testTimeout: 15000,
  },
});
