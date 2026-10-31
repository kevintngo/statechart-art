'use strict';
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const M = require('./media');
const { D } = M;
const { rng, hashStr } = require('../../tools/kit/util');
const MK = require('../../tools/lib/mask');
const tools = require('module').createRequire(path.join(__dirname, '..', '..', 'tools', 'package.json'));
const { createCanvas, ImageData } = tools('@napi-rs/canvas');

const OUT = path.join(__dirname, '..', 'out', 'tex');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const PPM = 7;

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const tohex = (c) => '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const mm = (pts) => pts.map(([x, y]) => [x / PPM, y / PPM]);
const shift = (pts, dx, dy = 0) => pts.map(([x, y]) => [x + dx, y + dy]);

function sines(seed, period, k0, k1, slope, step = 0.25) {
  const R = rng(seed), comps = [];
  let norm = 0;
  for (let k = k0; k <= k1; k++) { const a = Math.pow(k, -slope) * (0.3 + 1.4 * R()); comps.push((2 * Math.PI * k) / period, a, R() * 2 * Math.PI); norm += (a * a) / 2; }
  const s = 1 / Math.sqrt(norm), n = Math.round(period / step), tab = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) { const x = i * step; let v = 0; for (let j = 0; j < comps.length; j += 3) v += comps[j + 1] * Math.sin(comps[j] * x + comps[j + 2]); tab[i] = v * s; }
  return (x) => { const u = (((x % period) + period) % period) / step, i = Math.min(n - 1, Math.floor(u)), t = u - i; return tab[i] + (tab[i + 1] - tab[i]) * t; };
}

function lattice(seed) {
  const s = hashStr(String(seed)) | 0;
  return (ix, iy) => { let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ s; h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 2147483647.5 - 1; };
}
function vnoise(seed, cx, cy, period = 0) {
  const L = lattice(seed), nx = period ? Math.max(1, Math.round(period / cx)) : 0, sx = period ? period / nx : cx;
  return (x, y) => {
    const fx = x / sx, fy = y / cy, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, ux = tx * tx * (3 - 2 * tx), uy = ty * ty * (3 - 2 * ty);
    const i0 = nx ? ((ix % nx) + nx) % nx : ix, i1 = nx ? (i0 + 1) % nx : ix + 1;
    const a = L(i0, iy), b = L(i1, iy), c = L(i0, iy + 1), d = L(i1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
}
function fbm(seed, cx, cy, period = 0, oct = 4, gain = 0.5) {
  const ns = []; for (let o = 0; o < oct; o++) ns.push(vnoise(seed + ':' + o, cx / 2 ** o, cy / 2 ** o, period));
  return (x, y) => { let s = 0, a = 1, n = 0; for (const f of ns) { s += a * f(x, y); n += a; a *= gain; } return s / n; };
}

function edt(feat, W, H) {
  const INF = 1e10, n = Math.max(W, H), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1), g = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = feat[i] ? 0 : INF;
  const dt = (len) => {
    let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
    for (let q = 1; q < len; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; const dq = q - v[k]; d[q] = dq * dq + f[v[k]]; }
  };
  for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) f[y] = g[y * W + x]; dt(H); for (let y = 0; y < H; y++) g[y * W + x] = d[y]; }
  for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) f[x] = g[y * W + x]; dt(W); for (let x = 0; x < W; x++) g[y * W + x] = d[x]; }
  const out = new Float32Array(W * H); for (let i = 0; i < W * H; i++) out[i] = Math.sqrt(g[i]);
  return out;
}

function raster(W, H, draw) {
  const c = createCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  draw(g);
  const d = g.getImageData(0, 0, W, H).data, m = new Float32Array(W * H);
  for (let i = 0; i < m.length; i++) m[i] = d[4 * i + 3] / 255;
  return m;
}
const tracePoly = (g, pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); };
const traceLine = (g, pts) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };

function blur(src, W, H, r, passes = 2) {
  let a = Float32Array.from(src), b = new Float32Array(W * H);
  const k = 1 / (2 * r + 1);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < H; y++) { let acc = 0; const o = y * W; for (let x = -r; x <= r; x++) acc += a[o + clamp(x, 0, W - 1)]; for (let x = 0; x < W; x++) { b[o + x] = acc * k; acc += a[o + Math.min(W - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; } }
    for (let x = 0; x < W; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += b[clamp(y, 0, H - 1) * W + x]; for (let y = 0; y < H; y++) { a[y * W + x] = acc * k; acc += b[Math.min(H - 1, y + r + 1) * W + x] - b[Math.max(0, y - r) * W + x]; } }
  }
  return a;
}

function bleed(buf, W, H) {
  const N = W * H, seen = new Uint8Array(N), q = new Int32Array(N);
  let qh = 0, qt = 0;
  for (let i = 0; i < N; i++) if (buf[4 * i + 3] > 24) { seen[i] = 1; q[qt++] = i; }
  while (qh < qt) {
    const i = q[qh++], x = i % W, y = (i / W) | 0;
    const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
    for (const j of nb) {
      if (j < 0 || seen[j]) continue;
      seen[j] = 1; q[qt++] = j;
      if (buf[4 * j + 3] === 0) { buf[4 * j] = buf[4 * i]; buf[4 * j + 1] = buf[4 * i + 1]; buf[4 * j + 2] = buf[4 * i + 2]; }
    }
  }
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const head = Buffer.alloc(4), tail = Buffer.alloc(4), td = Buffer.concat([Buffer.from(type, 'ascii'), data]); head.writeUInt32BE(data.length); tail.writeUInt32BE(crc32(td)); return Buffer.concat([head, td, tail]); }
function encodePng(px, W, H) {
  const row = W * 4 + 1, raw = Buffer.alloc(row * H), ihdr = Buffer.alloc(13);
  for (let y = 0; y < H; y++) { raw[y * row] = 1; for (let i = 0; i < W * 4; i++) raw[y * row + 1 + i] = (px[y * W * 4 + i] - (i >= 4 ? px[y * W * 4 + i - 4] : 0)) & 255; }
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

async function writePng(canvas, name) {
  const W = canvas.width, H = canvas.height, im = canvas.getContext('2d').getImageData(0, 0, W, H);
  bleed(im.data, W, H);
  const file = path.join(OUT, name + '.png');
  fs.writeFileSync(file, encodePng(im.data, W, H));
  return file;
}

function toCanvas(rgba, W, H) {
  const buf = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H * 4; i++) buf[i] = rgba[i];
  const c = createCanvas(W, H);
  c.getContext('2d').putImageData(new ImageData(buf, W, H), 0, 0);
  return c;
}

function tornProfile(seed, period, amp) {
  const big = sines(seed + ':big', period, 8, 44, 1.25), mid = sines(seed + ':mid', period, 44, 220, 1.1), fine = sines(seed + ':fine', period, 220, 820, 0.85);
  const R = rng(seed + ':ev'), ev = [];
  for (let k = 0; k < period / 140; k++) ev.push([R() * period, 3 + R() * 12, (R() < 0.55 ? 1 : -1) * (1.2 + R() * 3.2)]);
  const events = (x) => { let s = 0; for (const [c, w, h] of ev) { let u = x - c; u -= Math.round(u / period) * period; if (Math.abs(u) < w * 3) s += h * Math.exp(-(u * u) / (w * w)); } return s; };
  return { smooth: (x) => big(x) * amp.big, rough: (x) => mid(x) * amp.mid + fine(x) * amp.fine + events(x) * (amp.ev ?? 1) };
}

function sheetFor(id, Wpx, Hpx, paper) {
  return M.sheet({ id: 'catch-' + id, w: Wpx / PPM, h: Hpx / PPM, ppm: PPM, paper, seed: 'catch-' + id });
}

function stroke(P, pts, q) { P.line(mm(pts), q); }

function rub(S, fn, gr = 0.66) {
  const { W, H, rgb, tooth } = S;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, w = fn(x, y, i); if (!w || w[3] <= 0) continue;
    const a = clamp(w[3] * (1 - gr * 0.5 + gr * tooth[i])), j = 3 * i;
    rgb[j] += (w[0] - rgb[j]) * a; rgb[j + 1] += (w[1] - rgb[j + 1]) * a; rgb[j + 2] += (w[2] - rgb[j + 2]) * a;
  }
}

function heightCompose(o) {
  const { W, H, OV, S, edgeS, edgeR, rimW, seed } = o;
  const SW = W + OV, rgb = S.rgb, out = new Float32Array(W * H * 4);
  const tooth = blur(S.tooth, SW, H, 1, 2);
  const rimCol = hex(o.rimCol), lipK = o.lip ?? 0.06, relief = o.relief ?? 0.05;
  const eS = new Float32Array(W), sS = new Float32Array(W), nS = new Float32Array(W), eF = new Float32Array(W), nF = new Float32Array(W), U = new Float32Array(W + 1), rw = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const xc = x + 0.5, s0 = edgeS(xc), ds = (edgeS(xc + 1) - edgeS(xc - 1)) / 2, f0 = s0 + edgeR(xc), df = edgeS(xc + 0.5) + edgeR(xc + 0.5) - edgeS(xc - 0.5) - edgeR(xc - 0.5);
    eS[x] = s0; sS[x] = ds; nS[x] = 1 / Math.sqrt(1 + ds * ds); eF[x] = f0; nF[x] = 1 / Math.sqrt(1 + df * df); rw[x] = rimW(xc);
    U[x + 1] = U[x] + Math.sqrt(1 + ds * ds);
  }
  const Ut = U[W], uAt = (xf) => { const xm = ((xf % W) + W) % W, i = Math.min(W - 1, Math.floor(xm)); return U[i] + (U[i + 1] - U[i]) * (xm - i); };
  const st1 = vnoise(seed + ':st1', 1.5, 9, Ut), st2 = vnoise(seed + ':st2', 5, 30, Ut), st3 = vnoise(seed + ':st3', 0.8, 3, Ut), lipN = vnoise(seed + ':lip', 30, 30, Ut);
  const cockle = fbm(seed + ':cockle', 520, 260, W, 3);
  const sample = (x, y, k) => {
    if (x >= OV) return rgb[3 * (y * SW + x) + k];
    return lerp(rgb[3 * (y * SW + x + W) + k], rgb[3 * (y * SW + x) + k], sstep(0, OV, x));
  };
  const toothAt = (x, y) => {
    const xx = Math.min(SW - 1, Math.max(0, x)), yy = Math.min(H - 1, Math.max(0, y));
    if (xx >= OV) return tooth[yy * SW + xx];
    return lerp(tooth[yy * SW + xx + W], tooth[yy * SW + xx], sstep(0, OV, xx));
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const j = 4 * (y * W + x), dF = (y + 0.5 - eF[x]) * nF[x];
      const ua = o.under ? o.under[j + 3] / 255 : 0;
      if (dF < -0.6 && ua <= 0) continue;
      let r = 0, g = 0, b = 0, a = 0;
      if (dF >= -0.6) {
        r = sample(x, y, 0); g = sample(x, y, 1); b = sample(x, y, 2);
        const rel = (toothAt(x - 1, y - 1) - toothAt(x + 1, y + 1)) * relief + cockle(x, y) * 0.035;
        r *= 1 + rel; g *= 1 + rel; b *= 1 + rel;
        const dS = (y + 0.5 - eS[x]) * nS[x], u = uAt(x + 0.5 + dS * sS[x] * nS[x]);
        const s1 = st1(u, dS) * 0.5 + 0.5, s2 = st2(u, dS) * 0.5 + 0.5, s3 = st3(u, dS) * 0.5 + 0.5;
        const bnd = rw[x] * (0.6 + 0.6 * s2) + (s1 - 0.5) * 1.5;
        const rimT = 1 - sstep(bnd - 1, bnd + 1, dS);
        if (rimT > 0) {
          const k = rimT * (o.rimMix ?? 0.85) * (0.7 + 0.3 * s1) * (0.85 + 0.15 * s3) * (0.8 + 0.2 * sstep(0, 3, bnd - dS));
          r = lerp(r, rimCol[0], k); g = lerp(g, rimCol[1], k); b = lerp(b, rimCol[2], k);
        }
        const lip = Math.exp(-((dS - bnd - 1.5) ** 2) / 2) * lipK * (0.5 + 0.5 * lipN(u, 0)) * sstep(2, 5, rw[x]);
        r *= 1 - lip; g *= 1 - lip; b *= 1 - lip;
        a = clamp(dF + 0.5) * (0.8 + 0.2 * sstep(0, 3, dF + (s3 - 0.5) * 1.6));
      }
      if (ua > 0) {
        const na = a + ua * (1 - a);
        r = (r * a + o.under[j] * ua * (1 - a)) / na; g = (g * a + o.under[j + 1] * ua * (1 - a)) / na; b = (b * a + o.under[j + 2] * ua * (1 - a)) / na; a = na;
      }
      out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = a * 255;
    }
  }
  return out;
}

