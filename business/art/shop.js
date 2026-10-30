'use strict';
const D = require('../../tools/lib/draw');

const C = {
  ink: '#1d1a1e', caramel: '#d9ac7c', tea: '#a8693f', pearl: '#3a2925', rose: '#d9727a', blush: '#f2b9c2', sage: '#9dbb86', sageDeep: '#6f9460',
  ochre: '#e0b04f', gold: '#e8c160', slate: '#8fa9bf', sky: '#c4dbe8', ice: '#dcebf1', wood: '#c99b6b', woodDeep: '#9c7148', cream: '#f7eedb',
  steel: '#bcc5ca', plastic: '#eaf2f4', film: '#f2a9b6', straw: '#e9878f', lilac: '#c6b6de', paper: '#fbf7ee', mint: '#bfe0cf',
};

const darker = (hex, k = 0.22) => { const h = hex.replace('#', ''), c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); return '#' + c.map((v) => Math.round(v * (1 - k)).toString(16).padStart(2, '0')).join(''); };
const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const at = (x, y, s = 1, a = 0, flip = false) => (pts) => pts.map((p) => { const q = rot([(flip ? -p[0] : p[0]) * s, p[1] * s], a); return [x + q[0], y + q[1]]; });

function part(P, poly, color, o = {}) {
  P.paper([poly], { clip: o.clip });
  if (color) P.colour([poly], color, { pressure: o.pressure ?? 0.72, passes: o.passes ?? 2, angle: o.angle ?? 35, clip: o.clip });
  if (o.shade) P.hatch([poly], { clip: [o.shade], angle: o.hatch ?? 70, pitch: o.pitch ?? 0.75, nib: 0.09 });
  if (o.outline !== false) P.outline([poly], { nib: o.nib ?? 0.28, clip: o.clip });
}

function counter(P, x0, x1, y, h, o = {}) {
  const top = [[x0 - 1.5, y - 2.4], [x1 + 1.5, y - 2.4], [x1 + 1.5, y], [x0 - 1.5, y]];
  const front = [[x0, y], [x1, y], [x1, y + h], [x0, y + h]];
  part(P, front, o.front || C.cream, { shade: [[x0, y], [x1, y], [x1, y + 2.6], [x0, y + 2.6]], hatch: 0, pitch: 0.55 });
  for (let x = x0 + 6; x < x1 - 2; x += 8) P.ink([[x, y + 3.2], [x, y + h - 1.4]], { nib: 0.12 });
  part(P, top, o.top || C.wood, { shade: [[x0 - 2, y - 0.9], [x1 + 2, y - 0.9], [x1 + 2, y + 0.2], [x0 - 2, y + 0.2]], hatch: 0, pitch: 0.45 });
}

function register(P, cx, by, s) {
  const T = at(cx, by, s);
  part(P, T([[-11, -6], [11, -6], [12, 0], [-12, 0]]), C.slate, { shade: T([[4, -7], [13, -7], [13, 1], [4, 1]]), hatch: 80 });
  part(P, T([[-9, -15], [7, -15], [9, -6], [-9, -6]]), C.steel, { shade: T([[2, -16], [10, -16], [10, -5], [2, -5]]), hatch: 75 });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) part(P, T(D.rrect(-7.6 + c * 3.6, -13.2 + r * 2.4, -5.4 + c * 3.6, -11.6 + r * 2.4, 0.4)), C.paper, { nib: 0.12, passes: 1, pressure: 0.4 });
  part(P, T([[-2, -22.6], [8, -22.6], [8, -16.6], [-2, -16.6]]), C.paper, { nib: 0.24, pressure: 0.4, passes: 1 });
  P.ink(T([[3, -16.6], [3, -15]]), { nib: 0.3 });
  P.label('$5.50', cx + 3 * s, by - 18.4 * s, { size: 2.6 * s, face: 'serif-bold' });
  P.ink(T([[-11, -3], [11, -3]]), { nib: 0.12 });
  part(P, T(D.ell(0, -1.6, 1.4, 0.7)), C.steel, { nib: 0.14, passes: 1 });
}

