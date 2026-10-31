'use strict';
const path = require('path');
const fs = require('fs');
const D = require('../../tools/lib/draw');
require('./media');
const { rng, hexToRgb } = require('../../tools/kit/util');
const tools = require('module').createRequire(path.join(__dirname, '..', '..', 'tools', 'package.json'));
const { createCanvas } = tools('@napi-rs/canvas');

const ROOT = path.join(__dirname, '..');
const GRID = 5, ATLAS = 2048, CELL = ATLAS / GRID, SS = 2, TILE = Math.ceil(CELL), N = TILE * SS, MID = N / 2;
const RAD = 194 * SS, RIM = 16 * SS, FELT = RAD - RIM;
const FACE = 'Kevin Sans Bold';

const PAL = {
  linen: '#e9dfcc',
  gold: ['#e2b33f', '#f6ecd2'], red: ['#c4453a', '#ef9a8c'], cream: ['#efe6d2', '#fbf7ee'],
  felt: { booster: '#26304f', ship: '#3a2f45', tower: '#2f4a43' },
};
const OFF_PATH = new Set(['Holding the count', 'Scrubbed for today', 'Diverted to the sea']);

const rgb = (h) => hexToRgb(h);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const css = (c, a = 1) => `rgba(${c.map((v) => Math.max(0, Math.min(255, Math.round(v)))).join(',')},${a})`;
const nrm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
const LIGHT = nrm([-0.42, -0.62, 0.66]), HALF = nrm([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);

function readChart() {
  const src = fs.readFileSync(path.join(ROOT, 'model', 'chart', 'chart.mmd'), 'utf8');
  const states = [], breaks = new Set();
  let region = null;
  for (const line of src.split('\n')) {
    const r = line.match(/^\s*state "The (booster|ship|tower)" as \w+ \{/i);
    if (r) { region = r[1].toLowerCase(); continue; }
    if (/^\s*\}\s*$/.test(line)) { region = null; continue; }
    const s = line.match(/^\s*(s\d+):\s*(.+?)\s*$/);
    if (s && region) states.push({ id: s[1], label: s[2], region });
    const b = line.match(/^\s*class (s\d+) breaks\b/);
    if (b) breaks.add(b[1]);
  }
  return states.map((st) => ({ ...st, kind: breaks.has(st.id) ? 'red' : OFF_PATH.has(st.label) ? 'cream' : 'gold' }));
}

function noiseField(R, cell) {
  const gw = Math.ceil(N / cell) + 3, g = new Float32Array(gw * gw).map(() => R() * 2 - 1);
  return (x, y) => {
    const fx = x / cell, fy = y / cell, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), i = (y0 + 1) * gw + x0 + 1;
    const a = g[i], b = g[i + 1], c = g[i + gw], d = g[i + gw + 1];
    return a + (b - a) * sx + (c - a + (d - c - b + a) * sx) * sy;
  };
}

function boxBlur(src, r) {
  const a = new Float32Array(src), b = new Float32Array(src.length), k = 1 / (2 * r + 1);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < N; y++) { const o = y * N; let acc = 0; for (let x = -r; x <= r; x++) acc += a[o + clamp(x, 0, N - 1)]; for (let x = 0; x < N; x++) { b[o + x] = acc * k; acc += a[o + Math.min(N - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; } }
    for (let x = 0; x < N; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += b[clamp(y, 0, N - 1) * N + x]; for (let y = 0; y < N; y++) { a[y * N + x] = acc * k; acc += b[Math.min(N - 1, y + r + 1) * N + x] - b[Math.max(0, y - r) * N + x]; } }
  }
  return a;
}

function alphaOf(canvas) {
  const d = canvas.getContext('2d').getImageData(0, 0, N, N).data, a = new Float32Array(N * N);
  for (let i = 0; i < a.length; i++) a[i] = d[4 * i + 3] / 255;
  return a;
}
function maskCanvas(draw) {
  const c = createCanvas(N, N), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  draw(g);
  return c;
}

