'use strict';
const path = require('path');
const fs = require('fs');
const M = require('./media');
const { D } = M;
const { rng } = require('../../tools/kit/util');
const tools = require('module').createRequire(path.join(__dirname, '..', '..', 'tools', 'package.json'));
const { createCanvas } = tools('@napi-rs/canvas');

const OUT = path.join(__dirname, '..', 'out', 'brand');

function patch(P, c, r, q = {}) {
  const R = rng('patch' + r), disc = [];
  for (let i = 0; i < 96; i++) { const a = (i / 96) * Math.PI * 2, k = r * (1 + (R() - 0.5) * 0.012); disc.push([c + Math.cos(a) * k, c + Math.sin(a) * k]); }
  P.fill([disc], '#26304f', { tool: 'pastelpencil', pressure: 1, passes: 3 });
  for (let i = 0; i < 260; i++) { const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r * 0.86; P.line([[c + Math.cos(a) * d, c + Math.sin(a) * d], [c + Math.cos(a) * d + (R() - 0.5) * 1.6, c + Math.sin(a) * d + (R() - 0.5) * 1.6]], { tool: 'pencil', color: R() < 0.5 ? '#334068' : '#1d2541', pressure: 0.5 }); }
  const rim = q.rim ?? r * 0.13;
  for (let i = 0; i < 240; i++) { const a = (i / 240) * Math.PI * 2, a2 = a + 0.05; P.line([[c + Math.cos(a) * (r - rim), c + Math.sin(a) * (r - rim)], [c + Math.cos(a2) * r * 0.995, c + Math.sin(a2) * r * 0.995]], { tool: 'gel', color: i % 2 ? '#e2b33f' : '#f6ecd2', nib: q.nib ?? 0.9 }); }
  const w = q.body ?? r * 0.15, top = c - r * 0.56, bottom = c + r * 0.3;
  const body = [[c - w, bottom], [c - w, top], [c + w, top], [c + w, bottom]];
  P.fill([body], '#d9dcdc', { tool: 'pencil', pressure: 0.95, passes: 3 });
  P.outline([body], { color: '#1d1a1e', nib: q.ink ?? 0.6 });
  for (const sx of [-1, 1]) { const fin = [[c + sx * w, top + w * 0.25], [c + sx * (w + w * 0.62), top + w * 0.25], [c + sx * (w + w * 0.62), top + w * 1.05], [c + sx * w, top + w * 1.05]]; P.fill([fin], '#5d6266', { tool: 'pencil', pressure: 1, passes: 2 }); P.outline([fin], { color: '#1d1a1e', nib: (q.ink ?? 0.6) * 0.8 }); }
  const ay = top + w * 1.75, ah = w * 0.42, reach = r * 0.66;
  for (const sx of [-1, 1]) { const arm = [[c + sx * (w + 0.2), ay], [c + sx * reach, ay], [c + sx * reach, ay + ah], [c + sx * (w + 0.2), ay + ah]]; P.fill([arm], '#e2b33f', { tool: 'pencil', pressure: 1, passes: 3 }); P.outline([arm], { color: '#1d1a1e', nib: (q.ink ?? 0.6) * 0.8 }); }
  const flame = [[c - w * 0.8, bottom + 0.3], [c, bottom + r * 0.36], [c + w * 0.8, bottom + 0.3]];
  P.fill([flame], '#ff9d52', { tool: 'pencil', pressure: 1, passes: 3 });
  P.fill([[[c - w * 0.42, bottom + 0.3], [c, bottom + r * 0.22], [c + w * 0.42, bottom + 0.3]]], '#ffe7a8', { tool: 'pencil', pressure: 1, passes: 2 });
}

async function shrink(canvas, w, h) {
  let src = canvas;
  while (src.width / 2 >= w * 1.5) { const c = createCanvas(Math.round(src.width / 2), Math.round(src.height / 2)), g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height); src = c; }
  const c = createCanvas(w, h), g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h); return c;
}
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = head.length;
  pngs.forEach((p, i) => { const e = 6 + 16 * i; head.writeUInt8(p.size, e); head.writeUInt8(p.size, e + 1); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6); head.writeUInt32LE(p.buf.length, e + 8); head.writeUInt32LE(off, e + 12); off += p.buf.length; });
  return Buffer.concat([head, ...pngs.map((p) => p.buf)]);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const big = M.sheet({ id: 'catch-icon', w: 64, h: 64, ppm: 8, paper: { base: '#14152c', tooth: 0.4, fibre: 0.4 }, seed: 'catch-icon' });
  patch(big, 32, 29);
  const bc = await big.save(path.join(OUT, 'icon-big.png'));
  for (const [f, px] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]]) fs.writeFileSync(path.join(OUT, f), await (await shrink(bc, px, px)).encode('png'));
  const small = M.sheet({ id: 'catch-fav', w: 32, h: 32, ppm: 16, paper: { base: '#14152c', tooth: 0.3, fibre: 0.3 }, seed: 'catch-fav' });
  patch(small, 16, 15.2, { rim: 2.6, nib: 1.1, body: 3.1, ink: 0.9 });
  const sc = await small.save(path.join(OUT, 'icon-bold.png'));
  const pngs = [];
  for (const px of [16, 32, 48]) { const buf = await (await shrink(sc, px, px)).encode('png'); fs.writeFileSync(path.join(OUT, `favicon-${px}.png`), buf); pngs.push({ size: px, buf }); }
  fs.writeFileSync(path.join(OUT, 'favicon.ico'), ico(pngs));
  console.log('brand written to', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
