'use strict';
const D = require('./draw');

const TAU = Math.PI * 2;
const HEAD = { c: [0, -30.6], r: 6.4 };
const SH = 4.9, SHY = -23.2, HIPY = -11.6;

function capsule(a, b, ra, rb = ra, n = 12) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), out = [];
  for (let i = 0; i <= n; i++) { const t = ang + Math.PI / 2 + (i / n) * Math.PI; out.push([a[0] + Math.cos(t) * ra, a[1] + Math.sin(t) * ra]); }
  for (let i = 0; i <= n; i++) { const t = ang - Math.PI / 2 + (i / n) * Math.PI; out.push([b[0] + Math.cos(t) * rb, b[1] + Math.sin(t) * rb]); }
  return out;
}
function limb(pts, r) {
  const L = [], Rr = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const n = [-(b[1] - a[1]) / d * r, (b[0] - a[0]) / d * r];
    L.push([p[0] + n[0], p[1] + n[1]]); Rr.push([p[0] - n[0], p[1] - n[1]]);
  });
  const end = (c, from, to) => { const out = []; for (let k = 1; k < 8; k++) { const t = from + (to - from) * k / 8; out.push([c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r]); } return out; };
  const a0 = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]), n1 = pts.length - 1, a1 = Math.atan2(pts[n1][1] - pts[n1 - 1][1], pts[n1][0] - pts[n1 - 1][0]);
  return [...L, ...end(pts[n1], a1 + Math.PI / 2, a1 - Math.PI / 2), ...Rr.reverse(), ...end(pts[0], a0 - Math.PI / 2, a0 - Math.PI * 1.5)];
}
const arc = (c, r, t0, t1, n = 24) => Array.from({ length: n + 1 }, (_, i) => { const t = t0 + (t1 - t0) * i / n; return [c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r]; });

const POSES = {
  stand: { l: [[-6.6, -17.4], [-6.8, -11.6]], r: [[6.6, -17.4], [6.8, -11.6]] },
  wave: { l: [[-6.6, -17.4], [-6.8, -11.6]], r: [[9.2, -26.4], [10.6, -32.6]] },
  cheer: { l: [[-9.2, -26.4], [-10.6, -32.6]], r: [[9.2, -26.4], [10.6, -32.6]] },
  hold: { l: [[-6.4, -17.8], [-2.4, -16.4]], r: [[6.4, -17.8], [2.4, -16.4]] },
  reach: { l: [[-6.6, -17.4], [-6.8, -11.6]], r: [[9.6, -20.6], [14.2, -17.6]] },
  shake: { l: [[-2.6, -16.2], [5.4, -15.6]], r: [[10.4, -18.8], [7.6, -24.2]] },
  roll: { l: [[-7.4, -17.2], [-4.6, -12.6]], r: [[7.4, -17.2], [4.6, -12.6]] },
  raise: { l: [[-6.6, -17.4], [-6.8, -11.6]], r: [[9.4, -25.4], [9.8, -31.6]] },
  stir: { l: [[-6.4, -17.8], [-3, -15.2]], r: [[8.6, -19], [11.6, -21.6]] },
  dig: { l: [[-3.8, -17.4], [1.6, -14.6]], r: [[7.4, -18.8], [5.8, -24.4]] },
};

