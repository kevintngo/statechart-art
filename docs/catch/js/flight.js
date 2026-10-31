import { BOOSTER, SHIP, MOUNT, CATCH, ARMS } from './dims.js';

export function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (xs[i + 1] - xs[i - 1])) / ((2 * xs[i + 1] - xs[i] - xs[i - 1]) / d[i - 1] + (xs[i + 1] + xs[i] - 2 * xs[i - 1]) / d[i]);
  return (x) => {
    if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]) * 0;
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

const HOLD = 3, MECO = 149, SEP = 151, FLIP = [153, 161], BOOST = [161, 172], TURN = [172, 182], DROP = 173, HOVER = 212, SETTLE = [214.6, 216], CUT = 215.8;
export const TIMES = { HOLD, MECO, SEP, FLIP, BOOST, DROP, TURN, HOVER, SETTLE, CUT, IGNITE: -1.2 };
const G = 1.2, SHIP_A = 7, CENTRE_A = 0.33, BOOST_A = 1.45, RING_PUSH = 2.4, RING_SPIN = 0.3, RING_DRAG = 0.15, DOWNRANGE = 400;

export const stackBase = (T) => {
  const t = Math.max(0, T - HOLD) / (150 - HOLD);
  return [DOWNRANGE * Math.pow(t, 3.4), MOUNT.top + 880 * Math.pow(t, 2.2), 0];
};
export const stackVel = (T) => { const e = 0.01, a = stackBase(T - e), b = stackBase(T + e); return [(b[0] - a[0]) / (2 * e), (b[1] - a[1]) / (2 * e), 0]; };
export const tiltOf = (v) => (Math.hypot(v[0], v[1]) < 1e-6 ? 0 : Math.atan2(v[0], v[1]));

const axis = (phi) => [Math.sin(phi), Math.cos(phi), 0];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

const lerpAngle = (a, b, t) => a + (b - a) * t;
const LEAN = 0.34, lean = (v) => LEAN * Math.tanh(Math.atan2(-v[0], -v[1]) / LEAN);
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function simulateBooster() {
  const out = [], dt = 0.05, phi0 = tiltOf(stackVel(SEP));
  let p = add(stackBase(SEP), axis(phi0), BOOSTER.centre), v = stackVel(SEP);
  for (let T = SEP; T <= TURN[1] + 1e-9; T += dt) {
    let phi = phi0;
    if (T > FLIP[0]) phi = lerpAngle(phi0, -Math.PI / 2, ease((T - FLIP[0]) / (FLIP[1] - FLIP[0])));
    if (T > TURN[0]) phi = lerpAngle(-Math.PI / 2, lean(v), ease((T - TURN[0]) / (TURN[1] - TURN[0])));
    const boost = T > BOOST[0] && T < BOOST[1], centre = T <= BOOST[0], k = boost ? BOOST_A : centre ? CENTRE_A : 0, d = axis(phi);
    out.push({ T, p: [...p], v: [...v], phi, boost, centre });
    v = [v[0] + d[0] * k * dt, v[1] + (d[1] * k - G) * dt, 0];
    p = add(p, v, dt);
  }
  return out;
}
const SIM = simulateBooster();
const END = SIM[SIM.length - 1];
const HOVER_CM = [0, CATCH.hover + BOOSTER.centre, 0];

function solveBurn() {
  const E = END, cmE = E.p, H = HOVER_CM[1];
  const fall = (T) => { const d = T - E.T; return { y: cmE[1] + E.v[1] * d - 0.5 * G * d * d, v: E.v[1] - G * d }; };
  const err = (Tl) => { const { y, v } = fall(Tl); return (HOVER - Tl) - (2 * (y - H)) / Math.abs(v); };
  let lo = E.T + 1, hi = HOVER - 1;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (err(lo) * err(mid) <= 0) hi = mid; else lo = mid; }
  const Tl = (lo + hi) / 2, { y, v } = fall(Tl);
  return { Tl, yl: y, vl: v, a: (v * v) / (2 * (y - H)), fall };
}
const BURN = solveBurn();
export const LANDING_BURN = BURN.Tl;

function approach(T) {
  const D = HOVER - END.T, t = Math.min(1, Math.max(0, (T - END.T) / D)), t2 = t * t, t3 = t2 * t, t4 = t3 * t, t5 = t4 * t;
  const x = (1 - 10 * t3 + 15 * t4 - 6 * t5) * END.p[0] + (t - 6 * t3 + 8 * t4 - 3 * t5) * END.v[0] * D;
  const vx = ((-30 * t2 + 60 * t3 - 30 * t4) * END.p[0] + (1 - 18 * t2 + 32 * t3 - 15 * t4) * END.v[0] * D) / D;
  let y, vy;
  if (T < BURN.Tl) { const f = BURN.fall(T); y = f.y; vy = f.v; }
  else { const r = HOVER - T; y = HOVER_CM[1] + 0.5 * BURN.a * r * r; vy = -BURN.a * r; }
  return { p: [x, y, 0], v: [vx, vy, 0] };
}

