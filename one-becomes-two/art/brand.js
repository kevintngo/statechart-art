'use strict';
const path = require('path');
const fs = require('fs');
const M = require('./media');
const B = require('./bio');
const Mk = require('./marks');
const { D } = M;
const { rng } = require('../../tools/kit/util');
const tools = require('module').createRequire(path.join(__dirname, '..', '..', 'tools', 'package.json'));
const { createCanvas } = tools('@napi-rs/canvas');

const OUT = path.join(__dirname, '..', 'out', 'brand');
const INK = '#1d1a1e', INK2 = '#3d3530';
const NUC = { nucleus: '#c4453a', nucleusLight: '#e0675c', chromatin: '#5a1a1a', nucleolus: '#3d1410', envelope: '#3d1410', tool: 'pencil' };
const PINKS = ['#f2b9c2', '#ebb0b8', '#f2c3a0', '#efc4bd', '#e9b9c9', '#f4cdb3'];
const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

function lobes(cx, cy, r, gap, grow = 0) {
  return [D.ell(cx - gap / 2, cy, r + grow, r * 0.96 + grow), D.ell(cx + gap / 2, cy, r + grow, r * 0.96 + grow)];
}

function dividing(P, cx, cy, r, gap, q = {}) {
  const body = lobes(cx, cy, r, gap), waist = Math.sqrt(Math.max(0, r * r - (gap / 2) ** 2)) * 0.96;
  if (q.glow !== false) B.glow(P, cx, cy, r * 2.1, '#f6d58a', { pressure: q.glowPressure ?? 0.16, steps: 4, ry: r * 1.5 });
  P.fill(body, q.fill || '#f3d58c', { tool: 'pencil', pressure: q.pressure ?? 0.85, passes: 3 });
  if (q.detail !== false) for (const [i, x] of [cx - gap / 2, cx + gap / 2].entries()) P.fill([B.blob(x - r * 0.25, cy - r * 0.25, r * 0.55, r * 0.45, 'lite' + i)], '#fbe9b8', { tool: 'pencil', pressure: 0.5, passes: 1, clip: body });
  for (const [i, x] of [cx - gap / 2, cx + gap / 2].entries()) {
    if (q.detail === false) P.dot(x + r * 0.06, cy + r * 0.04, r * 0.4, '#a3352b', { tool: 'pencil' });
    else B.nucleus(P, x + r * 0.06, cy + r * 0.05, r * 0.44, r * 0.4, 'dn' + i, NUC, { threads: 5 });
  }
  P.outline(body, { color: q.line || '#6b4a1c', nib: q.nib ?? 0.6 });
  const k = q.ring ?? 1;
  if (k) for (const dx of [-1.1, 0, 1.1]) P.line([[cx + dx * k - 0.5 * k, cy - waist], [cx + dx * k + 0.5 * k, cy + waist]], { tool: 'pencil', color: '#933323', pressure: 1, blunt: true });
  return body;
}

function tissue(P, rect, avoid, halo, fadeOf, seed) {
  const sites = B.scatter(seed, rect, 400, 10.5, avoid), cells = B.voronoi(rect, sites);
  for (const c of cells) {
    const fade = fadeOf(c.site), poly = B.rounded(B.inset(c.poly, 0.85), 2), k = hash(c.site.join());
    P.fill([poly], PINKS[k % PINKS.length], { tool: 'pencil', pressure: 0.32 + 0.42 * fade, passes: 2, angle: 20 + (k % 50), cut: halo });
    const R = rng('og' + k), nx = c.site[0] + (R() - 0.5) * 2.2, ny = c.site[1] + (R() - 0.5) * 2.2, nr = 1.9 + R() * 0.9;
    const nuc = B.blob(nx, ny, nr * 1.15, nr, 'on' + k, { wob: 0.12, rot: R() * 3 });
    P.fill([nuc], k % 3 ? '#8a6aa0' : '#6b4a7a', { tool: 'pencil', pressure: 0.45 + 0.45 * fade, passes: 2 });
    if (fade > 0.3) P.stipple([nuc], '#3d2f45', { nib: 0.2, density: 1.4, size: 0.8 });
    P.outline([poly], { color: fade > 0.4 ? '#8a5468' : '#b98a98', nib: 0.26, cut: halo });
  }
}