function edt(mask) {
  const BIG = 1e10, f = new Float64Array(N * N), line = new Float64Array(N), out = new Float64Array(N), v = new Int32Array(N), z = new Float64Array(N + 1);
  for (let i = 0; i < N * N; i++) f[i] = mask[i] >= 0.5 ? BIG : 0;
  const dt = () => {
    let k = 0; v[0] = 0; z[0] = -1e30; z[1] = 1e30;
    for (let q = 1; q < N; q++) {
      let s = (line[q] + q * q - (line[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = (line[q] + q * q - (line[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = 1e30;
    }
    k = 0;
    for (let q = 0; q < N; q++) { while (z[k + 1] < q) k++; out[q] = (q - v[k]) * (q - v[k]) + line[v[k]]; }
  };
  for (let x = 0; x < N; x++) { for (let y = 0; y < N; y++) line[y] = f[y * N + x]; dt(); for (let y = 0; y < N; y++) f[y * N + x] = out[y]; }
  for (let y = 0; y < N; y++) { for (let x = 0; x < N; x++) line[x] = f[y * N + x]; dt(); for (let x = 0; x < N; x++) f[y * N + x] = out[x]; }
  const Dm = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) Dm[i] = Math.sqrt(f[i]);
  return Dm;
}

function sampler(mask) {
  return (x, y) => {
    const fx = x - 0.5, fy = y - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy);
    if (x0 < 0 || y0 < 0 || x0 >= N - 1 || y0 >= N - 1) return 0;
    const tx = fx - x0, ty = fy - y0, i = y0 * N + x0;
    return (mask[i] * (1 - tx) + mask[i + 1] * tx) * (1 - ty) + (mask[i + N] * (1 - tx) + mask[i + N + 1] * tx) * ty;
  };
}

function poisson(cands, minD, R, taken = []) {
  const cell = minD, gw = Math.ceil(N / cell) + 1, grid = new Map(), out = [];
  const key = (x, y) => Math.floor(y / cell) * gw + Math.floor(x / cell);
  const add = (p) => { const k = key(p[0], p[1]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(p); };
  taken.forEach(add);
  for (const p of R.shuffle(cands)) {
    const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell);
    let ok = true;
    for (let yy = cy - 1; yy <= cy + 1 && ok; yy++) for (let xx = cx - 1; xx <= cx + 1 && ok; xx++) for (const q of grid.get(yy * gw + xx) || []) if ((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 < minD * minD) { ok = false; break; }
    if (ok) { add(p); out.push(p); }
  }
  return out;
}

function bounds(mask) {
  let x0 = N, y0 = N, x1 = -1, y1 = -1;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (mask[y * N + x] >= 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : [Math.max(1, x0 - 2), Math.max(1, y0 - 2), Math.min(N - 2, x1 + 2), Math.min(N - 2, y1 + 2)];
}

function thin(mask, [x0, y0, x1, y1]) {
  const S = new Uint8Array(N * N), del = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) S[y * N + x] = mask[y * N + x] >= 0.5 ? 1 : 0;
  for (let changed = true; changed;) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * N + x;
        if (!S[i]) continue;
        const p2 = S[i - N], p3 = S[i - N + 1], p4 = S[i + 1], p5 = S[i + N + 1], p6 = S[i + N], p7 = S[i + N - 1], p8 = S[i - 1], p9 = S[i - N - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (B < 2 || B > 6) continue;
        const A = (!p2 && p3 ? 1 : 0) + (!p3 && p4 ? 1 : 0) + (!p4 && p5 ? 1 : 0) + (!p5 && p6 ? 1 : 0) + (!p6 && p7 ? 1 : 0) + (!p7 && p8 ? 1 : 0) + (!p8 && p9 ? 1 : 0) + (!p9 && p2 ? 1 : 0);
        if (A !== 1) continue;
        if (pass === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
        del.push(i);
      }
      for (const i of del) S[i] = 0;
      if (del.length) changed = true;
    }
  }
  return S;
}

function chains(S, [x0, y0, x1, y1]) {
  const nb = [-N - 1, -N, -N + 1, -1, 1, N - 1, N, N + 1], seen = new Uint8Array(N * N), out = [];
  const deg = (i) => nb.reduce((c, o) => c + (S[i + o] ? 1 : 0), 0);
  const starts = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * N + x; if (S[i]) starts.push([deg(i), i]); }
  starts.sort((a, b) => a[0] - b[0]);
  for (const [, s] of starts) {
    if (seen[s]) continue;
    const pts = [s]; seen[s] = 1;
    let cur = s, dx = 0, dy = 0;
    for (;;) {
      let best = -1, bs = -9;
      for (const o of nb) {
        const j = cur + o;
        if (!S[j] || seen[j]) continue;
        const ox = (j % N) - (cur % N), oy = Math.floor(j / N) - Math.floor(cur / N), l = Math.hypot(ox, oy), sc = (ox * dx + oy * dy) / l - (l > 1 ? 0.05 : 0);
        if (sc > bs) { bs = sc; best = j; }
      }
      if (best < 0) break;
      const ox = (best % N) - (cur % N), oy = Math.floor(best / N) - Math.floor(cur / N), l = Math.hypot(ox, oy);
      dx = dx * 0.5 + (ox / l) * 0.5; dy = dy * 0.5 + (oy / l) * 0.5;
      seen[best] = 1; pts.push(best); cur = best;
    }
    if (pts.length >= 3) out.push(pts.map((i) => [(i % N) + 0.5, Math.floor(i / N) + 0.5]));
  }
  return out;
}

function caster(mask) {
  const at = sampler(mask);
  return (x, y, ux, uy, lim) => { let s = 0, prev = 1; while (s < lim) { const s2 = s + 0.35, a = at(x + ux * s2, y + uy * s2); if (a < 0.5) return s + (0.35 * (prev - 0.5)) / Math.max(1e-4, prev - a); prev = a; s = s2; } return lim; };
}

function satin(maskC, o, R) {
  const mask = alphaOf(maskC), box = bounds(mask);
  if (!box) return [];
  const Dm = edt(mask), C = new Float32Array(N * N), S = new Float32Array(N * N), inside = [];
  let maxD = 0;
  for (let y = box[1]; y <= box[3]; y++) for (let x = box[0]; x <= box[2]; x++) {
    const i = y * N + x, d = Dm[i];
    if (d <= 0) continue;
    if (d > maxD) maxD = d;
    const gx = (Dm[i + 1] - Dm[i - 1]) / 2, gy = (Dm[i + N] - Dm[i - N]) / 2;
    C[i] = gx * gx - gy * gy; S[i] = 2 * gx * gy;
    inside.push(i);
  }
  const rb = Math.max(1, Math.round(maxD * 0.7)), Cb = boxBlur(C, rb), Sb = boxBlur(S, rb), cast = caster(mask);
  const slant = o.slant ?? 0.4, pitch = o.pitch, out = [], seeds = [], rag = o.rag ?? 0.3;
  const lay = (x, y, phi, far) => {
    const i = Math.floor(y) * N + Math.floor(x), ux = Math.cos(phi), uy = Math.sin(phi);
    const lim = far || Math.max(3, (Dm[i] || 1) * 3 + 2), s1 = cast(x, y, ux, uy, lim), s0 = cast(x, y, -ux, -uy, lim);
    const e0 = s0 + 0.25 + R.gauss(0, rag), e1 = s1 + 0.25 + R.gauss(0, rag);
    out.push(stitch([x - ux * e0, y - uy * e0], [x + ux * e1, y + uy * e1], pitch * (o.cover || 1.45), o.th, 0.95 + R() * 0.08));
    seeds.push([x, y]);
  };
  for (const ch of chains(thin(mask, box), box)) {
    const sm = ch.map((p, k) => { let sx = 0, sy = 0, n = 0; for (let j = Math.max(0, k - 3); j <= Math.min(ch.length - 1, k + 3); j++) { sx += ch[j][0]; sy += ch[j][1]; n++; } return [sx / n, sy / n]; });
    if (sm.length > 6) { sm[0] = ch[0]; sm[sm.length - 1] = ch[ch.length - 1]; }
    const L = D.polyLen(sm);
    if (L < pitch * 0.6) continue;
    const pts = D.resample(sm, 0.5), step = pitch * (1 + R.gauss(0, 0.02));
    for (let s = R() * step * 0.8; s <= L; s += step * (1 + R.gauss(0, 0.04))) {
      const k = Math.min(pts.length - 1, Math.round(s / 0.5)), a = pts[Math.max(0, k - 4)], b = pts[Math.min(pts.length - 1, k + 4)];
      lay(pts[k][0], pts[k][1], Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2 + slant + R.gauss(0, 0.025));
    }
  }
  const cov = maskCanvas((g) => { g.lineWidth = pitch * (o.cover || 1.45) * o.th.body; for (const s of out) { g.beginPath(); g.moveTo(...s.pts[0]); g.lineTo(...s.pts[1]); g.stroke(); } });
  const ca = alphaOf(cov), gaps = [];
  for (const i of inside) if (mask[i] >= 0.5 && ca[i] < 0.5) gaps.push([(i % N) + 0.5, Math.floor(i / N) + 0.5]);
  for (const [x, y] of poisson(gaps, pitch * 0.95, R, seeds.slice())) { const i = Math.floor(y) * N + Math.floor(x); lay(x, y, 0.5 * Math.atan2(Sb[i], Cb[i]) + slant, maxD * 2.4 + 2); }
  return out;
}

function fillSatin(maskC, o, R) {
  const mask = alphaOf(maskC), box = bounds(mask);
  if (!box) return [];
  const at = sampler(mask), ang = o.angle, ux = Math.cos(ang), uy = Math.sin(ang), vx = -uy, vy = ux, out = [];
  const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, ext = Math.hypot(box[2] - box[0], box[3] - box[1]) / 2 + 2, maxLen = o.maxLen || 1e9, step = 0.4, rag = o.rag ?? 0.3;
  let li = 0;
  for (let q = -ext; q <= ext; q += o.pitch * (1 + R.gauss(0, 0.03)), li++) {
    let start = null, prev = 0;
    const emit = (s0, s1) => {
      const len = s1 - s0;
      if (len < 0.8) return;
      const parts = Math.max(1, Math.round(len / maxLen)), cuts = [s0];
      for (let k = 1; k < parts; k++) cuts.push(s0 + (len * (k + (li % 2 ? 0.32 : -0.32) + R.gauss(0, 0.1))) / parts);
      cuts.push(s1);
      for (let k = 0; k + 1 < cuts.length; k++) {
        const e0 = cuts[k] - (k ? 0.8 : 0.25) + R.gauss(0, rag), e1 = cuts[k + 1] + (k + 2 < cuts.length ? 0.8 : 0.25) + R.gauss(0, rag), da = R.gauss(0, 0.012);
        const ax = Math.cos(ang + da), ay = Math.sin(ang + da), bx = cx + vx * q, by = cy + vy * q;
        out.push(stitch([bx + ax * e0, by + ay * e0], [bx + ax * e1, by + ay * e1], o.pitch * (o.cover || 1.45), o.th, 0.95 + R() * 0.08));
      }
    };
    for (let s = -ext; s <= ext + step; s += step) {
      const a = at(cx + vx * q + ux * s, cy + vy * q + uy * s);
      if (a >= 0.5 && start === null) start = s - step + (step * (0.5 - prev)) / Math.max(1e-4, a - prev);
      else if (a < 0.5 && start !== null) { emit(start, s - step + (step * (prev - 0.5)) / Math.max(1e-4, prev - a)); start = null; }
      prev = a;
    }
  }
  return out;
}

function felt(R, hex) {
  const base = rgb(hex).map((v) => v * (1 + R.gauss(0, 0.018))), c = createCanvas(N, N), g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data;
  const lo = noiseField(R, 170), mid = noiseField(R, 34), fine = noiseField(R, 7);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = Math.hypot(x - MID, y - MID) / FELT;
    const k = 1 + 0.05 * lo(x, y) + 0.045 * mid(x, y) + 0.04 * fine(x, y) + 0.035 * (R() - 0.5) - 0.06 * smooth(0.6, 1, r) + 0.03 * (2 * MID - x - y) / N;
    const i = 4 * (y * N + x);
    d[i] = base[0] * k; d[i + 1] = base[1] * k; d[i + 2] = base[2] * k; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const light = mix(base, [255, 248, 236], 0.32), dark = base.map((v) => v * 0.5);
  const fibres = (gg, n, len, wid, al, lit = 0.6) => {
    for (let i = 0; i < n; i++) {
      const x = R() * N, y = R() * N, a = R() * Math.PI * 2, l = len[0] + R() * len[1], bend = (R() - 0.5) * l * 0.9, on = R() < lit;
      gg.strokeStyle = css(on ? light : dark, al[0] + R() * al[1]);
      gg.lineWidth = wid[0] + R() * wid[1];
      gg.beginPath(); gg.moveTo(x, y);
      gg.quadraticCurveTo(x + Math.cos(a) * l * 0.5 - Math.sin(a) * bend, y + Math.sin(a) * l * 0.5 + Math.cos(a) * bend, x + Math.cos(a) * l, y + Math.sin(a) * l);
      gg.stroke();
    }
  };
  const soft = createCanvas(N, N);
  fibres(soft.getContext('2d'), 24000, [5, 16], [0.6, 1.2], [0.1, 0.16]);
  g.filter = 'blur(1.4px)'; g.drawImage(soft, 0, 0); g.filter = 'none';
  fibres(g, 14000, [3, 10], [0.45, 0.7], [0.06, 0.14]);
  fibres(g, 2600, [10, 26], [0.35, 0.4], [0.05, 0.08], 0.9);
  return c;
}

const STOPS = [0, 0.07, 0.18, 0.32, 0.5, 0.68, 0.82, 0.93, 1];
function thread(pair, o = {}) { return { base: rgb(pair[0]), pale: rgb(pair[1]), k: 0.75, gloss: 8, sheen: 0.32, dip: 0.36, edge: 0.55, body: 0.74, under: 0.72, ...o }; }
function shade(th, T, t) {
  const ph = (t - 0.5) * Math.PI * th.k, s = Math.sin(ph), c = Math.cos(ph);
  const dif = Math.max(0, s * (T[0] * LIGHT[0] + T[1] * LIGHT[1]) + c * LIGHT[2]);
  const tt = c * (T[0] * HALF[0] + T[1] * HALF[1]) - s * HALF[2];
  const spec = Math.pow(Math.max(0, 1 - tt * tt), th.gloss);
  const e0 = 1 - Math.min(1, t / 0.16), e1 = 1 - Math.min(1, (1 - t) / 0.16), dip = 1 - th.dip * (e0 * e0 + e1 * e1);
  return { col: th.base.map((v, i) => (v * (0.42 + 0.68 * dif) + th.pale[i] * spec * th.sheen) * dip), spec: spec * dip };
}
function stitch(a, b, w, th, tint = 1) { return { pts: [a, b], w, th, tint }; }

function drawThreads(g, list) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  const seg = (a, b) => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
  for (const s of list) { g.lineWidth = s.w; g.strokeStyle = css(s.th.base.map((v) => v * s.th.edge * 0.6), 0.95); seg(...s.pts); }
  for (const s of list) {
    const [a, b] = s.pts, T = unit(a, b), gr = g.createLinearGradient(a[0], a[1], b[0], b[1]);
    for (const u of STOPS) gr.addColorStop(u, css(shade(s.th, T, u).col.map((v) => v * s.tint)));
    g.lineWidth = s.w * s.th.body; g.strokeStyle = gr; seg(a, b);
  }
  for (const s of list) {
    const [a, b] = s.pts, T = unit(a, b), nx = -T[1], ny = T[0], side = nx * LIGHT[0] + ny * LIGHT[1] > 0 ? 1 : -1, off = s.w * 0.12 * side;
    const a2 = [a[0] + nx * off, a[1] + ny * off], b2 = [b[0] + nx * off, b[1] + ny * off], gr = g.createLinearGradient(a2[0], a2[1], b2[0], b2[1]);
    for (const u of STOPS) gr.addColorStop(u, css(s.th.pale, clamp(shade(s.th, T, u).spec * 0.45)));
    g.lineWidth = s.w * 0.24; g.strokeStyle = gr; seg(a2, b2);
  }
}

function underlay(g, maskC, th) {
  const c = createCanvas(N, N), cg = c.getContext('2d');
  cg.drawImage(maskC, 0, 0); cg.globalCompositeOperation = 'source-in'; cg.fillStyle = css(th.base.map((v) => v * th.under)); cg.fillRect(0, 0, N, N);
  g.drawImage(c, 0, 0);
}

function rimStitches(R, th) {
  const out = [], pitch = 2.5 * SS, n = Math.round((2 * Math.PI * (RAD - RIM / 2)) / pitch);
  const wob = (f, a) => { const p = [R() * 6.3, R() * 6.3, R() * 6.3]; return (t) => a * (0.6 * Math.sin(t * f + p[0]) + 0.3 * Math.sin(t * f * 2.7 + p[1]) + 0.2 * Math.sin(t * f * 6.1 + p[2])); };
  const wIn = wob(2, 1.3 * SS), wOut = wob(3, 0.7 * SS), slant = (RIM * Math.tan(0.42)) / RAD;
  for (let i = 0; i < n; i++) {
    const t = ((i + R.gauss(0, 0.04)) / n) * Math.PI * 2;
    const ri = RAD - RIM + wIn(t) + R.gauss(0, 0.15 * SS) - 0.8 * SS, ro = RAD + wOut(t) + R.gauss(0, 0.12 * SS);
    out.push(stitch([MID + Math.cos(t) * ri, MID + Math.sin(t) * ri], [MID + Math.cos(t + slant) * ro, MID + Math.sin(t + slant) * ro], pitch * 1.38, th, 0.9 + R() * 0.14));
  }
  return out;
}

const probe = createCanvas(8, 8).getContext('2d');
function metrics(t) {
  probe.font = `100px "${FACE}"`;
  const m = probe.measureText(t);
  return { w: m.width / 100, asc: m.actualBoundingBoxAscent / 100, desc: m.actualBoundingBoxDescent / 100 };
}
function splits(label) {
  const w = label.split(' '), out = [];
  if (w.length === 1) return [[label]];
  for (let i = 1; i < w.length; i++) {
    out.push([w.slice(0, i).join(' '), w.slice(i).join(' ')]);
    for (let j = i + 1; j < w.length; j++) out.push([w.slice(0, i).join(' '), w.slice(i, j).join(' '), w.slice(j).join(' ')]);
  }
  return out;
}
const LAYOUT = { rho: FELT - 0.064 * RAD, mMin: 0.27 * RAD, mMax: 0.8 * RAD, gap: 0.075 * RAD, lead: 1.04, drop: 0.03 * RAD, fat: 0.045, sRef: 0.21 * RAD };
function place(lines, F, motif) {
  const ms = lines.map(metrics), n = lines.length, lead = LAYOUT.lead * F, pad = LAYOUT.fat * F * 0.5, gap = motif ? LAYOUT.gap : 0;
  const top0 = ms[0].asc * F, bottom = top0 + (n - 1) * lead + ms[n - 1].desc * F, total = motif + gap + bottom;
  const y0 = LAYOUT.drop - total / 2, blockTop = y0 + motif + gap;
  const base = ms.map((m, i) => blockTop + top0 + i * lead), rr = LAYOUT.rho * LAYOUT.rho;
  const fits = ms.every((m, i) => { const hw = (m.w * F) / 2 + pad; return [base[i] - m.asc * F - pad, base[i] + m.desc * F + pad].every((y) => hw * hw + y * y <= rr); });
  const mfit = !motif || [y0, y0 + motif].every((y) => (motif * 0.5) ** 2 + y * y <= rr);
  return { ok: fits && mfit, base, motifY: y0 + motif / 2, motifSize: motif, F, lines };
}
function bestFont(lines, motif) { let lo = 10, hi = RAD; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (place(lines, m, motif).ok) lo = m; else hi = m; } return lo; }
function bestMotif(lines, F) {
  if (!place(lines, F, LAYOUT.mMin).ok) return -1;
  if (place(lines, F, LAYOUT.mMax).ok) return LAYOUT.mMax;
  let lo = LAYOUT.mMin, hi = LAYOUT.mMax;
  for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (place(lines, F, m).ok) lo = m; else hi = m; }
  return lo;
}
let FONT = 0;
function fontSize() {
  if (!FONT) FONT = Math.min(...readChart().map((st) => Math.max(...splits(st.label).map((ls) => bestFont(ls, LAYOUT.mMin)))));
  return FONT;
}
function layout(label, F = fontSize()) {
  let best = null;
  for (const lines of splits(label)) {
    const m = bestMotif(lines, F);
    if (m < 0) continue;
    const ws = lines.map((t) => metrics(t).w), score = Math.min(m, 0.42 * RAD) - (lines.length === 3 ? 0.1 * RAD : 0) - (Math.max(...ws) - Math.min(...ws)) * 0.012 * RAD;
    if (!best || score > best.score) best = { lines, m, score };
  }
  return place(best.lines, F, best.m);
}