function heightFibres(ctx, o) {
  const { W, edge, rimW, seed } = o, R = rng(seed + ':fibres'), cols = o.cols.map(hex);
  const dens = o.density ?? 0.55;
  let x = 0;
  while (x < W) {
    x += -Math.log(1 - R()) / dens;
    const y0 = edge(x), dy = (edge(x + 1) - edge(x - 1)) / 2, nl = Math.hypot(dy, 1), nx = dy / nl, ny = -1 / nl;
    if (o.skip && o.skip(x, y0)) continue;
    const long = R() < 0.06, L = long ? 3.5 + R() * 6 : 0.6 + 1.6 * -Math.log(1 - R()), a = Math.atan2(ny, nx) + R.gauss(0, long ? 0.7 : 0.5), s0 = 0.5 + R() * Math.max(1, rimW(x)) * 0.35;
    const sx = x - nx * s0, sy = y0 - ny * s0, ex = sx + Math.cos(a) * (L + s0), ey = sy + Math.sin(a) * (L + s0);
    const bend = R.gauss(0, 0.3) * (L + s0), mx = (sx + ex) / 2 - Math.sin(a) * bend, my = (sy + ey) / 2 + Math.cos(a) * bend;
    const c = cols[R() < 0.8 || cols.length < 2 ? 0 : 1 + Math.floor(R() * (cols.length - 1))], al = (long ? 0.12 : 0.16) + 0.26 * R() * R();
    ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${al.toFixed(3)})`; ctx.lineWidth = 0.35 + R() * (long ? 0.35 : 0.6);
    for (const off of [-W, 0, W]) {
      if (Math.max(sx, ex, mx) + off < -2 || Math.min(sx, ex, mx) + off > W + 2) continue;
      ctx.beginPath(); ctx.moveTo(sx + off, sy); ctx.quadraticCurveTo(mx + off, my, ex + off, ey); ctx.stroke();
    }
  }
}

function loopArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }

function tearLoop(poly, seed, amp, keep) {
  const pts = MK.resampleClosed(poly, 1), n = pts.length, sg = loopArea(pts) > 0 ? 1 : -1;
  const k = (w) => Math.max(1, Math.round(n / w));
  const big = sines(seed + ':b', n, k(260), Math.max(k(260) + 1, k(50)), 1.25), mid = sines(seed + ':m', n, k(50), Math.max(k(50) + 1, k(10)), 1.1), fine = sines(seed + ':f', n, k(10), Math.max(k(10) + 1, k(2.6)), 0.85);
  const R = rng(seed + ':ev'), ev = [];
  for (let j = 0; j < n / 150; j++) ev.push([R() * n, 3 + R() * 10, (R() < 0.55 ? 1 : -1) * (1 + R() * 2.8)]);
  const out = [], nrm = [], wt = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1, nx = (sg * ty) / tl, ny = (-sg * tx) / tl;
    let e = 0; for (const [c, w, h] of ev) { let u = i - c; u -= Math.round(u / n) * n; if (Math.abs(u) < 3 * w) e += h * Math.exp(-(u * u) / (w * w)); }
    const w = keep ? keep(pts[i][0], pts[i][1]) : 1, d = w * (big(i) * (amp.big ?? 0) + mid(i) * amp.mid + fine(i) * amp.fine + e * (amp.ev ?? 1));
    out.push([pts[i][0] + nx * d, pts[i][1] + ny * d]); nrm.push([nx, ny]); wt.push(w);
  }
  return { pts: out, nrm, n, wt };
}

function drawRim(g, loop, o, ox, oy) {
  const { pts, nrm, n } = loop, R = rng(o.seed + ':rim'), rc = hex(o.col);
  const rw = sines(o.seed + ':rw', n, 2, Math.max(3, Math.round(n / 40)), 0.9), gap = sines(o.seed + ':gap', n, 2, Math.max(3, Math.round(n / 70)), 0.7);
  for (let s = 0; s < n; s += 0.6) {
    const i = Math.floor(s), j = (i + 1) % n, t = s - i, x = lerp(pts[i][0], pts[j][0], t) - ox, y = lerp(pts[i][1], pts[j][1], t) - oy, nx = nrm[i][0], ny = nrm[i][1];
    if (o.skip && o.skip(x + ox, y + oy)) continue;
    const w = o.w * clamp(1 + 0.5 * rw(s), 0.3, 1.8) * (gap(s) < -1.25 ? 0.25 : 1) * (o.scale ? o.scale(x + ox, y + oy) : 1), L = w * (0.35 + 0.95 * Math.pow(R(), 0.7)), ang = Math.atan2(-ny, -nx) + R.gauss(0, 0.22);
    g.strokeStyle = `rgba(${rc[0]},${rc[1]},${rc[2]},${(0.5 + 0.4 * R()).toFixed(3)})`; g.lineWidth = 0.9 + R() * 1.1;
    g.beginPath(); g.moveTo(x + nx * 0.6, y + ny * 0.6); g.lineTo(x + Math.cos(ang) * L, y + Math.sin(ang) * L); g.stroke();
  }
}

function drawFibres(g, loop, o, ox, oy) {
  const { pts, nrm, n } = loop, R = rng(o.seed + ':fib'), cols = o.cols.map(hex), dens = o.density ?? 0.45;
  let s = 0;
  while (s < n - 1) {
    s += -Math.log(1 - R()) / dens;
    const i = Math.floor(s) % n, x = pts[i][0] - ox, y = pts[i][1] - oy, nx = nrm[i][0], ny = nrm[i][1];
    if (o.skip && o.skip(x + ox, y + oy)) continue;
    const long = R() < 0.04, L = long ? 3.5 + R() * 6 : 0.6 + 1.4 * -Math.log(1 - R()), a = Math.atan2(ny, nx) + R.gauss(0, long ? 0.7 : 0.5), s0 = 0.6 + R() * 2.2;
    const sx = x - nx * s0, sy = y - ny * s0, ex = sx + Math.cos(a) * (L + s0), ey = sy + Math.sin(a) * (L + s0);
    const bend = R.gauss(0, 0.3) * (L + s0), mx = (sx + ex) / 2 - Math.sin(a) * bend, my = (sy + ey) / 2 + Math.cos(a) * bend;
    const c = cols[R() < 0.8 || cols.length < 2 ? 0 : 1 + Math.floor(R() * (cols.length - 1))], al = (long ? 0.12 : 0.16) + 0.26 * R() * R();
    g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${al.toFixed(3)})`; g.lineWidth = 0.35 + R() * (long ? 0.35 : 0.6);
    g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
  }
}

function renderPiece(pc, Hc) {
  const loop = tearLoop(pc.poly, pc.seed, pc.tear, pc.keep), m = 16;
  let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
  for (const [x, y] of loop.pts) { if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; }
  const x0 = Math.floor(mnx) - m, y0 = Math.max(-m, Math.floor(mny) - m), x1 = Math.ceil(mxx) + m, y1 = Math.min(Hc + 4, Math.ceil(mxy) + m), w = x1 - x0, h = y1 - y0;
  const local = shift(loop.pts, -x0, -y0);
  const mask = raster(w, h, (g) => { tracePoly(g, local); g.fill(); });
  const P = sheetFor(pc.seed, w, h, pc.paper);
  if (pc.paint && !process.argv.includes('--fast')) pc.paint(P, x0, y0, w, h);
  const rimC = createCanvas(w, h), fibC = createCanvas(w, h);
  drawRim(rimC.getContext('2d'), loop, { seed: pc.seed, ...pc.rim }, x0, y0);
  drawFibres(fibC.getContext('2d'), loop, { seed: pc.seed, ...pc.fibres }, x0, y0);
  const rim = rimC.getContext('2d').getImageData(0, 0, w, h).data, fib = fibC.getContext('2d').getImageData(0, 0, w, h).data;
  const tex = P.S.rgb, tooth = blur(P.S.tooth, w, h, 1, 2), soft = blur(mask, w, h, 2, 1), rc = hex(pc.rim.col), mix = pc.rim.mix ?? 0.85;
  const cockle = fbm(pc.seed + ':cockle', 420, 260, 0, 3), relief = pc.relief ?? 0.05, out = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, j = 4 * i, mk = mask[i];
    let r = 0, g = 0, b = 0, a = 0;
    if (mk > 0) {
      const t1 = tooth[Math.max(0, y - 1) * w + Math.max(0, x - 1)], t2 = tooth[Math.min(h - 1, y + 1) * w + Math.min(w - 1, x + 1)], rel = (t1 - t2) * relief + cockle(x + x0, y + y0) * 0.035;
      r = tex[3 * i] * (1 + rel); g = tex[3 * i + 1] * (1 + rel); b = tex[3 * i + 2] * (1 + rel);
      const ra = (rim[j + 3] / 255) * mix;
      r = lerp(r, rc[0], ra); g = lerp(g, rc[1], ra); b = lerp(b, rc[2], ra);
      a = mk * (0.8 + 0.2 * sstep(0.45, 0.95, soft[i]));
    }
    const fa = fib[j + 3] / 255;
    if (fa > 0) { const na = fa + a * (1 - fa); r = (fib[j] * fa + r * a * (1 - fa)) / na; g = (fib[j + 1] * fa + g * a * (1 - fa)) / na; b = (fib[j + 2] * fa + b * a * (1 - fa)) / na; a = na; }
    out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = a * 255;
  }
  const sh = pc.shadow;
  let shadow = null;
  if (sh) {
    const sb = blur(mask, w, h, sh.r, 2), sc = hex(sh.col), buf = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { buf[4 * i] = sc[0]; buf[4 * i + 1] = sc[1]; buf[4 * i + 2] = sc[2]; buf[4 * i + 3] = sb[i] * sh.a * 255; }
    shadow = createCanvas(w, h); shadow.getContext('2d').putImageData(new ImageData(buf, w, h), 0, 0);
  }
  return { canvas: toCanvas(out, w, h), shadow, x0, y0, w, h, sh };
}

