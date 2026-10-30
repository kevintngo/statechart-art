'use strict';
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('../tools/node_modules/@napi-rs/canvas');
const { layOut } = require('../tools/lib/layout');

const ROOT = path.join(__dirname, '..');
const SERIES = path.join(ROOT, 'business');
const OUT = path.join(SERIES, 'out');
const DOCS = path.join(ROOT, 'docs');
const SITE = (process.env.SITE || 'https://kevintngo.github.io/statechart-art/').replace(/\/?$/, '/');
const REPO = process.env.REPO || 'https://github.com/kevintngo/statechart-art';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const read = (p) => fs.readFileSync(path.join(SERIES, p), 'utf8').trimEnd();
const copy = (from, to) => { fs.mkdirSync(path.dirname(path.join(DOCS, to)), { recursive: true }); fs.copyFileSync(from, path.join(DOCS, to)); };
const code = (text, label) => `<pre tabindex="0" aria-label="${esc(label)}"><code>${esc(text)}</code></pre>`;

const PLATES = [
  {
    key: 'order', dir: 'order', model: 'Order.tla', n: 'I', title: 'An order', sub: 'from the line to your hand',
    kind: 'A flat chart with a branch and a loop',
    note: 'Each state is an order ticket pinned up, and each step is a red thread between the pins. The words for each step sit beside its thread.',
    rules: [['PaidForEveryDrink', 'Every drink being made, ready or handed over has been paid for.'], ['RefundsGiveMoneyBack', 'A refunded order has its money back.']],
    over: "The finished plate, faded, with pele's boxes and lines drawn over it in blue. Each order ticket sits on one of pele's boxes, and each red thread follows one of pele's lines.",
    alt: 'Pen and coloured pencil drawing titled An order, from the line to your hand. The statechart is drawn as paper order tickets pinned up with coloured pushpins and joined by red thread: in line; you order, to ordered; you pay, to paid. From paid, the barista starts if there are pearls, to being made, or money back if the pearls ran out, to refunded. From being made, your number is called, to ready. From ready, it is the wrong drink goes back to being made, and you pick it up leads to in your hand. Around the chart: three customers waiting in line, a cashier at a counter with a till showing 5.50 and coins, a barista shaking a drink beside a service bell and a finished cup, a jar of pearls labelled sold out with a coin on a shelf, and a person with short wavy black hair, a beige polo and an iced coffee on their head holding up a cup of boba milk tea.',
  },
  {
    key: 'day', dir: 'day', model: 'Day.tla', n: 'II', title: 'A day', sub: 'at the shop, 7 am to 9 pm',
    kind: 'A chart with a parent state',
    note: 'Open is a parent state with three states inside, so it is drawn as the shop window: quiet, busy and a rush are notes taped to the glass, and the other states are wooden signs.',
    rules: [['OpenOnlyWhenReady', 'The shop is open only once the tea is brewed and the pearls are boiled.'], ['CloseOnlyWhenEmpty', 'The shop closes up only when no one is inside.'], ['CountAfterMopping', 'The till is counted only after the floor is mopped.']],
    over: "The finished plate, faded, with pele's boxes and lines drawn over it in blue. The shop window sits on pele's box for open, and each sign and note sits on one of pele's boxes.",
    alt: 'Pen and coloured pencil drawing titled A day, at the shop, 7 am to 9 pm. The statechart is drawn as a shop front. Closed, getting ready and closing up are wooden signs. Open is the shop window under a striped awning, with quiet, busy and a rush as notes taped to the glass. At 7 am, closed goes to getting ready; tea and pearls ready leads into open, to quiet; people come in, to busy; school is out, to a rush; it calms down, back to quiet; at 9 pm, if quiet, to closing up; till counted, back to closed. Around the chart: a sunrise, a kettle and a pot of pearls on a stove on a shelf, a moon and stars, a mop in a bucket, a morning glory vine and a planter of flowers under the window.',
  },
  {
    key: 'counter', dir: 'counter', model: 'Counter.tla', n: 'III', title: 'Two at once', sub: 'the barista and the pot',
    kind: 'Two regions, at the same time',
    note: 'The barista and the pot each move on their own, side by side. A step that waits on the other region says so in brackets, coloured like the region it waits on.',
    rules: [['NoDrinkWhileCooking', 'The barista is never making a drink while a batch of pearls is cooking.']],
    over: "The finished plate, faded, with pele's boxes and lines drawn over it in blue. The frame and the two cards sit on pele's boxes for the regions, and each state sits on one of pele's boxes.",
    alt: 'Pen and coloured pencil drawing titled Two at once, the barista and the pot. Under a menu board, the statechart shows two regions side by side inside a frame marked at the same time. The barista: barista free; an order comes in, unless cooking pearls, to making a drink; shaken and sealed, to calling a number; picked up, back to barista free. The pot: full of pearls; pearls run low, to running low; a new batch, when barista free, to cooking pearls; chewy again, back to full of pearls. Each condition is coloured like the region it names. Below, a barista shakes a drink behind the counter beside two finished cups and a pager, and a pot of pearls and a kettle sit on a stove.',
  },
  {
    key: 'bug', dir: 'bug', model: 'Bug.tla', n: 'IV', title: 'The pearl bug', sub: 'TLC finds how old pearls get served',
    kind: 'A rule that breaks, and the path to it',
    note: 'TLC finds a way to break the rule: in a rush, nobody checks how old the pearls are. The chart marks the state that breaks it, and the shortest path to it is traced in red.',
    rules: [['NeverServeOldPearls', 'Pearls are never served more than 4 hours after boiling. It breaks.']],
    over: "The finished plate, faded, with pele's boxes and lines drawn over it in blue. Each card sits on one of pele's boxes, and the red path follows pele's lines.",
    alt: 'Pen and coloured pencil drawing titled The pearl bug, TLC finds how old pearls get served. A card states the rule: never serve pearls more than 4 hours old. The statechart: just boiled; an hour passes, to chewy, where more hours pass; an hour passes, to getting firm; an hour passes, to too old, where a rush starts. From too old, thrown out leads to thrown out, and a new batch is boiled leads back to just boiled; but a cup is served in a rush leads to an old cup is served, which is stamped rule broken. The path TLC found, from just boiled through too old to the old cup, is traced in red. Around the chart: a ladybug, an hourglass, a magnifying glass over a cup of old pearls, a pot of pearls on a stove and a jar of old pearls.',
  },
];

