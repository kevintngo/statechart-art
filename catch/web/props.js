import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, BOOSTER, SHIP, MOUNT, TOWER, ARMS, CARRIAGE, SHORE, WORLD, MASTS, shoreX } from './dims.js';

export const INK = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color('#2b1f1a') }, uWidth: { value: 1.6 }, uRes: { value: new THREE.Vector2(1280, 800) }, uStep: { value: 0 } },
  vertexShader: `
    uniform float uWidth; uniform vec2 uRes; uniform float uStep;
    float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719)) + uStep * 3.17) * 43758.5453); }
    void main() {
      vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(mat3(projectionMatrix) * (normalMatrix * normal));
      float w = uWidth * (0.75 + 0.5 * h(floor(position * 0.6)));
      c.xy += normalize(n.xy + 1e-5) * w * c.w * 2.0 / uRes;
      gl_Position = c;
    }`,
  fragmentShader: 'uniform vec3 uColor; void main() { gl_FragColor = vec4(uColor, 1.0); }',
  side: THREE.BackSide,
});

export function materials(tex = {}) {
  const std = (map, o = {}) => new THREE.MeshStandardMaterial({ map: tex[map] || null, roughness: 0.9, metalness: 0, ...o });
  return {
    booster: std('booster', { roughness: 0.72, metalness: 0.1 }),
    ship: std('ship', { roughness: 0.72, metalness: 0.1 }),
    nose: std('nose', { roughness: 0.72, metalness: 0.1 }),
    ring: std('hotring', { roughness: 0.72, metalness: 0.1, emissive: new THREE.Color('#ff8a3c'), emissiveMap: tex.hotvents || null, emissiveIntensity: 0, side: THREE.DoubleSide }),
    shield: std('card', { color: new THREE.Color('#57595e'), side: THREE.DoubleSide }),
    dark: std('card', { color: new THREE.Color('#6a6c70') }),
    bell: std('card', { color: new THREE.Color('#4a4b4f'), side: THREE.DoubleSide, emissive: new THREE.Color('#ff9b52'), emissiveIntensity: 0 }),
    card: std('card'),
    fin: tex.gridfin ? new THREE.MeshStandardMaterial({ map: tex.gridfin, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }) : std('card', { color: new THREE.Color('#8a8c90') }),
    truss: tex.truss ? new THREE.MeshStandardMaterial({ map: tex.truss, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 }) : std('card'),
    balsa: std('balsa'),
    paper: std(null, { color: new THREE.Color('#efe9dc') }),
    ground: std('ground', { roughness: 1 }),
    sea: std('sea', { roughness: 0.8 }),
    sky: new THREE.MeshBasicMaterial({ map: tex.sky || null, fog: false }),
    frost: new THREE.MeshStandardMaterial({ map: tex.frost || null, transparent: true, opacity: 0, depthWrite: false, roughness: 0.6, color: new THREE.Color('#ffffff'), polygonOffset: true, polygonOffsetFactor: -2 }),
  };
}

function inked(mesh, width = 1) {
  const g = mergeVertices(mesh.geometry.clone().deleteAttribute('uv').deleteAttribute('normal'), 1e-3);
  g.computeVertexNormals();
  const ink = new THREE.Mesh(g, INK);
  ink.userData.ink = width;
  ink.renderOrder = -1;
  mesh.add(ink);
  return mesh;
}

const mesh = (geo, mat, o = {}) => { const m = new THREE.Mesh(geo, mat); m.castShadow = o.cast !== false; m.receiveShadow = o.receive !== false; if (o.ink) inked(m, o.ink); return m; };

function bell(r, len) {
  const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(r * (0.38 + 0.62 * Math.pow(t, 0.7)), -len * t)); }
  return new THREE.LatheGeometry(pts, 20);
}

function engines(group, list, mat) {
  const out = [];
  for (const [n, rad, br, bl, off = 0] of list) for (let i = 0; i < n; i++) {
    const a = off + (i / n) * Math.PI * 2, m = mesh(bell(br, bl), mat, { cast: false });
    m.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
    group.add(m); out.push({ m, rad, br, bl });
  }
  return out;
}