function textMaskC(L, R) {
  const F = L.F;
  return maskCanvas((g) => {
    g.lineWidth = F * LAYOUT.fat; g.font = `${F}px "${FACE}"`; g.textBaseline = 'alphabetic';
    L.lines.forEach((t, li) => {
      const chars = [...t], W = g.measureText(t).width, x0 = MID - W / 2, y = MID + L.base[li];
      chars.forEach((ch, i) => {
        if (ch === ' ') return;
        const x = x0 + g.measureText(chars.slice(0, i).join('')).width, cw = g.measureText(ch).width;
        g.save(); g.translate(x + cw / 2 + R.gauss(0, F * 0.003), y + R.gauss(0, F * 0.005)); g.rotate(R.gauss(0, 0.014));
        g.fillText(ch, -cw / 2, 0); g.strokeText(ch, -cw / 2, 0); g.restore();
      });
    });
  });
}

function motifKit(L, R, th, layers) {
  const s = L.motifSize / 2, cx = MID, cy = MID + L.motifY, ref = LAYOUT.sRef;
  const P = ([x, y]) => [cx + x * s, cy + y * s];
  const pathOf = (g, pts, closed, sharp) => { const q = (pts.length > 2 && !sharp ? D.curve(pts, closed, 0.02) : pts).map(P); g.beginPath(); g.moveTo(...q[0]); for (const p of q.slice(1)) g.lineTo(...p); if (closed) g.closePath(); };
  const sat = (maskC, t, o = {}) => layers.push({ under: maskC, th: t, stitches: o.fill !== undefined ? fillSatin(maskC, { pitch: (o.pitch || 1.3) * SS, angle: o.fill, maxLen: o.maxLen ? o.maxLen * s : 0, th: t }, R) : satin(maskC, { pitch: (o.pitch || 1.3) * SS, slant: o.slant ?? 0.45, th: t }, R) });
  const K = {
    th, s, k: ref / s,
    col: (pts, w, t, o = {}) => sat(maskCanvas((g) => { g.lineWidth = w * ref; g.lineCap = o.cap || 'round'; pathOf(g, pts, false, o.sharp); g.stroke(); }), t, o),
    shape: (polys, t, o = {}) => sat(maskCanvas((g) => { for (const poly of polys) { pathOf(g, poly, true); g.fill(); } }), t, o),
    poly: (polys, t, o = {}) => sat(maskCanvas((g) => { for (const poly of polys) { const q = poly.map(P); g.beginPath(); g.moveTo(...q[0]); for (const p of q.slice(1)) g.lineTo(...p); g.closePath(); g.fill(); } }), t, o),
    blobs: (discs, t, o = {}) => sat(maskCanvas((g) => { for (const [x, y, r] of discs) { const [px, py] = P([x, y]); g.beginPath(); g.arc(px, py, r * s, 0, Math.PI * 2); g.fill(); } }), t, { fill: -0.32, ...o }),
    disc: (x, y, r, t, o = {}) => K.blobs([[x, y, r]], t, { fill: -0.7, ...o }),
    knot: (x, y, r, t) => {
      const [px, py] = P([x, y]), rr = r * ref, list = [], a0 = R() * Math.PI;
      for (let k = 0; k < 4; k++) { const a = a0 + (k * Math.PI) / 4 + R.gauss(0, 0.1), ux = Math.cos(a), uy = Math.sin(a), off = (k - 1.5) * rr * 0.12; list.push(stitch([px - ux * rr * 0.62 - uy * off, py - uy * rr * 0.62 + ux * off], [px + ux * rr * 0.62 - uy * off, py + uy * rr * 0.62 + ux * off], rr * 0.95, t, 0.95 + R() * 0.1)); }
      layers.push({ th: t, stitches: list });
    },
    straight: (a, b, w, t) => layers.push({ th: t, stitches: [stitch(P(a), P(b), w * ref, t, 0.97 + R() * 0.06)] }),
    wedge: (a, b, w0, w1, t, o) => { const T = unit(a, b), k = ref / s, nx = -T[1] * k, ny = T[0] * k; K.poly([[[a[0] + nx * w0 / 2, a[1] + ny * w0 / 2], [b[0] + nx * w1 / 2, b[1] + ny * w1 / 2], [b[0] - nx * w1 / 2, b[1] - ny * w1 / 2], [a[0] - nx * w0 / 2, a[1] - ny * w0 / 2]]], t, o); },
    flame: (x, y, w, h, dir, cols, a = 0) => {
      const fa = (dir > 0 ? 1.5 : -1.5) + a, rt = (pts) => rotate(pts, [x, y - dir * h], a);
      K.shape([rt(flame(x, y, w, h, dir))], cols[0], { fill: fa, maxLen: 0.42 });
      K.shape([rt(flame(x, y - dir * h * 0.24, w * 0.6, h * 0.72, dir))], cols[1], { fill: fa, maxLen: 0.36 });
      if (cols[2]) K.shape([rt(flame(x, y - dir * h * 0.46, w * 0.3, h * 0.42, dir))], cols[2], { fill: fa, maxLen: 0.3 });
    },
  };
  return K;
}