function coin(P, x, y, r = 2.2, tilt = 0.35) {
  const e = D.ell(x, y, r, r * tilt + 0.01);
  P.paper([D.ell(x, y + 0.5, r, r * tilt + 0.01)]); P.colour([D.ell(x, y + 0.5, r, r * tilt + 0.01)], '#c79a3e', { pressure: 0.85, passes: 1 }); P.outline([D.ell(x, y + 0.5, r, r * tilt + 0.01)], { nib: 0.14 });
  part(P, e, C.gold, { nib: 0.18, passes: 2 });
  P.outline([D.ell(x, y, r * 0.66, r * tilt * 0.66 + 0.01)], { nib: 0.08 });
}

function bell(P, cx, by, s) {
  const T = at(cx, by, s);
  part(P, T(D.ell(0, -0.9, 7, 1.6)), C.wood, { nib: 0.22 });
  const dome = T(D.curve([[-5.6, -1.6], [-5.2, -5.2], [-3, -7.4], [0, -8], [3, -7.4], [5.2, -5.2], [5.6, -1.6]]));
  part(P, dome, C.ochre, { shade: T([[1.4, -9], [6, -9], [6, -1], [1.4, -1]]), hatch: 70, pitch: 0.55 });
  P.paper([T(D.ell(-2.4, -5.4, 0.9, 1.4, 0.6))]);
  part(P, T(D.rrect(-0.7, -10.2, 0.7, -7.8, 0.3)), C.ochre, { nib: 0.16 });
  part(P, T(D.ell(0, -10.6, 1.4, 0.7)), C.ochre, { nib: 0.16 });
  for (const [a, l] of [[-2.4, 3], [-2.0, 3.6], [-1.15, 3], [-0.75, 3.6]]) { const p0 = T([[Math.cos(a) * 9.6, -6 + Math.sin(a) * 6.6]])[0], p1 = T([[Math.cos(a) * (9.6 + l), -6 + Math.sin(a) * (6.6 + l * 0.7)]])[0]; P.ink([p0, p1], { nib: 0.14 }); }
}

