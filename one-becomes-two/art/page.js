'use strict';
const path = require('path');
const fs = require('fs');
const C = require('./chart');
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
  const tiles = [];
  for (const s of meta.sheets) {
    const enc = await encode(path.join(OUT, 'sheets', s.file), s.file.replace(/\.png$/, ''));
    tiles.push({ ...s, enc });
  }
  const chart = C.readChart(), paths = C.readPaths(chart);
  const report = fs.readFileSync(path.join(ROOT, 'model', 'chart', 'report.md'), 'utf8'), counts = report.match(/TLC reached (\d+) states and (\d+) steps/);
  const pics = tiles.map((t, i) => {
    const img = `<img src="tiles/${t.enc[0].name}" srcset="tiles/${t.enc[0].name} 1080w, tiles/${t.enc[1].name} 2160w" sizes="(min-width: 960px) 960px, 100vw" width="${t.enc[1].w}" height="${t.enc[1].h}" alt="${esc(t.alt)}" ${i < 2 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
    return t.credits && t.credits.length ? `<div class="tile">\n${img}\n${credits(t, meta.W)}\n</div>` : img;
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
</body>
</html>
`;
  fs.writeFileSync(path.join(SITE, 'index.html'), html);
  console.log('site written:', SITE, tiles.length, 'tiles');
}

main().catch((e) => { console.error(e); process.exit(1); });
