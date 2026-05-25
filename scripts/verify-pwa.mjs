import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
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

console.log(`verify-pwa: OK (${entries.length} precache entries, ${assetFiles.length} asset files)`);