function shadowOf(canvas, sh) {
  const w = canvas.width, h = canvas.height, d = canvas.getContext('2d').getImageData(0, 0, w, h).data, a = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = d[4 * i + 3] / 255;
  const sb = blur(a, w, h, sh.r, 2), sc = hex(sh.col), buf = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { buf[4 * i] = sc[0]; buf[4 * i + 1] = sc[1]; buf[4 * i + 2] = sc[2]; buf[4 * i + 3] = sb[i] * sh.a * 255; }
  const c = createCanvas(w, h); c.getContext('2d').putImageData(new ImageData(buf, w, h), 0, 0);
  return c;
}

function placePiece(ctx, pc, W, offs = [-1, 0, 1]) {
  for (const k of offs) {
    const ox = pc.x0 + k * W;
    if (ox + pc.w < 0 || ox > W) continue;
    if (pc.shadow) { ctx.globalCompositeOperation = 'source-atop'; ctx.drawImage(pc.shadow, ox + pc.sh.dx, pc.y0 + pc.sh.dy); }
    ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(pc.canvas, ox, pc.y0);
  }
}
function placeLayer(ctx, layer, shadowSpec) {
  if (shadowSpec) {
    const { W, H } = layer, a = new Float32Array(W * H), d = layer.canvas.getContext('2d').getImageData(0, 0, W, H).data;
    for (let i = 0; i < W * H; i++) a[i] = d[4 * i + 3] / 255;
    const sb = blur(a, W, H, shadowSpec.r, 2), sc = hex(shadowSpec.col), buf = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) { buf[4 * i] = sc[0]; buf[4 * i + 1] = sc[1]; buf[4 * i + 2] = sc[2]; buf[4 * i + 3] = sb[i] * shadowSpec.a * 255; }
    const sc2 = createCanvas(W, H); sc2.getContext('2d').putImageData(new ImageData(buf, W, H), 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    for (const k of [-1, 0, 1]) ctx.drawImage(sc2, shadowSpec.dx + k * W, shadowSpec.dy);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(layer.canvas, 0, 0);
}

function duneGeometry(spec, W, H) {
  const tear = tornProfile(spec.seed, W, spec.tear), und = sines(spec.seed + ':und', W, 1, 7, 1.1);
  const wind = (t) => Math.pow(0.5 * (1 + Math.cos(Math.PI * t)), spec.windP ?? 1.15);
  const lee = (t) => 0.5 * (1 + Math.cos(Math.PI * Math.pow(t, spec.leeP ?? 0.85)));
  const k = spec.soft;
  const hgt = (x) => {
    let m = 0; const v = [];
    for (const d of spec.dunes) {
      let u = x - d.c; u -= Math.round(u / W) * W;
      const t = u < 0 ? -u / d.a : u / d.b, f = t >= 1 ? 0 : u < 0 ? wind(t) : lee(t);
      v.push(d.h * f); if (d.h * f > m) m = d.h * f;
    }
    let s = Math.exp(-k * m); for (const q of v) s += Math.exp(k * (q - m));
    return m + Math.log(s) / k;
  };
  const step = 0.5, n = W / step, tab = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) { const x = i * step; tab[i] = spec.base - hgt(x) - und(x) * spec.und + tear.smooth(x); }
  const edgeS = (x) => { const u = (((x % W) + W) % W) / step, i = Math.min(n - 1, Math.floor(u)), t = u - i; return tab[i] + (tab[i + 1] - tab[i]) * t; };
  const edgeF = (x) => edgeS(x) + tear.rough(x);
  const dunes = spec.dunes.slice().sort((p, q) => p.c - q.c).map((d) => {
    let best = d.c, by = 1e9;
    for (let x = d.c - 40; x < d.c + 40; x += 1) { const y = edgeS(x); if (y < by) { by = y; best = x; } }
    return { ...d, c: best, y: by };
  });
  const Hb = H + 50;
  for (let i = 0; i < dunes.length; i++) {
    const d = dunes[i], nx = i + 1 < dunes.length ? dunes[i + 1].c : dunes[0].c + W, sh = d.shape || {};
    let best = d.c, by = -1e9;
    for (let x = d.c; x < nx; x += 2) { const y = edgeS(x); if (y > by) { by = y; best = x; } }
    d.tx = best; d.ty = by;
    const S = [d.c, edgeF(d.c)], T = [d.tx, edgeF(d.tx)], Q = [lerp(d.c, d.tx, sh.qx ?? 0.55), d.ty + (H - d.ty) * (sh.qy ?? 0.32)];
    const dir = [Q[0] - S[0], Q[1] - S[1]];
    const ctrl = (sh.ctrl || [[0.06, 0.3], [0.55, 0.64]]).map(([fx, fy]) => [S[0] + dir[0] * fx, S[1] + dir[1] * fy]);
    const B = [Q[0] + (Hb - Q[1]) * (sh.bl ?? 0.2), Hb];
    d.S = S; d.T = T; d.Q = Q;
    d.brink = D.curve([[S[0] - 0.4, S[1] - 6], S, ...ctrl, Q, B], false, 1.5).slice(4).map(([x, y]) => [x, Math.max(y, edgeS(x) + clamp((y - S[1]) * 0.12, 0, 18))]);
    const Mt = [lerp(T[0], Q[0], 0.5) + (sh.tb ?? 6), lerp(T[1], Q[1], 0.5)], L = [Q[0] - (Hb - Q[1]) * (sh.ll ?? 0.18), Hb];
    d.left = D.curve([[T[0] + 2, T[1] - 6], T, Mt, Q, L], false, 1.5).slice(4);
    if (d.noSlip) d.brink = shift(d.left, 30, 30);
  }
  return { edgeS, edgeF, edgeR: tear.rough, dunes, Hb };
}

function litPoly(geo, i, W, lift) {
  const { dunes, edgeF, Hb } = geo, n = dunes.length, d = dunes[i];
  const p = i > 0 ? dunes[i - 1] : { ...dunes[n - 1], left: shift(dunes[n - 1].left, -W), tx: dunes[n - 1].tx - W };
  const top = []; for (let x = p.tx; x <= (d.noSlip ? d.tx + 30 : d.c); x += 1) top.push([x, edgeF(x) - lift]);
  const left = p.left.slice().reverse();
  return [[left[0][0], Hb + 10], ...left.filter((q) => q[1] > edgeF(q[0]) + 1), ...top, ...d.brink.filter((q) => q[1] > edgeF(q[0]) + 1), [d.brink[d.brink.length - 1][0], Hb + 10]];
}

function rubLocal(S, ox, oy, fn) { rub(S, (x, y, i) => fn(x + ox, y + oy, i)); }

function paintBase(P, spec, geo, W, H, OV) {
  const R = rng(spec.seed + ':base'), S = P.S, SW = W + OV, { edgeS, dunes } = geo, offs = [-W, 0, W];
  const pal = Object.fromEntries(Object.entries(spec.base_.pal).map(([k, v]) => [k, hex(v)]));
  const bf = raster(SW, H, (g) => { g.lineWidth = 2; for (const d of dunes) for (const o of offs) { traceLine(g, shift(d.brink, o)); g.stroke(); } });
  const dB = edt(Uint8Array.from(bf, (v) => (v > 0.3 ? 1 : 0)), SW, H), nz = fbm(spec.seed + ':bn', 120, 70, W, 4);
  const B = spec.base_;
  rub(S, (x, y, i) => {
    const dep = y - edgeS(x), n = nz(x, y) * 0.5 + 0.5, t = sstep(0, B.coreW * 2.6, dB[i]);
    const col = mixc(pal.deep, pal.refl, t), a = (B.a * (1 - 0.55 * t) + 0.25 * sstep(60, 300, dep)) * (0.85 + 0.3 * n);
    return [...col, clamp(a)];
  });
  for (const o of offs) for (const d of dunes) {
    const br = shift(d.brink, o);
    if (br[0][0] < -300 || br[0][0] > SW + 300) continue;
    for (const [col, n0, len, pr] of B.hatch) for (let m = 0; m < n0 * (d.shade ?? 1); m++) {
      const t = Math.pow(R(), 1.2) * 0.9, idx = Math.floor(t * Math.max(1, br.findIndex((q) => q[1] >= d.Q[1]))), p0 = br[idx], p1 = br[idx + 1] || br[idx];
      const tx = p1[0] - p0[0], ty = p1[1] - p0[1], tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl, off = 3 + Math.pow(R(), 1.5) * B.coreW * 2, L = len * (0.4 + 0.6 * R());
      const c0 = [p0[0] + uy * off, p0[1] - ux * off];
      stroke(P, [[c0[0] - ux * L * 0.5, c0[1] - uy * L * 0.5], [c0[0] + ux * L * 0.5, c0[1] + uy * L * 0.5]], { tool: 'pastelpencil', color: col, pressure: pr * (0.6 + 0.6 * R()), tremor: 0.5 });
    }
  }
}

