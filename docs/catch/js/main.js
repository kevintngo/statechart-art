import * as THREE from 'three';
import { buildScene } from './scene.js';
import { INK } from './props.js';
import { STATIONS, cameraPose, viewOffset, NARROW, lightsAt, SET_CUTS } from './story.js';
import { makeFX, applyPose } from './pose.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
let held = false;
try { held = localStorage.getItem('catch-still') === '1'; } catch (e) {}
const still = { get matches() { return held || motion.matches; } };
const hold = document.querySelector('.hold');
const markStill = () => document.documentElement.classList.toggle('still', held);
markStill();
if (hold) {
  hold.setAttribute('aria-pressed', String(held));
  hold.addEventListener('click', () => { held = !held; hold.setAttribute('aria-pressed', String(held)); markStill(); try { localStorage.setItem('catch-still', held ? '1' : '0'); } catch (e) {} });
}
const tags = document.querySelector('.regions');
const fitTags = () => { if (tags && window.scrollY < window.innerHeight / 2) document.documentElement.style.setProperty('--tags', `${Math.ceil(tags.getBoundingClientRect().bottom) + 6}px`); };
if (tags && 'ResizeObserver' in window) new ResizeObserver(fitTags).observe(tags);
fitTags();
const canvas = document.getElementById('stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.documentElement.classList.add('no-webgl');
  throw e;
}
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const loader = new THREE.TextureLoader();
const NAMES = ['booster', 'ship', 'nose', 'balsa', 'card', 'ground', 'sea', 'sky', 'cotton', 'tissue', 'glow', 'patches', 'frost', 'dunes1', 'dunes2', 'dunes3', 'clouddeck', 'seawaves', 'cotton2', 'gridfin', 'truss', 'hotring', 'hotvents'];
const tex = {};
await Promise.all(NAMES.map((n) => loader.loadAsync(`tex/${n}.webp`).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); tex[n] = t; }).catch(() => {})));
tex.tissue.wrapS = THREE.RepeatWrapping;

