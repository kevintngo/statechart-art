'use strict';
const M = require('./media');

function blockers(wall) {
  const boxes = Object.values(wall.nodes).map((n) => ({ x: n.x - 4, y: n.y - 2.5, w: n.w + 8, h: n.h + 5 }));
  for (const t of wall.tags || []) boxes.push({ x: t.x - 1.5, y: t.y - 1.5, w: t.w + 3, h: t.h + 3 });
  const pts = [];
  for (const e of wall.edges) { for (let i = 1; i < e.pts.length; i++) { const a = e.pts[i - 1], b = e.pts[i], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.2); for (let k = 0; k <= n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); } }
  return { boxes, pts };
}

function captioner(P, s, wall, extra = []) {
  const bl = blockers(wall), used = [...extra];
  const hit = (r) => bl.boxes.some((b) => r.x < b.x + b.w && b.x < r.x + r.w && r.y < b.y + b.h && b.y < r.y + r.h) || used.some((b) => r.x < b.x + b.w && b.x < r.x + r.w && r.y < b.y + b.h && b.y < r.y + r.h) || bl.pts.some((p) => p[0] > r.x - 2.6 && p[0] < r.x + r.w + 2.6 && p[1] > r.y - 2 && p[1] < r.y + r.h + 2);
  const cap = (lines, x, y, q = {}) => {
    lines = Array.isArray(lines) ? lines : [lines];
    const size = q.size ?? 4, lh = size * 1.25, w = Math.max(...lines.map((l) => M.measure(l, size, q.face || 'sans'))), h = lines.length * lh;
    const align = q.align || 'left', x0 = (xx) => (align === 'center' ? xx - w / 2 : align === 'right' ? xx - w : xx);
    let best = null;
    for (let dy = 0; dy <= (q.reach ?? 40); dy += 1.5) for (const sy of dy ? [-1, 1] : [1]) for (let dx = 0; dx <= (q.reachX ?? 120); dx += 2) for (const sx of dx ? [-1, 1] : [1]) {
      const xx = x + sx * dx, yy = y + sy * dy, r = { x: x0(xx), y: yy - size * 0.9, w, h };
      if (r.x < 5 || r.x + r.w > wall.W - 5 || r.y < s.top + 4 || r.y + r.h > s.top + s.h - 2) continue;
      if (hit(r)) continue;
      const score = dx + dy * 1.5;
      if (!best || score < best.score) best = { score, xx, yy, r };
    }
    if (!best) { console.warn('caption has no room:', lines.join(' / ')); return null; }
    used.push(best.r);
    lines.forEach((l, i) => P.text(l, best.xx, best.yy + i * lh, { size, color: q.color, face: q.face || 'sans', align }));
    return best.r;
  };
  cap.avoid = (x0, y0, x1, y1) => used.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  return cap;
}

module.exports = { captioner };