function paintLit(P, ox, oy, w, h, spec, geo, i) {
  const R = rng(spec.seed + ':lit' + i), S = P.S, { edgeS, dunes } = geo, d = dunes[i], L = spec.lit, pal = Object.fromEntries(Object.entries(L.pal).map(([k, v]) => [k, hex(v)]));
  const bf = raster(w, h, (g) => { g.lineWidth = 2; traceLine(g, shift(d.brink, -ox, -oy)); g.stroke(); });
  const dB = edt(Uint8Array.from(bf, (v) => (v > 0.3 ? 1 : 0)), w, h), nz = fbm(spec.seed + ':ln' + i, 140, 80, 0, 4);
  const lp = (pts) => pts.map(([x, y]) => [(x - ox) / PPM, (y - oy) / PPM]);
  const k = d.shade ?? 1;
  rubLocal(S, ox, oy, (x, y, j) => {
    const dep = y - edgeS(x), n = nz(x, y) * 0.5 + 0.5, near = 1 - sstep(0, L.litW, dB[j]);
    const low = sstep(L.low[0], L.low[1], dep);
    return [...mixc(pal.lit, pal.low, low), clamp((near * L.litA * k * (1 - 0.6 * low) + low * L.lowA) * (0.8 + 0.4 * n))];
  });
  rubLocal(S, ox, oy, (x, y) => {
    const dep = y - edgeS(x); if (dep > L.glow[0]) return null;
    const n = nz(x + 300, y) * 0.5 + 0.5;
    return [...pal.glow, (1 - sstep(0, L.glow[0], dep)) * L.glow[1] * (0.4 + 1.2 * n)];
  });
  for (const [col, n0, len, pr, depth] of L.sweep) for (let m = 0; m < n0 * k; m++) {
    const x0 = ox + R() * w - len * 0.3, dep = 6 + Math.pow(R(), 1.3) * depth, LL = len * (0.5 + R()), pts = [];
    for (let x = x0; x <= x0 + LL; x += 8) pts.push([x, edgeS(x) + dep * (1 + ((x - x0) / LL) * 0.15) + Math.sin(x * 0.01 + m) * 2]);
    P.line(lp(pts), { tool: 'pastelpencil', color: col, pressure: pr * (0.55 + 0.7 * R()), tremor: 0.4 });
  }
  const rp = L.ripples;
  for (let q = 0; q < rp.patches * k; q++) {
    const cx = lerp(d.S[0] - (d.S[0] - ox) * 0.95, d.S[0] - 20, R()), top = 16 + R() * 26, nrow = 3 + Math.floor(R() * rp.rows), wid = 70 + R() * 180;
    for (let r = 0; r < nrow; r++) {
      const dep = top + r * rp.gap * (1 + r * 0.08), xa = cx - wid * (0.3 + 0.4 * R()), xb = cx + wid * (0.3 + 0.4 * R()), pts = [], ph = R() * 6;
      for (let x = xa; x <= xb; x += 4) { const y = edgeS(x) + dep + Math.sin(x * rp.freq + ph) * rp.wig, jj = Math.round(y - oy) * w + Math.round(x - ox); if (x > d.S[0] - 6 || (jj >= 0 && jj < w * h && dB[jj] < 8)) break; pts.push([x, y]); }
      if (pts.length < 4) continue;
      const fade = 1 - r / (nrow + 1);
      P.line(lp(pts), { tool: 'pencil', color: rp.dark, pressure: rp.pd * fade * (0.6 + 0.6 * R()), tremor: 0.7 });
      P.line(lp(shift(pts, 0, -2.4)), { tool: 'pastelpencil', color: rp.pale, pressure: rp.pp * fade * (0.6 + 0.6 * R()), tremor: 0.6 });
    }
  }
}

function bladePoly(base, ang, len, w0, bend, n = 16) {
  const Lf = [], Rt = [], spine = [], wid = [];
  let x = base[0], y = base[1], a = ang;
  for (let i = 0; i <= n; i++) {
    const t = i / n, hw = Math.max(0.3, (w0 / 2) * Math.pow(1 - t, 0.75)), nx = Math.cos(a), ny = Math.sin(a);
    spine.push([x, y]); wid.push(hw); Lf.push([x - nx * hw, y - ny * hw]); Rt.push([x + nx * hw, y + ny * hw]);
    a += (bend * (0.3 + 1.7 * t)) / n; x += (Math.sin(a) * len) / n; y -= (Math.cos(a) * len) / n;
  }
  return { poly: [...Lf, ...Rt.reverse()], spine, wid };
}

function tuftShapes(t) {
  const R = rng(t.seed), shapes = [], cols = t.cols;
  for (let k = 0; k < t.n; k++) {
    const u = R() * 2 - 1, ang = t.lean + u * t.spread + R.gauss(0, 0.1), long = R() < 0.3, len = t.len * (long ? 0.9 + 0.35 * R() : 0.3 + 0.6 * Math.pow(R(), 0.6)) * (1 - 0.25 * Math.abs(u));
    const b = bladePoly([t.x + u * t.base + R.gauss(0, 1.5), t.y + R() * 5], ang, len, t.w * (0.65 + 0.6 * R()), t.bend * (long ? 1.1 + 1.2 * R() : 0.3 + 1.1 * R()) * (u > -0.2 ? 1.2 : 0.7));
    shapes.push({ ...b, col: cols[Math.floor(R() * cols.length)], dark: t.dark, pale: t.pale, z: R() });
  }
  shapes.sort((p, q) => p.z - q.z);
  for (let k = 0; k < t.stalks; k++) {
    const b = bladePoly([t.x + R.gauss(0, t.base * 0.5), t.y + 2], t.lean * 0.4 + R.gauss(0, 0.14), t.len * (1.2 + 0.4 * R()), 1.8, t.bend * 0.6 + 0.9, 30);
    shapes.push({ ...b, col: t.straw, dark: t.dark, pale: t.pale, stalk: true });
    const sp = b.spine, n = sp.length;
    for (let j = Math.floor(n * 0.5); j < n - 1; j += 2) {
      const f = (j - n * 0.5) / (n * 0.5), p = sp[j], side = (j >> 1) % 2 ? 1 : -1, dir = Math.PI * (0.58 + 0.2 * f + 0.08 * R()) + side * (0.35 - 0.2 * f), ped = 4 + R() * 5 * (1 - 0.5 * f);
      const dx = Math.sin(dir), dy = -Math.cos(dir), c = [p[0] + dx * (ped + 3.6), p[1] + dy * (ped + 3.6)];
      shapes.push({ poly: [[p[0] - 0.4, p[1]], [p[0] + 0.4, p[1]], [c[0] + 0.4, c[1]], [c[0] - 0.4, c[1]]], spine: [p, c], wid: [0.4, 0.4], col: t.straw, dark: t.dark, pale: t.pale, ped: true });
      shapes.push({ poly: D.ell(c[0], c[1], 1.55 + R() * 0.5, 4 + R() * 1.4, Math.atan2(dy, dx) - Math.PI / 2, 18), spine: [p, c], wid: [0.5, 0.5], col: t.seed2 || t.straw, dark: t.seedDark, pale: t.pale, head: true });
    }
  }
  return shapes;
}

function renderTuft(t) {
  const shapes = tuftShapes(t), sc = 2;
  let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
  for (const sh of shapes) for (const [x, y] of sh.poly) { if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; }
  const x0 = Math.floor(mnx) - 4, y0 = Math.floor(mny) - 4, w = Math.ceil(mxx) - x0 + 4, h = Math.ceil(mxy) - y0 + 4, W2 = w * sc, H2 = h * sc;
  const loc = (pts) => pts.map(([x, y]) => [(x - x0) * sc, (y - y0) * sc]);
  const mask = raster(W2, H2, (g) => { for (const sh of shapes) { tracePoly(g, loc(sh.poly)); g.fill(); } });
  const P = sheetFor(t.seed, W2, H2, t.paper), R = rng(t.seed + ':paint');
  if (!process.argv.includes('--fast')) {
    for (const sh of shapes) P.fill([mm(loc(sh.poly))], sh.col, { tool: 'pastelpencil', pressure: 0.92, passes: 3, angle: 80 });
    for (const sh of shapes) {
      if (sh.ped) continue;
      const sp = loc(sh.spine), wd = sh.wid.map((v) => v * sc);
      if (sh.head) { P.fill([mm(loc(sh.poly))], sh.dark, { tool: 'pencil', pressure: 0.45, passes: 1, angle: 20, clip: [mm(loc(shift(sh.poly, 0.6, 0.4)))] }); continue; }
      const dark = [], pale = [];
      for (let i = 0; i < sp.length - 1; i++) {
        const a = sp[i], b = sp[i + 1], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
        dark.push([a[0] - nx * wd[i] * 0.45, a[1] - ny * wd[i] * 0.45]); pale.push([a[0] + nx * wd[i] * 0.5, a[1] + ny * wd[i] * 0.5]);
      }
      if (dark.length > 2) {
        P.line(mm(dark), { tool: 'pencil', color: sh.dark, pressure: 0.5 + 0.3 * R(), tremor: 0.4 });
        if (!sh.stalk && R() < 0.6) P.line(mm(pale), { tool: 'pencil', color: sh.pale, pressure: 0.25 + 0.2 * R(), tremor: 0.4 });
      }
    }
  }
  const tex = P.S.rgb, buf = new Uint8ClampedArray(W2 * H2 * 4);
  for (let i = 0; i < W2 * H2; i++) { buf[4 * i] = tex[3 * i]; buf[4 * i + 1] = tex[3 * i + 1]; buf[4 * i + 2] = tex[3 * i + 2]; buf[4 * i + 3] = mask[i] * 255; }
  const big = createCanvas(W2, H2); big.getContext('2d').putImageData(new ImageData(buf, W2, H2), 0, 0);
  const canvas = createCanvas(w, h), g = canvas.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(big, 0, 0, w, h);
  return { canvas, shadow: null, x0, y0, w, h };
}

function paintGround(P, spec, geo, W, H, OV, gEdge) {
  const S = P.S, G = spec.ground, pal = Object.fromEntries(Object.entries(G.pal).map(([k, v]) => [k, hex(v)])), nz = fbm(spec.seed + ':gn', 160, 60, W, 4), R = rng(spec.seed + ':gr');
  rub(S, (x, y) => { const dep = y - gEdge(x), n = nz(x, y) * 0.5 + 0.5; return [...mixc(pal.top, pal.low, sstep(0, 70, dep)), clamp((0.25 + 0.5 * sstep(-4, 60, dep)) * (0.7 + 0.6 * n) * G.a)]; });
  for (const [col, n0, len, pr] of G.sweep) for (let m = 0; m < n0; m++) {
    const x0 = R() * (W + OV + 200) - 200, dep = 4 + R() * 60, pts = [];
    for (let x = x0; x <= x0 + len * (0.5 + R()); x += 8) pts.push([x, gEdge(x) + dep + Math.sin(x * 0.012 + m) * 2]);
    stroke(P, pts, { tool: 'pastelpencil', color: col, pressure: pr * (0.55 + 0.7 * R()), tremor: 0.4 });
  }
}

