'use strict';
const path = require('path');
const { plate } = require('../../tools/lib/storybook');
const { layOut, mapper, contentBox, saveShapes } = require('../../tools/lib/layout');
const TC = require('../../tools/lib/tagchart');
const D = require('../../tools/lib/draw');
const Lt = require('../../tools/lib/letter');
const H = require('./shop');
const { C } = H;

const FAST = process.argv.includes('--fast');
const HERE = path.join(__dirname, '..');
const RED = '#b8352f';

function stamp(P, cx, cy, lines, rot) {
  const w = Math.max(...lines.map((t) => Lt.measure(t, 'serif-bold', 3.4))) + 6, h = lines.length * 4.6 + 3.4;
  const outer = D.tf(D.rrect(-w / 2, -h / 2, w / 2, h / 2, 1.2), { x: cx, y: cy, rot }), inner = D.tf(D.rrect(-w / 2 + 1, -h / 2 + 1, w / 2 - 1, h / 2 - 1, 0.8), { x: cx, y: cy, rot });
  P.outline([outer], { nib: 0.5, color: RED }); P.outline([inner], { nib: 0.18, color: RED });
  const S = P.S, ppm = S.ppm;
  lines.forEach((t, i) => Lt.write(S, t, cx + Math.sin(rot) * (i - (lines.length - 1) / 2) * -4.6, cy + Math.cos(rot) * (i - (lines.length - 1) / 2) * 4.6 + 1.2, { face: 'serif-bold', size: 3.4, align: 'center', color: RED, slant: 0 }));
}

function ladybug(P, x, y, s, a = 0) {
  const T = H.at(x, y, s, a);
  const body = T(D.ell(0, 0, 4, 3.2)), head = T(D.ell(-4.4, 0, 1.8, 1.7));
  for (const sd of [-1, 1]) for (const lx of [-1.6, 0.4, 2.2]) P.ink(T([[lx, sd * 2.8], [lx + 0.8, sd * 4.6]]), { nib: 0.14 });
  H.part(P, head, '#3d3436', { nib: 0.16 });
  H.part(P, body, '#d4453b', { nib: 0.2 });
  P.ink(T([[-4, 0], [4, 0]]), { nib: 0.14 });
  for (const [px, py] of [[-1.6, -1.6], [1.8, -1.4], [0.2, 1.8], [2.4, 1.4], [-2, 1.2]]) P.dot(...T([[px, py]])[0], 0.55, '#2f2a2c');
  for (const sd of [-1, 1]) P.curve(T([[-5.6, sd * 0.6], [-7, sd * 1.6], [-7.6, sd * 2.6]]), { nib: 0.1 });
}

async function main() {
  const L = await layOut(path.join(HERE, 'bug/layout.mmd'), { face: 'Kevin Serif Bold', svgOut: path.join(HERE, 'out/bug-layout.svg') });
  const chart = { ...L, nodes: L.nodes.filter((n) => !/^lg/.test(n.id)), clusters: [] };
  const bugIds = new Set(chart.nodes.filter((n) => n.classes.includes('bugPath')).map((n) => n.id));
  const near = (p, n) => Math.abs(p[0] - n.cx) <= n.w / 2 + 2 && Math.abs(p[1] - n.cy) <= n.h / 2 + 2;
  chart.edges = chart.edges.map((e) => {
    const a = chart.nodes.find((n) => near(e.pts[0], n)), b = chart.nodes.find((n) => near(e.marker ? e.marker[0] : e.pts[e.pts.length - 1], n));
    return { ...e, bug: !!(a && b && bugIds.has(a.id) && bugIds.has(b.id)) };
  });
  const P = plate({ id: 'bug', w: 216, h: 216, ppm: FAST ? 5 : 10, seed: 'boba-bug-1', paper: 'hotpress' });
  const m = mapper(contentBox(chart), { x: 10, y: 44, w: 196, h: 168 });
  saveShapes(path.join(HERE, 'out/bug-pele.json'), chart, m);

  P.text('the business of boba  ·  IV', 12.5, 13.6, { face: 'serif-bold', size: 3.8 });
  P.text('The pearl bug', 11, 30, { size: 13.6 });
  P.italic('TLC finds how old pearls get served', 12.5, 39.4, { face: 'serif-bold', size: 4.4 });
  ladybug(P, 120, 36, 0.85, -0.3);

  const key = D.rrect(140, 8, 207, 40, 1.2);
  H.part(P, key, C.paper, { nib: 0.22, pressure: 0.4, passes: 1 });
  P.text('the rule', 144, 15, { face: 'serif-bold', size: 3.4 });
  P.italic('never serve pearls more', 144, 21, { face: 'serif-bold', size: 3.2 });
  P.italic('than 4 hours old', 144, 26, { face: 'serif-bold', size: 3.2 });
  P.ink([[144, 32.4], [154, 32.4]], { nib: 0.42, color: RED });
  P.text('the path TLC found', 156.4, 33.6, { face: 'serif-bold', size: 3.1 });

  const res = TC.draw(P, chart, m, { style: 'soft', tagColor: '#f6ecd4', breakFill: '#f7cfc9', bugColor: RED, textScale: 1.0, labelsBeside: true, stopShort: 1.8, bounds: { x0: 8, x1: 210 }, avoid: [{ x0: 138, x1: 210, y0: 6, y1: 42 }] });
  const broken = res.L.nodes.find((n) => n.classes.includes('breaks'));
  P.ink([[8, 176.4], [46, 176.4]], { nib: 0.24 });
  H.stove(P, 26, 176, 0.86);
  H.pot(P, 26, 167.4, 0.82);
  H.hourglass(P, 198, 70, 0.9);
  P.ink([[178, 141.6], [212, 141.6]], { nib: 0.26 });
  const old = H.bobaCup(P, 192, 141.2, 0.42, { stage: 'pearls', tea: '#c7b9a8' });
  H.magnifier(P, 192, 128.4, 6.6, 0.75);
  P.ink([[8, 212.4], [30, 212.4]], { nib: 0.22 });
  H.jar(P, 19, 212, 0.72, { label: 'old', pearls: [[-4.4, -1.8], [-1.2, -1.9], [2, -1.8], [-2.8, -4.8], [0.6, -4.8]] });
  stamp(P, m.X(broken.cx + broken.w / 2) + 15, m.Y(broken.cy) - 12, ['rule', 'broken'], -0.2);

  const out = await P.finish(path.join(HERE, 'out/bug.png'), { sizes: [['-x.jpg', 2048, 93], ['-preview.png', 1080]] });
  console.log(out);
}
main().catch((e) => { console.error(e); process.exit(1); });