export function makeBooster(M) {
  const g = new THREE.Group(); g.name = 'booster';
  const body = mesh(new THREE.CylinderGeometry(R, R, BOOSTER.body, 72, 1, true), M.booster, { ink: 1 });
  body.position.y = BOOSTER.body / 2; g.add(body);
  const top = mesh(new THREE.CircleGeometry(R, 72), M.dark); top.rotation.x = -Math.PI / 2; top.position.y = BOOSTER.body; g.add(top);
  const base = mesh(new THREE.CircleGeometry(R, 72), M.dark); base.rotation.x = Math.PI / 2; base.position.y = 0; g.add(base);
  const bells = engines(g, BOOSTER.engines, M.bell);
  const F = BOOSTER.fins, fins = [];
  for (const a of F.angles) {
    const f = mesh(new THREE.BoxGeometry(F.radial, F.thick, F.tall), [M.dark, M.dark, M.fin, M.fin, M.dark, M.dark], { ink: 0.8 }), r = (a * Math.PI) / 180;
    f.position.set(Math.cos(r) * (R + F.radial / 2), F.y, Math.sin(r) * (R + F.radial / 2)); f.rotation.y = -r; g.add(f); fins.push(f);
  }
  const frost = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.07, R + 0.07, 46, 72, 1, true), M.frost);
  frost.position.y = 4 + 23; frost.renderOrder = 2; frost.name = 'frost'; g.add(frost);
  const P = BOOSTER.pins, pins = [];
  for (const s of [1, -1]) {
    const p = mesh(new THREE.BoxGeometry(P.wide, P.tall, P.out), M.dark, { ink: 0.8 });
    p.position.set(0, P.y, s * (R + P.out / 2)); g.add(p); pins.push(p);
  }
  g.userData = { bells, fins, pins, frost };
  return g;
}

export const SHIELD = 0.2;
export function makeHotRing(M) {
  const g = new THREE.Group(); g.name = 'hotring';
  const band = mesh(new THREE.CylinderGeometry(R, R, BOOSTER.ring, 72, 1, true), M.ring, { ink: 1 });
  band.position.y = BOOSTER.ring / 2; band.name = 'band'; g.add(band);
  const rs = (R * R + SHIELD * SHIELD) / (2 * SHIELD), th = Math.asin((R - 0.02) / rs);
  const cap = mesh(new THREE.SphereGeometry(rs, 64, 3, 0, Math.PI * 2, 0, th), M.shield);
  cap.position.y = -rs * Math.cos(th); cap.name = 'shield'; g.add(cap);
  return g;
}

export function noseRadius(y) { const t = Math.min(1, Math.max(0, (y - SHIP.body) / SHIP.nose)); return R * Math.pow(Math.max(0, 1 - Math.pow(t, 1.9)), 0.5); }

function flap(spec, side, M, follow) {
  const s = new THREE.Shape(), root = [];
  for (let i = 0; i <= 12; i++) { const y = spec.y0 + ((spec.y1 - spec.y0) * i) / 12; root.push([follow ? noseRadius(y) - 0.04 : R - 0.04, y]); }
  const tip0 = spec.y0 + (spec.root - spec.tip) * 0.35, tip1 = tip0 + spec.tip;
  s.moveTo(root[0][0], root[0][1]); s.lineTo(R + spec.out, tip0); s.lineTo(R + spec.out, tip1);
  for (let i = root.length - 1; i >= 0; i--) s.lineTo(root[i][0], root[i][1]);
  const geo = new THREE.ExtrudeGeometry(s, { depth: spec.thick, bevelEnabled: false });
  geo.translate(0, 0, -spec.thick / 2);
  const m = mesh(geo, M.card, { ink: 0.8 });
  m.rotation.y = side > 0 ? 0 : Math.PI;
  return m;
}

export function makeShip(M) {
  const g = new THREE.Group(); g.name = 'ship';
  const body = mesh(new THREE.CylinderGeometry(R, R, SHIP.body, 72, 1, true), M.ship, { ink: 1 });
  body.position.y = SHIP.body / 2; g.add(body);
  const pts = []; for (let i = 0; i <= 24; i++) { const y = SHIP.body + (SHIP.nose * i) / 24; pts.push(new THREE.Vector2(Math.max(0.0001, noseRadius(y)), y)); }
  const nose = mesh(new THREE.LatheGeometry(pts, 72), M.nose, { ink: 1 }); g.add(nose);
  const base = mesh(new THREE.CircleGeometry(R, 72), M.dark); base.rotation.x = Math.PI / 2; g.add(base);
  const bells = engines(g, SHIP.engines, M.bell);
  const frost = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.07, R + 0.07, 22, 72, 1, true), M.frost);
  frost.position.y = 3 + 11; frost.renderOrder = 2; frost.name = 'frost'; g.add(frost);
  const flaps = [flap(SHIP.aft, 1, M, false), flap(SHIP.aft, -1, M, false), flap(SHIP.fwd, 1, M, true), flap(SHIP.fwd, -1, M, true)];
  flaps.forEach((f) => g.add(f));
  g.userData = { bells, flaps, frost };
  return g;
}