function bobaCup(P, cx, by, s, o = {}) {
  const T = at(cx, by, s, o.rot ?? 0);
  const top = -30, tw = 10, bw = 7.4;
  const side = (sx) => D.curve([[sx * tw, top], [sx * (tw - 1.4), top + 10], [sx * (bw + 0.6), -9], [sx * bw, -1.4]], false, 0.4);
  const body = T([...side(-1), [-bw + 1.2, 0], [bw - 1.2, 0], ...side(1).reverse()]);
  const level = top + 4.2, stage = o.stage || 'ready', full = stage !== 'empty' && stage !== 'pearls', straw = stage === 'ready' || o.straw;
  const shine = T([[-tw + 1.7, top + 2.6], [-tw + 3.1, top + 2.6], [-bw + 2.7, -3.4], [-bw + 1.6, -3.4]]);
  P.paper([body]);
  P.colour([body], C.plastic, { pressure: 0.35, passes: 1, cut: [shine] });
  if (full) {
    P.colour([body], o.tea || C.caramel, { pressure: 0.74, clip: [T([[-14, level], [14, level], [14, 1], [-14, 1]])], cut: [shine] });
    P.colour([body], o.teaShade || darker(o.tea || C.caramel), { pressure: 0.45, passes: 1, clip: [T([[4, level], [14, level], [14, 1], [3, 1]])], cut: [shine] });
  }
  const sa = [3.6, top - 12.4], sb = [1.1, -6.2], sw = 1.6, len = Math.hypot(sa[0] - sb[0], sa[1] - sb[1]);
  const u = [(sa[0] - sb[0]) / len, (sa[1] - sb[1]) / len], nv = [-u[1] * sw, u[0] * sw];
  const band = (p0, p1) => [[p0[0] + nv[0], p0[1] + nv[1]], [p1[0] + nv[0], p1[1] + nv[1]], [p1[0] - nv[0], p1[1] - nv[1]], [p0[0] - nv[0], p0[1] - nv[1]]];
  const tLid = (top - sb[1]) / (sa[1] - sb[1]), pLid = [sb[0] + (sa[0] - sb[0]) * tLid, top];
  if (straw) P.colour([T(band(sb, pLid))], o.strawInside || '#efc0c6', { pressure: 0.6, passes: 1, clip: [body] });
  if (stage !== 'empty') {
    const pr = 1.55;
    for (const [x0, y, n] of [[-5.6, -1.75, 5], [-4.5, -4.6, 5], [-3.1, -7.4, 4]]) for (let i = 0; i < n; i++) {
      const x = x0 + i * 2.8 + (y === -4.6 ? 0.1 : 0), c = T(D.ell(x, y, pr, pr * 0.96));
      P.paper([c], { clip: [body] }); P.colour([c], C.pearl, { pressure: 0.95, clip: [body] });
      P.paper([T(D.ell(x - 0.5, y - 0.55, 0.42, 0.28, -0.6))]);
    }
  }
  if (full) for (const [x, y, a] of [[-3.8, level + 2.6, 0.22], [3.0, level + 2.2, -0.28]]) {
    const q = T(D.tf(D.rrect(-2.3, -2.3, 2.3, 2.3, 0.9), { x, y, rot: a }));
    P.paper([q]); P.colour([q], C.ice, { pressure: 0.55, passes: 1 }); P.outline([q], { nib: 0.1 });
  }
  P.outline([body], { nib: 0.3 });
  const rim = T(D.ell(0, top, tw + 0.3, 1.8));
  if (stage === 'sealed' || stage === 'ready') { P.paper([rim]); P.colour([rim], o.film || C.film, { pressure: 0.72 }); P.outline([rim], { nib: 0.24 }); }
  else P.outline([rim], { nib: 0.22 });
  if (straw) {
    const outside = T(band(pLid, sa));
    P.paper([outside]); P.colour([outside], o.strawColor || C.straw, { pressure: 0.85 });
    const [e1a, e1b, e2b, e2a] = outside;
    P.ink([e1a, e1b], { nib: 0.24, tremor: 0.08, smooth: 0.02 });
    P.ink([e2a, e2b], { nib: 0.24, tremor: 0.08, smooth: 0.02 });
    P.ink([e1b, e2b], { nib: 0.24, tremor: 0.08, smooth: 0.02 });
  }
  return { body, top: T([[0, top]])[0] };
}

function jar(P, cx, by, s, o = {}) {
  const T = at(cx, by, s);
  const body = T(D.curve([[-7, -18], [7, -18], [8.6, -15], [8.6, -2], [7, 0], [-7, 0], [-8.6, -2], [-8.6, -15]]));
  P.paper([body]); P.colour([body], C.plastic, { pressure: 0.35, passes: 1 });
  for (const [x, y] of o.pearls || []) { const c = T(D.ell(x, y, 1.6, 1.55)); P.paper([c]); P.colour([c], C.pearl, { pressure: 0.95 }); P.outline([c], { nib: 0.1 }); }
  P.hatch([body], { clip: [T([[3.6, -19], [9, -19], [9, 1], [3.6, 1]])], angle: 82, pitch: 0.7, nib: 0.08 });
  P.outline([body], { nib: 0.28 });
  part(P, T(D.rrect(-7.6, -21.4, 7.6, -17.8, 1)), C.rose, { nib: 0.24 });
  if (o.label) {
    const tag = T([[-5.6, -13], [5.6, -13], [5.6, -6.6], [-5.6, -6.6]]);
    part(P, tag, C.paper, { nib: 0.18, pressure: 0.4, passes: 1 });
    P.label(o.label, cx, by - 8.8 * s, { size: 2.3 * s, color: '#b5453a' });
  }
}

