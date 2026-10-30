'use strict';
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('../../tools/node_modules/@napi-rs/canvas');
const { plate } = require('../../tools/lib/storybook');
const H = require('./shop');

const OUT = path.join(__dirname, '..', 'out');

async function icon() {
  const P = plate({ id: 'icon', w: 14, h: 14, ppm: 512 / 14, seed: 'boba-icon-2', paper: 'hotpress' });
  H.bobaCup(P, 7.1, 13.3, 0.3, { stage: 'ready' });
  const big = P.S.toCanvas();
  const sizes = { 'icon-512.png': 512, 'icon-192.png': 192, 'apple-touch-icon.png': 180, 'favicon-48.png': 48, 'favicon-32.png': 32, 'favicon-16.png': 16 };
  for (const [name, px] of Object.entries(sizes)) {
    const c = createCanvas(px, px), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high'; g.drawImage(big, 0, 0, px, px);
    fs.writeFileSync(path.join(OUT, name), await c.encode('png'));
  }
}

async function og() {
  const P = plate({ id: 'og', w: 240, h: 126, ppm: 5, seed: 'boba-og-2', paper: 'hotpress' });
  P.text('statechart art', 13, 26, { face: 'serif-bold', size: 5 });
  P.text('The business', 12, 48, { size: 12.6 });
  P.text('of boba', 12, 65, { size: 12.6 });
  P.italic('four statecharts,', 13, 83, { face: 'serif-bold', size: 5.8 });
  P.italic('drawn by hand', 13, 91.6, { face: 'serif-bold', size: 5.8 });
  const base = P.S.toCanvas(), c = createCanvas(1200, 630), x = c.getContext('2d');
  x.drawImage(base, 0, 0);
  const cards = [['order', 640, 316, -0.1, 236], ['day', 770, 288, -0.03, 236], ['counter', 905, 300, 0.04, 236], ['bug', 1040, 330, 0.09, 250]];
  for (const [name, cx, cy, rot, size] of cards) {
    const img = await loadImage(path.join(OUT, name + '-preview.png'));
    x.save(); x.translate(cx, cy); x.rotate(rot);
    x.fillStyle = '#e4d9c6'; x.fillRect(-size / 2 + 8, -size / 2 + 9, size, size);
    x.drawImage(img, -size / 2, -size / 2, size, size);
    x.strokeStyle = '#21201f'; x.lineWidth = 2.2; x.strokeRect(-size / 2, -size / 2, size, size);
    x.restore();
  }
  fs.writeFileSync(path.join(OUT, 'og.png'), await c.encode('png'));
}

(async () => { await icon(); await og(); console.log('icons and og written'); })().catch((e) => { console.error(e); process.exit(1); });
