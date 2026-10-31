export const R = 4.5;

export const BOOSTER = {
  body: 69,
  ring: 2,
  height: 71,
  engines: [[3, 0.6, 0.45, 1.3], [10, 2.15, 0.52, 1.4], [20, 3.5, 0.6, 1.6]],
  fins: { radial: 3.2, tall: 3.4, thick: 0.6, y: 67.6, angles: [60, 120, 240, 300] },
  pins: { y: 62, out: 1.7, tall: 0.9, wide: 1.1 },
  centre: 30,
};

export const SHIP = {
  body: 36.3,
  nose: 14,
  height: 50.3,
  engines: [[3, 1.3, 0.55, 1.1, 0], [3, 3.1, 1.05, 1.7, Math.PI / 3]],
  aft: { y0: 2, y1: 14, out: 4, root: 12, tip: 7, thick: 0.4 },
  fwd: { y0: 35.3, y1: 43.3, out: 2.8, root: 8, tip: 4, thick: 0.35 },
  centre: 21,
};

export const MOUNT = { top: 20.5, thick: 1.9, rin: 4.3, rout: 9.5, legR: 7.6, leg: 1.6, legs: 6, clamps: 20, clampR: 4.95, clamp: [0.7, 1.2, 0.8] };

export const TOWER = { x: -26, w: 12, h: 146, bays: 16, leg: 0.9, girt: 0.6, brace: 0.38 };

export const CARRIAGE = { inner: 6.05, outer: 8.4, tall: 3.2 };

export const ARMS = { hingeX: TOWER.x + CARRIAGE.outer + 1.0, hingeZ: R + 0.35 + 0.6, length: 33, root: 0.95, knuckle: 0.97, wide: 1.2, tall: 2.4, open: (62 * Math.PI) / 180, park: 90 / 62 };

export const CATCH = { armTop: 96.5 };
CATCH.base = CATCH.armTop - (BOOSTER.pins.y - BOOSTER.pins.tall / 2);
CATCH.hover = CATCH.base + 1.6;
CATCH.carriage = CATCH.armTop - ARMS.tall / 2;

export const MASTS = { at: [[62, 44], [-44, 74]], h: 16 };

export const SHORE = 352;
export const WORLD = { ground: [-500, 900, -900, 700], backdropZ: -900, sea: -0.6 };
export const shoreX = (z) => SHORE + Math.sin(-z * 0.022) * 13 + Math.sin(-z * 0.0062) * 20;