const flame = (x, y, w, h, dir = -1) => {
  const p = [[0, 1], [0.42, 0.72], [0.5, 0.3], [0.3, -0.15], [0.16, -0.5], [0.06, -0.8], [0, -1], [-0.1, -0.7], [-0.26, -0.42], [-0.46, -0.05], [-0.52, 0.38], [-0.4, 0.76]];
  return p.map(([u, v]) => [x + u * w, y - v * h * dir]);
};
const arcPts = (cx, cy, r, a0, a1, n = 16) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
const wave = (y, amp, x0, x1, cycles, ph = 0, n = 28) => Array.from({ length: n + 1 }, (_, i) => { const x = x0 + ((x1 - x0) * i) / n; return [x, y + Math.sin(ph + (i / n) * cycles * Math.PI * 2) * amp]; });
const capsule = (x, y0, y1, w, top) => {
  const h = w / 2, pts = [];
  if (top === 'nose') pts.push([x - h, y0 + w * 1.3], [x - h * 0.86, y0 + w * 0.7], [x - h * 0.55, y0 + w * 0.28], [x - h * 0.2, y0 + w * 0.04], [x + h * 0.2, y0 + w * 0.04], [x + h * 0.55, y0 + w * 0.28], [x + h * 0.86, y0 + w * 0.7], [x + h, y0 + w * 1.3]);
  else pts.push([x - h, y0 + w * 0.1], [x - h * 0.82, y0], [x + h * 0.82, y0], [x + h, y0 + w * 0.1]);
  pts.push([x + h, y1], [x - h, y1]);
  return pts;
};
const rotate = (pts, [cx, cy], a) => pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
function ship(K, x, y0, y1, w, t, a = 0) {
  const c = [x, (y0 + y1) / 2], h = w / 2, Rt = (p) => rotate(p, c, a);
  K.poly([Rt(capsule(x, y0, y1, w, 'nose'))], t);
  for (const sg of [-1, 1]) {
    K.poly([Rt([[x + sg * h * 0.8, y1 - w * 1.7], [x + sg * (h + w * 0.46), y1 - w * 0.85], [x + sg * (h + w * 0.46), y1 - w * 0.05], [x + sg * h * 0.8, y1 - w * 0.2]])], K.th.gold, { slant: 0.15 });
    K.poly([Rt([[x + sg * h * 0.7, y0 + w * 1.15], [x + sg * (h + w * 0.3), y0 + w * 1.55], [x + sg * (h + w * 0.3), y0 + w * 1.95], [x + sg * h * 0.8, y0 + w * 1.9]])], K.th.gold, { slant: 0.15 });
  }
}
function boosterPolys(x, y0, y1, w, a = 0) {
  const c = [x, (y0 + y1) / 2], h = w / 2, Rt = (p) => rotate(p, c, a);
  return { body: Rt(capsule(x, y0, y1, w, 'flat')), fins: [-1, 1].map((sg) => Rt([[x + sg * h * 0.85, y0 + w * 0.22], [x + sg * (h + w * 0.42), y0 + w * 0.22], [x + sg * (h + w * 0.42), y0 + w * 0.62], [x + sg * h * 0.85, y0 + w * 0.62]])) };
}
function booster(K, x, y0, y1, w, t, a = 0) {
  const b = boosterPolys(x, y0, y1, w, a);
  K.poly([b.body], t);
  for (const f of b.fins) K.poly([f], K.th.gold, { fill: a });
  return b;
}
function stack(K, x, top, bottom, w) {
  const split = top + (bottom - top) * 0.4;
  booster(K, x, split + w * 0.12, bottom, w, K.th.linen);
  ship(K, x, top, split, w, K.th.cream);
}
function lattice(K, x, y0, y1, w) {
  const { gold } = K.th, h = w / 2, rail = 0.1, n = Math.max(3, Math.round((y1 - y0) / (w * 1.05)));
  for (const sg of [-1, 1]) K.col([[x + sg * h, y0], [x + sg * h, y1]], rail, gold, { cap: 'butt', slant: 0.3 });
  for (let i = 0; i < n; i++) { const a = y0 + ((y1 - y0) * i) / n, b = y0 + ((y1 - y0) * (i + 1)) / n; K.straight([x + (i % 2 ? h : -h), a], [x + (i % 2 ? -h : h), b], 0.07, gold); }
  K.col([[x - h, y0 + (rail * K.k) / 2], [x + h, y0 + (rail * K.k) / 2]], rail, gold, { cap: 'butt' });
  return { left: x - h - (rail * K.k) / 2, right: x + h + (rail * K.k) / 2 };
}
function clouds(K, list) {
  K.blobs(list, K.th.linen, { fill: -0.3 });
  K.blobs(list.filter((_, i) => i % 2 === 0).map(([x, y, r]) => [x - r * 0.25, y - r * 0.3, r * 0.55]), K.th.cream, { fill: -0.3 });
}
function chopsticks(K, open, o = {}) {
  const { gold, linen, pale } = K.th, hy = 0.42, armW = 0.24;
  K.col([[-0.96, -0.56], [-0.5, -0.56], [-0.5, 0.56], [-0.96, 0.56], [-0.96, -0.56]], 0.1, gold, { sharp: true });
  K.straight([-0.93, -0.53], [-0.53, 0.53], 0.07, gold); K.straight([-0.53, -0.53], [-0.93, 0.53], 0.07, gold);
  if (o.booster) {
    const bx = 0.4, br = hy - (armW * K.k) / 2 - 0.004;
    for (const sg of [-1, 1]) K.col([[bx + sg * br * 0.8, 0], [bx + sg * br * 1.36, 0]], 0.11, gold, { cap: 'butt' });
    K.disc(bx, 0, br, linen);
    K.col(arcPts(bx, 0, br * 0.62, 0, Math.PI * 2, 28), 0.07, pale);
    K.knot(bx, 0, 0.11, pale);
  }
  [-1, 1].forEach((sg, k) => {
    const p = [-0.5, sg * hy], q = [p[0] + Math.cos(open) * 1.44, p[1] + sg * Math.sin(open) * 1.44];
    if (o.broken && k === 0) o.broken(p, q); else K.col([p, q], armW, gold);
    K.knot(p[0], p[1], 0.11, pale);
  });
}