function shaker(P, cx, by, s, a = 0) {
  const T = at(cx, by, s, a);
  const cupB = T(D.curve([[-5.4, -14], [5.4, -14], [4.4, -1], [3.6, 0], [-3.6, 0], [-4.4, -1]]));
  const capT = T(D.curve([[-4.6, -14], [-3.6, -19], [-1.6, -21.4], [1.6, -21.4], [3.6, -19], [4.6, -14]]));
  for (const p of [T(D.rrect(-1.5, -24.4, 1.5, -21.2, 0.8)), capT, cupB]) part(P, p, C.steel, { passes: 1, pressure: 0.6, shade: T([[1.6, -25], [7, -25], [7, 1], [1.2, 1]]), hatch: 85, pitch: 0.55 });
  part(P, T(D.rrect(-5.9, -15.2, 5.9, -13.2, 0.6)), C.steel, { nib: 0.2, passes: 1 });
}


function shopWindow(P, x0, y0, x1, y1, head, o = {}) {
  const fr = 2.4, outer = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], glass = [[x0 + fr, head + 1], [x1 - fr, head + 1], [x1 - fr, y1 - fr], [x0 + fr, y1 - fr]];
  P.paper([outer]); P.colour([outer], o.frame || '#7f9fa8', { pressure: 0.72, cut: [glass] }); P.hatch([outer], { cut: [glass], angle: 90, pitch: 0.8, nib: 0.08 });
  P.colour([glass], '#eef4f4', { pressure: 0.4, passes: 1 });
  for (const [a, b] of [[0.12, 0.2], [0.18, 0.22], [0.62, 0.7]]) { const sx = x0 + (x1 - x0) * a, ex = x0 + (x1 - x0) * b; P.colour([[[sx, head + 2], [sx + 3, head + 2], [ex + 3 - 22, y1 - 4], [ex - 22, y1 - 4]]], '#ffffff', { pressure: 0.55, passes: 1, clip: [glass] }); }
  P.outline([outer], { nib: 0.3 }); P.outline([glass], { nib: 0.2 });
  const sill = [[x0 - 2.4, y1], [x1 + 2.4, y1], [x1 + 1.4, y1 + 3], [x0 - 1.4, y1 + 3]];
  P.paper([sill]); P.colour([sill], C.wood, { pressure: 0.72 }); P.hatch([sill], { angle: 0, pitch: 0.6, nib: 0.08 }); P.outline([sill], { nib: 0.26 });
}

function awning(P, x0, x1, top, bottom, label, o = {}) {
  const n = Math.max(6, Math.round((x1 - x0) / 9)), sw = (x1 - x0) / n, drop = (bottom - top) * 0.36;
  for (let i = 0; i < n; i++) {
    const a = x0 + i * sw, b = a + sw, stripe = D.curve([[a, top], [b, top], [b, bottom], [a + sw * 0.5, bottom + drop], [a, bottom]]);
    P.paper([stripe]); P.colour([stripe], i % 2 ? C.cream : (o.color || C.rose), { pressure: 0.72 });
    if (i % 2 === 0) P.hatch([stripe], { clip: [[[a, bottom - 2], [b, bottom - 2], [b, bottom + drop + 1], [a, bottom + drop + 1]]], angle: 90, pitch: 0.7, nib: 0.08 });
  }
  const edge = []; for (let i = 0; i <= n; i++) { edge.push([x0 + i * sw, bottom]); if (i < n) edge.push([x0 + i * sw + sw * 0.5, bottom + drop]); }
  P.outline([[[x0, top], [x1, top], ...D.curve(edge.slice().reverse(), false, 0.3)]], { nib: 0.3 });
  const val = [[x0 + (x1 - x0) * 0.32, top + 0.8], [x0 + (x1 - x0) * 0.68, top + 0.8], [x0 + (x1 - x0) * 0.68, bottom - 0.8], [x0 + (x1 - x0) * 0.32, bottom - 0.8]];
  P.paper([val]); P.colour([val], C.paper, { pressure: 0.5, passes: 1 }); P.outline([val], { nib: 0.24 });
  P.text(label, (x0 + x1) / 2, (top + bottom) / 2 + (o.size ?? 5) * 0.36, { face: 'serif-bold', size: o.size ?? 5, align: 'center' });
}