const DUNES2 = {
  dunes2: {
    seed: 'dunes2',
    base: 352, und: 7, soft: 0.05, windP: 1.2, leeP: 0.9,
    dunes: [
      { c: 290, h: 112, a: 300, b: 180, noSlip: true, shape: { qx: 0.45, qy: 0.5 } },
      { c: 760, h: 160, a: 400, b: 240, noSlip: true, shape: { qx: 0.42, qy: 0.5 } },
      { c: 1185, h: 84, a: 200, b: 170, noSlip: true, shape: { qx: 0.42, qy: 0.5 } },
      { c: 1570, h: 136, a: 340, b: 230, shade: 0.6, shape: { qx: 0.8, qy: 0.5, ctrl: [[0.22, 0.32], [0.5, 0.72]], bl: 0.5 } },
      { c: 1905, h: 70, a: 180, b: 140, noSlip: true, shape: { qx: 0.42, qy: 0.46 } },
    ],
    tear: { big: 2.4, mid: 1.8, fine: 0.8 },
    rim: { w: 3.9, col: '#eedcd2', mix: 0.62 },
    base_: {
      paper: { base: '#a78272', tooth: 0.6, fibre: 0.7 },
      pal: { deep: '#87676b', refl: '#b8917f' }, coreW: 46, a: 0.4,
      hatch: [['#6c5058', 24, 110, 0.26], ['#c09886', 18, 150, 0.2]],
    },
    lit: {
      paper: [{ base: '#c9a18b', tooth: 0.6, fibre: 0.7 }, { base: '#c59c88', tooth: 0.6, fibre: 0.7 }, { base: '#caa490', tooth: 0.6, fibre: 0.7 }, { base: '#c29884', tooth: 0.6, fibre: 0.7 }, { base: '#c8a08c', tooth: 0.6, fibre: 0.7 }],
      tear: { big: 1.2, mid: 1.4, fine: 0.7 },
      pal: { lit: '#ecd3c0', low: '#ad8578', glow: '#f0d4c2' }, litW: 60, litA: 0.4, low: [110, 320], lowA: 0.3, glow: [60, 0.2],
      sweep: [['#e4c6b2', 10, 220, 0.2, 120], ['#b48a7c', 8, 260, 0.16, 240]],
      ripples: { patches: 1, rows: 4, gap: 9, freq: 0.035, wig: 1.2, dark: '#a8806f', pale: '#efd8c8', pd: 0.18, pp: 0.2 },
      inner: 0.42,
      shadow: { dx: 2, dy: 2.5, r: 3, a: 0.26, col: '#3a2a2e' },
    },
  },
  dunes3: {
    seed: 'dunes3',
    base: 360, und: 9, soft: 0.04, windP: 1.05, leeP: 1,
    dunes: [
      { c: 180, h: 66, a: 360, b: 300, noSlip: true, shape: { qx: 0.4, qy: 0.55 } },
      { c: 700, h: 112, a: 420, b: 330, noSlip: true, shape: { qx: 0.4, qy: 0.55 } },
      { c: 1240, h: 78, a: 360, b: 330, noSlip: true, shape: { qx: 0.4, qy: 0.55 } },
      { c: 1690, h: 124, a: 380, b: 310, noSlip: true, shape: { qx: 0.4, qy: 0.55 } },
    ],
    tear: { big: 2.2, mid: 1.6, fine: 0.75 },
    rim: { w: 3.6, col: '#d9d1e0', mix: 0.56 },
    base_: {
      paper: { base: '#8f87a0', tooth: 0.55, fibre: 0.65 },
      pal: { deep: '#7c7491', refl: '#a49bb3' }, coreW: 46, a: 0.3,
      hatch: [],
    },
    lit: {
      paper: [{ base: '#aaa0b8', tooth: 0.55, fibre: 0.65 }, { base: '#a69cb5', tooth: 0.55, fibre: 0.65 }, { base: '#ada4bb', tooth: 0.55, fibre: 0.65 }, { base: '#a399b2', tooth: 0.55, fibre: 0.65 }],
      tear: { big: 1.4, mid: 1.4, fine: 0.7 },
      pal: { lit: '#cdc1d0', low: '#958ca8', glow: '#ddc9d0' }, litW: 50, litA: 0.15, low: [90, 300], lowA: 0.28, glow: [70, 0.26],
      sweep: [['#c9bed0', 8, 260, 0.16, 120], ['#9a90ad', 6, 300, 0.14, 240]],
      ripples: { patches: 0, rows: 0, gap: 9, freq: 0.03, wig: 1, dark: '#9a90ad', pale: '#d8cfdc', pd: 0, pp: 0 },
      inner: 0.5,
      shadow: { dx: 2, dy: 2.5, r: 3, a: 0.2, col: '#2e2a3a' },
    },
  },
};

async function dunes(name) {
  const spec = DUNES[name] || DUNES2[name], W = 2048, H = 512, OV = 192;
  const geo = duneGeometry(spec, W, H), { dunes: ds, edgeS, edgeF } = geo, n = ds.length;
  const lower = (x) => { let v = 0; for (const d of ds) for (const o of [-W, 0, W]) { const p = ds.indexOf(d) > 0 ? ds[ds.indexOf(d) - 1].tx + o : ds[n - 1].tx - W + o; const e = d.noSlip ? d.tx + o + 46 : d.c + o - 6; v = Math.max(v, sstep(p + 4, p + 40, x) * (1 - sstep(e - 40, e, x))); } return v * 16; };
  const lowTab = new Float32Array(W); for (let x = 0; x < W; x++) lowTab[x] = lower(x + 0.5);
  const lowAt = (x) => lowTab[Math.min(W - 1, Math.max(0, Math.floor(((x % W) + W) % W)))];
  const P = sheetFor(name + '-base', W + OV, H, spec.base_.paper);
  if (!process.argv.includes('--fast')) paintBase(P, spec, geo, W, H, OV);
  const rimW = (() => { const a = sines(spec.seed + ':rim', W, 3, 40, 0.9), b = sines(spec.seed + ':rimgap', W, 5, 30, 0.7); return (x) => spec.rim.w * clamp(1 + 0.5 * a(x), 0.3, 1.8) * (b(x) < -1.25 ? 0.3 : 1); })();
  const baseImg = heightCompose({ W, H, OV, S: P.S, edgeS: (x) => edgeS(x) + lowAt(x), edgeR: geo.edgeR, rimW, seed: spec.seed, rimCol: spec.rim.col, rimMix: spec.rim.mix });
  const out = createCanvas(W, H), ctx = out.getContext('2d');
  const baseC = toCanvas(baseImg, W, H);
  heightFibres(baseC.getContext('2d'), { W, edge: (x) => edgeF(x) + lowAt(x), rimW, seed: spec.seed, cols: [spec.rim.col, tohex(mixc(hex(spec.base_.paper.base), hex(spec.rim.col), 0.5))] });
  ctx.drawImage(baseC, 0, 0);
  const tuft = (t) => { const d = ds[t.dune], x = d.c - t.dx; return renderTuft({ ...spec.tuftStyle, ...t, seed: `${spec.seed}-tuft${t.dune}-${t.dx}`, x, y: edgeS(x) + (t.front ? t.dep : 9) }); };
  if (spec.tufts) for (const t of spec.tufts.filter((q) => !q.front)) placePiece(ctx, tuft(t), W);
  const lits = [];
  for (let i = 0; i < n; i++) {
    const poly = litPoly(geo, i, W, 0.6), top = (x, y) => Math.abs(y - (edgeF(x) - 0.6));
    lits.push(renderPiece({
      poly, seed: `${spec.seed}-lit${i}`, paper: spec.lit.paper[i % spec.lit.paper.length], tear: spec.lit.tear,
      keep: (x, y) => sstep(0.4, 2.5, top(x, y)), rim: { ...spec.rim, scale: (x, y) => lerp(1, spec.lit.inner, sstep(1, 4, top(x, y))) }, fibres: { cols: [spec.rim.col] },
      shadow: spec.lit.shadow, paint: (Pp, ox, oy, w, h) => paintLit(Pp, ox, oy, w, h, spec, geo, i),
    }, H));
  }
  for (const k of [-1, 0, 1]) for (const pc of lits) placePiece(ctx, pc, W, [k]);
  if (spec.tufts) for (const t of spec.tufts.filter((q) => q.front)) { const pc = tuft(t); pc.shadow = shadowOf(pc.canvas, spec.tuftShadow); pc.sh = spec.tuftShadow; placePiece(ctx, pc, W); }
  if (spec.ground) {
    const G = spec.ground, gs = sines(spec.seed + ':gnd', W, 1, 9, 1.2), gt = tornProfile(spec.seed + ':gt', W, G.tear), gEdge = (x) => H - G.h - gs(x) * G.amp + gt.smooth(x);
    const PG = sheetFor(name + '-ground', W + OV, H, G.paper);
    if (!process.argv.includes('--fast')) paintGround(PG, spec, geo, W, H, OV, gEdge);
    const gImg = heightCompose({ W, H, OV, S: PG.S, edgeS: gEdge, edgeR: gt.rough, rimW: (x) => rimW(x + 700) * 0.7, seed: spec.seed + ':ground', rimCol: spec.rim.col, rimMix: spec.rim.mix * 0.8 });
    const gC = toCanvas(gImg, W, H);
    heightFibres(gC.getContext('2d'), { W, edge: (x) => gEdge(x) + gt.rough(x), rimW, seed: spec.seed + ':gf', cols: [spec.rim.col] });
    placeLayer(ctx, { canvas: gC, W, H }, G.shadow);
  }
  return writePng(out, name);
}

const DUNES = {
  dunes1: {
    seed: 'dunes1',
    base: 362, und: 8, soft: 0.05, windP: 1.25, leeP: 0.88,
    dunes: [
      { c: 610, h: 222, a: 560, b: 250, shape: { qx: 0.78, qy: 0.56, ctrl: [[0.2, 0.3], [0.48, 0.7]], bl: 0.5 } },
      { c: 1035, h: 92, a: 180, b: 170, shade: 0.7, noSlip: true, shape: { qx: 0.4, qy: 0.5 } },
      { c: 1560, h: 182, a: 430, b: 250, shape: { qx: 0.8, qy: 0.54, ctrl: [[0.22, 0.32], [0.5, 0.72]], bl: 0.5 } },
      { c: 1935, h: 70, a: 170, b: 130, shade: 0.45, noSlip: true, shape: { qx: 0.4, qy: 0.42 } },
    ],
    tear: { big: 2.6, mid: 1.9, fine: 0.8 },
    rim: { w: 4.5, col: '#f6ecd2', mix: 0.82 },
    base_: {
      paper: { base: '#a96f4f', tooth: 0.62, fibre: 0.75 },
      pal: { deep: '#764544', refl: '#c08a5f' }, coreW: 46, a: 0.6,
      hatch: [['#6a3e40', 34, 110, 0.3], ['#c99363', 26, 150, 0.24], ['#9a7a8e', 14, 120, 0.2]],
    },
    lit: {
      paper: [{ base: '#dbac6f', tooth: 0.6, fibre: 0.75 }, { base: '#d5a56b', tooth: 0.6, fibre: 0.75 }, { base: '#d9aa70', tooth: 0.6, fibre: 0.75 }, { base: '#d2a068', tooth: 0.6, fibre: 0.75 }],
      tear: { big: 1.2, mid: 1.4, fine: 0.7 },
      pal: { lit: '#f5e2b4', low: '#c18d55', glow: '#f3d9aa' }, litW: 70, litA: 0.5, low: [120, 330], lowA: 0.32, glow: [70, 0.2],
      sweep: [['#f1d9a6', 14, 240, 0.24, 150], ['#e6be8b', 8, 200, 0.2, 110], ['#c9925a', 10, 280, 0.18, 280]],
      ripples: { patches: 2, rows: 4, gap: 9, freq: 0.035, wig: 1.4, dark: '#b9844f', pale: '#f4e2b6', pd: 0.24, pp: 0.26 },
      inner: 0.45,
      shadow: { dx: 2.5, dy: 3, r: 3, a: 0.32, col: '#3b2318' },
    },
    tufts: [
      { dune: 0, dx: 150, n: 30, len: 74, stalks: 3, base: 11 }, { dune: 0, dx: 345, n: 14, len: 44, stalks: 1, base: 8 }, { dune: 1, dx: 46, n: 18, len: 52, stalks: 2, base: 9 }, { dune: 2, dx: 112, n: 24, len: 64, stalks: 2, base: 10 },
      { dune: 0, dx: 260, n: 12, len: 30, stalks: 0, base: 7, front: true, dep: 120 }, { dune: 2, dx: 230, n: 10, len: 26, stalks: 1, base: 6, front: true, dep: 96 },
    ],
    tuftShadow: { dx: 2, dy: 2.5, r: 2, a: 0.3, col: '#3b2318' },
    tuftStyle: { lean: 0.24, spread: 0.62, w: 4.4, bend: 0.6, paper: { base: '#a39a5c', tooth: 0.5, fibre: 0.5 }, cols: ['#7b7841', '#8a8447', '#6c7046', '#a3915a', '#958650'], straw: '#c1a462', seed2: '#cfae67', dark: '#4b4729', seedDark: '#94723a', pale: '#cdbd80' },
    ground: {
      paper: { base: '#c38b52', tooth: 0.65, fibre: 0.8 }, h: 62, amp: 9, tear: { big: 2.2, mid: 1.7, fine: 0.8 },
      pal: { top: '#d4a46a', low: '#a86f3e' }, a: 0.5,
      sweep: [['#e2b77f', 60, 260, 0.25], ['#9f6637', 40, 300, 0.22]],
      shadow: { dx: 2, dy: 3, r: 3, a: 0.34, col: '#3b2318' },
    },
  },
};

