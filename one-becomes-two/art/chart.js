'use strict';
const fs = require('fs');
const path = require('path');
const tools = require('module').createRequire(path.join(__dirname, '..', '..', 'tools', 'package.json'));
const { createCanvas } = tools('@napi-rs/canvas');
const { pathToFileURL } = require('url');
const { readState } = require('../../tools/lib/layout');
require('../../tools/lib/letter');

const MODEL = path.join(__dirname, '..', 'model');

function readChart() {
  const src = fs.readFileSync(path.join(MODEL, 'chart', 'chart.mmd'), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
  const nodes = {}, edges = [], stack = [];
  for (const raw of src.split('\n')) {
    const l = raw.trim();
    const open = l.match(/^state "([^"]+)" as (\w+) \{$/);
    if (open) { stack.push(open[2] === 'legend' ? null : { id: open[2], label: open[1] }); continue; }
    if (l === '}') { stack.pop(); continue; }
    if (stack.length && stack[stack.length - 1] === null) continue;
    const node = l.match(/^(s\d+): (.+)$/);
    if (node) { nodes[node[1]] = { id: node[1], label: node[2], parent: stack.length ? stack[stack.length - 1] : null, classes: [] }; continue; }
    const edge = l.match(/^(\[\*\]|s\d+) --> (s\d+)(?:: (.+))?$/);
    if (edge) { edges.push({ from: edge[1], to: edge[2], label: edge[3] || '' }); continue; }
    const cls = l.match(/^class (s\d+) (\w+)$/);
    if (cls && nodes[cls[1]]) nodes[cls[1]].classes.push(cls[2]);
  }
  return { nodes, edges };
}

function readPaths(chart) {
  const rep = fs.readFileSync(path.join(MODEL, 'chart', 'report.md'), 'utf8'), out = [];
  const byName = (s) => Object.values(chart.nodes).find((n) => (n.parent ? `${n.parent.label} / ${n.label}` : n.label) === s.trim());
  for (const block of rep.split(/^## /m).slice(1)) {
    const m = block.match(/^(\w+) breaks/);
    if (!m) continue;
    const steps = [...block.matchAll(/^(\d+)\. (?:(.+?): )?(.+)$/gm)].map((q) => ({ step: q[2], node: byName(q[3]) }));
    const ids = steps.map((s) => s.node && s.node.id);
    const es = [{ from: '[*]', to: ids[0] }];
    for (let i = 1; i < ids.length; i++) es.push({ from: ids[i - 1], to: ids[i] });
    out.push({ rule: m[1], nodes: ids, edges: es });
  }
  return out;
}

let pele;
async function layOutChapter(nodes, edges, o) {
  pele ??= await import(pathToFileURL(tools.resolve('pele')).href);
  const g = createCanvas(8, 8).getContext('2d');
  const measurer = { width(t, s) { g.font = `${s}px "Kevin Sans Bold"`; return g.measureText(t).width; } };
  const lines = ['---', 'config:', '  state:', `    rankSpacing: ${o.rank}`, `    nodeSpacing: ${o.node}`, '---', 'stateDiagram-v2', '  direction TB'];
  for (const n of nodes) lines.push(`  ${n.id}: ${n.label}`);
  for (const e of edges) lines.push(`  ${e.from} --> ${e.to}`);
  const src = lines.join('\n');
  const r = pele.render(src, { measurer, fontFamily: 'Kevin Sans Bold', fontSize: o.fontSize, padding: o.padding ?? 12, responsive: false, limit: 1e6, outputLimit: 8e6, maxEdges: 1e4 });
  const L = readState(r.svg);
  L.src = src;
  L.order = edges.map((e, i) => ({ ...e, id: `edge${i}` }));
  for (const e of L.edges) Object.assign(e, L.order.find((q) => q.id === e.id));
  return L;
}

async function chapters(o = {}) {
  const chart = readChart(), paths = readPaths(chart);
  const opts = { fontSize: o.fontSize || 24, rank: o.rank || 200, node: o.node || 28, padding: o.padding ?? 12 };
  const inA = (n) => (n.parent && /interphase/.test(n.parent.label)) || /apoptosis/.test(n.label);
  const A = Object.values(chart.nodes).filter(inA), B = Object.values(chart.nodes).filter((n) => !inA(n));
  const aIds = new Set(A.map((n) => n.id));
  const exitA = { id: 'xa', label: '·' };
  const edgesA = [], edgesB = [], cross = [];
  for (const e of chart.edges) {
    const fa = e.from === '[*]' || aIds.has(e.from), ta = aIds.has(e.to);
    if (fa && ta) edgesA.push(e);
    else if (!fa && !ta) edgesB.push(e);
    else { cross.push(e); edgesA.push({ ...e, to: 'xa' }); edgesB.unshift({ ...e, from: '[*]' }); }
  }
  const LA = await layOutChapter([...A, exitA], edgesA, opts);
  const LB = await layOutChapter(B, edgesB, opts);
  return { chart, paths, A: LA, B: LB, cross, opts };
}

module.exports = { readChart, readPaths, chapters, layOutChapter };
