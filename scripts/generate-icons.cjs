/* eslint-disable @typescript-eslint/no-require-imports */
// Regenerates the raster app icons + native source assets from the vector
// sources in public/. Run from the repo root:  node scripts/generate-icons.cjs
//
// Sources:  public/icon.svg (rounded-square glyph), public/icon-maskable.svg (full-bleed)
// Outputs:  public/icon-192.png, public/icon-512.png, public/icon-maskable-512.png,
//           public/apple-touch-icon.png  (PWA / web)
//           assets/icon.png (1024), assets/splash.png (2732)  (source for @capacitor/assets)
//
// sharp ships transitively with Next.js, so no extra install is required.

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pub = path.join(root, 'public');
const assets = path.join(root, 'assets');
fs.mkdirSync(assets, { recursive: true });

const iconSvg = fs.readFileSync(path.join(pub, 'icon.svg'));
const maskSvg = fs.readFileSync(path.join(pub, 'icon-maskable.svg'));

async function png(svgBuf, size, out) {
  await sharp(svgBuf, { density: 512 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log('wrote', path.relative(root, out));
}

(async () => {
  await png(iconSvg, 192, path.join(pub, 'icon-192.png'));
  await png(iconSvg, 512, path.join(pub, 'icon-512.png'));
  await png(maskSvg, 512, path.join(pub, 'icon-maskable-512.png'));
  // iOS home-screen icon uses the full-bleed variant (iOS rounds corners; no transparency).
  await png(maskSvg, 180, path.join(pub, 'apple-touch-icon.png'));

  // Native source for `npx @capacitor/assets generate`.
  await png(maskSvg, 1024, path.join(assets, 'icon.png'));

  const glyph = await sharp(iconSvg, { density: 512 }).resize(820, 820).png().toBuffer();
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: '#f5f5f7' } })
    .composite([{ input: glyph, gravity: 'center' }])
    .png()
    .toFile(path.join(assets, 'splash.png'));
  console.log('wrote', path.relative(root, path.join(assets, 'splash.png')));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
