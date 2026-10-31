import * as THREE from 'three';
import { SHIP_SET } from './flight.js';

const hash = (n) => { const x = Math.sin(n * 91.3 + 17.1) * 43758.5453; return x - Math.floor(x); };

export function nightSky() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 512; c.height = 1024;
  const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#070a18'); grad.addColorStop(0.5, '#0e1531'); grad.addColorStop(0.78, '#1b2753'); grad.addColorStop(0.9, '#33386a'); grad.addColorStop(0.97, '#5b4d75'); grad.addColorStop(1, '#6d5a7e');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 2600; i++) { const x = hash(i) * 512, y = hash(i + 7000) * 1024, a = 0.03 + hash(i + 9000) * 0.05; g.fillStyle = `rgba(${200 + hash(i + 3) * 55},${190 + hash(i + 4) * 50},${220 + hash(i + 5) * 35},${a})`; g.fillRect(x, y, 1 + hash(i + 6) * 6, 1); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeSetC(tex, M) {
  const g = new THREE.Group(); g.name = 'setC';
  const [x0] = SHIP_SET;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 3200), new THREE.MeshStandardMaterial({ map: tex.sea ? tex.sea.clone() : null, color: '#6f8aa6', roughness: 0.5, metalness: 0.05 }));
  if (sea.material.map) { sea.material.map.wrapS = sea.material.map.wrapT = THREE.RepeatWrapping; sea.material.map.repeat.set(80, 28); sea.material.map.needsUpdate = true; }
  sea.rotation.x = -Math.PI / 2; sea.position.set(x0 + 300, 0, 700); sea.receiveShadow = true; g.add(sea);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(9000, 1700), new THREE.MeshBasicMaterial({ map: nightSky(), fog: false }));
  sky.position.set(x0 + 300, 640, -900); g.add(sky);
  const moonX = x0 + 420;
  const moon = new THREE.Mesh(new THREE.CircleGeometry(46, 48), new THREE.MeshBasicMaterial({ color: '#f6ead0', fog: false }));
  moon.position.set(moonX, 620, -890); g.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow || null, color: '#c9c3ff', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.scale.set(320, 320, 1); halo.position.copy(moon.position).add(new THREE.Vector3(0, 0, 1)); g.add(halo);
  const glints = [];
  for (let i = 0; i < 170; i++) {
    const t = Math.pow(hash(i + 1), 0.8), z = -860 + t * 1000, spread = 6 + t * 70, x = moonX + (hash(i + 2) - 0.5) * 2 * spread * (0.4 + hash(i + 3));
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow || null, color: '#f3ecd8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: true }));
    s.position.set(x, 0.4, z); const w = 4 + t * 10; s.scale.set(w * 1.8, w * 0.35, 1); s.renderOrder = 2; g.add(s); glints.push({ s, i, base: 0.25 + 0.5 * (1 - t) });
  }
  const fill = new THREE.DirectionalLight('#aebcff', 0); fill.position.set(x0 + 260, 260, 620); fill.target.position.set(x0, 20, 0); g.add(fill, fill.target);
  const foam = [], spray = [];
  for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.cotton || null, color: '#eef4f6', transparent: true, depthWrite: false, opacity: 0 })); s.renderOrder = 4; g.add(s); foam.push({ s, a: (i / 26) * Math.PI * 2 + hash(i + 40) * 0.3, k: hash(i + 41) }); }
  for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.cotton || null, color: '#f4f8fa', transparent: true, depthWrite: false, opacity: 0 })); s.renderOrder = 4; g.add(s); spray.push({ s, a: hash(i + 60) * Math.PI * 2, v: 9 + hash(i + 61) * 10, up: 12 + hash(i + 62) * 14, at: 0.2 + hash(i + 63) * 0.75 }); }
  g.userData = { sea, sky, moon, halo, glints, fill, foam, spray };
  return g;
}

export function setSetC(g, on, step, splash, along) {
  const { glints, fill, foam, spray } = g.userData;
  fill.intensity = on ? 1.1 : 0;
  for (const p of glints) p.s.material.opacity = on ? p.base * (0.55 + 0.45 * hash(p.i * 3.1 + step)) : 0;
  for (const f of foam) {
    const k = Math.max(0, splash - f.k * 0.05), r = 6 + k * 20, size = 4 + k * 5;
    f.s.visible = on && splash > 0;
    f.s.position.set(along.x + Math.cos(f.a) * r, size * 0.32, along.z + Math.sin(f.a) * r);
    f.s.scale.set(size * 2.2, size * 1.1, 1);
    f.s.material.opacity = Math.max(0, Math.min(0.85, k * 4) * (1 - Math.max(0, k - 0.6) / 0.8));
  }
  for (const p of spray) {
    const t = splash - p.at * 0.6;
    p.s.visible = on && t > 0 && t < 1.2;
    if (!p.s.visible) continue;
    const tt = t * 3.2, d = 4 + p.v * tt, h = Math.max(0, p.up * tt - 9 * tt * tt), size = 1.4 + tt * 1.2;
    p.s.position.set(along.x + Math.cos(p.a) * d, h + size * 0.4, along.z + Math.sin(p.a) * d);
    p.s.scale.set(size * 2, size * 2, 1);
    p.s.material.opacity = Math.max(0, 0.5 * (1 - t / 1.2));
  }
}