const W = buildScene(tex), { scene, booster, ship, tower, sun, hemi, rim, M } = W;
const atlas = await fetch('js/patches.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
const { parseChart } = await import('./chartdata.js');
const chart = await fetch('js/chart.mmd').then((r) => (r.ok ? r.text() : null)).then((t) => (t ? parseChart(t) : null)).catch(() => null);
const layout = await fetch('js/layout.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
const FX = makeFX(W, tex, { atlas, chart, layout });
const { MASTS } = await import('./dims.js');
const floods = [[-22, 150, 18, 0.42], [-22, 150, -18, 0.42], ...MASTS.at.map(([x, z]) => [x, MASTS.h + 0.55, z, 0.3])].map(([x, y, z, a]) => {
  const l = new THREE.SpotLight('#ffe2bc', 0, 0, a, 0.55, 1.2);
  l.position.set(x, y, z); l.target.position.set(0, y > 100 ? 80 : 56, 0);
  l.userData.k = 1.7 * Math.pow(l.position.distanceTo(l.target.position), 1.2);
  scene.add(l, l.target); return l;
});
const SUN_DAWN = new THREE.Color('#ffc28c'), SUN_NIGHT = new THREE.Color('#9fb2ff');
const SKY_DAWN = new THREE.Color('#cbb6e6'), SKY_NIGHT = new THREE.Color('#3c4a86');
const GROUND_DAWN = new THREE.Color('#6e4c3e'), GROUND_NIGHT = new THREE.Color('#1d1b2c');
const FOG_DAWN = new THREE.Color('#c39fb8'), FOG_NIGHT = new THREE.Color('#2a2c55');
const BACK_DAWN = new THREE.Color('#ffffff'), BACK_NIGHT = new THREE.Color('#6e6f9e');
const CLOUD_DAWN = new THREE.Color('#fbe9e4'), CLOUD_NIGHT = new THREE.Color('#6d6a93');
const VENT_DAWN = new THREE.Color('#f6f2ee'), VENT_NIGHT = new THREE.Color('#b9c0dc');
const SMOKE_TINT = new THREE.Color();

const camera = new THREE.PerspectiveCamera(36, 1, 1, 9000);
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.5, 1.2);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const ui = {
  regions: { booster: document.getElementById('r-booster'), ship: document.getElementById('r-ship'), tower: document.getElementById('r-tower') },
  curtain: document.getElementById('curtain'),
  last: -1,
};

function resize() {
  const w = window.innerWidth, h = window.innerHeight, pr = renderer.getPixelRatio();
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const [ox, oy] = viewOffset(camera.aspect);
  camera.setViewOffset(w, h, ox * w, oy * h, w, h);
  camera.updateProjectionMatrix();
  const px = w * h * pr * pr, samples = Math.min(renderer.capabilities.maxSamples || 0, px <= 1.6e6 ? 4 : px <= 5e6 ? 2 : 0);
  for (const t of [composer.renderTarget1, composer.renderTarget2]) if (t.samples !== samples) { t.samples = samples; t.dispose(); }
  composer.setPixelRatio(pr); composer.setSize(w, h);
  INK.uniforms.uRes.value.set(w * pr, h * pr);
  INK.uniforms.uWidth.value = 1.5 * pr;
}
window.addEventListener('resize', resize);
resize();

function pose(s, step, now = 0) {
  const L = lightsAt(s);
  applyPose(W, FX, s, step, { now: still.matches ? 0 : now, flood: L.flood, narrow: camera.aspect <= NARROW });
  sun.intensity = L.sun; sun.color.copy(SUN_DAWN).lerp(SUN_NIGHT, L.night);
  hemi.intensity = L.hemi; hemi.color.copy(SKY_DAWN).lerp(SKY_NIGHT, L.night); hemi.groundColor.copy(GROUND_DAWN).lerp(GROUND_NIGHT, L.night);
  scene.fog.color.copy(FOG_DAWN).lerp(FOG_NIGHT, L.night);
  M.sky.color.copy(BACK_DAWN).lerp(BACK_NIGHT, L.night * 0.8);
  for (const c of FX.clouds.children) c.material.color.copy(CLOUD_DAWN).lerp(CLOUD_NIGHT, L.night * 0.85);
  FX.stars.material.opacity = Math.min(1, L.night * 1.2);
  floods.forEach((f) => { f.intensity = L.flood * f.userData.k; });
  for (const p of FX.vents.userData.puffs) p.s.material.color.copy(VENT_DAWN).lerp(VENT_NIGHT, L.night * 0.7);
  rim.intensity = 0.55 + L.night * 0.4;

  const c = cameraPose(s, camera.aspect);
  camera.position.copy(c.position);
  camera.fov = c.fov; camera.updateProjectionMatrix();
  camera.lookAt(c.target);

  const curtain = Math.max(...SET_CUTS.map((k) => Math.min(1, Math.max(0, (0.2 - Math.abs(s - k)) / 0.16))));
  if (still.matches) { ui.curtain.style.transform = ''; ui.curtain.style.opacity = curtain.toFixed(3); }
  else { ui.curtain.style.opacity = curtain > 0 ? '1' : '0'; ui.curtain.style.transform = `translateY(${((curtain - 1) * 101).toFixed(2)}%)`; }
  const cur = Math.min(STATIONS.length - 1, Math.floor(s + 0.3));
  if (cur !== ui.last) {
    ui.last = cur;
    const r = STATIONS[cur].regions;
    for (const k of ['booster', 'ship', 'tower']) if (ui.regions[k] && ui.regions[k].textContent !== r[k]) { ui.regions[k].textContent = r[k]; const p = ui.regions[k].parentElement; p.classList.remove('changed'); void p.offsetWidth; p.classList.add('changed'); }
    document.body.dataset.station = STATIONS[cur].key;
  }
}

let target = 0, shown = 0, stepNow = 0, last = 0, movedAt = 0;
const sections = [...document.querySelectorAll('.station')];
let tops = [];
const measure = () => { tops = sections.map((el) => el.getBoundingClientRect().top + window.scrollY); };
const readScroll = () => {
  const y = window.scrollY;
  if (!tops.length) { target = Math.max(0, Math.min(STATIONS.length - 1 + 0.4, y / window.innerHeight)); return; }
  let i = 0;
  while (i < tops.length - 1 && tops[i + 1] <= y) i++;
  const span = i < tops.length - 1 ? tops[i + 1] - tops[i] : window.innerHeight;
  target = Math.max(0, Math.min(STATIONS.length - 1 + 0.4, i + (y - tops[i]) / span));
  movedAt = last;
};
measure();
if ('ResizeObserver' in window) new ResizeObserver(() => { measure(); readScroll(); }).observe(document.querySelector('main'));
window.addEventListener('scroll', readScroll, { passive: true });
readScroll(); shown = target;

const plate = document.getElementById('sampler');
let covered = false;
if (plate && 'IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => { document.body.classList.toggle('plate-in', e.isIntersecting); }, { rootMargin: '0px 0px -50% 0px' }).observe(plate);
}

function draw(now) {
  stepNow = still.matches ? 0 : Math.floor(now / 83);
  INK.uniforms.uStep.value = stepNow;
  covered = !!plate && plate.getBoundingClientRect().top <= 0;
  if (!covered) { pose(shown, stepNow, now); composer.render(); }
}

let filming = false;
function frame(now) {
  if (!filming) {
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60, gap = target - shown;
    last = now;
    if (Math.abs(gap) > (still.matches ? 2 * dt : 1)) { if (now - movedAt > 150) shown = target; }
    else if (still.matches) shown = target;
    else shown += Math.max(-2 * dt, Math.min(2 * dt, gap * Math.min(1, (1 - Math.pow(0.0015, 1 / 60)) * 1.6)));
    if (Math.abs(target - shown) < 1e-4) shown = target;
    draw(now);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__catch = {
  THREE, W, camera, renderer,
  goto(s) { target = shown = s; pose(s, 0); composer.render(); },
  film(now) { filming = true; readScroll(); shown = target; draw(now); },
};
document.body.classList.add('ready');
