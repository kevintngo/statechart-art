'use strict';
const path = require('path');
const fs = require('fs');
const C = require('./chart');
const M = require('./media');
const { D } = M;

const W = 180, MARGIN = 6, TITLE = 256, HEAD = 46, GAP_AB = 74, END = 214;

async function build(o = {}) {
  const ch = await C.chapters({ fontSize: 24, rank: o.rank || 330, node: 30 });
  const k = (W - 2 * MARGIN) / ch.A.width;
  const fs_ = 24 * k;
  const A = { L: ch.A, ox: MARGIN, oy: TITLE }, B = { L: ch.B, ox: W / 2 - (ch.B.width / 2) * k };
  B.oy = A.oy + ch.A.height * k + GAP_AB;
  const total = B.oy + ch.B.height * k + END;
  const nodes = {}, edges = [], rows = [];
  for (const [name, Ch] of [['A', A], ['B', B]]) {
    const X = (x) => Ch.ox + x * k, Y = (y) => Ch.oy + y * k;
    Ch.X = X; Ch.Y = Y;
    for (const n of Ch.L.nodes) {
      nodes[n.id] = { id: n.id, chapter: name, x: X(n.cx - n.w / 2), y: Y(n.cy - n.h / 2), w: n.w * k, h: n.h * k, cx: X(n.cx), cy: Y(n.cy), lines: n.lines.map((l) => ({ text: l.text, x: X(l.x), y: Y(l.y) })), classes: (ch.chart.nodes[n.id] || {}).classes || [], label: (ch.chart.nodes[n.id] || {}).label };
    }
    for (const e of Ch.L.edges) {
      const pts = e.pts.map(([x, y]) => [X(x), Y(y)]);
      if (e.marker) { const last = e.pts[e.pts.length - 1]; const tip = e.marker.reduce((a, b) => (Math.hypot(b[0] - last[0], b[1] - last[1]) > Math.hypot(a[0] - last[0], a[1] - last[1]) ? b : a)); pts.push([X(tip[0]), Y(tip[1])]); }
      edges.push({ chapter: name, from: e.from, to: e.to, pts });
    }
    for (const s of Ch.L.starts) Ch.start = [X(s.cx), Y(s.cy)];
    const own = Ch.L.nodes.filter((n) => n.id !== 'xa').map((n) => nodes[n.id]).sort((a, b) => a.y - b.y), groups = [];
    for (const n of own) { const g = groups.find((q) => n.y < q.bottom && n.y + n.h > q.top); if (g) { g.ids.push(n.id); g.top = Math.min(g.top, n.y); g.bottom = Math.max(g.bottom, n.y + n.h); } else groups.push({ chapter: name, ids: [n.id], top: n.y, bottom: n.y + n.h }); }
    rows.push(...groups);
  }
  const label = (from, to) => (ch.chart.edges.find((e) => e.from === from && e.to === to) || {}).label || '';
  const cross = ch.cross[0];
  const exitA = edges.find((e) => e.chapter === 'A' && e.to === 'xa');
  const entryB = edges.find((e) => e.chapter === 'B' && e.from === '[*]');
  const xa = nodes.xa;
  const bridge = D.curve([[xa.cx, xa.y], [xa.cx, xa.cy], [xa.cx, A.oy + ch.A.height * k + 10], [B.start[0], B.oy - 8], [B.start[0], B.start[1]]], false, 0.35);
  const joined = { from: cross.from, to: cross.to, pts: [...exitA.pts.slice(0, -1), ...bridge, ...entryB.pts.slice(1)], label: cross.label, long: true };
  const all = edges.filter((e) => e !== exitA && e !== entryB).map((e) => ({ ...e, label: e.from === '[*]' ? '' : label(e.from, e.to) }));
  all.push(joined);
  delete nodes.xa;
  const first = all.find((e) => e.from === '[*]' && e.to === 's1');
  const startCell = [A.start[0], TITLE - 24];
  first.pts = [[startCell[0], startCell[1] + 9], ...first.pts];
  const healthy = new Set(['[*]>s1', 's1>s4', 's4>s7', 's7>s11', 's11>s12', 's12>s13', 's13>s15', 's15>s17', 's17>s18', 's18>s19', 's19>s21']);
  const bugOnly = new Set();
  for (const p of ch.paths) for (const e of p.edges) { const key = `${e.from}>${e.to}`; if (!healthy.has(key)) bugOnly.add(key); }
  for (const e of all) { const key = `${e.from}>${e.to}`; e.kind = healthy.has(key) ? 'gold' : bugOnly.has(key) ? 'red' : 'plain'; }
  return { W, total, k, fs: fs_, nodes, edges: all, rows, A, B, chart: ch.chart, paths: ch.paths, start: A.start, startCell };
}

module.exports = { build, W, MARGIN, TITLE, HEAD, GAP_AB, END };