function waveGeometry(seed, W, q) {
  const R = rng(seed + ':waves'), waves = [];
  let x = 0;
  while (x < W - q.gap[0] * 0.6) { const gap = lerp(q.gap[0], q.gap[1], R()); waves.push({ c: x, h: lerp(q.h[0], q.h[1], Math.pow(R(), 0.8)), gap }); x += gap; }
  const sc = W / x; for (const w of waves) { w.c = w.c * sc + q.phase; w.gap *= sc; w.a = w.gap * (0.6 + 0.12 * R()); w.b = w.gap * (0.36 + 0.1 * R()); }
  const back = (t) => Math.pow(0.5 + 0.5 * Math.cos(Math.PI * t), 1.35), front = (t) => 0.5 + 0.5 * Math.cos(Math.PI * Math.pow(t, 0.78));
  const und = sines(seed + ':und', W, 1, 5, 1), k = 0.12, step = 0.5, n = W / step, tab = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const xx = i * step, v = [];
    let m = 0;
    for (const w of waves) { let u = xx - w.c; u -= Math.round(u / W) * W; const t = u < 0 ? -u / w.a : u / w.b, f = t >= 1 ? 0 : u < 0 ? back(t) : front(t); v.push(w.h * f); if (w.h * f > m) m = w.h * f; }
    let ss = Math.exp(-k * m); for (const qv of v) ss += Math.exp(k * (qv - m));
    tab[i] = q.base - (m + Math.log(ss) / k) - und(xx) * q.und;
  }
  const edge = (xx) => { const u = (((xx % W) + W) % W) / step, i = Math.min(n - 1, Math.floor(u)), t = u - i; return tab[i] + (tab[i + 1] - tab[i]) * t; };
  return { edge, waves };
}

function paintSeaBody(P, g, W, H, OV, q) {
  const S = P.S, R = rng('seabody'), pal = Object.fromEntries(Object.entries(q.pal).map(([k, v]) => [k, hex(v)])), nz = fbm('seabody:n', 160, 60, W, 4), nz2 = fbm('seabody:n2', 50, 22, W, 3);
  const face = new Float32Array(W + OV);
  for (let x = 0; x < W + OV; x++) {
    let f = 0;
    for (const w of g.waves) for (const o of [-W, 0, W]) { const u = x - (w.c + o), hk = w.h / q.h[1]; f = Math.max(f, u > 0 ? Math.exp(-u / (w.b * 1.1)) * hk : Math.exp(u / (w.a * 0.35)) * hk); }
    face[x] = f;
  }
  rub(S, (x, y) => { const dep = y - g.edge(x), n = nz(x, y) * 0.5 + 0.5; return [...pal.deep, clamp(sstep(6, H - g.edge(x) + 30, dep) * q.deepA * (0.75 + 0.5 * n))]; });
  rub(S, (x, y) => { const dep = y - g.edge(x); if (dep < -6) return null; const n = nz2(x, y) * 0.5 + 0.5, f = face[x] * (1 - sstep(8, q.faceD, dep)); return f > 0.01 ? [...pal.face, clamp(f * q.faceA * (0.7 + 0.6 * n))] : null; });
  for (let k = 0; k < q.swells; k++) {
    const y = lerp(q.swellY[0], q.swellY[1], Math.pow(R(), 0.9)), x0 = R() * (W + OV + 300) - 300, L = 140 + R() * 360, pts = [], dark = R() < 0.6;
    for (let xx = x0; xx <= x0 + L; xx += 8) pts.push([xx, y + Math.sin(xx * 0.011 + k) * 3 + (g.edge(xx) - q.base) * 0.25]);
    stroke(P, pts, dark ? { tool: 'pencil', color: q.arcDark, pressure: 0.3 + 0.2 * R(), tremor: 0.5 } : { tool: 'pastelpencil', color: q.arcPale, pressure: 0.42 + 0.2 * R(), tremor: 0.5 });
  }
  for (const w of g.waves) for (const o of [0, W]) {
    if (w.c + o > W + OV + 100) continue;
    const hk = w.h / q.h[1], rows = 1 + Math.round(2.4 * hk);
    for (let r = 0; r < rows; r++) {
      const dep = 18 + r * (11 + r * 3) + R() * 4, x0 = w.c + o - w.a * (0.12 + 0.1 * R()) + r * 10, L = (w.b * (0.7 + 0.5 * R()) + w.a * 0.15) * (1 - r * 0.18);
      const rad = (3.6 + R() * 2.2) * (1 - r * 0.15), pts = [];
      let th = R() * 6.28;
      for (let t = 0; t < L; t += 0.8) {
        const rr = rad * (0.75 + 0.35 * Math.sin(t * 0.05 + r * 2)), xx = x0 + t;
        th += 0.8 / (rr * 0.62);
        pts.push([xx + rr * Math.cos(th), g.edge(xx) + dep + rr * Math.sin(th) * 0.55 + (t / L) * 6]);
      }
      let i = 0;
      while (i < pts.length - 4) {
        const n = 20 + Math.floor(R() * 60), seg = pts.slice(i, i + n);
        if (seg.length > 3 && R() < 0.8) stroke(P, seg, { tool: 'pencil', color: q.lace, pressure: (0.55 - r * 0.1) * (0.6 + 0.5 * R()) * (0.6 + 0.4 * hk), tremor: 0.6, smooth: 0.15 });
        i += n + Math.floor(R() * 14);
      }
      for (let k = 0; k < 6 * hk; k++) { const xx = x0 + R() * L, yy = g.edge(xx) + dep + R.gauss(0, 5); stroke(P, [[xx, yy], [xx + 1 + R() * 3, yy + R.gauss(0, 0.6)]], { tool: 'pastelpencil', color: q.lace, pressure: 0.5 + 0.3 * R(), tremor: 0.4 }); }
    }
  }
}

function crepeBand(g, W, H, q) {
  const out = new Float32Array(W * H * 4), seed = q.seed;
  const fr = sines(seed + ':fr', W, 2, 30, 0.9), th = sines(seed + ':th', W, 3, 50, 0.9), rf = sines(seed + ':rf', W, Math.round(W / 30), Math.round(W / 11), 0.6), rfa = sines(seed + ':rfa', W, 4, 60, 0.8), bw = sines(seed + ':bw', W, 30, 200, 1.1);
  const top = new Float32Array(W), slope = new Float32Array(W), bot = new Float32Array(W), U = new Float32Array(W + 1), crestK = new Float32Array(W);
  const topAt = (xx) => { const e = g.edge(xx), crest = clamp((q.base - e) / q.h[1]); const ruf = clamp(0.5 + 0.38 * rf(xx)) * q.ruffle * clamp(0.65 + 0.35 * rfa(xx), 0.2, 1.2); return e - q.frill * (0.75 + 0.4 * fr(xx)) * (0.5 + 0.7 * crest) - ruf; };
  for (let xx = 0; xx < W; xx++) {
    const e = g.edge(xx + 0.5), crest = clamp((q.base - e) / q.h[1]);
    top[xx] = topAt(xx + 0.5); slope[xx] = topAt(xx + 1) - topAt(xx);
    crestK[xx] = crest;
    bot[xx] = e + lerp(q.thin, q.thick, Math.pow(crest, 1.1)) * clamp(0.8 + 0.3 * th(xx), 0.5, 1.3) + bw(xx) * 1.3;
    const d = (g.edge(xx + 1) - g.edge(xx - 1)) / 2; U[xx + 1] = U[xx] + Math.sqrt(1 + d * d);
  }
  const Ut = U[W], n1 = vnoise(seed + ':n1', q.pitch, 16, Ut), n2 = vnoise(seed + ':n2', q.pitch * 0.5, 7, Ut), bend = fbm(seed + ':bend', 40, 30, Ut, 3), soft = vnoise(seed + ':soft', 30, 10, Ut), blot = fbm(seed + ':blot', 26, 12, Ut, 3);
  const lit = hex(q.lit), shade = hex(q.shade), deepC = hex(q.deep), sea = hex(q.sea), warm = hex(q.warm), glowC = hex(q.glowC);
  const hAt = (u, v) => n1(u, v) + 0.55 * n2(u, v);
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const t0 = top[xx], b0 = bot[xx]; if (y + 1 < t0 - 1 || y > b0 + 4) continue;
    const u = (U[xx] + U[xx + 1]) / 2, v = y + 0.5 - t0, thick = Math.max(3, b0 - t0), f = clamp(v / thick);
    const aTop = clamp(v + 0.5), aBot = clamp((b0 - y - 0.5) / 2.6 + 0.5 + (soft(u, v) * 0.5) * 0.8);
    const a = aTop * aBot; if (a <= 0.002) continue;
    const ub = u + bend(u, v) * 6, stretch = 1 - sstep(0, q.stretch, v);
    const ridge = (hAt(ub - 0.6, v) - hAt(ub + 0.6, v)) * q.crinkle * (1 - 0.8 * stretch);
    const flute = -slope[xx] * 0.55 * stretch;
    let sh = q.bias - ridge - flute + f * q.lowShade + (blot(u, v) * 0.5) * q.blot;
    sh = clamp(sh, -0.4, 1);
    let c = sh < 0 ? mixc(lit, warm, clamp(-sh * 2.5)) : sh < 0.5 ? mixc(lit, shade, sh / 0.5) : mixc(shade, deepC, (sh - 0.5) / 0.5);
    c = mixc(c, sea, f * f * q.seaTint * (1 - 0.5 * crestK[xx]));
    c = mixc(c, glowC, q.glow * (1 - sstep(0, 9, v)) * (0.5 + 0.5 * crestK[xx]) * clamp(1 - sh * 1.5));
    const j = 4 * (y * W + xx), edgeA = 0.86 + 0.14 * sstep(0, 2.2, v);
    out[j] = c[0]; out[j + 1] = c[1]; out[j + 2] = c[2]; out[j + 3] = a * edgeA * (q.alpha - 0.12 * f * f) * 255;
  }
  return { img: out, top, bot };
}

