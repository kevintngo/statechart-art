import * as THREE from 'three';
import { setArms } from './props.js';
import { makeFlame, setFlame, makeSmoke, setSmoke, makeClouds, makeStars, makeGlow, makePlasma, setPlasma, makeVents, ventState } from './effects.js';
import { flightTime, shipTime, tipAt, setOf, shipPitch, shipBase } from './story.js';
import { boosterAt, ringAt, shipAt, armsAt, shipLanding, TIMES, LANDING_BURN } from './flight.js';
import { BOOSTER, MOUNT, R, TOWER, MASTS } from './dims.js';
import { makeSetC, setSetC } from './setc.js';
import { makeThreads, lightThreads, PLAN_ASPECTS } from './thread.js';
import { makeFinale, lightFinale } from './finale.js';
import { makeFlats } from './flats.js';

export function makeFX(W, tex = {}, o = {}) {
  const { scene, booster, ship, M } = W;
  ship.rotation.order = 'ZYX';
  const bFlame = makeFlame(tex, { power: 15000, ref: 3.7 }), sFlame = makeFlame(tex, { power: 11000, ref: 3.2 });
  booster.add(bFlame); ship.add(sFlame);
  const plasma = makePlasma(tex); ship.add(plasma);
  const smoke = makeSmoke(tex); scene.add(smoke);
  const clouds = makeClouds(tex); scene.add(clouds);
  const stars = makeStars(tex); scene.add(stars);
  const ringGlow = makeGlow(tex, '#ffae5e'); ringGlow.scale.set(46, 46, 1); scene.add(ringGlow);
  const setC = o.setC === false ? null : makeSetC(tex, M);
  if (setC) scene.add(setC);
  const threads = makeThreads(tex, o.atlas || null, PLAN_ASPECTS[0]), threadsNarrow = makeThreads(tex, o.atlas || null, PLAN_ASPECTS[1]); scene.add(threads, threadsNarrow);
  const vents = makeVents(tex); scene.add(vents);
  const finale = makeFinale(tex, o.atlas || null, o.chart || null, o.layout || null); scene.add(finale);
  const flats = makeFlats(tex); scene.add(flats);
  const lamps = [-1, 1].map((k) => { const l = makeGlow(tex, '#ffd9a0'); l.scale.set(16, 16, 1); l.position.set(TOWER.x + TOWER.w / 2 + 0.8, TOWER.h - 3, k * (TOWER.w / 2 - 1)); scene.add(l); return l; });
  for (const [x, z] of MASTS.at) { const l = makeGlow(tex, '#ffe6bd'); l.scale.set(13, 13, 1); const d = Math.hypot(x, z); l.position.set(x - (x / d) * 0.9, MASTS.h + 0.55, z - (z / d) * 0.9); scene.add(l); lamps.push(l); }
  return { bFlame, sFlame, plasma, smoke, clouds, stars, ringGlow, setC, threads, threadsNarrow, vents, lamps, finale, flats, smokeTint: new THREE.Color() };
}

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export function flameLength(b, T) {
  const baseY = b.base[1], over = Math.hypot(b.base[0], b.base[2]) < MOUNT.rout + 12, k = over ? ease((baseY - (MOUNT.top + 2)) / 6) : 0, floor = 1 + (MOUNT.top + 0.2) * k, room = (baseY - floor) / Math.max(0.3, Math.cos(b.phi));
  if (T < TIMES.MECO && T >= TIMES.IGNITE) { const grow = Math.min(1, (T - TIMES.IGNITE) / 3); return { r: 3.7, l: Math.min(34 + Math.min(40, T * 0.3), room) * (0.35 + 0.65 * grow) }; }
  if (b.boost) return { r: 2.8, l: 30 };
  if (b.centre && T >= TIMES.MECO) return { r: 1.25, l: 15 };
  if (b.landing && b.burn) { const k = ease((T - LANDING_BURN - 3.6) / 0.8); return { r: 2.8 - 1.55 * k, l: Math.min(26 - 8 * k, room) }; }
  return { r: 0, l: 0 };
}