function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = head.length;
  pngs.forEach((p, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(p.size, e); head.writeUInt8(p.size, e + 1); head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(p.buf.length, e + 8); head.writeUInt32LE(off, e + 12); off += p.buf.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.buf)]);
}

async function jpeg(from, to, px, q = 88) {
  const img = await loadImage(from), k = px / Math.max(img.width, img.height), c = createCanvas(Math.round(img.width * k), Math.round(img.height * k));
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
  fs.mkdirSync(path.dirname(path.join(DOCS, to)), { recursive: true });
  fs.writeFileSync(path.join(DOCS, to), await c.encode('jpeg', q));
}

const overlay = (p) => {
  const sh = JSON.parse(fs.readFileSync(path.join(OUT, `${p.key}-pele.json`), 'utf8')), pts = (q) => q.map((v) => v.join(',')).join(' ');
  return `<svg viewBox="0 0 216 216" role="img" aria-label="${esc(p.over)}"><rect width="216" height="216" fill="#fff" fill-opacity="0.62"/>`
    + `<g fill="none" stroke="#1b4fd1" stroke-width="0.46" stroke-linejoin="round" stroke-linecap="round">`
    + sh.boxes.map(([x, y, w, h, rx]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="#1b4fd1" fill-opacity="0.1"/>`).join('')
    + sh.lines.map((q) => `<polyline points="${pts(q)}"/>`).join('')
    + sh.heads.map((q) => `<polygon points="${pts(q)}" fill="#1b4fd1"/>`).join('')
    + sh.dots.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#1b4fd1"/>`).join('')
    + '</g></svg>';
};

const inlineSvg = (svg, label) => svg.replace('<svg ', `<svg aria-label="${esc(label)}" `).replace(/ role="graphics-document document"/, ' role="img"');

async function main() {
  fs.mkdirSync(DOCS, { recursive: true });
  for (const f of ['KevinSerif-Regular.woff2', 'KevinSans-Regular.woff2', 'KevinSans-Bold.woff2']) copy(path.join(ROOT, 'tools/fonts', f), 'fonts/' + f);
  for (const f of ['og.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) copy(path.join(OUT, f), f);
  fs.writeFileSync(path.join(DOCS, 'favicon.ico'), ico([16, 32, 48].map((size) => ({ size, buf: fs.readFileSync(path.join(OUT, `favicon-${size}.png`)) }))));
  fs.writeFileSync(path.join(DOCS, 'site.webmanifest'), JSON.stringify({
    name: 'The business of boba', short_name: 'boba statecharts', start_url: './', display: 'browser', background_color: '#faf9f6', theme_color: '#faf9f6',
    icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }],
  }, null, 2) + '\n');
  copy(path.join(__dirname, 'style.css'), 'style.css');
  fs.writeFileSync(path.join(DOCS, '.nojekyll'), '');

  const plates = [], made = [];
  for (const p of PLATES) {
    copy(path.join(OUT, `${p.key}-x.jpg`), `img/${p.key}.jpg`);
    await jpeg(path.join(OUT, `${p.key}.png`), `img/${p.key}-1080.jpg`, 1080);
    const L = await layOut(path.join(SERIES, p.dir, 'layout.mmd'), { face: 'Kevin Serif Bold' });
    const report = read(`${p.dir}/chart/report.md`);
    const states = (report.match(/TLC reached (\d+) states and (\d+) steps/) || []).slice(1);
    const bugPath = report.match(/The shortest path has[\s\S]*?(?=\n\n## )/);
    plates.push(`
  <figure class="plate" id="${p.key}">
    <a href="img/${p.key}.jpg"><img src="img/${p.key}-1080.jpg" srcset="img/${p.key}-1080.jpg 1080w, img/${p.key}.jpg 2048w" sizes="(min-width: 780px) 720px, 100vw" width="1080" height="1080" alt="${esc(p.alt)}"${p.n === 'I' ? '' : ' loading="lazy"'} decoding="async"></a>
    <figcaption><span class="num">${p.n}</span><h2>${p.title}</h2><p class="sub">${p.sub}</p><p><b>${p.kind}.</b> ${p.note}</p></figcaption>
  </figure>`);
    made.push(`
  <article class="made" id="made-${p.key}">
    <h3><span class="num">${p.n}</span> ${p.title}</h3>
    <p class="stats">TLC reached ${states[0]} states and ${states[1]} steps.</p>
    <ul class="rules">${p.rules.map(([name, words]) => `<li class="${/breaks\./.test(words) || name === 'NeverServeOldPearls' ? 'broken' : 'holds'}"><span class="mark" aria-hidden="true"></span><span>${esc(words)} <code>${name}</code></span></li>`).join('')}</ul>
    ${bugPath ? `<div class="path"><h4>The path TLC found</h4>${code(bugPath[0], 'The path TLC found to the broken rule')}</div>` : ''}
    <div class="row">
      <figure>${code(read(`${p.dir}/${p.model}`), `The model, ${p.model}`)}<figcaption>1. The model, in TLA+</figcaption></figure>
      <figure>${code(read(`${p.dir}/view.mjs`), `The view for ${p.title}`)}<figcaption>2. The view: the reader's words for each state and step</figcaption></figure>
    </div>
    <div class="row three">
      <figure>${code(read(`${p.dir}/layout.mmd`), `The Mermaid chart for ${p.title}`)}<figcaption>3. The chart /statechart wrote, with a line of layout for pele</figcaption></figure>
      <figure><div class="pele">${inlineSvg(L.svg, `pele's plain layout of ${p.title}`)}</div><figcaption>4. pele's plain layout, which the drawing follows</figcaption></figure>
      <figure><div class="over"><img src="img/${p.key}-1080.jpg" alt="" width="1080" height="1080" loading="lazy" decoding="async">${overlay(p)}</div><figcaption>5. pele's boxes and lines, in blue, on the drawing</figcaption></figure>
    </div>
  </article>`);
  }

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>The business of boba · statechart art</title>
<meta name="description" content="Four statecharts about running a boba shop: an order, a day, two jobs at once, and a bug TLC finds. Each one is checked by TLC, laid out by pele, and drawn by hand in code.">
<meta name="theme-color" content="#faf9f6">
<meta name="color-scheme" content="light">
<link rel="canonical" href="${SITE}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="statechart art">
<meta property="og:title" content="The business of boba">
<meta property="og:description" content="Four statecharts about running a boba shop, drawn by hand in code.">
<meta property="og:url" content="${SITE}">
<meta property="og:image" content="${SITE}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="The title The business of boba, four statecharts, drawn by hand, beside four pen and coloured pencil plates: an order, a day, two at once and the pearl bug.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:creator" content="@kevin_t_ngo">
<meta name="twitter:title" content="The business of boba">
<meta name="twitter:description" content="Four statecharts about running a boba shop, drawn by hand in code.">
<meta name="twitter:image" content="${SITE}og.png">
<link rel="icon" href="favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" href="icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<link rel="preload" href="fonts/KevinSerif-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/KevinSans-Regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="style.css">
</head>
<body>
<main>
<header class="top">
  <p class="kicker">statechart art</p>
  <h1>The business of boba</h1>
  <p class="lede">Four statecharts about running a boba shop, one for each kind of chart <code>/statechart</code> makes: a flat chart, a parent state, two regions at the same time, and a rule that breaks. Each one is a small TLA+ model checked by <a href="#tlc">TLC</a>, laid out by pele, and drawn by hand in pen and coloured pencil, by code.</p>
  <p class="repo">The code, the models and the drawings are on GitHub: <a href="${REPO}">${esc(REPO.replace(/^https?:\/\/(www\.)?github\.com\//, ''))}</a></p>
</header>

<section class="plates" aria-label="The four plates">
${plates.join('\n')}
</section>

<section class="how" aria-labelledby="how">
  <h2 id="how">How they were made</h2>
  <div class="tlc" id="tlc">
    <h3>What TLC is</h3>
    <p>Each chart starts as a model in TLA+, a language for saying how something works one step at a time: where it starts, and which steps can come next. <a href="https://github.com/tlaplus/tlaplus">TLC</a> is the program that checks a TLA+ model.</p>
    <p>A test tries a few cases. TLC tries all of them. From the first state it takes every step that can happen, then every step after those, until it has seen every state the model can reach. In each state it checks the rules, such as \"every drink being made has been paid for\". If a rule can break, TLC finds the shortest list of steps that breaks it. That's the red path on the pearl bug: in a rush, nobody checks how old the pearls are.</p>
  </div>
  <ol class="steps">
    <li><b>Model it.</b> A few lines of TLA+ say what can happen in the shop, and which rules must always hold.</li>
    <li><b>Check it.</b> <code>/statechart</code> runs <a href="#tlc">TLC</a> over every state the model can reach and checks each rule in each one. When a rule breaks, it finds the shortest path to the break.</li>
    <li><b>Choose the words.</b> A view says what the reader sees in each state and each step. It picks the kind of chart too: a word for a flat chart, a list for parent states, an object for regions.</li>
    <li><b>Lay it out.</b> pele lays out the Mermaid chart, measuring every word in the letters the drawing uses.</li>
    <li><b>Draw it.</b> A program draws pele's boxes and lines as things from a boba shop, tickets, signs, notes and cards, in a simulated pen and coloured pencils, and fills the space around them with the shop. Words sit on clean paper, and arrows stop short of what they point at. The last picture for each plate below puts pele's boxes and lines, in blue, over the finished drawing.</li>
  </ol>
${made.join('\n')}
</section>

<footer class="foot">
  <p>The models are checked with <a href="https://github.com/tlaplus/tlaplus">TLC</a> (MIT). The charts are laid out by <a href="https://pele.run">pele</a> (MIT). The letters are Kevin Serif and Kevin Sans, traced from A. V. Hershey's 1967 fonts (public domain). The code, the models and the drawings are <a href="${REPO}">on GitHub</a>, under the <a href="${REPO}/blob/main/LICENSE">MIT license</a>.</p>
</footer>
</main>
</body>
</html>
`;
  fs.writeFileSync(path.join(DOCS, 'index.html'), html);
  console.log('wrote', DOCS);
}
main().catch((e) => { console.error(e); process.exit(1); });