async function seawaves() {
  const W = 2048, H = 256, OV = 192, q = SEA;
  const g = waveGeometry('seawaves', W, q);
  const P = sheetFor('seawaves-body', W + OV, H, q.paper);
  if (!process.argv.includes('--fast')) paintSeaBody(P, g, W, H, OV, q);
  const body = heightCompose({ W, H, OV, S: P.S, edgeS: (x) => g.edge(x) + 3, edgeR: () => 0, rimW: () => 0, seed: 'seawaves', rimCol: '#ffffff', rimMix: 0, lip: 0 });
  const out = createCanvas(W, H), ctx = out.getContext('2d');
  ctx.drawImage(toCanvas(body, W, H), 0, 0);
  const band = crepeBand(g, W, H, { ...q.crepe, base: q.base, h: q.h });
  placeLayer(ctx, { canvas: toCanvas(band.img, W, H), W, H }, q.crepe.shadow);
  return writePng(out, 'seawaves');
}

const SEA = {
  paper: { base: '#3f7c82', tooth: 0.6, fibre: 0.6 },
  base: 124, und: 6, gap: [190, 330], h: [18, 54], phase: 60,
  pal: { deep: '#28525f', face: '#6ba9a3' }, deepA: 0.62, faceA: 0.62, faceD: 95,
  swells: 22, swellY: [150, 246], arcPale: '#7fb6ae', arcDark: '#2b5b68', lace: '#e9f2ec',
  crepe: { seed: 'crepe', frill: 4, thin: 7, thick: 24, ruffle: 2.4, stretch: 7, pitch: 2.3, crinkle: 0.5, blot: 0.12, lit: '#f6f1e8', warm: '#fcf5ea', shade: '#d4ccd5', deep: '#aea8bc', sea: '#c2dad5', glowC: '#fbe2d0', glow: 0.45, bias: 0.14, lowShade: 0.2, seaTint: 0.4, alpha: 0.97, shadow: { dx: 1.5, dy: 2.5, r: 2, a: 0.32, col: '#143642' } },
};

function cloudLobes(seed, q) {
  const R = rng(seed), lobes = [];
  const env = (x) => { let h = q.base; for (const [c, w, t] of q.towers) h = Math.min(h, q.base - (q.base - t) * Math.exp(-(((x - c) / w) ** 2))); return h; };
  let x = q.x0 + q.r0 * 0.6;
  while (x < q.x1 - q.r0 * 0.6) {
    const top = env(x) + R.gauss(0, 6), r = clamp((q.base - top) * (0.42 + 0.12 * R()), q.rmin, q.rmax);
    lobes.push({ cx: x, cy: top + r, r, z: 0 });
    x += r * (0.75 + 0.35 * R());
  }
  const big = lobes.slice();
  for (const L of big) {
    const n = 1 + Math.floor(R() * 3.2);
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + R.gauss(0, 0.65), r = L.r * (0.32 + 0.2 * R()), d = L.r - r * (0.35 + 0.3 * R());
      const m = { cx: L.cx + Math.cos(a) * d, cy: L.cy + Math.sin(a) * d, r, z: 1 };
      lobes.push(m);
      if (R() < 0.55) { const a2 = a + R.gauss(0, 0.6), r2 = r * (0.38 + 0.2 * R()), d2 = r - r2 * 0.5; lobes.push({ cx: m.cx + Math.cos(a2) * d2, cy: m.cy + Math.sin(a2) * d2, r: r2, z: 2 }); }
    }
  }
  const taper = (xx) => Math.min(sstep(q.x0 - 40, q.x0 + q.r0 * 1.4, xx), 1 - sstep(q.x1 - q.r0 * 1.4, q.x1 + 40, xx));
  const top = (xx) => { let y = 1e9; for (const L of lobes) { const dx = xx - L.cx; if (Math.abs(dx) < L.r) { const v = L.cy - Math.sqrt(L.r * L.r - dx * dx); if (v < y) y = v; } } return y; };
  return { lobes, top, env, taper };
}

function cloudPoly(cl, q) {
  const pts = [], bot = [], bs = sines(q.seed + ':bot', 4096, 6, 40, 1.2);
  for (let x = q.x0 - 60; x <= q.x1 + 60; x += 1) {
    const t = cl.top(x), bl = q.base + q.sag * Math.sin(Math.PI * clamp((x - q.x0) / (q.x1 - q.x0))) + bs(x * 2) * q.wob;
    if (t >= bl - 2) continue;
    pts.push([x, t]); bot.push([x, bl]);
  }
  return [...pts, ...bot.reverse()];
}

function paintCloud(P, ox, oy, w, h, cl, q, R) {
  const S = P.S, pal = Object.fromEntries(Object.entries(q.pal).map(([k, v]) => [k, hex(v)])), nz = fbm(q.seed + ':cn', 90, 60, 0, 4), L = [-0.42, -0.78, 0.46], ll = Math.hypot(...L), lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll;
  const lobes = cl.lobes.filter((o) => o.cx + o.r > ox - 10 && o.cx - o.r < ox + w + 10);
  let shade = new Float32Array(w * h), occ = new Float32Array(w * h);
  const topAt = new Float32Array(w); for (let x = 0; x < w; x++) topAt[x] = cl.top(x + ox);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x + ox, Y = y + oy;
    let best = null, bz = -1e9, second = -1e9;
    for (const o of lobes) { const dx = X - o.cx, dy = Y - o.cy, d2 = dx * dx + dy * dy; if (d2 >= o.r * o.r) continue; const zz = Math.sqrt(o.r * o.r - d2) + o.z * q.zstep; if (zz > bz) { second = bz; bz = zz; best = o; } else if (zz > second) second = zz; }
    const i = y * w + x;
    if (!best) { shade[i] = q.flat; continue; }
    const nx = (X - best.cx) / best.r, ny = (Y - best.cy) / best.r, nzv = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    shade[i] = clamp((nx * lx + ny * ly + nzv * lz + q.wrap) / (1 + q.wrap));
    occ[i] = second > -1e8 ? 1 - sstep(0, q.creaseW, bz - second) : 0;
  }
  shade = blur(shade, w, h, 2, 1); occ = blur(occ, w, h, 2, 2);
  rub(S, (x, y, i) => {
    const Y = y + oy, below = Y - topAt[x], zone = 1 - sstep(q.zone[0], q.zone[1], below), depth = sstep(q.gradTop, q.base + q.sag * 0.5, Y), n = nz(x + ox, Y) * 0.5 + 0.5;
    const dark = clamp(((1 - shade[i]) * q.shadeK + occ[i] * q.occK) * zone + (1 - zone) * q.bodyK + depth * q.depthK);
    const c = dark < 0.5 ? mixc(pal.mid, pal.lilac, dark / 0.5) : mixc(pal.lilac, pal.deep, (dark - 0.5) / 0.5);
    return [...c, clamp(dark * q.rubA * (0.82 + 0.36 * n) + 0.06)];
  }, q.grain);
  rub(S, (x, y, i) => { const Y = y + oy, below = Y - topAt[x], lit = clamp((shade[i] - 0.6) / 0.4) * (1 - sstep(q.zone[0], q.zone[1], below)) * (1 - sstep(q.gradTop - 30, q.gradTop + 110, Y)); return lit > 0.02 ? [...pal.glow, lit * q.glowA * (0.7 + 0.6 * (nz(x + ox + 300, Y) * 0.5 + 0.5))] : null; }, q.grain);
  const lp = (pts) => pts.map(([x, y]) => [(x - ox) / PPM, (y - oy) / PPM]);
  for (const o of lobes) {
    if (o.r < 16 || R() > 0.75) continue;
    const a0 = -2.5 + R() * 0.5, a1 = a0 + 0.6 + R() * 0.6, rr = o.r * (0.84 + 0.1 * R()), pts = [];
    for (let a = a0; a <= a1; a += 0.05) pts.push([o.cx + Math.cos(a) * rr, o.cy + Math.sin(a) * rr]);
    P.line(lp(pts), { tool: 'pastelpencil', color: q.hi, pressure: 0.28 + 0.22 * R(), tremor: 0.5 });
  }
}

async function clouddeck() {
  const W = 2048, H = 512, C = CLOUD, out = createCanvas(W, H), ctx = out.getContext('2d');
  for (const layer of C.layers) {
    const q = { ...C.common, ...layer }, R = rng(q.seed + ':p'), cl = cloudLobes(q.seed, q);
    const poly = cloudPoly(cl, q);
    const pc = renderPiece({ poly, seed: q.seed, paper: q.paper, tear: q.tear, rim: q.rim, fibres: { cols: [q.rim.col], density: 0.32 }, shadow: q.shadow, relief: 0.045, paint: (P, ox, oy, w, h) => paintCloud(P, ox, oy, w, h, cl, q, R) }, H);
    placePiece(ctx, pc, W, [0]);
  }
  C.puffs.forEach((pf, k) => {
    const q = { ...C.common, ...C.puff, ...pf, seed: 'cloud-puff' + k }, R = rng(q.seed + ':p'), cl = cloudLobes(q.seed, q);
    const pc = renderPiece({ poly: cloudPoly(cl, q), seed: q.seed, paper: q.paper, tear: q.tear, rim: q.rim, fibres: { cols: [q.rim.col], density: 0.32 }, shadow: q.shadow, relief: 0.045, paint: (P, ox, oy, w, h) => paintCloud(P, ox, oy, w, h, cl, q, R) }, H);
    placePiece(ctx, pc, W, [0]);
  });
  return writePng(out, 'clouddeck');
}