function sunrise(P, cx, cy, r) {
  const disc = D.curve(Array.from({ length: 25 }, (_, i) => { const a = Math.PI + (i / 24) * Math.PI; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }), false, 0.4);
  const half = [...disc, [cx + r, cy]];
  P.paper([half]); P.colour([half], C.ochre, { pressure: 0.8 }); P.hatch([half], { clip: [[[cx, cy - r - 1], [cx + r + 1, cy - r - 1], [cx + r + 1, cy], [cx, cy]]], angle: 60, pitch: 0.7, nib: 0.08 }); P.outline([half], { nib: 0.28 });
  for (let i = 0; i < 9; i++) { const a = Math.PI + 0.12 + (i / 8) * (Math.PI - 0.24), r0 = r * 1.3, r1 = r * (i % 2 ? 1.62 : 1.8); P.ink([[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]], { nib: 0.2 }); }
  P.ink([[cx - r * 2.1, cy], [cx + r * 2.1, cy]], { nib: 0.22 });
}

function moon(P, cx, cy, r) {
  const outer = D.ell(cx, cy, r, r), bite = D.ell(cx + r * 0.42, cy - r * 0.2, r * 0.86, r * 0.86);
  P.paper([outer], { cut: [bite] }); P.colour([outer], '#efd98f', { pressure: 0.8, cut: [bite] }); P.hatch([outer], { cut: [bite, D.ell(cx - r * 0.2, cy - r * 0.1, r * 0.7, r * 0.8)], angle: 50, pitch: 0.6, nib: 0.08 }); P.outline([outer], { nib: 0.26, cut: [bite] });
  for (const [x, y, s] of [[cx + r * 1.6, cy - r * 0.9, 1.1], [cx + r * 2.2, cy + r * 0.5, 0.8], [cx - r * 0.4, cy - r * 1.7, 0.9]]) { P.ink([[x - s, y], [x + s, y]], { nib: 0.14 }); P.ink([[x, y - s], [x, y + s]], { nib: 0.14 }); }
}

function stove(P, cx, by, s) {
  const T = at(cx, by, s);
  part(P, T([[-14, -10], [14, -10], [14, 0], [-14, 0]]), C.cream, { shade: T([[6, -11], [15, -11], [15, 1], [6, 1]]), hatch: 80, pitch: 0.6 });
  for (const x of [-8, 8]) part(P, T(D.ell(x, -10.4, 5.4, 1.2)), '#6e6a6a', { nib: 0.18, passes: 1 });
  for (const x of [-9, -3, 3, 9]) part(P, T(D.ell(x, -4.6, 1.3, 1.3)), C.paper, { nib: 0.16, passes: 1, pressure: 0.4 });
  part(P, T(D.rrect(-11, -2.8, 11, -1.4, 0.4)), C.steel, { nib: 0.14, passes: 1 });
}

function kettle(P, cx, by, s) {
  const T = at(cx, by, s);
  const body = T(D.curve([[-6.4, -1], [-6.8, -7.4], [-4, -11], [4, -11], [6.8, -7.4], [6.4, -1], [4.6, 0], [-4.6, 0]]));
  part(P, T(D.curve([[5.6, -5.6], [9.4, -8.6], [11.2, -11.8], [12, -11.2], [10.4, -7.2], [6, -2.8]])), C.slate, {});
  part(P, body, C.slate, { shade: T([[2, -12], [8, -12], [8, 1], [2, 1]]), hatch: 72 });
  P.paper([T(D.ell(-3.2, -6.8, 1.0, 1.7, 0.3))]);
  P.outline([T(D.curve([[-4, -11], [-3, -15.4], [0, -16.4], [3, -15.4], [4, -11]], false))], { nib: 0.26 });
  part(P, T(D.ell(0, -11.4, 2, 0.8)), C.slate, { nib: 0.2 });
  for (let i = 0; i < 2; i++) { const x0 = 11.6 + i * 2.2; P.curve(T([[x0, -13], [x0 + 0.9, -15.2], [x0 - 0.9, -17.4], [x0 + 0.9, -19.6], [x0, -21.6]]), { nib: 0.12, color: '#6f6a70' }); }
}