export function makeMount(M) {
  const g = new THREE.Group(); g.name = 'mount';
  const { top, thick, rin, rout } = MOUNT, y0 = top - thick;
  const ring = mesh(new THREE.LatheGeometry([new THREE.Vector2(rin, y0), new THREE.Vector2(rout, y0), new THREE.Vector2(rout, top), new THREE.Vector2(rin, top), new THREE.Vector2(rin, y0)], 64), M.card, { ink: 1 });
  g.add(ring);
  for (let i = 0; i < MOUNT.legs; i++) { const a = (i / MOUNT.legs) * Math.PI * 2 + Math.PI / 6, l = mesh(new THREE.BoxGeometry(MOUNT.leg, y0, MOUNT.leg), M.card, { ink: 0.8 }); l.position.set(Math.cos(a) * MOUNT.legR, y0 / 2, Math.sin(a) * MOUNT.legR); l.rotation.y = -a; g.add(l); }
  for (let i = 0; i < MOUNT.clamps; i++) { const a = (i / MOUNT.clamps) * Math.PI * 2, [cr, ct, cw] = MOUNT.clamp, c = mesh(new THREE.BoxGeometry(cr, ct, cw), M.dark); c.position.set(Math.cos(a) * MOUNT.clampR, top + ct / 2, Math.sin(a) * MOUNT.clampR); c.rotation.y = -a; g.add(c); }
  return g;
}

function stick(a, b, t) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length(), geo = new THREE.BoxGeometry(t, L, t);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  geo.applyQuaternion(q); geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geo;
}

export function makeTower(M) {
  const g = new THREE.Group(); g.name = 'tower'; g.position.x = TOWER.x;
  const { w, h, bays, leg, girt, brace } = TOWER, c = w / 2 - leg / 2, geos = [], V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const b = new THREE.BoxGeometry(leg, h, leg); b.translate(sx * c, h / 2, sz * c); geos.push(b); }
  const bay = h / bays, inner = c - leg / 2;
  for (let k = 1; k <= bays; k++) {
    const y = k * bay - girt / 2;
    for (const s of [-1, 1]) {
      const gx = new THREE.BoxGeometry(girt, girt, 2 * inner); gx.translate(s * c, y, 0); geos.push(gx);
      const gz = new THREE.BoxGeometry(2 * inner, girt, girt); gz.translate(0, y, s * c); geos.push(gz);
    }
    const ya = (k - 1) * bay + girt, yb = k * bay - girt;
    for (const s of [-1, 1]) {
      geos.push(stick(V(s * c, ya, -inner), V(s * c, yb, inner), brace), stick(V(s * c, ya, inner), V(s * c, yb, -inner), brace));
      geos.push(stick(V(-inner, ya, s * c), V(inner, yb, s * c), brace), stick(V(inner, ya, s * c), V(-inner, yb, s * c), brace));
    }
  }
  const lattice = mesh(mergeGeometries(geos), M.balsa);
  g.add(lattice);
  const cap = mesh(new THREE.BoxGeometry(w + 1.2, 1.4, w + 1.2), M.card, { ink: 0.8 }); cap.position.y = h + 0.7; g.add(cap);
  const carriage = new THREE.Group(), { inner: ci, outer: co, tall } = CARRIAGE, bw = co - ci;
  for (const s of [-1, 1]) {
    const a = mesh(new THREE.BoxGeometry(bw, tall, 2 * co), M.card, { ink: 0.8 }); a.position.set(s * (ci + bw / 2), 0, 0); carriage.add(a);
    const b = mesh(new THREE.BoxGeometry(2 * ci, tall, bw), M.card, { ink: 0.8 }); b.position.set(0, 0, s * (ci + bw / 2)); carriage.add(b);
  }
  g.add(carriage);
  const arms = [1, -1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(ARMS.hingeX - TOWER.x, 0, s * ARMS.hingeZ);
    const arm = mesh(new THREE.BoxGeometry(ARMS.length - ARMS.root, ARMS.tall, ARMS.wide), [M.card, M.card, M.card, M.card, M.truss, M.truss], { ink: 1 });
    arm.position.x = ARMS.root + (ARMS.length - ARMS.root) / 2; arm.name = 'arm'; pivot.add(arm);
    const knuckle = mesh(new THREE.CylinderGeometry(ARMS.knuckle, ARMS.knuckle, ARMS.tall + 0.6, 20), M.dark, { ink: 0.8 }); knuckle.name = 'knuckle'; pivot.add(knuckle);
    pivot.userData.side = s;
    carriage.add(pivot);
    return pivot;
  });
  g.userData = { carriage, arms };
  return g;
}

