'use strict';
const path = require('path');
const fs = require('fs');
const C = require('./chart');
const Wl = require('./wall');
const Mk = require('./marks');
const tools = require('module').createRequire(path.join(__dirname, '..', '..', 'tools', 'package.json'));
const { createCanvas, loadImage } = tools('@napi-rs/canvas');

const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'out'), BRAND = path.join(OUT, 'brand');
const SITE = path.join(ROOT, '..', 'docs', 'one-becomes-two');
const HOME = 'https://kevintngo.github.io/statechart-art/one-becomes-two/';
const DESC = 'The life of one cell, from one cell to two, drawn as a statechart and checked by TLC.';
const OG_ALT = 'The title One becomes two, the life of one cell, drawn as a statechart, above a pink tissue of cells in coloured pencil. A gold thread leads into one gold cell pinching in two, with a nucleus in each half.';
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function encode(file, base) {
  const im = await loadImage(file), out = [];
  for (const w of [1080, 2160]) {
    const h = Math.round((im.height * w) / im.width), c = createCanvas(w, h), g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, w, h);
    const name = `${base}-${w}.webp`;
    fs.writeFileSync(path.join(SITE, 'tiles', name), await c.encode('webp', 84));
    out.push({ name, w, h });
  }
  return out;
}

function chartText(chart) {
  const groups = new Map();
  for (const n of Object.values(chart.nodes)) { const g = n.parent ? n.parent.label : 'Endings'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(n); }
  const label = (id) => (id === '[*]' ? 'the start' : chart.nodes[id].label);
  let html = '';
  for (const [g, list] of groups) {
    html += `<h3>${esc(g)}</h3>\n<dl>\n`;
    for (const n of list) {
      const out = chart.edges.filter((e) => e.from === n.id);
      html += `<dt>${esc(n.label)}${n.classes.includes('breaks') ? ' <span class="breaks">(breaks a rule)</span>' : ''}</dt>\n`;
      html += out.length ? out.map((e) => `<dd>${esc(e.label)} → ${esc(label(e.to))}</dd>`).join('\n') + '\n' : '<dd>the end</dd>\n';
    }
    html += '</dl>\n';
  }
  return html;
}

function credits(s, W) {
  const pct = (v, of) => `${((v / of) * 100).toFixed(3)}%`;
  const items = s.credits.map((c) => `<li style="left:${pct(c.x, W)};top:${pct(c.y - c.size * 0.86, s.h)};font-size:${((c.size / W) * 100).toFixed(4)}cqw">${c.parts.map((p) => (p.href ? `<a href="${esc(p.href)}">${esc(p.t)}</a>` : esc(p.t))).join('')}</li>`);
  return `<ul class="credits" aria-label="Credits">\n${items.join('\n')}\n</ul>`;
}