const MOTIFS = {
  'Filling with propellant': (K) => {
    const { cream, pale } = K.th;
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 3, c = Math.cos(a), s = Math.sin(a);
      K.col([[c * 0.2, s * 0.2], [c * 0.97, s * 0.97]], 0.18, cream);
      for (const sg of [-1, 1]) { const b = a + sg * 0.8; K.col([[c * 0.56, s * 0.56], [c * 0.56 + Math.cos(b) * 0.32, s * 0.56 + Math.sin(b) * 0.32]], 0.14, cream); }
    }
    K.knot(0, 0, 0.2, pale);
  },
  'Holding the count': (K) => {
    const { cream, gold } = K.th;
    K.poly([[[-0.4, 0.82], [0.4, 0.82], [0.24, 0.54], [0, 0.42], [-0.24, 0.54]], [[-0.32, -0.68], [0.32, -0.68], [0.06, -0.3], [-0.06, -0.3]]], gold, { fill: 0 });
    K.col([[0, -0.28], [0, 0.44]], 0.07, gold);
    for (const sg of [-1, 1]) K.col([[sg * 0.52, -0.84], [sg * 0.46, -0.46], [sg * 0.12, -0.1], [sg * 0.12, 0.1], [sg * 0.46, 0.46], [sg * 0.52, 0.84]], 0.14, cream);
    K.col([[-0.68, -0.92], [0.68, -0.92]], 0.24, cream); K.col([[-0.68, 0.92], [0.68, 0.92]], 0.24, cream);
  },
  'Lifting off': (K) => {
    const { red, gold, pale } = K.th;
    K.flame(0, 0.6, 0.26, 0.27, 1, [red, gold, pale]);
    stack(K, 0, -0.98, 0.35, 0.22);
    clouds(K, [[-0.8, 0.88, 0.14], [-0.56, 0.8, 0.2], [-0.28, 0.86, 0.18], [0.02, 0.92, 0.14], [0.3, 0.86, 0.18], [0.58, 0.8, 0.2], [0.82, 0.88, 0.14]]);
  },
  'Through max Q': (K) => {
    const { cream, gold } = K.th;
    K.col([[-0.98, -0.42], [0.2, -0.42], [0.56, -0.5], [0.7, -0.72], [0.56, -0.92], [0.34, -0.84]], 0.18, cream);
    K.col([[-0.5, 0.0], [0.98, 0.0]], 0.18, gold);
    K.col([[-0.98, 0.62], [0.2, 0.62], [0.52, 0.56], [0.64, 0.42], [0.54, 0.28], [0.38, 0.32]], 0.18, cream);
  },
  'Scrubbed for today': (K) => {
    clouds(K, [[-0.52, -0.1, 0.3], [-0.12, -0.34, 0.38], [0.32, -0.18, 0.32], [0.64, 0.02, 0.24], [-0.76, 0.08, 0.2], [-0.4, 0.12, 0.2], [0.0, 0.08, 0.24], [0.36, 0.1, 0.22]]);
    for (const x of [-0.46, -0.04, 0.38]) K.col([[x + 0.1, 0.46], [x - 0.06, 0.86]], 0.13, K.th.cream);
  },
  'Hot staging': (K) => {
    const { gold, red, pale } = K.th;
    for (let k = 0; k < 8; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 4, long = k % 2 === 0, l = long ? 0.98 : 0.62;
      K.wedge([Math.cos(a) * 0.1, Math.sin(a) * 0.1], [Math.cos(a) * l, Math.sin(a) * l], long ? 0.34 : 0.28, 0.04, long ? gold : red);
    }
    K.knot(0, 0, 0.24, pale);
  },
  'Flipping, burning back': (K) => {
    const { gold, red, pale } = K.th;
    K.col([[0.6, 0.46], [0.6, 0.0], ...arcPts(0, 0, 0.6, 0, -Math.PI, 14).slice(1), [-0.6, 0.2]], 0.2, gold);
    K.poly([[[-0.94, 0.16], [-0.26, 0.16], [-0.6, 0.7]]], gold, { slant: 0.2 });
    K.flame(0.6, 0.74, 0.26, 0.26, 1, [red, gold, pale]);
  },
  'Diverted to the sea': (K) => {
    const { cream, linen } = K.th;
    K.col(wave(-0.46, 0.12, -0.7, 0.7, 1.5, 0.3), 0.17, cream);
    K.col(wave(0.04, 0.14, -0.96, 0.96, 2, 0), 0.18, cream);
    K.col(wave(0.54, 0.12, -0.8, 0.8, 1.6, 0.6), 0.17, linen);
  },
  'Coming in on a failed check': (K) => {
    const { red } = K.th;
    K.col([[-0.74, -0.74], [0.74, 0.74]], 0.34, red); K.col([[0.74, -0.74], [-0.74, 0.74]], 0.34, red);
  },
  'Falling home': (K) => {
    const { gold, pale } = K.th;
    [[-0.6, 1, gold], [-0.02, 0.82, gold], [0.5, 0.64, pale]].forEach(([y, k, t]) => K.col([[-0.78 * k, y - 0.3 * k], [0, y + 0.3 * k], [0.78 * k, y - 0.3 * k]], 0.21, t));
  },
  'Slowing over the tower': (K) => {
    const { red, gold, pale, linen } = K.th;
    const T = lattice(K, -0.78, -0.98, 0.98, 0.3);
    K.col([[T.right, -0.3], [-0.16, -0.3]], 0.2, gold, { cap: 'butt' }); K.knot(-0.16, -0.3, 0.1, pale);
    K.flame(0.4, 0.27 + 0.32, 0.3, 0.32, 1, [red, gold, pale]);
    booster(K, 0.4, -0.94, 0.3, 0.3, linen);
  },
  'Hits the tower': (K) => {
    const { red, cream, palered, linen } = K.th;
    const T = lattice(K, -0.78, -0.98, 0.98, 0.3), a = -0.5, len = 1.36, w = 0.27, hit = -0.44;
    const pr = boosterPolys(0, -len / 2, len / 2, w, a), pts = [pr.body, ...pr.fins].flat(), lx = Math.min(...pts.map((q) => q[0])), lp = pts.find((q) => q[0] === lx);
    const cx = T.right - lx, cy = hit - lp[1];
    booster(K, cx, cy - len / 2, cy + len / 2, w, linen, a);
    const c = [T.right, hit];
    [[-1.25, 0.62, red], [-0.75, 0.42, cream], [-0.25, 0.6, red], [0.3, 0.44, cream], [0.85, 0.5, red], [-1.75, 0.46, cream], [1.35, 0.36, red]].forEach(([b, l, t]) => K.wedge([c[0] + Math.cos(b) * 0.05, c[1] + Math.sin(b) * 0.05], [c[0] + Math.cos(b) * l, c[1] + Math.sin(b) * l], 0.26, 0.03, t));
    K.knot(c[0], c[1], 0.18, palered);
  },
  'Caught by the arms': (K) => {
    const { gold, pale, linen } = K.th;
    const ground = 0.95, gh = (0.12 * K.k) / 2, w = 0.32, y0 = -0.74, ay = y0 + w * 0.62 + (0.22 * K.k) / 2;
    K.col([[-0.98, ground], [0.2, ground]], 0.12, pale, { cap: 'butt' });
    const T = lattice(K, -0.78, -0.98, ground - gh, 0.3);
    booster(K, 0.26, y0, 0.5, w, linen);
    K.col([[T.right, ay], [0.76, ay]], 0.22, gold, { cap: 'butt' }); K.knot(0.76, ay, 0.1, pale);
  },
  'Riding on top': (K) => {
    const { gold, pale } = K.th;
    const ground = 0.95, gh = (0.14 * K.k) / 2, w = 0.26;
    K.col([[-0.46, ground], [0.86, ground]], 0.14, pale, { cap: 'butt' });
    const T = lattice(K, 0.68, -0.72, ground - gh, 0.26);
    stack(K, 0, -0.98, ground - gh, w);
    K.col([[T.left, 0.1], [w / 2, 0.1]], 0.12, gold, { cap: 'butt' });
  },
  'Engines lit while attached': (K) => {
    const { gold, red, pale, cream, linen } = K.th;
    K.poly([[[-0.36, -0.98], [0.36, -0.98], [0.36, -0.3], [-0.36, -0.3]]], cream);
    booster(K, 0, 0.3, 0.98, 0.72, linen);
    for (const sg of [-1, 1]) { K.shape([rotate(flame(0, -0.5, 0.5, 0.5, -1), [0, 0], sg * Math.PI / 2)], red, { fill: 0, maxLen: 0.5 }); K.shape([rotate(flame(0, -0.32, 0.3, 0.34, -1), [0, 0], sg * Math.PI / 2)], gold, { fill: 0, maxLen: 0.4 }); }
    K.knot(0, 0, 0.17, pale);
  },
  'Flying on to space': (K) => {
    const { gold, pale } = K.th;
    const c = [-0.2, -0.04];
    [[0, 0.98], [Math.PI / 2, 0.98], [Math.PI, 0.78], [-Math.PI / 2, 0.78]].forEach(([a, l]) => K.wedge(c, [c[0] + Math.cos(a) * l * 0.8, c[1] + Math.sin(a) * l * 0.92], 0.36, 0.03, gold));
    [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4].forEach((a) => K.wedge(c, [c[0] + Math.cos(a) * 0.32, c[1] + Math.sin(a) * 0.32], 0.2, 0.03, pale));
    [[0.62, -0.62, 0.15], [0.74, 0.4, 0.12], [0.34, 0.8, 0.1], [-0.84, 0.72, 0.11]].forEach(([x, y, r]) => K.knot(x, y, r, pale));
  },
  'Falling back, glowing': (K) => {
    const { gold, red, pale } = K.th;
    const head = [-0.46, 0.46], tail = (w, h, t, a) => K.shape([rotate(flame(head[0], head[1] - h, w, h, -1), head, 0.79)], t, { fill: -0.79 + a, maxLen: 0.45 });
    tail(0.66, 0.8, red, 0.03); tail(0.44, 0.66, gold, -0.02); tail(0.22, 0.5, pale, 0.02);
    K.disc(head[0], head[1], 0.3, gold); K.disc(head[0] - 0.04, head[1] + 0.03, 0.17, pale); K.knot(head[0] - 0.05, head[1] + 0.04, 0.1, pale);
  },
  'Flipping upright': (K) => {
    const { gold, red, pale, cream } = K.th;
    const tilt = 0.32, [bx, by] = rotate([[0.34, 0.42]], [0.34, -0.26], tilt)[0];
    K.flame(bx, by + 0.24, 0.22, 0.24, 1, [red, gold, pale], tilt);
    ship(K, 0.34, -0.94, 0.42, 0.26, cream, tilt);
    const r = 0.92, c = [0.3, 0.3], a1 = Math.PI * 1.27;
    K.col(arcPts(c[0], c[1], r, Math.PI * 0.96, a1, 14), 0.16, gold);
    const tip = [c[0] + Math.cos(a1 + 0.12) * r, c[1] + Math.sin(a1 + 0.12) * r], tn = [Math.cos(a1 + 0.12), Math.sin(a1 + 0.12)], tt = [-tn[1], tn[0]];
    K.poly([[[tip[0] - tt[0] * 0.1 + tn[0] * 0.22, tip[1] - tt[1] * 0.1 + tn[1] * 0.22], [tip[0] + tt[0] * 0.28, tip[1] + tt[1] * 0.28], [tip[0] - tt[0] * 0.1 - tn[0] * 0.22, tip[1] - tt[1] * 0.1 - tn[1] * 0.22]]], gold, { slant: 0.2 });
  },
  'Splashed down': (K) => {
    const { cream, pale, linen } = K.th;
    ship(K, 0, -0.98, 0.52, 0.26, cream);
    K.col(wave(0.5, 0.1, -0.98, 0.98, 2, 0.4), 0.18, cream);
    K.col(wave(0.84, 0.08, -0.78, 0.78, 1.6, 1.2), 0.15, linen);
    [[-0.46, 0.14, 0.13], [0.48, 0.04, 0.12], [-0.36, -0.2, 0.09], [0.38, -0.3, 0.09]].forEach(([x, y, r]) => K.knot(x, y, r, pale));
  },
  'Arms open, waiting': (K) => chopsticks(K, 0.36),
  'Arms closing': (K) => { chopsticks(K, 0.14); for (const sg of [-1, 1]) K.col(arcPts(-0.5, sg * 0.42, 1.28, sg * 0.24, sg * 0.42, 6), 0.08, K.th.pale); },
  'Damaged': (K) => chopsticks(K, 0.36, {
    broken: (p, q) => {
      const m = [p[0] + (q[0] - p[0]) * 0.52, p[1] + (q[1] - p[1]) * 0.52], d = unit(p, q), l = Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.44, b = 1.05;
      const e = [m[0] + (d[0] * Math.cos(b) - d[1] * Math.sin(b)) * l, m[1] + (d[0] * Math.sin(b) + d[1] * Math.cos(b)) * l];
      K.col([p, m], 0.24, K.th.gold); K.col([m, e], 0.24, K.th.gold);
      for (const [dx, dy, ex, ey] of [[-0.05, -0.17, 0.05, 0.13], [0.06, -0.15, -0.04, 0.15]]) K.straight([m[0] + dx, m[1] + dy], [m[0] + ex, m[1] + ey], 0.06, K.th.red);
      [[-0.2, -0.36], [0.06, -0.42], [0.3, -0.3]].forEach(([dx, dy]) => K.straight([m[0] + dx * 0.45, m[1] + dy * 0.45], [m[0] + dx, m[1] + dy], 0.06, K.th.red));
    },
  }),
  'Holding the booster': (K) => chopsticks(K, 0, { booster: true }),
};

