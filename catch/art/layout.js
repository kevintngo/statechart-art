'use strict';
const path = require('path');
const fs = require('fs');
const { layOut } = require('../../tools/lib/layout');
require('../../tools/lib/letter');

const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'out');
const MMD = path.join(ROOT, 'model', 'chart', 'chart.mmd');

const THEME = `<style>
@font-face { font-family: "Kevin Sans"; src: url(fonts/KevinSans-Regular.woff2) format("woff2"); }
svg.pele { background: #f6efe2; --pele-bg: #f6efe2; --pele-fg: #1d1a1e; --pele-muted: #4a4038; --pele-line: #4a4038; --pele-surface: #fbf6ec; --pele-surface-alt: #ede3d0; --pele-border: #8f8172; --pele-accent: #c4453a; --pele-font: "Kevin Sans", "Avenir Next", sans-serif; }
.pele .pele-node.bugPath rect { stroke: #c4453a; stroke-width: 2px; }
.pele .pele-node.breaks rect { fill: #f8ddd6; stroke: #c4453a; stroke-width: 2.5px; }
.pele .pele-node.breaks text { fill: #8f2a20; }
</style>`;

function readEdges(src) {
  const out = [];
  for (const raw of src.split('\n')) {
    const m = raw.trim().match(/^(\[\*\]|s\d+) --> (s\d+)(?:: (.+))?$/);
    if (m) out.push({ from: m[1], to: m[2], label: m[3] || '' });
  }
  return out;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const src = fs.readFileSync(MMD, 'utf8'), svgOut = path.join(OUT, 'chart.svg');
  const L = await layOut(MMD, { svgOut });
  const order = readEdges(src);
  if (order.length !== L.edges.length) throw new Error(`pele drew ${L.edges.length} edges, the chart has ${order.length}`);
  const nodes = {};
  for (const n of L.nodes) if (/^s\d+$/.test(n.id)) nodes[n.id] = { cx: n.cx, cy: n.cy, w: n.w, h: n.h, classes: n.classes };
  const starts = Object.fromEntries(L.starts.map((s) => [s.id, { cx: s.cx, cy: s.cy }]));
  const edges = L.edges.map((e) => {
    const i = Number(e.id.replace('edge', '')), o = order[i];
    const a = e.pts[0], b = e.pts[e.pts.length - 1], to = nodes[o.to];
    if (Math.abs(b[0] - to.cx) > to.w / 2 + 14 || Math.abs(b[1] - to.cy) > to.h / 2 + 14) throw new Error(`edge${i} does not end at ${o.to}`);
    if (o.from !== '[*]') { const fr = nodes[o.from]; if (Math.abs(a[0] - fr.cx) > fr.w / 2 + 14 || Math.abs(a[1] - fr.cy) > fr.h / 2 + 14) throw new Error(`edge${i} does not start at ${o.from}`); }
    return { i, ...o, pts: e.pts.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]) };
  }).sort((p, q) => p.i - q.i);
  const clusters = L.clusters.map((c) => ({ id: c.id, x: c.x, y: c.y, w: c.w, h: c.h }));
  fs.writeFileSync(path.join(OUT, 'layout.json'), JSON.stringify({ width: L.width, height: L.height, nodes, starts, edges, clusters, dividers: L.dividers }) + '\n');
  fs.writeFileSync(svgOut, L.svg.replace(/(<svg[^>]*>)/, `$1${THEME}`).replace('<svg ', '<svg aria-label="The Catch statechart, drawn by pele" '));
  console.log('layout:', Object.keys(nodes).length, 'states,', edges.length, 'arrows,', `${Math.round(L.width)}x${Math.round(L.height)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
