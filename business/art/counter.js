'use strict';
const path = require('path');
const { plate } = require('../../tools/lib/storybook');
const { layOut, mapper } = require('../../tools/lib/layout');
const TC = require('../../tools/lib/tagchart');
const D = require('../../tools/lib/draw');
const Lt = require('../../tools/lib/letter');
const { person } = require('../../tools/lib/people');
const H = require('./shop');
const { C } = H;

const FAST = process.argv.includes('--fast');
const HERE = path.join(__dirname, '..');

async function main() {
  const L = await layOut(path.join(HERE, 'counter/layout.mmd'), { face: 'Kevin Serif Bold', svgOut: path.join(HERE, 'out/counter-layout.svg') });
  const P = plate({ id: 'counter', w: 216, h: 216, ppm: FAST ? 5 : 10, seed: 'boba-counter-1', paper: 'hotpress' });
  const all = L.clusters.find((c) => c.id === 'all');
  const m = mapper({ x: all.x, y: all.y, w: all.w, h: all.h }, { x: 6, y: 50, w: 204, h: 120 });
  const box = (c) => [m.X(c.x), m.Y(c.y), m.X(c.x + c.w), m.Y(c.y + c.h), m.Y(c.headY)];

  P.text('the business of boba  ·  III', 12.5, 13.6, { face: 'serif-bold', size: 3.8 });
  P.text('Two at once', 11, 30, { size: 14 });
  P.italic('the barista and the pot', 12.5, 39.6, { face: 'serif-bold', size: 4.6 });

  const mb = [[132, 10], [206, 10], [206, 42], [132, 42]];
  H.part(P, D.rrect(130.4, 8.4, 207.6, 43.6, 1.2), C.wood, { nib: 0.26 });
  H.part(P, mb, '#f6efdc', { nib: 0.2, pressure: 0.45, passes: 1 });
  for (const sx of [146, 192]) P.ink([[sx, 8.4], [sx + (sx < 160 ? -6 : 6), 2]], { nib: 0.16 });
  const menu = [['brown sugar boba', '5.50'], ['classic milk tea', '4.75'], ['taro with pearls', '5.25']];
  P.text('menu', 169, 17.2, { face: 'serif-bold', size: 3.6, align: 'center' });
  menu.forEach(([a, b], i) => { P.text(a, 135.4, 24.6 + i * 6, { face: 'serif-bold', size: 3.1 }); P.text(b, 202.6, 24.6 + i * 6, { face: 'serif-bold', size: 3.1, align: 'right' }); });

  const [ax0, ay0, ax1, ay1, ahead] = box(all);
  P.outline([D.rrect(ax0, ay0, ax1, ay1, 2)], { nib: 0.3 });
  P.outline([D.rrect(ax0 + 1, ay0 + 1, ax1 - 1, ay1 - 1, 1.6)], { nib: 0.12 });
  P.italic('at the same time', (ax0 + ax1) / 2, (ay0 + ahead) / 2 + 1.5, { face: 'serif-bold', size: 4.2, align: 'center' });
  P.ink([[ax0 + 1, ahead], [ax1 - 1, ahead]], { nib: 0.14 });
  const tints = { r0: '#e6eff4', r1: '#f6e3e3' }, deep = { r0: '#3f6f97', r1: '#a3434b' };
  for (const c of L.clusters.filter((q) => q !== all)) {
    const [x0, y0, x1, y1, hy] = box(c), card = D.rrect(x0, y0, x1, y1, 1.6);
    P.paper([card]); P.colour([card], tints[c.id], { pressure: 0.42, passes: 1 });
    P.colour([D.rrect(x0, y0, x1, hy, 1.6)], tints[c.id], { pressure: 0.6, passes: 1 });
    P.outline([card], { nib: 0.24 }); P.ink([[x0, hy], [x1, hy]], { nib: 0.14 });
    P.text(c.label[0].text, (x0 + x1) / 2, (y0 + hy) / 2 + 1.8, { face: 'serif-bold', size: 5, align: 'center' });
  }
  for (const d of L.dividers) { const a = m.P(d[0]), b = m.P(d[d.length - 1]); for (let y = a[1] + 2; y < b[1] - 2; y += 2.6) P.ink([[a[0], y], [a[0], y + 1.2]], { nib: 0.14 }); }

  const tagColor = (n) => (m.X(n.cx) < 108 ? '#d5e4ef' : '#f3d6d8');
  const cards = L.clusters.filter((q) => q !== all).map(box);
  const avoid = [{ x0: cards[0][2] - 0.5, x1: cards[1][0] + 0.5, y0: 40, y1: 180 }];
  for (const [x0, y0, x1, y1, hy] of cards) avoid.push({ x0, x1, y0: y0 - 4, y1: hy + 0.6 });
  TC.draw(P, L, m, {
    style: 'soft', tagColor, textScale: 1.14, labelScale: 1.1, labelsBeside: true, stopShort: 1.8, bounds: { x0: 9, x1: 207 }, avoid,
    condColour: (t) => (/cooking pearls/.test(t) ? deep.r1 : deep.r0),
  });

  person(P, 40, 203, 0.86, { seed: 'barista3', pose: 'shake', hair: 'bun', shirt: { color: C.sky }, apron: C.sage, look: 0.6, front: { l: true, r: true }, hold: { r: () => H.shaker(P, 40 + 6.6 * 0.86, 203 - 12.6 * 0.86, 0.52, 0.12) } });
  H.counter(P, 4, 212, 198, 14);
  H.bobaCup(P, 72, 195.6, 0.5, { stage: 'ready' });
  H.bobaCup(P, 86, 195.6, 0.5, { stage: 'sealed', tea: '#c9a7d8' });
  const pager = D.rrect(97, 190.6, 107, 195.6, 1.4); H.part(P, pager, '#59646e', { nib: 0.2 }); for (const x of [99.6, 102, 104.4]) P.dot(x, 192.2, 0.5, '#f1c95a');
  H.stove(P, 170, 195.6, 1.05);
  H.pot(P, 163, 184.6, 0.86);
  H.kettle(P, 182, 184.6, 0.72);

  const out = await P.finish(path.join(HERE, 'out/counter.png'), { sizes: [['-x.jpg', 2048, 93], ['-preview.png', 1080]] });
  console.log(out);
}
main().catch((e) => { console.error(e); process.exit(1); });
