import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { init, actions, rules, key } from './cellcycle.mjs';
import { state, step } from './view.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const label = (v) => state(v).join(' / ');
const seen = new Map(), edges = [], queue = [], parent = new Map();
for (const v of init()) { seen.set(key(v), v); queue.push(v); parent.set(key(v), null); }
while (queue.length) {
  const v = queue.shift();
  for (const a of actions) {
    if (!a.when(v)) continue;
    const w = a.then(v), k = key(w);
    edges.push({ from: v, to: w, action: a.name });
    if (!seen.has(k)) { seen.set(k, w); parent.set(k, { v, action: a.name }); queue.push(w); }
  }
}
const distinct = new Set(edges.map((e) => key(e.from) + '>' + key(e.to)));
console.log(`states ${seen.size}, steps ${distinct.size}`);

const arrows = new Set();
for (const e of edges) { const f = label(e.from), t = label(e.to); if (f !== t) arrows.add(`${f} --${step(e.action, e.from, e.to)}--> ${t}`); }
const mmd = fs.readFileSync(path.join(here, 'chart', 'chart.mmd'), 'utf8'), names = {}, parentOf = {};
let group = null;
for (const line of mmd.split('\n')) {
  const g = line.match(/^\s*state "(.+)" as (s\d+) \{/); if (g) { group = g[1]; names[g[2]] = g[1]; continue; }
  if (/^\s*\}/.test(line)) { group = null; continue; }
  const n = line.match(/^\s*(s\d+): (.+)$/); if (n) { names[n[1]] = n[2]; parentOf[n[1]] = group; }
}
const full = (id) => (parentOf[id] ? `${parentOf[id]} / ${names[id]}` : names[id]);
const chartArrows = new Set();
for (const line of mmd.split('\n')) { const m = line.match(/^\s*(s\d+) --> (s\d+): (.+)$/); if (m) chartArrows.add(`${full(m[1])} --${m[3]}--> ${full(m[2])}`); }
const missing = [...chartArrows].filter((a) => !arrows.has(a)), extra = [...arrows].filter((a) => !chartArrows.has(a));
console.log(`arrows ${arrows.size} (chart ${chartArrows.size}), missing ${missing.length}, extra ${extra.length}`);
for (const a of [...missing, ...extra]) console.log('  ', a);

const pathTo = (v) => { const out = []; let k = key(v); while (parent.get(k)) { const p = parent.get(k); out.unshift(step(p.action, p.v, seen.get(k))); k = key(p.v); } return out; };
const report = fs.readFileSync(path.join(here, 'chart', 'report.md'), 'utf8');
let ok = seen.size === 61 && distinct.size === 77 && !missing.length && !extra.length;
for (const r of rules) {
  const bad = [...seen.values()].filter((v) => !r.holds(v));
  if (!bad.length) { console.log(`${r.name} holds`); continue; }
  const order = [...seen.keys()], first = bad.sort((a, b) => order.indexOf(key(a)) - order.indexOf(key(b)))[0], steps = pathTo(first);
  const m = report.match(new RegExp(`## ${r.name} breaks\\nThe shortest path has (\\d+) steps:\\n([\\s\\S]*?)(\\n\\n|$)`));
  const tlc = m ? m[2].split('\n').slice(1).map((l) => l.replace(/^\d+\. /, '').split(':')[0]) : null;
  const same = tlc && JSON.stringify(tlc) === JSON.stringify(steps);
  if (!same) ok = false;
  console.log(`${r.name} breaks in ${steps.length} steps, ${same ? 'same path as TLC' : 'DIFFERENT from TLC: ' + JSON.stringify(tlc)}`);
}
console.log(ok ? 'matches TLC' : 'DOES NOT MATCH TLC');
process.exit(ok ? 0 : 1);