function ringStitches(R, th) {
  const out = [], rr = FELT - 5.2 * SS, dash = 6.4 * SS, gap = 3.6 * SS, n = Math.floor((2 * Math.PI * rr) / (dash + gap)), a0 = R() * Math.PI * 2, ph = [R() * 6.3, R() * 6.3];
  const wan = (a) => 0.55 * SS * Math.sin(a * 2 + ph[0]) + 0.3 * SS * Math.sin(a * 5 + ph[1]);
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2 + R.gauss(0, 0.004), b = a + (dash / rr) * (1 + R.gauss(0, 0.11)), r0 = rr + wan(a) + R.gauss(0, 0.3 * SS), r1 = rr + wan(b) + R.gauss(0, 0.3 * SS);
    out.push(stitch([MID + Math.cos(a) * r0, MID + Math.sin(a) * r0], [MID + Math.cos(b) * r1, MID + Math.sin(b) * r1], 2.3 * SS, th, 0.94 + R() * 0.1));
  }
  return out;
}

function shadowFelt(fc, tc) {
  const A = alphaOf(tc), sh = new Float32Array(N * N), dx = Math.round(1.3 * SS), dy = Math.round(1.8 * SS);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const sx = x - dx, sy = y - dy; sh[y * N + x] = sx >= 0 && sy >= 0 ? A[sy * N + sx] : 0; }
  const ao = boxBlur(A, Math.round(2.4 * SS)), drop = boxBlur(sh, Math.round(1.3 * SS));
  const g = fc.getContext('2d'), img = g.getImageData(0, 0, N, N), d = img.data;
  for (let i = 0; i < N * N; i++) { const k = (1 - 0.3 * ao[i]) * (1 - 0.5 * drop[i]); d[4 * i] *= k; d[4 * i + 1] *= k; d[4 * i + 2] *= k; }
  g.putImageData(img, 0, 0);
}

