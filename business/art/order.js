'use strict';
const path = require('path');
const { plate } = require('../../tools/lib/storybook');
const { layOut, mapper, contentBox, saveShapes } = require('../../tools/lib/layout');
const TC = require('../../tools/lib/tagchart');
const D = require('../../tools/lib/draw');
const { person } = require('../../tools/lib/people');
const H = require('./shop');
const { C } = H;

const FAST = process.argv.includes('--fast');
const HERE = path.join(__dirname, '..');

async function main() {
  const L = await layOut(path.join(HERE, 'order/layout.mmd'), { face: 'Kevin Serif Bold', svgOut: path.join(HERE, 'out/order-layout.svg') });
  const P = plate({ id: 'order', w: 216, h: 216, ppm: FAST ? 5 : 10, seed: 'boba-order-1', paper: 'hotpress' });
  const m = mapper(contentBox(L), { x: 8, y: 16, w: 200, h: 194 });
  saveShapes(path.join(HERE, 'out/order-pele.json'), L, m);

  P.text('the business of boba  ·  I', 12.5, 13.6, { face: 'serif-bold', size: 3.8 });
  P.text('An order', 11, 30, { size: 15 });
  P.italic('from the line to your hand', 12.5, 39.6, { face: 'serif-bold', size: 4.6 });

  const shopper = (seed, x, hair, color, o = {}) => person(P, x, 93, 0.7, { seed, pose: o.pose || 'stand', hair, shirt: { color }, look: -0.9, pants: o.pants, hold: o.hold, front: o.front, flip: o.flip });
  P.ink([[156, 93.4], [212, 93.4]], { nib: 0.2 });
  shopper('q3', 203, 'short', C.sky, {});
  shopper('q2', 188.6, 'bob', C.blush, { pose: { l: [[-6.6, -17.4], [-6.8, -11.6]], r: [[6.4, -17.8], [4.6, -21.2]] }, front: { r: true }, hold: { r: (Q, h) => { const ph = D.rrect(h[0] - 1.2, h[1] - 2.6, h[0] + 1.2, h[1] + 1.4, 0.4); Q.paper([ph]); Q.colour([ph], '#5b6670', { pressure: 0.85 }); Q.outline([ph], { nib: 0.14 }); } } });
  shopper('q1', 173.4, 'bun', C.mint, {});

  person(P, 30, 101, 0.86, { seed: 'cashier', pose: { l: [[-6.6, -17.4], [-6.8, -11.6]], r: [[8.2, -18.6], [12.6, -15.2]] }, hair: 'short', hat: 'cap', capColor: C.rose, shirt: { color: C.paper }, apron: C.rose, look: 0.9, front: { r: true } });
  H.counter(P, 8, 100, 92, 11);
  H.register(P, 64, 89.6, 1.0);
  for (const [x, y] of [[82, 88.6], [87, 89.2], [84.6, 87.2]]) H.coin(P, x, y, 2.1);

  person(P, 30, 193, 0.86, { seed: 'barista', pose: 'shake', hair: 'bun', shirt: { color: C.sky }, apron: C.sage, look: 0.7, front: { l: true, r: true }, hold: { r: (Q, h) => H.shaker(Q, 30 + 6.6 * 0.86, 193 - 12.6 * 0.86, 0.52, 0.12) } });
  for (const [x, y, a, l] of [[43.6, 163.6, -0.5, 3.2], [44.6, 168.4, -0.1, 3.6], [43.8, 173, 0.3, 3]]) P.ink([[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]], { nib: 0.16 });
  H.counter(P, 4, 64, 190, 22);
  H.bell(P, 54.6, 187.6, 0.86);
  H.bobaCup(P, 12.6, 187.6, 0.46, { stage: 'sealed' });

  P.ink([[186, 151.6], [212, 151.6]], { nib: 0.3 });
  for (const x of [190, 207]) P.ink([[x, 151.6], [x + 1.6, 155.4]], { nib: 0.22 });
  H.jar(P, 197.6, 151.2, 0.96, { label: 'sold out', pearls: [[-4.8, -1.8], [-1.6, -1.9]] });
  for (const [x, y] of [[209, 149.6]]) H.coin(P, x, y, 1.8);

  P.ink([[128, 212.4], [212, 212.4]], { nib: 0.2 });
  const me = person(P, 156, 212, 0.98, {
    seed: 'kevin', pose: 'raise', hair: 'wavy', shirt: { style: 'polo', color: '#dcc49c' }, shoes: 'white', look: -0.6,
    top: (Q, { HC }) => { const cup = HC([[-3.2, -15.2], [3.2, -15.2], [2.4, -7.2], [-2.4, -7.2]]); Q.paper([cup]); Q.colour([cup], '#a8754f', { pressure: 0.7 }); Q.outline([cup], { nib: 0.16 }); Q.ink(HC([[1.2, -15.2], [2.6, -19]]), { nib: 0.2 }); },
    hold: { r: (Q, h) => H.bobaCup(Q, h[0] + 0.6, h[1] + 8.4, 0.42, { stage: 'ready' }) },
  });
  for (const [x, y, r] of [[178, 166, 1.6], [184, 176, 1.1], [138, 172, 1.3]]) { P.ink([[x - r, y], [x + r, y]], { nib: 0.16 }); P.ink([[x, y - r], [x, y + r]], { nib: 0.16 }); }

  TC.draw(P, L, m, { style: 'ticket', labelsBeside: true, stopShort: 3.4, bounds: { x0: 4, x1: 212 }, lineColor: '#a8443b', startColor: '#a8443b', pinColor: (n) => ['#cf4e43', '#3f7fae', '#e0b04f', '#6f9a5c'][Math.round(n.cy) % 4], numbers: () => 'No. 42' });
  const out = await P.finish(path.join(HERE, 'out/order.png'), { sizes: [['-x.jpg', 2048, 93], ['-preview.png', 1080]] });
  console.log(out);
}
main().catch((e) => { console.error(e); process.exit(1); });