function pot(P, cx, by, s) {
  const T = at(cx, by, s);
  const body = T(D.curve([[-8.6, -12], [8.6, -12], [8.2, -2.4], [6.4, 0], [-6.4, 0], [-8.2, -2.4]]));
  for (const sd of [-1, 1]) part(P, T(D.rrect(sd * 8.6 - 2.2, -11.4, sd * 8.6 + 2.2, -9.6, 0.8)), C.rose, { nib: 0.18 });
  part(P, body, C.rose, { shade: T([[3, -13], [10, -13], [10, 1], [3, 1]]), hatch: 78 });
  part(P, T(D.ell(0, -12, 8.8, 1.8)), '#8a4e3c', { nib: 0.24 });
  for (const [x, y] of [[-5, -12.1], [-2.4, -12.5], [0.2, -12.0], [2.8, -12.4], [5.2, -12.0], [-1.2, -11.6], [1.4, -11.5]]) { const c = T(D.ell(x, y, 1.15, 0.9)); P.paper([c]); P.colour([c], C.pearl, { pressure: 0.95 }); P.outline([c], { nib: 0.08 }); }
  for (let i = 0; i < 3; i++) { const x0 = -3.4 + i * 3.4; P.curve(T([[x0, -14.4], [x0 + 0.9, -16.6], [x0 - 0.9, -18.8], [x0 + 0.9, -21], [x0, -23]]), { nib: 0.12, color: '#6f6a70' }); }
}

function mop(P, cx, by, s) {
  const T = at(cx, by, s);
  part(P, T([[-6, -9], [6, -9], [5, 0], [-5, 0]]), C.slate, { shade: T([[2, -10], [7, -10], [7, 1], [2, 1]]), hatch: 80 });
  part(P, T(D.ell(0, -9, 6, 1.2)), '#9fbcd0', { nib: 0.18 });
  P.ink(T([[-3.4, -9], [-3, -11.4], [3, -11.4], [3.4, -9]]), { nib: 0.16 });
  part(P, T(D.rrect(1, -34, 2.4, -6, 0.6)), C.wood, { nib: 0.2 });
  const head = T(D.curve([[-1.6, -7.4], [5, -7.4], [6, -2], [3.6, -0.4], [1.6, -3], [0, -0.6], [-1.8, -2.6]]));
  part(P, head, C.cream, { nib: 0.18 });
}

function morningGlory(P, cx, cy, r, a = 0) {
  const T = at(cx, cy, 1, a);
  const flower = T(D.curve(Array.from({ length: 10 }, (_, i) => { const t = (i / 10) * Math.PI * 2, k = i % 2 ? 0.86 : 1; return [Math.cos(t) * r * k, Math.sin(t) * r * k]; })));
  P.paper([flower]); P.colour([flower], '#9bb4e2', { pressure: 0.75 });
  P.colour([D.ell(cx, cy, r * 0.55, r * 0.55)], '#f4f1e4', { pressure: 0.6, passes: 1 });
  P.colour([D.ell(cx, cy, r * 0.2, r * 0.2)], '#e8c45a', { pressure: 0.9, passes: 1 });
  for (let i = 0; i < 5; i++) { const t = (i / 5) * Math.PI * 2 + a; P.ink([[cx + Math.cos(t) * r * 0.22, cy + Math.sin(t) * r * 0.22], [cx + Math.cos(t) * r * 0.92, cy + Math.sin(t) * r * 0.92]], { nib: 0.08 }); }
  P.outline([flower], { nib: 0.2 });
}

function vine(P, x, y0, y1, o = {}) {
  const pts = []; for (let y = y1; y >= y0; y -= 1.5) pts.push([x + Math.sin(y * 0.18) * 3, y]);
  P.ink(D.curve(pts, false, 0.4), { nib: 0.24, color: '#5f7d4e' });
  const R = P.R;
  for (let i = 0; i < (o.leaves ?? 12); i++) {
    const t = (i + 0.5) / (o.leaves ?? 12), p = pts[Math.round(t * (pts.length - 1))], side = i % 2 ? 1 : -1;
    const lf = D.curve([[p[0], p[1]], [p[0] + side * 2.6, p[1] - 2.6], [p[0] + side * 4.8, p[1] - 1.2], [p[0] + side * 4.4, p[1] + 1.6], [p[0] + side * 1.6, p[1] + 1.2]]);
    P.paper([lf]); P.colour([lf], C.sage, { pressure: 0.75 }); P.outline([lf], { nib: 0.16 });
  }
  for (const [t, r] of o.flowers || [[0.2, 3], [0.45, 3.6], [0.7, 3.2], [0.9, 2.8]]) { const p = pts[Math.round(t * (pts.length - 1))]; morningGlory(P, p[0] + (t * 10 % 2 > 1 ? 4 : -4), p[1], r, t * 3); }
}