async function main() {
  const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'sheets.json'), 'utf8'));
  fs.rmSync(path.join(SITE, 'tiles'), { recursive: true, force: true });
  fs.mkdirSync(path.join(SITE, 'tiles'), { recursive: true });
  fs.mkdirSync(path.join(SITE, 'fonts'), { recursive: true });
  for (const f of ['KevinSans-Regular.woff2', 'KevinSans-Bold.woff2']) fs.copyFileSync(path.join(ROOT, '..', 'tools', 'fonts', f), path.join(SITE, 'fonts', f));
  for (const f of ['og.jpg', 'favicon.ico', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) fs.copyFileSync(path.join(BRAND, f), path.join(SITE, f));
  fs.writeFileSync(path.join(SITE, 'site.webmanifest'), JSON.stringify({
    name: 'One becomes two', short_name: 'One becomes two', start_url: './', display: 'browser', background_color: '#191614', theme_color: '#191614',
    icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }],
  }, null, 2) + '\n');
  const wall = await Wl.build(), round = (p) => [+p[0].toFixed(2), +p[1].toFixed(2)], labelOf = (id) => (id === '[*]' ? '[*]' : wall.nodes[id].label);
  const stepData = {
    W: meta.W, total: meta.total, start: round(wall.startCell),
    nodes: Object.fromEntries(Object.values(wall.nodes).map((n) => [n.label, { x: +n.x.toFixed(2), y: +n.y.toFixed(2), w: +n.w.toFixed(2), h: +n.h.toFixed(2) }])),
    edges: wall.edges.map((e) => ({ from: labelOf(e.from), to: labelOf(e.to), label: e.label, kind: e.kind, pts: Mk.resample(Mk.smoothPts(e.pts, 1), 1.2).map(round) })),
  };
  fs.mkdirSync(path.join(SITE, 'js'), { recursive: true });
  fs.writeFileSync(path.join(SITE, 'js', 'chart.json'), JSON.stringify(stepData));
  for (const [from, name] of [[path.join(ROOT, 'model', 'cellcycle.mjs'), 'cellcycle.mjs'], [path.join(ROOT, 'model', 'view.mjs'), 'view.mjs'], [path.join(__dirname, 'step.mjs'), 'step.mjs']]) fs.copyFileSync(from, path.join(SITE, 'js', name));
  fs.rmSync(path.join(SITE, 'cells'), { recursive: true, force: true });
  fs.mkdirSync(path.join(SITE, 'cells'), { recursive: true });
  for (const f of fs.readdirSync(path.join(OUT, 'cells')).filter((f) => f.endsWith('.png'))) {
    const im = await loadImage(path.join(OUT, 'cells', f)), c = createCanvas(560, 560), g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, 560, 560);
    fs.writeFileSync(path.join(SITE, 'cells', f.replace(/\.png$/, '.webp')), await c.encode('webp', 82));
  }
  const tiles = [];
  for (const s of meta.sheets) {
    const enc = await encode(path.join(OUT, 'sheets', s.file), s.file.replace(/\.png$/, ''));
    tiles.push({ ...s, enc });
  }
  const chart = C.readChart(), paths = C.readPaths(chart);
  const report = fs.readFileSync(path.join(ROOT, 'model', 'chart', 'report.md'), 'utf8'), counts = report.match(/TLC reached (\d+) states and (\d+) steps/);
  const pics = tiles.map((t, i) => {
    const img = `<img src="tiles/${t.enc[0].name}" srcset="tiles/${t.enc[0].name} 1080w, tiles/${t.enc[1].name} 2160w" sizes="(min-width: 960px) 960px, 100vw" width="${t.enc[1].w}" height="${t.enc[1].h}" alt="${esc(t.alt)}" ${i < 2 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
    const opener = t.step ? `<button type="button" class="step-open" id="step-open" aria-expanded="false" aria-controls="stepper" style="left:${((t.step.x / meta.W) * 100).toFixed(3)}%;top:${((t.step.y / t.h) * 100).toFixed(3)}%;width:${((t.step.w / meta.W) * 100).toFixed(3)}%;height:${((t.step.h / t.h) * 100).toFixed(3)}%">Step through the chart</button>\n` : '';
    return t.credits && t.credits.length ? `<div class="tile">\n${img}\n${credits(t, meta.W)}\n${opener}</div>` : img;
  }).join('\n');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>One becomes two</title>
<meta name="description" content="${esc(DESC)}">
<link rel="canonical" href="${HOME}">
<meta name="theme-color" content="#191614">
<meta property="og:type" content="website">
<meta property="og:site_name" content="statechart art">
<meta property="og:title" content="One becomes two">
<meta property="og:description" content="${esc(DESC)}">
<meta property="og:url" content="${HOME}">
<meta property="og:image" content="${HOME}og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(OG_ALT)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="One becomes two">
<meta name="twitter:description" content="${esc(DESC)}">
<meta name="twitter:image" content="${HOME}og.jpg">
<meta name="twitter:image:alt" content="${esc(OG_ALT)}">
<link rel="icon" href="favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" href="icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<link rel="preload" href="fonts/KevinSans-Regular.woff2" as="font" type="font/woff2" crossorigin>
<style>
@font-face { font-family: "Kevin Sans"; src: url(fonts/KevinSans-Regular.woff2) format("woff2"); font-weight: 400; font-display: swap; }
@font-face { font-family: "Kevin Sans"; src: url(fonts/KevinSans-Bold.woff2) format("woff2"); font-weight: 700; font-display: swap; }
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html { background: #191614; color: #efe6d6; font: 400 1.0625rem/1.65 "Kevin Sans", "Avenir Next", system-ui, sans-serif; -webkit-text-size-adjust: 100%; }
body { margin: 0; }
.wall { max-width: 960px; margin: 0 auto; background: #f5f1e7; box-shadow: 0 0 0 1px #2c2622, 0 30px 90px rgba(0, 0, 0, 0.5); }
.wall img { display: block; width: 100%; height: auto; }
.tile { position: relative; container-type: inline-size; }
.credits { list-style: none; margin: 0; padding: 0; }
.credits li { position: absolute; margin: 0; white-space: nowrap; line-height: 1.16; color: transparent; }
.credits a { color: transparent; text-decoration: none; border-radius: 2px; }
.credits a:hover { background: rgba(196, 69, 58, 0.12); }
.credits a:focus-visible { outline: 2px solid #933323; outline-offset: 2px; background: rgba(196, 69, 58, 0.08); }
.credits ::selection { color: transparent; background: rgba(226, 179, 63, 0.4); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.wall { position: relative; }
.step-open { position: absolute; margin: 0; padding: 0; border: 0; border-radius: 3px; background: transparent; color: transparent; font: inherit; font-size: 1px; cursor: pointer; }
.step-open:hover { background: rgba(226, 179, 63, 0.14); }
.step-open:focus-visible { outline: 2px solid #933323; outline-offset: 3px; }
.step-marks { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.step-marks[hidden] { display: none; }
.step-marks svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.step-spot { position: absolute; border-radius: 10px; box-shadow: 0 0 0 3px rgba(240, 200, 106, 0.95), 0 0 22px 8px rgba(240, 200, 106, 0.4), 0 0 0 300vmax rgba(14, 11, 9, 0.34); transition-property: left, top, width, height, border-radius; transition-timing-function: cubic-bezier(0.45, 0, 0.55, 1); }
.step-spot.round { border-radius: 50%; }
.step-route { fill: none; stroke: #f6d27a; stroke-width: 1.1; stroke-linecap: round; stroke-linejoin: round; opacity: 0; transition: opacity 0.7s; }
.step-token { filter: drop-shadow(0 0 3px rgba(246, 210, 122, 0.95)); }
.step-token circle { fill: #f3d58c; stroke: #3a2a14; stroke-width: 0.5; }
.step-token .nuc { fill: #c4453a; stroke: none; }
.stepper { position: fixed; z-index: 20; background: #1d1917; color: #efe6d6; box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.45); }
.stepper[hidden] { display: none; }
.scope { position: relative; aspect-ratio: 1; border-radius: 50%; background: #f5f1e7; box-shadow: 0 0 0 6px #0c0a09, 0 0 0 7px #4a413a; overflow: hidden; }
.scope canvas { display: block; width: 100%; height: 100%; }
.scope::after { content: ""; position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle, transparent 60%, rgba(70, 50, 25, 0.16) 82%, rgba(30, 20, 10, 0.42) 100%); pointer-events: none; }
.step-chapter { margin: 0; font-size: 0.85rem; color: #c9bfae; }
.step-now { font-weight: 700; font-size: 1.3rem; line-height: 1.25; margin: 2px 0 4px; }
.step-now:focus { outline: none; }
.step-cell-note { margin: 0; font-size: 0.85rem; color: #f0c86a; }
.step-ask { margin: 12px 0 8px; color: #d8cfc0; }
.step-moves { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.move { display: grid; grid-template-columns: 24px 1fr; column-gap: 10px; align-items: center; width: 100%; text-align: left; font: inherit; font-size: 1rem; line-height: 1.3; color: #1d1a1e; background: #fbf6ea; border: 1px solid #6f655a; border-radius: 2px; box-shadow: 2px 3px 0 #0b0a0b; padding: 9px 12px; cursor: pointer; }
.move .swatch { grid-row: span 2; width: 24px; height: 6px; border-radius: 3px; background: #efe6d2; box-shadow: 0 0 0 1px #2e2a26; }
.move.gold .swatch { background: repeating-linear-gradient(90deg, #e2b33f 0 4px, #f6ecd2 4px 7px); box-shadow: 0 0 0 1px #3a2a14; }
.move.red .swatch { background: repeating-linear-gradient(90deg, #c4453a 0 4px, #ef9a8c 4px 7px); box-shadow: 0 0 0 1px #3d1410; }
.move.red .what { color: #8f2a20; }
.move .to { font-size: 0.85rem; color: #5b5046; }
.move:hover { background: #fffaf0; }
.move:active { transform: translate(1px, 2px); box-shadow: 1px 1px 0 #0b0a0b; }
.move:focus-visible, .step-controls button:focus-visible { outline: 2px solid #f0c86a; outline-offset: 3px; }
.step-hint { font-size: 0.8rem; color: #b3a99a; margin: 10px 0 0; }
.step-controls { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.step-controls button { font: inherit; font-size: 0.9rem; color: #efe6d6; background: transparent; border: 1px solid #5a5048; border-radius: 2px; padding: 6px 12px; min-height: 36px; cursor: pointer; }
.step-controls button:disabled { opacity: 0.45; cursor: default; }
.step-controls button:hover:not(:disabled) { border-color: #f0c86a; }
.step-trail-box { margin-top: 16px; font-size: 0.85rem; color: #c9bfae; }
.step-trail-box summary { cursor: pointer; padding: 4px 0; }
.step-trail { margin: 6px 0 0; padding-left: 1.4em; }
.step-trail li[aria-current] { color: #f0c86a; }
@media (min-width: 900px) {
  .stepper { top: 0; right: 0; bottom: 0; width: 360px; overflow-y: auto; padding: 28px 24px 32px; border-left: 1px solid #2c2622; }
  .scope { width: 240px; margin: 6px auto 20px; }
  body.stepping main { margin-right: 360px; }
}
@media (max-width: 899px) {
  .stepper { left: 0; right: 0; bottom: 0; max-height: 52vh; overflow-y: auto; padding: 14px 16px 18px; border-top: 1px solid #2c2622; display: grid; grid-template-columns: 104px 1fr; column-gap: 14px; align-items: center; }
  .scope { width: 104px; margin: 6px 0; }
  .step-now { font-size: 1.1rem; }
  .step-body, .step-controls, .step-trail-box { grid-column: 1 / -1; }
  body.stepping main { padding-bottom: 54vh; }
}
@media (prefers-reduced-motion: reduce) { .step-spot, .step-route { transition: none; } }
.text { max-width: 44rem; margin: 56px auto 80px; padding: 0 20px 0 36px; }
.text h2 { display: inline; font-weight: 700; font-size: 1.35rem; margin: 0; }
.text summary { cursor: pointer; padding: 10px 0; list-style-position: outside; }
.text summary:focus-visible { outline: 2px solid #f0c86a; outline-offset: 4px; }
.text h3 { font-weight: 700; font-size: 1.15rem; margin: 28px 0 6px; }
.text p { margin: 8px 0; color: #d8cfc0; }
.text dl { margin: 0; }
.text dt { margin-top: 10px; font-weight: 700; }
.text dd { margin: 2px 0 0 1.2em; color: #d8cfc0; }
.text .breaks { color: #f0a493; font-weight: 400; }
.text ul { padding-left: 1.2em; }
.text li { margin: 6px 0; color: #d8cfc0; }
a { color: #f0c86a; text-underline-offset: 0.18em; }
a:focus-visible { outline: 2px solid #f0c86a; outline-offset: 3px; }
</style>
</head>
<body>
<main>
<h1 class="sr-only">One becomes two</h1>
<div class="wall">
${pics}
<div class="step-marks" id="step-marks" hidden aria-hidden="true">
<div class="step-spot" id="step-spot"></div>
<svg viewBox="0 0 ${meta.W} ${meta.total.toFixed(2)}" preserveAspectRatio="none"><path class="step-route" id="step-route"/><g class="step-token" id="step-token"><circle r="2.6"/><circle class="nuc" r="1.05"/></g></svg>
</div>
</div>
<section class="text">
<details>
<summary><h2>Read the chart as text</h2></summary>
<p>A statechart of the cell cycle, modelled in TLA+ and checked by TLC, which reached ${counts ? counts[1] : ''} states and ${counts ? counts[2] : ''} steps. Each state below lists the steps that leave it.</p>
${chartText(chart)}
<h3>What TLC found</h3>
<ul>
<li>Holds: a cell never divides before it copies its DNA, and a cell never gets stuck.</li>
<li>Breaks without p53: damaged DNA gets copied, and both daughters carry the mutation (a path of ${paths.find((p) => p.rule === 'DaughtersCarryNoMutation').nodes.length - 1} steps).</li>
<li>Breaks without the spindle check: the sisters are pulled apart too soon, and the daughters get the wrong chromosomes (a path of ${paths.find((p) => p.rule === 'EachDaughterGetsOneOfEach').nodes.length - 1} steps).</li>
</ul>
</details>
</section>
</main>
<aside class="stepper" id="stepper" aria-labelledby="step-now" hidden>
<div class="scope"><canvas id="step-cell" role="img" aria-label=""></canvas></div>
<div class="step-head">
<p class="step-chapter" id="step-chapter"></p>
<h2 class="step-now" id="step-now" tabindex="-1"></h2>
<p class="step-cell-note" id="step-cell-note"></p>
</div>
<div class="step-body">
<p class="step-ask" id="step-ask"></p>
<ul class="step-moves" id="step-moves"></ul>
<p class="step-hint" id="step-hint" hidden>Words in brackets say when a step can happen.</p>
</div>
<div class="step-controls">
<button type="button" id="step-back">Back</button>
<button type="button" id="step-play" aria-pressed="false">Play</button>
<button type="button" id="step-again">Start again</button>
<button type="button" id="step-close">Close</button>
</div>
<details class="step-trail-box"><summary>The path so far</summary><ol class="step-trail" id="step-trail"></ol></details>
<p class="sr-only" aria-live="polite" id="step-live"></p>
</aside>
<script type="module" src="js/step.mjs"></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(SITE, 'index.html'), html);
  console.log('site written:', SITE, tiles.length, 'tiles');
}

main().catch((e) => { console.error(e); process.exit(1); });