function person(P, x, y, s, o = {}) {
  const S = P.S, sx = o.flip ? -1 : 1;
  const L = (pts) => pts.map(([px, py]) => [x + px * s * sx, y + py * s]);
  const pose = typeof o.pose === 'object' ? o.pose : POSES[o.pose || 'stand'];
  const w = o.w ?? 1.1;
  const shirt = o.shirt || {};
  const hand = { l: L([pose.l[1]])[0], r: L([pose.r[1]])[0] };
  const lean = o.lean ?? 0;

  if (o.back) o.back(P, { L, s, sx, hand });

  const foot = o.stance === 'step' ? [[-4.2, -0.9], [3.6, -1.6]] : o.stance === 'wide' ? [[-4.6, -0.9], [4.6, -0.9]] : [[-2.7, -0.9], [2.7, -0.9]];
  for (const [i, side] of [[0, -1], [1, 1]]) {
    const hip = [side * 2.4, HIPY], f = foot[i], knee = [(hip[0] + f[0]) / 2 + (o.stance === 'step' ? side * 0.6 : 0), (HIPY + f[1]) / 2];
    P.shape([L(limb(D.curve([hip, knee, [f[0], f[1] - 1.6]], false, 0.8), 1.85))], { fill: o.pants === 'white' ? 'paper' : 'black', w });
    const shoe = D.ell(f[0] + side * 0.7, f[1] - 0.2, 2.5, 1.35);
    P.shape([L(shoe)], { fill: o.shoes === 'black' ? 'black' : 'paper', w });
  }

  const arm = (side, key, front) => {
    const sh = [side * SH, SHY + 0.6], [el, hd] = pose[key];
    if (!!front !== !!(o.front?.[key])) return;
    P.shape([L(limb(D.curve([sh, el, hd], false, 0.6), 1.35))], { fill: 'paper', w });
    const sleeveEnd = [sh[0] + (el[0] - sh[0]) * 0.62, sh[1] + (el[1] - sh[1]) * 0.62];
    P.shape([L(capsule(sh, sleeveEnd, 2.15, 2.0))], { fill: shirt.fill || shirt.color || 'paper', w });
  };
  arm(-1, 'l', false); arm(1, 'r', false);

  const torso = D.curve([[-5.7, SHY - 0.8], [-6.2, -18.4], [-5.6, HIPY - 0.8], [-4.6, HIPY + 1.2], [4.6, HIPY + 1.2], [5.6, HIPY - 0.8], [6.2, -18.4], [5.7, SHY - 0.8], [2.4, SHY - 2.1], [0, SHY - 1.7], [-2.4, SHY - 2.1]], true, 0.5);
  P.shape([L(torso)], { fill: shirt.fill || shirt.color || 'paper', w });
  if (shirt.style === 'polo') {
    for (const sd of [-1, 1]) P.shape([L([[0, SHY - 1.7], [sd * 3.4, SHY - 2.3], [sd * 1.6, SHY + 1.6]])], { fill: 'paper', w: 0.8 });
    P.line(L([[0, SHY - 0.2], [0, SHY + 3.6]]), { w: 0.6 });
    for (const yy of [SHY + 1.2, SHY + 2.8]) P.line(L([[-0.3, yy], [0.3, yy]]), { w: 0.6 });
  }
  if (o.apron) {
    const ap = D.curve([[-4.2, SHY + 1.4], [4.2, SHY + 1.4], [4.6, HIPY - 2], [5.6, HIPY + 4.6], [0, HIPY + 5.4], [-5.6, HIPY + 4.6], [-4.6, HIPY - 2]], true, 0.5);
    P.shape([L(ap)], { fill: o.apron === 'white' ? 'paper' : o.apron, w: 0.9 });
    P.line(L([[-4.2, SHY + 1.4], [-3, SHY - 1.6]]), { w: 0.7 }); P.line(L([[4.2, SHY + 1.4], [3, SHY - 1.6]]), { w: 0.7 });
  }

  const hc = [HEAD.c[0] + lean, HEAD.c[1]], hr = HEAD.r;
  const HC = (pts) => L(pts.map(([px, py]) => [px + hc[0], py + hc[1]]));
  P.shape([L(capsule([lean * 0.5, SHY - 1.4], [hc[0], hc[1] + hr - 1], 1.6))], { fill: 'paper', w: 0.9 });
  const face = D.ell(0, 0, hr, hr * 0.97);
  if (o.hair === 'bob' || o.hair === 'long') {
    const down = o.hair === 'long' ? 9.6 : 4.2;
    P.black([HC(D.curve([[-hr - 0.9, down], [-hr - 1.2, -1], [-hr * 0.7, -hr - 0.6], [0, -hr - 1.3], [hr * 0.7, -hr - 0.6], [hr + 1.2, -1], [hr + 0.9, down], [hr - 1.6, down + 0.6], [-hr + 1.6, down + 0.6]]))], { w });
  }
  P.shape([HC(face)], { fill: 'paper', w });
  if (o.blush !== false) for (const sd of [-1, 1]) P.splash([HC(D.ell(sd * 3.6 + (o.look ?? 0), 2.1, 1.25, 0.8))], o.blushColor || '#f2a3b3');
  for (const sd of [-1, 1]) P.black([HC(D.ell(sd * 2.1 + (o.look ?? 0), 0.4, 0.62, 0.66))], { outline: false });

  const hairTop = (fringe) => {
    const outer = arc([0, 0], hr + 0.75, Math.PI + 0.2, TAU - 0.2, 30);
    return [...outer, ...fringe];
  };
  if (o.hair === 'wavy') {
    const fr = D.curve([[hr + 0.2, -0.6], [hr - 1.4, -2.2], [hr - 2.6, -1.6], [3.2, -3.4], [1.8, -2.4], [0.4, -3.8], [-1.2, -2.6], [-2.6, -3.6], [-4, -2.2], [-hr + 1.6, -2.6], [-hr - 0.2, -0.4]], false, 0.4);
    P.black([HC(hairTop(fr))], { w });
    for (const [a, b, c] of [[[-1.6, -hr - 0.4], [-0.6, -hr - 1.8], [0.6, -hr - 1.2]], [[2.4, -hr - 0.2], [3.4, -hr - 1.4], [4.6, -hr - 0.6]]]) P.black([HC([a, b, c, [c[0] - 0.6, c[1] + 0.9], [a[0] + 0.6, a[1] + 0.6]])], { outline: false });
  } else if (o.hair === 'short' || o.hair === 'bun' || o.hair === 'bob' || o.hair === 'long') {
    const fr = D.curve([[hr + 0.2, -0.4], [hr - 1.6, -2.9], [2, -3.9], [-1.6, -3.6], [-hr + 1.4, -2.6], [-hr - 0.2, -0.2]], false, 0.4);
    P.black([HC(hairTop(fr))], { w });
    if (o.hair === 'bun') P.black([HC(D.ell(0.4, -hr - 2.4, 2.9, 2.6))], { w });
  }

  if (o.hat === 'conical') {
    const hat = D.curve([[-14.2, -2.8], [-7, -6.4], [-0.6, -14.8], [0.6, -14.8], [7, -6.4], [14.2, -2.8], [0, -1.2]], true, 0.4);
    P.shape([HC(hat)], { fill: o.hatColor || 'paper', w });
    for (const t of [0.45, 0.72]) P.line(HC([[-14.2 * t, -2.8 - (1 - t) * 6], [14.2 * t, -2.8 - (1 - t) * 6]]), { w: 0.5 });
    P.line(HC([[-5.6, -2.6], [-3.8, 4.2], [0, 6.6], [3.8, 4.2], [5.6, -2.6]]), { w: 0.45 });
  }
  if (o.hat === 'cap') {
    P.shape([HC(D.curve([[-hr - 0.6, -1.4], [-hr + 0.4, -5.6], [0, -hr - 1.6], [hr - 0.4, -5.6], [hr + 0.6, -1.4]], true, 0.4))], { fill: o.capColor || 'black', w });
    P.shape([HC(D.curve([[hr * 0.1, -1.6], [hr + 4.6, -1.2], [hr + 4.8, 0.2], [hr * 0.1, -0.2]], true, 0.4))], { fill: 'black', w: 0.9 });
  }
  if (o.top) o.top(P, { HC, L, s, sx, hr });

  arm(-1, 'l', true); arm(1, 'r', true);
  for (const [key, side] of [['l', -1], ['r', 1]]) {
    if (o.hold?.[key]) o.hold[key](P, hand[key], side * sx);
    P.shape([D.ell(hand[key][0], hand[key][1], 1.55 * s, 1.5 * s)], { fill: 'paper', w: 0.95 });
  }
  if (o.after) o.after(P, { L, s, sx, hand });
  return { hand, head: L([hc])[0], L };
}

module.exports = { person, POSES, HEAD, capsule, limb };