export function setArms(tower, y, open) {
  const { carriage, arms } = tower.userData;
  carriage.position.y = y;
  for (const p of arms) p.rotation.y = -p.userData.side * open * ARMS.open;
}

export function makeGround(M) {
  const [x0, , z0, z1] = WORLD.ground, s = new THREE.Shape(), edge = [];
  for (let z = z1; z >= z0; z -= 8) edge.push([shoreX(z), z]);
  s.moveTo(x0, -z1);
  for (const [x, z] of edge) s.lineTo(x, -z);
  s.lineTo(x0, -z0); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: false, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, -0.6, 0);
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - x0) / (WORLD.ground[1] - x0), 1 - (pos.getZ(i) - z0) / (z1 - z0));
  const m = mesh(geo, M.ground, { cast: false });
  m.name = 'ground';
  const skirt = mesh(new THREE.PlaneGeometry(2500, z1 - z0).rotateX(-Math.PI / 2), M.ground, { cast: false }), su = skirt.geometry.attributes.uv;
  for (let i = 0; i < su.count; i++) su.setX(i, 0);
  skirt.position.set(x0 - 1250, 0, (z0 + z1) / 2); m.add(skirt);
  return m;
}

export function makeSea(M) {
  const geo = new THREE.PlaneGeometry(4200, 1600, 1, 1);
  geo.rotateX(-Math.PI / 2); geo.translate(SHORE - 60 + 2100, WORLD.sea + 0.15, -900 + 800);
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 42, uv.getY(i) * 16);
  if (M.sea.map) { M.sea.map.wrapS = M.sea.map.wrapT = THREE.RepeatWrapping; }
  const m = mesh(geo, M.sea, { cast: false }); m.name = 'sea';
  return m;
}

export function makeBackdrop(M) {
  const geo = new THREE.PlaneGeometry(8000, 3000), uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * 8000 - 2000) / 3600);
  if (M.sky.map) { M.sky.map.wrapS = THREE.MirroredRepeatWrapping; M.sky.map.needsUpdate = true; }
  const m = new THREE.Mesh(geo, M.sky); m.position.set(400, 1300, WORLD.backdropZ); m.name = 'backdrop';
  return m;
}

export function makeMasts(M) {
  const g = new THREE.Group(); g.name = 'masts';
  for (const [x, z] of MASTS.at) {
    const pole = mesh(new THREE.CylinderGeometry(0.22, 0.32, MASTS.h, 10), M.card, { ink: 0.6 }); pole.position.set(x, MASTS.h / 2, z); g.add(pole);
    const head = mesh(new THREE.BoxGeometry(2.2, 1.1, 0.9), M.dark, { ink: 0.6 }); head.position.set(x, MASTS.h + 0.55, z); head.lookAt(0, MASTS.h + 0.55, 0); g.add(head);
  }
  return g;
}

export function makeFarm(M) {
  const g = new THREE.Group(); g.name = 'farm';
  let i = 0;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
    const r = 3.4, h = 12 + ((i * 7) % 9), x = -166 + col * 17, z = -140 + row * 22;
    const t = mesh(new THREE.CylinderGeometry(r, r, h, 32), M.paper, { ink: 0.8 }); t.position.set(x, h / 2, z); g.add(t);
    const dome = mesh(new THREE.SphereGeometry(r, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.paper, { ink: 0.8 }); dome.position.set(x, h, z); g.add(dome);
    i++;
  }
  return g;
}
