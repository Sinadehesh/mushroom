#!/usr/bin/env node
// Renders the Play Store art that isn't a screenshot:
//   store/play-icon-512.png       the 512×512 store icon (from assets/icon.png)
//   store/play-feature-graphic.png 1024×500: logo, name and tagline, and a lock-screen quiz card.
// The card's photo must be CC0, so the art needs no credit: chanterelle #1 (see scripts/mushroom-photos.json).
//
//   npm run store-art

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CREAM = '#F6F1EA';
const INK = '#2A211B';
const AMBER = '#E8B866';
const GREEN = '#3F7D4A';

async function featureGraphic() {
  const W = 1024;
  const H = 500;
  const card = { x: 612, y: 38, w: 346, h: 424 };
  const photo = { x: card.x + 18, y: card.y + 52, w: card.w - 36, h: 200 };
  const chipW = 147;
  const chip = (x, y, label, right) => `
    <rect x="${x}" y="${y}" width="${chipW}" height="42" rx="12" fill="#FFFFFF" stroke="${right ? GREEN : '#E2D8CB'}" stroke-width="${right ? 3 : 1.5}" />
    <text x="${x + chipW / 2}" y="${y + 27}" text-anchor="middle" font-family="Helvetica, Arial, 'Liberation Sans', sans-serif" font-size="16" font-weight="bold" fill="${right ? GREEN : INK}">${label}</text>`;
  const cx = card.x + 18;
  const cy = photo.y + photo.h + 50;
  const scene = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <radialGradient id="bg" cx="0.2" cy="0.1" r="1.1">
        <stop offset="0" stop-color="#7A4527" />
        <stop offset="0.6" stop-color="#3E2416" />
        <stop offset="1" stop-color="#1E120B" />
      </radialGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.45" />
      </filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)" />
    <text x="66" y="262" font-family="Georgia, 'DejaVu Serif', serif" font-weight="bold" font-size="70" fill="${CREAM}">ShroomLock</text>
    <text x="68" y="318" font-family="Helvetica, Arial, 'Liberation Sans', sans-serif" font-size="29" fill="${CREAM}">Name the mushroom. Unlock your app.</text>
    <text x="68" y="362" font-family="Helvetica, Arial, 'Liberation Sans', sans-serif" font-size="21" fill="${AMBER}">Learn the mushrooms, and their look-alikes</text>
    <rect x="${card.x}" y="${card.y}" width="${card.w}" height="${card.h}" rx="28" fill="${CREAM}" filter="url(#shadow)" />
    <text x="${cx}" y="${card.y + 34}" font-family="Helvetica, Arial, 'Liberation Sans', sans-serif" font-size="13" font-weight="bold" letter-spacing="1.5" fill="#6E6259">YOUR APP IS LOCKED</text>
    <text x="${cx}" y="${cy - 14}" font-family="Georgia, 'DejaVu Serif', serif" font-size="23" font-weight="bold" fill="${INK}">What is this mushroom?</text>
    ${chip(cx, cy, 'Jack-o’-lantern', false)}${chip(cx + chipW + 16, cy, 'Chanterelle ✓', true)}
    ${chip(cx, cy + 52, 'Deadly Webcap', false)}${chip(cx + chipW + 16, cy + 52, 'Hedgehog', false)}
  </svg>`);
  const roundMask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${photo.w}" height="${photo.h}"><rect width="${photo.w}" height="${photo.h}" rx="18" /></svg>`,
  );
  const mushroom = await sharp(join(root, 'assets/mushrooms/chanterelle-1.jpg'))
    .resize(photo.w, photo.h, { fit: 'cover', position: 'attention' })
    .composite([{ input: roundMask, blend: 'dest-in' }])
    .png()
    .toBuffer();
  const logo = await sharp(join(root, 'assets/android-icon-foreground.png')).resize(190, 190).png().toBuffer();
  return sharp({ create: { width: W, height: H, channels: 3, background: CREAM } }).composite([
    { input: scene, left: 0, top: 0 },
    { input: mushroom, left: photo.x, top: photo.y },
    { input: logo, left: 34, top: 20 },
  ]);
}

mkdirSync(join(root, 'store'), { recursive: true });
await (await featureGraphic())
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toFile(join(root, 'store/play-feature-graphic.png'));
await sharp(join(root, 'assets/icon.png'))
  .resize(512, 512)
  .removeAlpha()
  .png()
  .toFile(join(root, 'store/play-icon-512.png'));
console.log('✓ store/play-feature-graphic.png, store/play-icon-512.png');
