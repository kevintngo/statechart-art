'use strict';
const path = require('path');
const fs = require('fs');
const K = require('../../tools/kit');
const MK = require('../../tools/lib/mask');
const D = require('../../tools/lib/draw');
const Lt = require('../../tools/lib/letter');
const { rng } = require('../../tools/kit/util');
const tools = require('module').createRequire(path.join(__dirname, '..', '..', 'tools', 'package.json'));
const { createCanvas } = tools('@napi-rs/canvas');

const INK = '#1d1a1e';

function sheet(o) {
  const S = K.sheet({ id: o.id, w: o.w, h: o.h, ppm: o.ppm, paper: o.paper, seed: o.seed || o.id });
  const R = rng('media:' + (o.inkSeed || o.seed || o.id));
  const oy = o.top || 0, ox = o.left || 0;
  const tx = (p) => [p[0] - ox, p[1] - oy];
  const tp = (pts) => pts.map(tx);
  const tpolys = (polys) => polys.map((poly) => (Array.isArray(poly[0][0]) ? poly.map(tp) : tp(poly)));
  const rectOf = (r) => [[r.x0 - 1.5, r.y0 - 1.5], [r.x1 + 1.5, r.y0 - 1.5], [r.x1 + 1.5, r.y1 + 1.5], [r.x0 - 1.5, r.y1 + 1.5]];
  const tools2 = new Map();
  const tool = (kind, opts = {}) => { const k = kind + JSON.stringify(opts); if (!tools2.has(k)) tools2.set(k, S.tool(kind, opts)); return tools2.get(k); };
  const maskOf = (polys, q = {}) => {
    const m = MK.maskOf(S, tpolys(polys));
    if (q.cut) MK.subtract(S, m, tpolys(q.cut));
    if (q.clip) { const c = MK.maskOf(S, tpolys(q.clip)); for (let i = 0; i < m.length; i++) m[i] &= c[i]; }
    return m;
  };
  const visible = (polys) => polys.some((poly) => (Array.isArray(poly[0][0]) ? poly.flat() : poly).some((p) => p[1] - oy > -40 && p[1] - oy < o.h + 40));
  const P = { S, R, w: o.w, h: o.h, top: oy, tool, maskOf, visible };

  P.fill = (polys, color, q = {}) => {
    if (!visible(polys)) return null;
    const m = q.mask || maskOf(polys, q), kind = q.tool || 'pencil', a = q.angle ?? 35;
    if (q.reset) MK.paint(S, m, () => {}, 9, true);
    MK.paint(S, m, (r) => {
      const T = S.tool(kind, { color, point: q.blunt ? 'blunt' : undefined, kind: q.wax ? 'wax' : undefined });
      T.fillWith(rectOf(r), { angle: a + R.gauss(0, 4), pressure: q.pressure ?? 0.78 });
      if ((q.passes ?? 2) > 1) T.fillWith(rectOf(r), { angle: a - 68 + R.gauss(0, 4), pressure: (q.pressure ?? 0.78) * 0.85 });
      if ((q.passes ?? 2) > 2) T.fillWith(rectOf(r), { angle: a + 50, pressure: (q.pressure ?? 0.78) * 0.75 });
    }, 9, false);
    return m;
  };
  P.hatch = (polys, color, q = {}) => {
    if (!visible(polys)) return null;
    const m = q.mask || maskOf(polys, q);
    MK.paint(S, m, (r) => {
      const T = q.tool === 'fineliner' || !q.tool ? S.tool('fineliner', { nib: q.nib ?? 0.14, color, kind: 'technical' }) : S.tool(q.tool, { color });
      T.hatch(rectOf(r), { angle: q.angle ?? 45, pitch: q.pitch ?? 0.8, pressure: q.pressure ?? 0.8, length: q.length ?? 26, cross: q.cross ?? 0, curve: q.curve ?? 0.012 });
    }, 9, false);
    return m;
  };
  P.stipple = (polys, color, q = {}) => {
    if (!visible(polys)) return null;
    const m = q.mask || maskOf(polys, q);
    MK.paint(S, m, (r) => S.tool(q.tool || 'fineliner', { nib: q.nib ?? 0.25, color, kind: 'technical' }).stipple(rectOf(r), { density: q.density ?? 1.2, size: q.size ?? 1, clump: q.clump }), 9, false);
    return m;
  };
  P.outline = (polys, q = {}) => {
    if (!visible(polys)) return null;
    const m = q.mask || maskOf(polys, q);
    MK.outline(S, S.tool(q.tool || 'fineliner', { nib: q.nib ?? 0.3, color: q.color || INK, kind: 'technical' }), m, { segLen: q.segLen ?? 50, tremor: q.tremor ?? 0.45, smooth: 0.2 });
    return m;
  };
  P.line = (pts, q = {}) => {
    if (pts.length < 2 || !visible([pts])) return;
    const kind = q.tool || 'fineliner';
    const opts = kind === 'fineliner' ? { nib: q.nib ?? 0.3, color: q.color || INK, kind: 'technical' } : kind === 'gel' ? { nib: q.nib ?? 0.7, color: q.color } : { color: q.color, point: q.blunt ? 'blunt' : undefined };
    const p = D.resample(tp(pts), q.step ?? 0.6).map(([x, y]) => [x + R.gauss(0, q.jitter ?? 0.02), y + R.gauss(0, q.jitter ?? 0.02)]);
    S.tool(kind, opts).stroke(p, { smooth: q.smooth ?? 0.25, tremor: q.tremor ?? 0.5, profile: q.profile ?? (kind === 'fineliner' || kind === 'gel' ? 'even' : 'taper'), pressure: q.pressure });
  };
  P.curve = (ctrl, q = {}) => P.line(D.curve(ctrl, false, q.t ?? 0.35), q);
  P.dot = (x, y, r, color, q = {}) => {
    const m = maskOf([D.ell(x, y, r, r)]);
    MK.paint(S, m, (rr) => { const T = S.tool(q.tool || 'pencil', { color, point: 'blunt' }); T.fillWith(rectOf(rr), { angle: 20, pressure: q.pressure ?? 0.98 }); T.fillWith(rectOf(rr), { angle: -40, pressure: (q.pressure ?? 0.98) * 0.95 }); }, 12, false);
  };
  P.erase = (polys, q = {}) => { for (const poly of tpolys(polys)) S.erase(poly, q); };
  P.smudge = (polys, q = {}) => { for (const poly of tpolys(polys)) S.smudge(poly, q); };
  P.text = (t, x, y, q = {}) => Lt.write(S, t, x - ox, y - oy, { face: 'sans-bold', size: 4.4, color: INK, ...q });
  P.save = async (file, q = {}) => {
    const canvas = S.toCanvas();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, await canvas.encode(q.format === 'jpeg' ? 'jpeg' : 'png', q.quality));
    return canvas;
  };
  return P;
}

function measure(t, size, face = 'sans-bold') { return Lt.measure(t, face, size); }

module.exports = { sheet, measure, INK, createCanvas, D };
