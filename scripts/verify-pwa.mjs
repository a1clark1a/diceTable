import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(__dirname, '..', 'dist');

if (!existsSync(distDir)) {
  console.error('verify-pwa: dist/ does not exist. Run `npm run build` first.');
  process.exit(1);
}

const swPath = resolve(distDir, 'sw.js');
const manifestPath = resolve(distDir, 'manifest.webmanifest');

if (!existsSync(swPath)) {
  console.error(`verify-pwa: missing ${swPath}`);
  process.exit(1);
}
if (!existsSync(manifestPath)) {
  console.error(`verify-pwa: missing ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const requiredManifestKeys = [
  'name',
  'short_name',
  'description',
  'theme_color',
  'background_color',
  'display',
  'start_url',
  'icons',
];
for (const key of requiredManifestKeys) {
  if (!(key in manifest)) {
    console.error(`verify-pwa: manifest.webmanifest missing key "${key}"`);
    process.exit(1);
  }
}
if (manifest.display !== 'minimal-ui') {
  console.error(`verify-pwa: manifest.display expected "minimal-ui", got "${manifest.display}"`);
  process.exit(1);
}
if (manifest.start_url !== '/') {
  console.error(`verify-pwa: manifest.start_url expected "/", got "${manifest.start_url}"`);
  process.exit(1);
}
for (const icon of manifest.icons) {
  const iconPath = resolve(distDir, icon.src.replace(/^\//, ''));
  if (!existsSync(iconPath)) {
    console.error(`verify-pwa: icon ${icon.src} declared in manifest but missing on disk`);
    process.exit(1);
  }
}

const swSource = readFileSync(swPath, 'utf8');
const swSiblings = readdirSync(distDir).filter((f) => /^workbox-.*\.js$/.test(f));
const sources = [swSource, ...swSiblings.map((f) => readFileSync(resolve(distDir, f), 'utf8'))];
const combined = sources.join('\n');

const entries = [];
const entryRegex = /\{\s*"?url"?\s*:\s*"([^"]+)"\s*,\s*"?revision"?\s*:\s*("[^"]*"|null)\s*\}/g;
let m;
while ((m = entryRegex.exec(combined)) !== null) {
  entries.push(m[1]);
}
if (entries.length === 0) {
  console.error('verify-pwa: could not extract any precache entries from sw.js / workbox-*.js');
  process.exit(1);
}

const precached = new Set(entries);

function expect(url, label) {
  if (!precached.has(url)) {
    console.error(`verify-pwa: precache missing ${label}: ${url}`);
    process.exit(1);
  }
}

expect('index.html', 'index.html');
expect('manifest.webmanifest', 'manifest.webmanifest');
expect('favicon.svg', 'favicon.svg');
expect('favicon.ico', 'favicon.ico');
expect('apple-touch-icon.png', 'apple-touch-icon.png');
expect('icon-192.png', 'icon-192.png');
expect('icon-512.png', 'icon-512.png');
expect('og-image.png', 'og-image.png');

const assetFiles = readdirSync(resolve(distDir, 'assets'));
for (const file of assetFiles) {
  expect(`assets/${file}`, `dist/assets/${file}`);
}

const requiredChunkPrefixes = [
  'ComposedChart-',
  'OverlayChartImpl-',
  'InspectChartBody-',
  'DocsPage-',
];
for (const prefix of requiredChunkPrefixes) {
  const found = assetFiles.find((f) => f.startsWith(prefix) && f.endsWith('.js'));
  if (!found) {
    console.error(`verify-pwa: expected a chunk starting with "${prefix}" in dist/assets/ but none found`);
    process.exit(1);
  }
}

// Runs the built sw.js against a stand-in Workbox that records each
// NavigationRoute, so the check reads the routes a browser would get instead
// of pattern-matching minified source.
function readNavigationRoutes(source) {
  const navigationRoutes = [];
  class NavigationRoute {
    constructor(_handler, { allowlist = [/./], denylist = [] } = {}) {
      this.allowlist = allowlist;
      this.denylist = denylist;
    }
  }
  const workbox = new Proxy({}, {
    get: (_target, name) => {
      if (name === 'NavigationRoute') return NavigationRoute;
      if (name === 'registerRoute') {
        return (route) => {
          if (route instanceof NavigationRoute) navigationRoutes.push(route);
        };
      }
      return function noop() {};
    },
  });
  const sandbox = { define: (_deps, factory) => factory(workbox), skipWaiting() {}, addEventListener() {} };
  sandbox.self = sandbox;
  runInNewContext(source, sandbox);
  return navigationRoutes;
}

const navigationRoutes = readNavigationRoutes(swSource);
if (navigationRoutes.length !== 1) {
  console.error(`verify-pwa: expected one NavigationRoute in sw.js, found ${navigationRoutes.length}`);
  process.exit(1);
}
const [navigation] = navigationRoutes;
// Same order as workbox-routing's NavigationRoute: the denylist wins, both
// lists test path plus query.
const getsAppShell = (path) =>
  !navigation.denylist.some((re) => re.test(path)) && navigation.allowlist.some((re) => re.test(path));

const vercelConfig = JSON.parse(readFileSync(resolve(rootDir, 'vercel.json'), 'utf8'));
const serverPaths = [
  ...readdirSync(distDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !precached.has(entry.name))
    .map((entry) => `/${entry.name}`),
  ...readdirSync(resolve(rootDir, 'api'))
    .filter((name) => name.endsWith('.ts') && !name.startsWith('_') && !name.endsWith('.d.ts'))
    .map((name) => `/api/${name.slice(0, -3)}`),
  ...(vercelConfig.rewrites ?? [])
    .filter((rule) => rule.destination !== '/index.html' && /^\/[\w./-]*$/.test(rule.source))
    .map((rule) => rule.source),
];
for (const path of serverPaths) {
  if (getsAppShell(path)) {
    console.error(`verify-pwa: the service worker answers ${path} with the app shell; add it to workbox.navigateFallbackDenylist in vite.config.ts`);
    process.exit(1);
  }
}

const sitemapPaths = [...readFileSync(resolve(distDir, 'sitemap.xml'), 'utf8').matchAll(/<loc>https?:\/\/[^/<]+(\/[^<]*)<\/loc>/g)].map((match) => match[1]);
if (sitemapPaths.length === 0) {
  console.error('verify-pwa: no <loc> entries in dist/sitemap.xml');
  process.exit(1);
}
for (const path of sitemapPaths) {
  if (!getsAppShell(path)) {
    console.error(`verify-pwa: workbox.navigateFallbackDenylist blocks the app route ${path}, so it stops opening offline`);
    process.exit(1);
  }
}

console.log(`verify-pwa: OK (${entries.length} precache entries, ${assetFiles.length} asset files, ${serverPaths.length} server paths outside the app shell)`);