function planter(P, x0, x1, top, h) {
  const box = [[x0, top], [x1, top], [x1 - 1.4, top + h], [x0 + 1.4, top + h]];
  const R = P.R;
  for (let x = x0 + 3; x < x1 - 2; x += 5.6) {
    P.ink([[x, top], [x + R.range(-1, 1), top - 6]], { nib: 0.16, color: '#5f7d4e' });
    const c = [x + R.range(-1, 1), top - 7 - R() * 2];
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, pet = D.ell(c[0] + Math.cos(a) * 1.5, c[1] + Math.sin(a) * 1.5, 1.4, 0.95, a); P.paper([pet]); P.colour([pet], (Math.round(x) % 3) ? C.blush : '#f3d27a', { pressure: 0.72, passes: 1 }); P.outline([pet], { nib: 0.1 }); }
    P.paper([D.ell(c[0], c[1], 0.8, 0.8)]); P.colour([D.ell(c[0], c[1], 0.8, 0.8)], '#c9873e', { pressure: 0.9, passes: 1 });
  }
  P.paper([box]); P.colour([box], '#c98f76', { pressure: 0.72 }); P.hatch([box], { angle: 80, pitch: 0.7, nib: 0.08 }); P.outline([box], { nib: 0.26 });
}

function hourglass(P, cx, cy, s) {
  const T = at(cx, cy, s);
  for (const sd of [-1, 1]) H_part(P, T(D.rrect(-6, sd * 11 - 1.2, 6, sd * 11 + 1.2, 0.6)), C.wood);
  for (const sd of [-1, 1]) P.ink(T([[sd * 5, -10], [sd * 5, 10]]), { nib: 0.32 });
  const glass = T(D.curve([[-4, -9.6], [4, -9.6], [3.6, -5], [0.6, -0.6], [3.6, 5], [4, 9.6], [-4, 9.6], [-3.6, 5], [-0.6, -0.6], [-3.6, -5]]));
  P.paper([glass]); P.colour([glass], C.plastic, { pressure: 0.35, passes: 1 });
  const sandBottom = T(D.curve([[-3.8, 9.4], [3.8, 9.4], [3, 6.2], [0, 4.2], [-3, 6.2]]));
  P.colour([sandBottom], C.ochre, { pressure: 0.8 }); P.ink(T([[0, -0.4], [0, 4.4]]), { nib: 0.12, color: '#b07a2c' });
  P.outline([glass], { nib: 0.24 });
}
function H_part(P, poly, color) { part(P, poly, color, { nib: 0.22 }); }

function magnifier(P, cx, cy, r, a = 0.7) {
  const T = at(cx, cy, 1, a);
  part(P, T(D.rrect(r * 0.95, -1.1, r * 2.3, 1.1, 0.6)), C.woodDeep, { nib: 0.22 });
  const lens = D.ell(cx, cy, r, r), rim = D.ell(cx, cy, r + 0.9, r + 0.9);
  P.paper([rim]); P.colour([rim], '#9aa3a8', { pressure: 0.7, cut: [lens] }); P.outline([rim], { nib: 0.24 }); P.outline([lens], { nib: 0.16 });
  P.colour([D.ell(cx - r * 0.35, cy - r * 0.35, r * 0.35, r * 0.18, -0.7)], '#ffffff', { pressure: 0.6, passes: 1 });
}

module.exports = { hourglass, magnifier, C, at, rot, part, counter, register, coin, bell, bobaCup, jar, shaker, shopWindow, awning, sunrise, moon, stove, kettle, pot, mop, morningGlory, vine, planter };