const CLOUD = {
  common: { zstep: 6, wrap: 0.6, creaseW: 9, flat: 0.5, zone: [22, 110], bodyK: 0.3, baseStrokes: 30, grain: 0.36, tear: { big: 1.6, mid: 1.4, fine: 0.6 }, wob: 5, r0: 60, rmin: 26 },
  puffs: [{ x0: 300, x1: 520, base: 446, towers: [[400, 80, 372], [470, 50, 392]] }, { x0: 1090, x1: 1260, base: 438, towers: [[1170, 70, 372]] }, { x0: 1560, x1: 1800, base: 444, towers: [[1640, 70, 376], [1730, 60, 386]] }],
  puff: { sag: 2, rmax: 48, r0: 30, rmin: 16, wob: 2, paper: { base: '#f6f1ea', tooth: 0.5, fibre: 0.55 }, rim: { w: 3.6, col: '#fdfbf6', mix: 0.7 }, shadow: { dx: 3, dy: 4, r: 4, a: 0.32, col: '#5a4a72' },
    pal: { mid: '#f1eae6', lilac: '#d3c7dc', deep: '#b0a3c3', glow: '#fce7d6' }, gradTop: 380, shadeK: 0.6, depthK: 0.5, occK: 0.3, rubA: 0.72, glowA: 0.5, arc: '#bfb1cf', hi: '#fffaf2', zone: [12, 50] },
  layers: [
    { seed: 'cloud-back', x0: 70, x1: 1985, base: 432, sag: 10, rmax: 118, towers: [[640, 260, 92], [1330, 230, 128], [1760, 160, 214], [260, 150, 220]],
      paper: { base: '#d8cde2', tooth: 0.5, fibre: 0.55 }, rim: { w: 4.5, col: '#f4eff5', mix: 0.75 }, shadow: null,
      pal: { mid: '#d2c6de', lilac: '#b9abcb', deep: '#9a8bb0', glow: '#f1e0e2' }, gradTop: 150, shadeK: 0.58, depthK: 0.55, occK: 0.32, rubA: 0.72, glowA: 0.4, arc: '#ad9fc2', hi: '#ece4ef' },
    { seed: 'cloud-front', x0: 120, x1: 1930, base: 404, sag: 8, rmax: 104, towers: [[720, 230, 120], [1290, 200, 160], [420, 170, 212], [1700, 170, 236]],
      paper: { base: '#f4eee6', tooth: 0.5, fibre: 0.55 }, rim: { w: 4, col: '#fdfbf6', mix: 0.7 }, shadow: { dx: 3, dy: 5, r: 5, a: 0.3, col: '#5a4a72' },
      pal: { mid: '#efe8e4', lilac: '#d0c4da', deep: '#ab9ebf', glow: '#fce8d8' }, gradTop: 165, shadeK: 0.56, depthK: 0.6, occK: 0.2, rubA: 0.72, glowA: 0.55, arc: '#bfb1cf', hi: '#fffaf2' },
  ],
};

function cottonLobes(seed, S2) {
  const R = rng(seed), k = S2 / 512, lobes = [];
  const add = (x, y, r, z) => lobes.push({ x: x * k, y: y * k, r: r * k, z: z * k, ph: R() * 6.28, bump: 0.04 + 0.05 * R() });
  for (const [x, y, r] of [[150, 322, 84], [252, 318, 106], [356, 326, 88], [196, 244, 80], [306, 236, 86], [252, 196, 70]]) add(x + R.gauss(0, 4), y + R.gauss(0, 4), r * (0.95 + 0.1 * R()), 0);
  const big = lobes.slice();
  for (const L of big) {
    const n = 2 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + R.gauss(0, 0.85), r = (L.r / k) * (0.32 + 0.18 * R()), d = L.r / k - r * (0.2 + 0.3 * R());
      if (Math.sin(a) > 0.25) continue;
      add(L.x / k + Math.cos(a) * d, L.y / k + Math.sin(a) * d, r, 10 + R() * 10);
    }
  }
  for (let i = 0; i < 12; i++) { const a = -Math.PI * (0.08 + 0.84 * R()), host = big[Math.floor(R() * big.length)], r = 14 + R() * 18, d = host.r / k * 0.8; add(host.x / k + Math.cos(a) * d, host.y / k + Math.sin(a) * d, r, 16 + R() * 8); }
  return lobes;
}

function curl(g, x, y, a, len, cv, col, al, wd, R, steps = 7) {
  const pts = [[x, y]];
  for (let t = 0; t < steps; t++) { a += cv / steps + R.gauss(0, 0.16); x += (Math.cos(a) * len) / steps; y += (Math.sin(a) * len) / steps; pts.push([x, y]); }
  g.strokeStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${al.toFixed(3)})`; g.lineWidth = wd;
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) g.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
  g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); g.stroke();
}

async function cotton2() {
  const S2 = 1024, seed = 'cotton2', R = rng(seed), lobes = cottonLobes(seed, S2), N = S2 * S2, C = COTTON;
  const F = new Float32Array(N), own = new Int16Array(N), edgeN = fbm(seed + ':edge', 34, 34, 0, 4), fine = fbm(seed + ':fine', 8, 8, 0, 3), floorY = C.floor * 2;
  for (let y = 0; y < S2; y++) for (let x = 0; x < S2; x++) {
    let f = 0, bo = 0, bv = 0;
    for (let k = 0; k < lobes.length; k++) {
      const L = lobes[k], dx = x - L.x, dy = y - L.y, d2 = dx * dx + dy * dy, s2 = L.r * L.r * C.sig;
      if (d2 > s2 * 9) continue;
      const an = Math.atan2(dy, dx), v = Math.exp(-d2 / (s2 * (1 + L.bump * 2 * Math.sin(an * 4 + L.ph)))) * (1 + L.z / 400);
      f += v; if (v > bv) { bv = v; bo = k; }
    }
    const i = y * S2 + x, fl = 1 - sstep(floorY - 50, floorY + 40, y) * 0.95;
    F[i] = f * fl * (1 + 0.12 * edgeN(x, y)); own[i] = bo;
  }
  const t0 = C.t0, Z = new Float32Array(N);
  for (let i = 0; i < N; i++) Z[i] = Math.sqrt(Math.max(0, F[i] - t0 * 0.6)) * C.zk;
  const zs = blur(Z, S2, S2, 5, 2), zb = blur(Z, S2, S2, 34, 2), Lv = C.light, ll = Math.hypot(...Lv), lx = Lv[0] / ll, ly = Lv[1] / ll, lz = Lv[2] / ll;
  const top = hex(C.top), mid = hex(C.mid), low = hex(C.low), deep = hex(C.deep), glow = hex(C.glow);
  const colAt = (sh) => (sh < 0.35 ? mixc(deep, low, sh / 0.35) : sh < 0.7 ? mixc(low, mid, (sh - 0.35) / 0.35) : mixc(mid, top, (sh - 0.7) / 0.3));
  const body = new Float32Array(N * 4), shadeMap = new Float32Array(N), dens = new Float32Array(N);
  for (let y = 1; y < S2 - 1; y++) for (let x = 1; x < S2 - 1; x++) {
    const i = y * S2 + x;
    const gx = (zs[i + 1] - zs[i - 1]) * 0.5, gy = (zs[i + S2] - zs[i - S2]) * 0.5, nl = Math.hypot(gx, gy, 1), nx = -gx / nl, ny = -gy / nl, nz = 1 / nl;
    let sh = clamp((nx * lx + ny * ly + nz * lz + C.wrap) / (1 + C.wrap));
    const ao = clamp((zb[i] - zs[i]) * C.ao), under = sstep(C.underTop * 2, floorY + 30, y), d = clamp((F[i] - t0 * 0.35) / (t0 * 1.2));
    sh = clamp(sh * (1 - 0.5 * under) - ao * 0.6 + fine(x, y) * 0.05 + (1 - d) * 0.14);
    shadeMap[i] = sh; dens[i] = d;
    const c = mixc(colAt(sh), glow, C.glowA * sstep(0.8, 1, sh) * (1 - under));
    const a = sstep(t0 * 0.55, t0 * 1.05, F[i] + (fine(x, y) - 0.0) * t0 * 0.12);
    body[4 * i] = c[0]; body[4 * i + 1] = c[1]; body[4 * i + 2] = c[2]; body[4 * i + 3] = a * 255;
  }
  const canvas = toCanvas(body, S2, S2), g = canvas.getContext('2d');
  const at = (x, y) => { const xi = clamp(Math.round(x), 0, S2 - 1), yi = clamp(Math.round(y), 0, S2 - 1), i = yi * S2 + xi; return [shadeMap[i], dens[i], own[i], F[i]]; };
  const tang = (x, y, o) => { const L = lobes[o]; return Math.atan2(y - L.y, x - L.x) + (Math.PI / 2) * (R() < 0.5 ? 1 : -1); };
  g.lineCap = 'round';
  for (let k = 0; k < C.inner; k++) {
    const x = 80 + R() * (S2 - 160), y = 80 + R() * (S2 - 160), [sh, d, o, f] = at(x, y);
    if (f < t0 * 1.05) continue;
    const dk = R() < 0.4 ? -0.14 : 0.07;
    curl(g, x, y, tang(x, y, o) + R.gauss(0, 0.7), 8 + R() * 34, R.gauss(0, 1.6), colAt(clamp(sh + dk + R.gauss(0, 0.05))), 0.05 + 0.12 * R(), 0.5 + R() * 0.9, R);
  }
  for (let k = 0; k < C.fuzz; k++) {
    const x = 50 + R() * (S2 - 100), y = 50 + R() * (S2 - 100), [sh, d, o, f] = at(x, y);
    if (f < t0 * 0.3 || f > t0 * 1.3 || R() > 0.25 + d) continue;
    curl(g, x, y, tang(x, y, o) + R.gauss(0, 0.9), 5 + R() * 20, R.gauss(0, 2.4), colAt(clamp(sh + 0.05 + R.gauss(0, 0.05))), 0.05 + 0.14 * R(), 0.4 + R() * 0.7, R, 6);
  }
  for (let k = 0; k < C.strays; k++) {
    const L = lobes[Math.floor(R() * lobes.length)], a0 = -Math.PI * R() * 1.1 + 0.05, r0 = L.r * (0.95 + 0.25 * R()), x = L.x + Math.cos(a0) * r0, y = L.y + Math.sin(a0) * r0, [sh, , , f] = at(x, y);
    if (f > t0 * 0.9 || f < t0 * 0.2 || y > floorY) continue;
    const dir = R() < 0.5 ? 1 : -1;
    curl(g, x, y, a0 + dir * (Math.PI / 2 - 0.3 - 0.4 * R()), 24 + R() * 56, dir * (0.5 + R() * 1.2), colAt(clamp(sh + 0.1)), 0.06 + 0.12 * R(), 0.4 + R() * 0.5, R, 10);
  }
  const out = createCanvas(512, 512), go = out.getContext('2d');
  go.imageSmoothingEnabled = true; go.imageSmoothingQuality = 'high'; go.drawImage(canvas, 0, 0, 512, 512);
  const im = go.getImageData(0, 0, 512, 512), dd = im.data;
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) { const e = Math.min(x, y, 511 - x, 511 - y), f = sstep(2, 20, e); dd[4 * (y * 512 + x) + 3] *= f; }
  go.putImageData(im, 0, 0);
  return writePng(out, 'cotton2');
}

const COTTON = { floor: 388, underTop: 250, sig: 0.42, t0: 0.55, zk: 120, light: [-0.45, -0.85, 0.55], wrap: 0.68, ao: 0.019, top: '#fdf9f2', mid: '#e8e2e7', low: '#bfb7ca', deep: '#9d94ae', glow: '#fdebdc', glowA: 0.35, inner: 70000, fuzz: 160000, strays: 700 };

const JOBS = { dunes1: () => dunes('dunes1'), dunes2: () => dunes('dunes2'), dunes3: () => dunes('dunes3'), seawaves, clouddeck, cotton2 };

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, fn] of Object.entries(JOBS)) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    const t0 = Date.now(); const f = await fn(); console.log(name, ((Date.now() - t0) / 1000).toFixed(1) + 's', f);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
