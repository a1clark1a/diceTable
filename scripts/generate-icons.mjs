#!/usr/bin/env node
// Rasterizes public/favicon.svg into the PNG / ICO targets that PWAs, iOS,
// and legacy browsers expect. The SVG itself is hand-crafted and must never
// be overwritten — guarded explicitly below.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, '..', 'public');
const svgPath = resolve(publicDir, 'favicon.svg');

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const APPLE_BG = { r: 250, g: 250, b: 250, alpha: 1 }; // #fafafa, matches light theme

const pngTargets = [
  { name: 'apple-touch-icon.png', size: 180, background: APPLE_BG },
  { name: 'icon-192.png', size: 192, background: TRANSPARENT },
  { name: 'icon-512.png', size: 512, background: TRANSPARENT },
];

const icoSizes = [16, 32, 48];

// Open Graph cards render at 1200×630. We center the square favicon on a
// branded canvas so social previews show the logo at a generous size without
// distorting the original artwork.
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const OG_ICON_SIZE = 500;

async function rasterizePng(svgBuffer, size, background) {
  return sharp(svgBuffer, { density: 384 })
    .resize(size, size, { fit: 'contain', background })
    .png()
    .toBuffer();
}

async function rasterizeOgImage(svgBuffer) {
  const icon = await rasterizePng(svgBuffer, OG_ICON_SIZE, TRANSPARENT);
  return sharp({
    create: {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      channels: 4,
      background: APPLE_BG,
    },
  })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function main() {
  const svgBuffer = await readFile(svgPath);

  for (const target of pngTargets) {
    const outPath = resolve(publicDir, target.name);
    // The favicon source is hand-crafted; refuse to clobber it even by mistake.
    if (basename(outPath) === 'favicon.svg') {
      throw new Error('Refusing to overwrite favicon.svg');
    }
    const buf = await rasterizePng(svgBuffer, target.size, target.background);
    await writeFile(outPath, buf);
    const meta = await sharp(buf).metadata();
    console.log(`wrote ${target.name} (${meta.width}x${meta.height}, ${buf.byteLength} B)`);
  }

  const icoPngBuffers = await Promise.all(
    icoSizes.map((size) => rasterizePng(svgBuffer, size, TRANSPARENT)),
  );
  const icoBuffer = await pngToIco(icoPngBuffers);
  const icoPath = resolve(publicDir, 'favicon.ico');
  if (basename(icoPath) === 'favicon.svg') {
    throw new Error('Refusing to overwrite favicon.svg');
  }
  await writeFile(icoPath, icoBuffer);
  console.log(`wrote favicon.ico (${icoSizes.join('/')}, ${icoBuffer.byteLength} B)`);

  const ogBuffer = await rasterizeOgImage(svgBuffer);
  const ogPath = resolve(publicDir, 'og-image.png');
  await writeFile(ogPath, ogBuffer);
  console.log(`wrote og-image.png (${OG_WIDTH}x${OG_HEIGHT}, ${ogBuffer.byteLength} B)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