async function shrink(canvas, w, h) {
  let src = canvas;
  while (src.width / 2 >= w * 1.5) {
    const c = createCanvas(Math.round(src.width / 2), Math.round(src.height / 2)), g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height);
    src = c;
  }
  const c = createCanvas(w, h), g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h);
  return c;
}

async function og() {
  const P = M.sheet({ id: 'obt-og', w: 200, h: 105, ppm: 12, paper: 'hotpress', seed: 'obt-og' });
  const cx = 151, cy = 79, r = 10.5, gap = 17;
  const halo = lobes(cx, cy, r, gap, 1.4);
  const near = (p) => Math.min(B.len(B.sub(p, [cx - gap / 2, cy])), B.len(B.sub(p, [cx + gap / 2, cy]))) < r + 5;
  tissue(P, { x0: -8, y0: 52, x1: 208, y1: 115 }, near, halo, (p) => Math.max(0, Math.min(1, (p[1] - 52) / 26)), 'og-tissue');
  dividing(P, cx, cy, r, gap);
  const path1 = D.curve([[-3, 63], [36, 61], [82, 64], [114, 72], [129.6, 78.4]], false, 0.35);
  const cordPts = Mk.cut(Mk.smoothPts(path1, 1), 0, 5.2);
  Mk.cord(P, cordPts, Mk.GOLD);
  const full = Mk.cut(path1, 0, 1.3);
  Mk.arrowhead(P, full[full.length - 1], Mk.at(path1, 1 - 9 / Mk.lengthOf(path1)), Mk.GOLD, 4.4);
  P.text('One becomes two', 12, 29.5, { size: 12.6, color: INK });
  P.text('The life of one cell, drawn as a statechart.', 12.6, 41.5, { size: 5.1, color: INK2 });
  const big = await P.save(path.join(OUT, 'og-2400.png'));
  const small = await shrink(big, 1200, 630);
  fs.writeFileSync(path.join(OUT, 'og.jpg'), await small.encode('jpeg', 90));
}

async function icon(name, size, ppm, draw) {
  const P = M.sheet({ id: 'obt-' + name, w: size, h: size, ppm, paper: 'navy', seed: 'obt-' + name });
  draw(P);
  return P.save(path.join(OUT, name + '.png'));
}

function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = head.length;
  pngs.forEach((p, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(p.size, e); head.writeUInt8(p.size, e + 1); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(p.buf.length, e + 8); head.writeUInt32LE(off, e + 12); off += p.buf.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.buf)]);
}

async function icons() {
  const big = await icon('icon-big', 64, 8, (P) => dividing(P, 32, 32, 13.5, 19, { nib: 1, glow: false, ring: 1.4 }));
  for (const [file, px] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]]) fs.writeFileSync(path.join(OUT, file), await (await shrink(big, px, px)).encode('png'));
  const bold = (ring) => (P) => dividing(P, 16, 16, 7.4, 10.6, { nib: 1.7, detail: false, glow: false, fill: '#efc45c', pressure: 0.98, line: '#2a1d0c', ring });
  const ringed = await icon('icon-bold', 32, 16, bold(1.5)), plain = await icon('icon-tiny', 32, 16, bold(0));
  const pngs = [];
  for (const px of [16, 32, 48]) { const buf = await (await shrink(px < 24 ? plain : ringed, px, px)).encode('png'); fs.writeFileSync(path.join(OUT, `favicon-${px}.png`), buf); pngs.push({ size: px, buf }); }
  fs.writeFileSync(path.join(OUT, 'favicon.ico'), ico(pngs));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await og();
  await icons();
  console.log('brand written to', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
