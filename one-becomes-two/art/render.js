'use strict';
const path = require('path');
const fs = require('fs');
const Wl = require('./wall');
const M = require('./media');
const Mk = require('./marks');
const SC = require('./scenes');
const { D } = M;

const OUT = path.join(__dirname, '..', 'out');
const args = process.argv.slice(2);
const PPM = Number((args.find((a) => a.startsWith('--ppm=')) || '--ppm=12').slice(6));
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);

const { GOLD, RED, PLAIN } = Mk;

function wrap(label, max = 20) {
  if (label.length <= max) return [label];
  const words = label.split(' ');
  let best = null;
  for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(' '), b = words.slice(i).join(' '), s = Math.max(a.length, b.length); if (!best || s < best.s) best = { s, lines: [a, b] }; }
  return best.lines;
}

function placeTags(wall, sheets) {
  const size = 3.9, boxes = Object.values(wall.nodes).map((n) => ({ x: n.x - 4, y: n.y - 3, w: n.w + 8, h: n.h + 6 })), placed = [];
  const seams = sheets.map((s) => s.top);
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const order = wall.edges.filter((e) => e.label).sort((a, b) => Mk.lengthOf(a.pts) - Mk.lengthOf(b.pts));
  for (const e of order) {
    const lines = wrap(e.label), w = Math.max(...lines.map((l) => M.measure(l, size))) + 5.2, h = lines.length * size * 1.22 + 2.6, L = Mk.lengthOf(e.pts);
    let best = null;
    for (let t = 0.05; t <= 0.95; t += 0.01) for (const side of [0, -1, 1, -2, 2]) {
      const p = Mk.at(e.pts, t), r = { x: p[0] - w / 2 + Math.sign(side) * (w / 2 + (Math.abs(side) > 1 ? 7 : 1.8)), y: p[1] - h / 2, w, h };
      if (r.x < 3 || r.x + r.w > wall.W - 3) continue;
      if (boxes.some((b) => hit(r, b)) || placed.some((q) => hit(r, { x: q.x - 2, y: q.y - 2, w: q.w + 4, h: q.h + 4 }))) continue;
      if (seams.some((y) => y > r.y - 2.5 && y < r.y + r.h + 2.5)) continue;
      let cross = 0;
      for (const f of wall.edges) if (f !== e && f.pts.some((q) => q[0] > r.x - 1 && q[0] < r.x + r.w + 1 && q[1] > r.y - 1 && q[1] < r.y + r.h + 1)) cross++;
      const up = e.pts[e.pts.length - 1][1] < e.pts[0][1];
      const want = e.long ? 0.12 : up ? 0.22 : L > 90 ? 0.22 : 0.5;
      const score = cross * 40 + Math.abs(t - want) * 30 + (side ? 14 : 0) + (Math.abs(side) > 1 ? 30 : 0);
      if (!best || score < best.score) best = { score, r, side };
    }
    if (best) placed.push({ ...best.r, lines, size, key: `${e.from}-${e.to}`, red: e.kind === 'red', edge: e, beside: best.side });
    else console.warn('no room for tag', e.label);
  }
  return placed;
}

function sheetsOf(wall) {
  const b = [0, Wl.TITLE];
  const rowsA = wall.rows.filter((r) => r.chapter === 'A'), rowsB = wall.rows.filter((r) => r.chapter === 'B');
  for (const r of rowsA.slice(1)) b.push(r.top - 8);
  b.push(wall.B.oy);
  for (const r of rowsB.slice(1)) b.push(r.top - 8);
  const endStart = Math.max(...rowsB[rowsB.length - 1].ids.map((id) => wall.nodes[id].y + wall.nodes[id].h)) + 112;
  b.push(endStart, wall.total);
  const sheets = [];
  for (let i = 0; i < b.length - 1; i++) sheets.push({ index: i, top: b[i], h: b[i + 1] - b[i] });
  return sheets;
}

async function main() {
  const wall = await Wl.build();
  const sheets = sheetsOf(wall);
  const looks = SC.looks(wall, sheets);
  const tags = placeTags(wall, sheets);
  wall.tags = tags;
  console.log(`wall ${wall.W} x ${Math.round(wall.total)} mm, ${sheets.length} sheets, text ${wall.fs.toFixed(2)} mm, ppm ${PPM}`);
  fs.mkdirSync(path.join(OUT, 'sheets'), { recursive: true });
  const files = [];
  for (const s of sheets) {
    const look = looks[s.index];
    const file = path.join(OUT, 'sheets', `${String(s.index).padStart(2, '0')}-${look.id}.png`);
    files.push(file);
    if (ONLY.length && !ONLY.includes(look.id) && !ONLY.includes(String(s.index))) continue;
    const t0 = Date.now();
    const P = M.sheet({ id: 'obt-' + look.id, w: wall.W, h: s.h, ppm: PPM, paper: look.paper, seed: 'obt-' + look.id, top: s.top });
    const prev = looks[s.index - 1];
    if (prev) SC.seam(P, s, prev, look);
    if (look.pre) await look.pre(P, s, wall);
    if (look.back) await look.back(P, s, wall);
    for (const e of wall.edges) {
      if (!P.visible([e.pts])) continue;
      const th = e.kind === 'gold' ? GOLD : e.kind === 'red' ? RED : PLAIN, pts = Mk.cut(Mk.smoothPts(e.pts, 1), e.from === '[*]' && e.to === 's1' ? 0 : 1.6, 5.2);
      if (pts.length < 2) continue;
      if (e.kind === 'plain') Mk.thread(P, pts, th); else Mk.cord(P, pts, th);
      const full = Mk.cut(e.pts, 0, 1.3), tip = full[full.length - 1], from = Mk.at(e.pts, Math.max(0, 1 - 9 / Mk.lengthOf(e.pts)));
      Mk.arrowhead(P, tip, from, th, 4.4);
    }
    if (look.mid) await look.mid(P, s, wall);
    for (const n of Object.values(wall.nodes)) if (n.y > s.top - 1 && n.y + n.h < s.top + s.h + 1) Mk.slide(P, n, { ...look.slide, size: wall.fs, mark: n.classes.includes('breaks') ? '#c4453a' : null });
    for (const t of tags) if (t.y > s.top && t.y + t.h < s.top + s.h) Mk.tag(P, t, look.tag);
    if (look.front) await look.front(P, s, wall);
    await P.save(file);
    console.log(`${path.basename(file)} ${Math.round(s.h)} mm in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  const prior = fs.existsSync(path.join(OUT, 'sheets.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'sheets.json'), 'utf8')) : null;
  const kept = (i, k, d) => looks[i][k] || (prior && prior.sheets[i] && prior.sheets[i].id === looks[i].id && prior.sheets[i][k]) || d;
  fs.writeFileSync(path.join(OUT, 'sheets.json'), JSON.stringify({ W: wall.W, total: wall.total, ppm: PPM, sheets: sheets.map((s, i) => ({ ...s, id: looks[i].id, file: path.basename(files[i]), alt: looks[i].alt || '', credits: kept(i, 'credits', []), step: kept(i, 'step', null) })) }, null, 1));
}

main().catch((e) => { console.error(e); process.exit(1); });