function fallAttitude(T) { return lean(approach(T).v); }
const BURN_PHI = fallAttitude(BURN.Tl);
function attitude(T) {
  if (T < BURN.Tl) return fallAttitude(T);
  return BURN_PHI * (1 - ease((T - BURN.Tl) / (HOVER - BURN.Tl)));
}

export function boosterAt(T) {
  if (T < SEP) {
    const base = stackBase(T), phi = tiltOf(stackVel(Math.max(T, HOLD + 0.01)));
    return { base, phi: T < HOLD ? 0 : phi, burn: T >= TIMES.IGNITE && T < MECO, centre: T >= MECO, attached: true };
  }
  if (T <= END.T) {
    const i = Math.min(SIM.length - 2, Math.floor((T - SEP) / 0.05)), A = SIM[i], B = SIM[i + 1], f = (T - A.T) / (B.T - A.T);
    const p = A.p.map((c, k) => c + (B.p[k] - c) * f), phi = A.phi + (B.phi - A.phi) * f;
    return { base: add(p, axis(phi), -BOOSTER.centre), phi, burn: A.boost || A.centre, boost: A.boost, centre: A.centre };
  }
  if (T < HOVER) {
    const { p } = approach(T), phi = attitude(T);
    return { base: add(p, axis(phi), -BOOSTER.centre), phi, burn: T >= BURN.Tl, landing: true };
  }
  const settle = ease((T - SETTLE[0]) / (SETTLE[1] - SETTLE[0]));
  const y = CATCH.hover - (CATCH.hover - CATCH.base) * settle;
  return { base: [0, y, 0], phi: 0, burn: T < CUT, landing: true, hover: true };
}

const RING0 = (() => {
  const e = 0.01, a = boosterAt(DROP - e), b = boosterAt(DROP + e), top = (q) => add(add(q.base, axis(q.phi), BOOSTER.body), axis(q.phi), BOOSTER.ring / 2), pa = top(a), pb = top(b), mid = boosterAt(DROP), d = axis(mid.phi);
  return { p: top(mid), v: add([(pb[0] - pa[0]) / (2 * e), (pb[1] - pa[1]) / (2 * e), 0], d, RING_PUSH), phi: mid.phi, spin: (b.phi - a.phi) / (2 * e) };
})();
export function ringAt(T) {
  if (T < DROP) { const b = boosterAt(T); return { base: add(b.base, axis(b.phi), BOOSTER.body), phi: b.phi, free: false }; }
  const dt = T - DROP, phi = RING0.phi + (RING0.spin + RING_SPIN) * dt, k = RING_DRAG, e = (1 - Math.exp(-k * dt)) / k, vt = -G / k;
  const c = [RING0.p[0] + RING0.v[0] * e, RING0.p[1] + vt * dt + (RING0.v[1] - vt) * e, 0];
  return { base: add(c, axis(phi), -BOOSTER.ring / 2), phi, free: true, centre: c };
}

export function shipAt(T) {
  if (T < SEP) {
    const b = boosterAt(T);
    return { base: add(b.base, axis(b.phi), BOOSTER.height), phi: b.phi, burn: T > MECO + 0.4, attached: true };
  }
  const b0 = boosterAt(SEP), dir = axis(b0.phi), start = add(b0.base, dir, BOOSTER.height), v0 = Math.hypot(...stackVel(SEP)), dt = T - SEP;
  return { base: add(start, dir, v0 * dt + 0.5 * SHIP_A * dt * dt), phi: b0.phi, burn: true };
}

export function armsAt(T) {
  const close = ease((T - (HOVER + 0.6)) / 1.8), ready = ease((T - (HOVER - 40)) / 20);
  const park = 108, y = park + (CATCH.carriage - park) * ready;
  return { y, open: (ARMS.park + (1 - ARMS.park) * ready) * (1 - close) };
}

export const SHIP_SET = [6000, 0, 0];
export const SHIP_TOUCH = 1.8, SHIP_BURN = 0.42;
export function shipLanding(t) {
  const x0 = SHIP_SET[0], P = [
    [-238, 300], [-128, 205], [-38, 118], [-4, 76], [0, 47], [0, SHIP_TOUCH + SHIP.centre],
  ];
  const ts = [0, 0.18, 0.4, 0.58, 0.78, 1];
  const fx = monotone(ts, P.map((p) => p[0])), fy = monotone(ts, P.map((p) => p[1]));
  const u = Math.min(1, Math.max(0, t));
  const flip = ease((u - SHIP_BURN + 0.05) / 0.22), pitch = -Math.PI / 2 + flip * (Math.PI / 2), a = flip * (Math.PI / 2);
  return { base: [x0 + fx(u) - SHIP.centre * Math.cos(a), fy(u) - SHIP.centre * Math.sin(a), 0], pitch, flip, glow: 1 - ease((u - 0.23) / 0.13), burn: u > SHIP_BURN && u < 0.995 };
}