export function applyPose(W, FX, s, step = 0, o = {}) {
  const { booster, ship, tower, M } = W;
  const T = flightTime(s), set = setOf(s), b = boosterAt(T);
  if (FX.setC) FX.setC.visible = set === 'C';
  for (const m of [W.backdrop, W.ground, W.sea, FX.stars, FX.clouds]) m.visible = set === 'A';
  for (const m of FX.flats.children) m.visible = (m.userData.flat.set || 'A') === set;
  booster.position.set(...b.base); booster.rotation.set(0, 0, -b.phi);
  const rg = ringAt(T);
  W.ring.position.set(...rg.base); W.ring.rotation.set(0, 0, -rg.phi); W.ring.visible = set === 'A' && s < 8.7;
  const bf = flameLength(b, T);
  setFlame(FX.bFlame, set === 'A' && bf.l > 0, bf.r, bf.l, step, 1);
  if (T < TIMES.SEP) FX.bFlame.userData.light.intensity *= Math.max(0, Math.min(1, (120 - b.base[1]) / 50));
  const glow = T < TIMES.MECO + 0.4 ? 0 : T < TIMES.SEP ? Math.min(1, (T - TIMES.MECO - 0.4) / 1) : Math.max(0, 1 - (T - TIMES.SEP) / 3);
  M.ring.emissiveIntensity = glow * 2.6;
  M.frost.opacity = Math.max(0, Math.min(0.92, 0.92 * (1 - (T - 4) / 26)));
  FX.ringGlow.position.set(...b.base).add(new THREE.Vector3(Math.sin(b.phi), Math.cos(b.phi), 0).multiplyScalar(BOOSTER.body + 1));
  FX.ringGlow.material.opacity = glow * 0.85;
  let shipInfo;
  if (set === 'A') {
    const sp = shipAt(T), gap = T < TIMES.SEP ? 0 : Math.hypot(sp.base[0] - b.base[0] - Math.sin(b.phi) * BOOSTER.height, sp.base[1] - b.base[1] - Math.cos(b.phi) * BOOSTER.height);
    ship.position.set(...sp.base); ship.rotation.set(0, -Math.PI / 2, -sp.phi);
    setFlame(FX.sFlame, sp.burn && T < TIMES.SEP + 30, 3.2, Math.min(34, 6 + gap), step, 2);
    setPlasma(FX.plasma, 0, step);
    if (FX.setC) setSetC(FX.setC, false, step, 0, new THREE.Vector3());
    shipInfo = { set, attached: T < TIMES.SEP };
  } else {
    const L = shipLanding(shipTime(s)), tip = tipAt(s), pe = shipPitch(L, tip), base = shipBase(L, tip);
    ship.position.copy(base); ship.rotation.set(0, -Math.PI / 2, pe);
    setFlame(FX.sFlame, L.burn, 2.2, Math.min(18, Math.max(0, base.y - 0.6)), step, 3);
    setPlasma(FX.plasma, L.glow, step);
    if (FX.setC) {
      const splash = Math.max(0, s - 10.98), nose = base.clone().add(new THREE.Vector3(-Math.sin(pe), Math.cos(pe), 0).multiplyScalar(44));
      setSetC(FX.setC, true, step, splash, tip > 0.6 ? nose : base);
    }
    shipInfo = { set, L, tip };
  }
  const arms = armsAt(T);
  setArms(tower, arms.y, arms.open);
  FX.smokeTint.set('#f3e6dc').lerp(new THREE.Color('#ffd2a6'), Math.min(1, Math.max(0, 1 - (T - 10) / 30)));
  setSmoke(FX.smoke, T, FX.smokeTint);
  FX.smoke.visible = set === 'A';
  FX.threads.visible = !o.narrow; FX.threadsNarrow.visible = !!o.narrow;
  lightThreads(o.narrow ? FX.threadsNarrow : FX.threads, s);
  lightFinale(FX.finale, s);
  const venting = Math.max(0, Math.min(1, (TIMES.IGNITE - 2 - T) / 4)), now = o.now ?? 0;
  FX.vents.visible = set === 'A' && venting > 0;
  for (const p of FX.vents.userData.puffs) { const st = ventState(p, now, R); p.s.position.set(st.x + b.base[0], st.y + MOUNT.top, st.z); p.s.scale.set(st.r * 3.1, st.r * 2.0, 1); p.s.material.opacity = st.opacity * venting; }
  for (const l of FX.lamps) { l.material.opacity = (o.flood ?? 0) * (0.85 + 0.15 * Math.sin(now / 400)); l.visible = set === 'A' && l.material.opacity > 0.01; }
  W.scene.updateMatrixWorld(true);
  return { T, set, b, arms, ship: shipInfo };
}
