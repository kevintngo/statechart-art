import * as THREE from 'three';
import { monotone, boosterAt, shipAt, armsAt, shipLanding, SHIP_SET, SHIP_BURN } from './flight.js';
import { BOOSTER, SHIP, CATCH } from './dims.js';
import { FIN, FINALE_VIEW, RIGHT } from './finale.js';

export const STATIONS = [
  { key: 'filling', booster: 'Filling with propellant', ship: 'Riding on top', tower: 'Arms open, waiting', step: '', title: 'Filling with propellant', text: 'Before dawn, super cold liquid oxygen and methane pour into the tanks, and frost blooms on the steel. On the tower, the arms wait, open.' },
  { key: 'liftoff', booster: 'Lifting off', step: 'the count reaches zero', title: 'Lifting off', text: 'Thirty-three engines light. The clamps let go, and the stack climbs past the tower on a column of fire.' },
  { key: 'maxq', booster: 'Through max Q', step: 'the air presses hardest', title: 'Through max Q', text: 'About a minute up, the air pushes back hardest. The engines throttle down, and the stack keeps climbing.' },
  { key: 'staging', booster: 'Hot staging', ship: 'Engines lit while attached', step: 'most of the booster’s engines cut off', title: 'Hot staging', text: 'All but three of the booster’s engines cut off. The ship lights its own six while still attached, and their fire blasts out through the vented ring between the two.' },
  { key: 'boostback', booster: 'Flipping, burning back', ship: 'Flying on to space', step: 'the ship pulls away', title: 'Flipping, burning back', text: 'The ship climbs on toward space. The booster flips around and lights ten more engines to head home.' },
  { key: 'falling', booster: 'Falling home', step: 'every check passes: go for catch', title: 'Falling home', text: 'Before the burn ends, every check on the booster and the tower passes, so the call is go. The booster drops the vented ring and falls back toward the tower, steering with its grid fins.' },
  { key: 'landing', booster: 'Slowing over the tower', step: 'the landing burn starts', title: 'Slowing over the tower', text: 'Near the ground, thirteen engines light, then only the middle three keep firing. The booster slows almost to a stop and slides in between the open arms.' },
  { key: 'closing', tower: 'Arms closing', step: 'the arms close', title: 'Arms closing', text: 'The arms swing in around the booster’s body, just below the pins it will rest on.' },
  { key: 'caught', booster: 'Caught by the arms', tower: 'Holding the booster', step: 'the arms catch it', title: 'Caught', text: 'The booster settles onto the arms, and its engines go quiet. Caught, seven minutes after it left, just after sunrise.' },
  { key: 'reentry', ship: 'Falling back, glowing', step: 'falls back into the air', title: 'Falling back, glowing', text: 'Far away, about forty minutes later, the ship falls back into the air belly first. Its black tiles take the heat, and the air around it glows pink.' },
  { key: 'flip', ship: 'Flipping upright', step: 'flips and lights its engines', title: 'Flipping upright', text: 'Close to the water, it swings upright and lights its engines to slow down.' },
  { key: 'splash', ship: 'Splashed down', step: 'touches the water', title: 'Splashed down', text: 'It slows almost to a hover, sets down on the ocean, then tips over onto its side.' },
  { key: 'checked', step: '', title: 'What TLC checked', text: '' },
];
let last = { booster: '', ship: '', tower: '' };
for (const st of STATIONS) { last = { booster: st.booster || last.booster, ship: st.ship || last.ship, tower: st.tower || last.tower }; Object.assign(st, { regions: { ...last } }); }