function renderPatch(st, o = {}) {
  const R = rng('catch-patch:' + st.label);
  const th = {
    gold: thread(PAL.gold), red: thread(PAL.red), cream: thread(PAL.cream), linen: thread([PAL.linen, PAL.cream[1]]),
    pale: thread([PAL.gold[1], '#fffaf0']), palered: thread([PAL.red[1], '#fde4dc']),
  };
  const ringTh = thread(st.kind === 'cream' ? [PAL.linen, PAL.cream[1]] : [PAL[st.kind][1], '#fffaf0'], { k: 0.7, dip: 0.5 });
  const rimTh = thread(PAL[st.kind], { k: 0.95, gloss: 5, sheen: 0.42, dip: 0.42, edge: 0.45, body: 0.7 });
  const textTh = thread(PAL.cream, { k: 0.6, gloss: 8, sheen: 0.28, dip: 0.2, edge: 0.82, body: 0.8, under: 0.84 });
  const L = layout(st.label, o.font);
  const layers = [{ th: rimTh, stitches: rimStitches(R, rimTh) }, { th: ringTh, stitches: ringStitches(R, ringTh) }];
  if (MOTIFS[st.label]) MOTIFS[st.label](motifKit(L, R, th, layers));
  const tm = textMaskC(L, R);
  layers.push({ under: tm, th: textTh, stitches: satin(tm, { pitch: 1.25 * SS, slant: 0.42, th: textTh, rag: 0.35 }, R) });
  const tc = createCanvas(N, N), tg = tc.getContext('2d');
  for (const ly of layers) { if (ly.under) underlay(tg, ly.under, ly.th); drawThreads(tg, ly.stitches); }
  const fc = felt(R, PAL.felt[st.region]);
  shadowFelt(fc, tc);
  const big = createCanvas(N, N), bg = big.getContext('2d');
  bg.save(); bg.beginPath(); bg.arc(MID, MID, FELT + RIM * 0.5, 0, Math.PI * 2); bg.clip(); bg.drawImage(fc, 0, 0); bg.restore();
  bg.drawImage(tc, 0, 0);
  const tile = createCanvas(TILE, TILE), g = tile.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(big, 0, 0, TILE, TILE);
  return { tile, layout: L };
}

async function main() {
  const states = readChart(), atlas = createCanvas(ATLAS, ATLAS), ag = atlas.getContext('2d'), map = {};
  if (states.length > GRID * GRID) throw new Error(`${states.length} states do not fit a ${GRID} x ${GRID} atlas`);
  for (const [i, st] of states.entries()) {
    const col = i % GRID, row = Math.floor(i / GRID), t0 = Date.now();
    const { tile } = renderPatch(st);
    ag.drawImage(tile, Math.round(col * CELL), Math.round(row * CELL));
    map[st.label] = [col, row];
    console.log(st.label, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
  fs.mkdirSync(path.join(ROOT, 'out', 'tex'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'out', 'tex', 'patches.png'), await atlas.encode('png'));
  fs.writeFileSync(path.join(ROOT, 'out', 'patches.json'), '{\n' + Object.entries(map).map(([k, v]) => `  ${JSON.stringify(k)}: [${v.join(', ')}]`).join(',\n') + '\n}\n');
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { readChart, renderPatch, layout, fontSize, metrics, PAL, N, TILE, SS, RAD };
