'use strict';
const path = require('path');
const { plate } = require('../../tools/lib/storybook');
const { layOut, mapper, contentBox } = require('../../tools/lib/layout');
const TC = require('../../tools/lib/tagchart');
const H = require('./shop');
const { C } = H;

const FAST = process.argv.includes('--fast');
const HERE = path.join(__dirname, '..');

async function main() {
  const L = await layOut(path.join(HERE, 'day/layout.mmd'), { face: 'Kevin Serif Bold', svgOut: path.join(HERE, 'out/day-layout.svg') });
  const P = plate({ id: 'day', w: 216, h: 216, ppm: FAST ? 5 : 10, seed: 'boba-day-1', paper: 'hotpress' });
  const m = mapper(contentBox(L), { x: 8, y: 12, w: 200, h: 198 });
  const open = L.clusters.find((c) => c.label[0].text === 'open');
  const wx0 = m.X(open.x), wx1 = m.X(open.x + open.w), wy0 = m.Y(open.y), wy1 = m.Y(open.y + open.h), head = m.Y(open.headY);

  P.text('the business of boba  ·  II', 12.5, 13.6, { face: 'serif-bold', size: 3.8 });
  P.text('A day', 11, 30, { size: 15 });
  P.italic('at the shop, 7 am to 9 pm', 12.5, 39.6, { face: 'serif-bold', size: 4.6 });

  H.sunrise(P, 186, 34, 7.4);
  const shelf = [[168, 104.4], [210, 104.4], [210, 107], [168, 107]];
  H.part(P, shelf, C.wood, { nib: 0.24, shade: [[168, 106], [210, 106], [210, 107.4], [168, 107.4]], hatch: 0, pitch: 0.5 });
  for (const x of [173, 205]) P.ink([[x, 107], [x, 113], [x + (x < 190 ? 5 : -5), 107]], { nib: 0.24 });
  H.stove(P, 189, 104.4, 1.0);
  H.kettle(P, 181.6, 94, 0.82);
  H.pot(P, 197.4, 94, 0.72);
  H.moon(P, 190, 160, 6);
  H.mop(P, 196, 210, 0.9);
  H.vine(P, 18, 74, 196, {});
  H.planter(P, wx0 + 2, wx0 + 46, wy1 + 11.6, 7);

  H.shopWindow(P, wx0, wy0, wx1, wy1, head);
  H.awning(P, wx0 - 3, wx1 + 3, wy0 - 6, head + 0.6, 'open', { size: 5.2 });
  const fr = 2.6;
  TC.draw(P, L, m, {
    labelsBeside: true, stopShort: 2.2, bounds: { x0: 4, x1: 212 },
    avoid: [{ x0: 166, x1: 212, y0: 84, y1: 114 }, { x0: 172, x1: 212, y0: 18, y1: 44 }, { x0: wx0 - 3, x1: wx1 + 3, y0: wy0 - 7, y1: head + 4 }, { x0: wx0 - 1, x1: wx0 + fr + 1, y0: wy0, y1: wy1 + 3 }, { x0: wx1 - fr - 1, x1: wx1 + 1, y0: wy0, y1: wy1 + 3 }, { x0: wx0 - 3, x1: wx1 + 3, y0: wy1 - fr - 1, y1: wy1 + 4 }],
    nodeStyle: (n) => (['quiet', 'busy', 'a rush'].includes(n.lines.map((q) => q.text).join(' ')) ? 'note' : 'sign'),
  });
  const out = await P.finish(path.join(HERE, 'out/day.png'), { sizes: [['-x.jpg', 2048, 93], ['-preview.png', 1080]] });
  console.log(out);
}
main().catch((e) => { console.error(e); process.exit(1); });
