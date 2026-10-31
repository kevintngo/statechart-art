import * as THREE from 'three';
import { makeBooster, makeHotRing, makeShip, makeMount, makeTower, makeGround, makeSea, makeBackdrop, makeFarm, makeMasts, materials, setArms } from './props.js';
import { MOUNT, BOOSTER } from './dims.js';

export function buildScene(tex = {}) {
  const M = materials(tex);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#14152c');
  scene.fog = new THREE.Fog('#c39fb8', 520, 2600);

  const hemi = new THREE.HemisphereLight('#cbb6e6', '#6e4c3e', 1.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffc28c', 2.7);
  sun.position.set(380, 240, 520);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -220; sc.right = 220; sc.top = 220; sc.bottom = -60; sc.near = 50; sc.far = 1400;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  sun.target.position.set(-20, 40, -20);
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#8fa2ff', 0.55);
  rim.position.set(-500, 300, -600);
  scene.add(rim);

  const ground = makeGround(M), sea = makeSea(M), backdrop = makeBackdrop(M), farm = makeFarm(M), masts = makeMasts(M), mount = makeMount(M), tower = makeTower(M);
  const booster = makeBooster(M), ring = makeHotRing(M), ship = makeShip(M);
  booster.position.set(0, MOUNT.top, 0);
  ring.position.set(0, MOUNT.top + BOOSTER.body, 0);
  ship.position.set(0, MOUNT.top + BOOSTER.height, 0);
  ship.rotation.y = -Math.PI / 2;
  setArms(tower, 108, 1);
  scene.add(ground, sea, backdrop, farm, masts, mount, tower, booster, ring, ship);
  return { scene, M, sun, hemi, rim, ground, sea, backdrop, farm, masts, mount, tower, booster, ring, ship };
}