const KS = [0, 0.4, 0.62, 0.8, 1.0, 1.4, 2.0, 2.4, 3.0, 3.4, 4.0, 4.4, 5.0, 5.4, 6.0, 6.4, 7.0, 7.4, 7.6, 8.0, 8.4];
const KT = [-30, -8, -1.2, 3, 14, 20, 58, 66, 150.6, 153.5, 163, 168, 184, 188, 200, 205.3, 213.2, 213.9, 214.4, 216.2, 219];
export const flightTime = monotone(KS, KT);
const smooth0 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
function fallClock(s0, s1, blend = 0.05) {
  const n = 4000, cum = [0], C = (u) => { const L = shipLanding(u); return [L.base[0] - Math.sin(L.pitch) * SHIP.centre, L.base[1] + Math.cos(L.pitch) * SHIP.centre]; };
  let prev = C(0);
  for (let i = 1; i <= n; i++) { const q = C(i / n); cum.push(cum[i - 1] + Math.hypot(q[0] - prev[0], q[1] - prev[1])); prev = q; }
  const lenAt = (u) => { const f = u * n, i = Math.min(n - 1, Math.floor(f)); return cum[i] + (cum[i + 1] - cum[i]) * (f - i); };
  const uAt = (L) => { let lo = 0, hi = n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= L) lo = m; else hi = m; } return (lo + (L - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo])) / n; };
  const L1 = lenAt(SHIP_BURN), L2 = lenAt(0.995) - L1, sb = (s1 * L1 + 2 * s0 * L2) / (L1 + 2 * L2), V1 = L1 / (sb - s0), V2 = (2 * L2) / (s1 - sb);
  const v = (s) => { const w = smooth0((s - (sb - blend)) / (2 * blend)); return V1 * (1 - w) + V2 * Math.max(0, (s1 - s) / (s1 - sb)) * w; };
  const ds = 0.0005, tab = [];
  let acc = 0;
  for (let s = s0; s <= s1 + 1e-9; s += ds) { tab.push(acc); acc += v(s + ds / 2) * ds; }
  const scale = lenAt(0.995) / acc;
  return (s) => {
    if (s <= s0) return 0;
    if (s >= s1) return 0.995 + 0.005 * smooth0((s - s1) / 0.4);
    const f = (s - s0) / ds, i = Math.min(tab.length - 2, Math.floor(f));
    return uAt((tab[i] + (tab[i + 1] - tab[i]) * (f - i)) * scale);
  };
}
const shipClock = fallClock(8.0, 11.0);
export const tipAt = (s) => { const t = Math.min(1, Math.max(0, (s - 11.4) / 0.55)); return t * t * (3 - 2 * t); };
export const shipTime = (s) => shipClock(s);

export const SET_CUTS = [8.7, 11.7];
export const setOf = (s) => (s >= SET_CUTS[0] && s < SET_CUTS[1] ? 'C' : 'A');

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const centre = (p) => { const a = p.phi; return V(p.base[0] + Math.sin(a) * BOOSTER.centre, p.base[1] + Math.cos(a) * BOOSTER.centre, 0); };

function shot(i, s) {
  const T = flightTime(s), b = boosterAt(T);
  const stackMid = () => { const a = b.phi; return V(b.base[0] + Math.sin(a) * 60, b.base[1] + Math.cos(a) * 60, 0); };
  switch (i) {
    case 0: return { target: V(-10, 74, 0), dist: 330, yaw: 0.14, pitch: 0.06, fov: 34 };
    case 1: return { target: V(-4, Math.max(64, b.base[1] + 44), 0), dist: 255, yaw: 0.16, pitch: -0.06, fov: 40 };
    case 2: return { target: stackMid(), dist: 230, yaw: 0.2, pitch: 0.02, fov: 38 };
    case 3: { const top = V(b.base[0] + Math.sin(b.phi) * (BOOSTER.height + 6), b.base[1] + Math.cos(b.phi) * (BOOSTER.height + 6), 0); return { target: top, dist: 165, yaw: 0.5, pitch: 0.02, fov: 36 }; }
    case 4: return { target: centre(b).add(V(20, 40, 0)), dist: 330, yaw: 0.28, pitch: 0.04, fov: 38 };
    case 5: return { target: centre(b), dist: 250, yaw: -0.2, pitch: 0.16, fov: 38 };
    case 6: return { target: V(b.base[0] * 0.6, Math.max(70, b.base[1] + 20), 0), dist: 240, yaw: -0.5, pitch: 0.06, fov: 38 };
    case 7: return { target: V(-4, CATCH.armTop - 2, 0), dist: 120, yaw: -0.78, pitch: 0.2, fov: 38 };
    case 8: return { target: V(-10, 78, 0), dist: 230, yaw: -0.5, pitch: 0.08, fov: 36 };
    case 9: case 10: case 11: {
      const L = shipLanding(shipTime(s)), c = shipCentre(L, tipAt(s));
      return { target: c.clone().add(V(0, i === 11 ? 6 : 0, 0)), dist: i === 9 ? 230 : i === 10 ? 170 : 150, yaw: i === 11 ? 0.32 : 0.18, pitch: i === 11 ? 0.12 : 0.04, fov: 38 };
    }
    default: return { target: FINALE_VIEW.target.clone(), dist: FINALE_VIEW.dist, yaw: FINALE_VIEW.yaw, pitch: FINALE_VIEW.pitch, fov: 36 };
  }
}

export const FLOAT = 0.25;
export const shipPitch = (L, tip = 0) => L.pitch - tip * (Math.PI / 2);
export function shipBase(L, tip = 0) { return V(L.base[0], L.base[1] + FLOAT * tip, L.base[2]); }
export function shipCentre(L, tip = 0) {
  const pe = shipPitch(L, tip), b = shipBase(L, tip);
  return b.add(V(-Math.sin(pe), Math.cos(pe), 0).multiplyScalar(SHIP.centre));
}

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export function cameraAt(s) {
  const i = Math.min(STATIONS.length - 1, Math.max(0, Math.floor(s))), f = s - i;
  const a = shot(i, s);
  const cut = SET_CUTS.some((c) => Math.floor(c) === i);
  if (f <= 0.4 || i === STATIONS.length - 1) return a;
  if (cut) return s < i + 0.7 ? a : shot(i + 1, s);
  const b = shot(i + 1, s), w = smooth((f - 0.4) / 0.6);
  return { target: a.target.clone().lerp(b.target, w), dist: a.dist + (b.dist - a.dist) * w, yaw: a.yaw + (b.yaw - a.yaw) * w, pitch: a.pitch + (b.pitch - a.pitch) * w, fov: a.fov + (b.fov - a.fov) * w };
}

export const NARROW = 1.15, WIDEST = 2.4;
export const viewOffset = (aspect) => (aspect > NARROW ? [-0.12, 0] : [0, 0.2]);
export function viewScale(aspect) { const k = Math.sqrt(1.6 / aspect); return aspect > NARROW ? Math.min(2.1, Math.max(1, k)) : Math.min(2.4, 1.15 * k); }
export function cameraPose(s, aspect) {
  const c = cameraAt(s);
  let k = viewScale(aspect);
  if (aspect < 1 && s >= SET_CUTS[1]) { c.target.addScaledVector(RIGHT, 32); k = Math.max(k, 2.25); }
  const position = c.target.clone().add(V(Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), Math.cos(c.yaw) * Math.cos(c.pitch)).multiplyScalar(c.dist * k));
  if (position.y < 4) position.y = 4;
  const fov = aspect > WIDEST ? (360 / Math.PI) * Math.atan(Math.tan((c.fov * Math.PI) / 360) * (WIDEST / aspect)) : c.fov;
  return { position, target: c.target, fov, k };
}

const LIGHT_S = [0, 1, 2, 3, 4, 5, 6, 7, 8, 8.69, 8.71, 11.69, 11.71, 12];
const lk = (vals) => monotone(LIGHT_S, vals);
const SUN = lk([0.35, 0.7, 2.0, 2.6, 2.6, 2.4, 2.3, 2.6, 2.7, 2.7, 0.45, 0.45, 2.3, 2.3]);
const HEMI = lk([0.8, 0.85, 1.0, 1.05, 1.05, 1.05, 1.05, 1.1, 1.15, 1.15, 0.5, 0.5, 1.1, 1.1]);
const FLOOD = lk([1, 1, 0.8, 0.7, 0.6, 0.5, 0.45, 0.3, 0.2, 0.2, 0, 0, 0.15, 0.15]);
const NIGHT = lk([0.8, 0.72, 0.55, 0.45, 0.4, 0.32, 0.22, 0.12, 0.06, 0.06, 1, 1, 0.1, 0.1]);
export function lightsAt(s) { return { sun: SUN(s), hemi: HEMI(s), flood: FLOOD(s), night: Math.min(1, Math.max(0, NIGHT(s))) }; }
export { SHIP_SET };
