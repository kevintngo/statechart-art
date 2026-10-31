'use strict';
const path = require('path');
const fs = require('fs');
const tools = require('module').createRequire(path.join(__dirname, '..', '..', 'tools', 'package.json'));
const { loadImage, createCanvas } = tools('@napi-rs/canvas');

const ROOT = path.join(__dirname, '..'), WEB = path.join(ROOT, 'web'), OUT = path.join(ROOT, 'out');
const SITE = path.join(ROOT, '..', 'docs', 'catch');
const THREE = path.join(ROOT, 'node_modules', 'three');

const newer = (a, b) => !fs.existsSync(b) || fs.statSync(a).mtimeMs > fs.statSync(b).mtimeMs;
const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };

async function webp(from, to, q = 86) {
  if (!newer(from, to)) return false;
  const im = await loadImage(from), c = createCanvas(im.width, im.height);
  c.getContext('2d').drawImage(im, 0, 0);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, await c.encode('webp', q));
  return true;
}

async function main() {
  fs.mkdirSync(SITE, { recursive: true });
  copy(path.join(THREE, 'build', 'three.module.js'), path.join(SITE, 'vendor', 'three.module.js'));
  copy(path.join(THREE, 'build', 'three.core.js'), path.join(SITE, 'vendor', 'three.core.js'));
  for (const f of ['utils/BufferGeometryUtils.js', 'postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js', 'postprocessing/UnrealBloomPass.js', 'postprocessing/OutputPass.js', 'postprocessing/ShaderPass.js', 'postprocessing/MaskPass.js', 'postprocessing/Pass.js', 'shaders/CopyShader.js', 'shaders/LuminosityHighPassShader.js', 'shaders/OutputShader.js']) copy(path.join(THREE, 'examples', 'jsm', f), path.join(SITE, 'vendor', 'addons', f));
  copy(path.join(THREE, 'LICENSE'), path.join(SITE, 'vendor', 'LICENSE-three.txt'));
  for (const f of fs.readdirSync(WEB)) if (/\.(js|css)$/.test(f)) copy(path.join(WEB, f), path.join(SITE, f === 'style.css' ? f : path.join('js', f)));
  let n = 0;
  for (const f of fs.readdirSync(path.join(OUT, 'tex'))) if (f.endsWith('.png') && (await webp(path.join(OUT, 'tex', f), path.join(SITE, 'tex', f.replace(/\.png$/, '.webp'))))) n++;
  for (const f of ['KevinSans-Regular.woff2', 'KevinSans-Bold.woff2']) copy(path.join(ROOT, '..', 'tools', 'fonts', f), path.join(SITE, 'fonts', f));
  copy(path.join(ROOT, 'model', 'chart', 'chart.mmd'), path.join(SITE, 'js', 'chart.mmd'));
  copy(path.join(ROOT, 'model', 'chart', 'chart.mmd'), path.join(SITE, 'chart.txt'));
  if (fs.existsSync(path.join(OUT, 'patches.json'))) copy(path.join(OUT, 'patches.json'), path.join(SITE, 'js', 'patches.json'));
  const mmd = path.join(ROOT, 'model', 'chart', 'chart.mmd'), lay = path.join(OUT, 'layout.json');
  if (!fs.existsSync(lay) || newer(mmd, lay)) throw new Error('the chart changed: run node art/layout.js first');
  copy(lay, path.join(SITE, 'js', 'layout.json'));
  copy(path.join(OUT, 'chart.svg'), path.join(SITE, 'chart.svg'));
  const { STATIONS } = await import(require('url').pathToFileURL(path.join(WEB, 'story.js')).href);
  const { parseChart, flown } = await import(require('url').pathToFileURL(path.join(WEB, 'chartdata.js')).href);
  const chart = parseChart(fs.readFileSync(mmd, 'utf8')), plain = (t) => t.replace(/\u2019/g, "'");
  const arrows = new Set(chart.edges.map((e) => e.label.replace(/ \[when .*\]$/, '')));
  for (const st of STATIONS) if (st.step && !arrows.has(plain(st.step))) throw new Error('not a chart arrow: ' + st.step);
  const visited = new Set(STATIONS.flatMap((st) => Object.values(st.regions)));
  for (const s of Object.values(chart.states)) if (flown(s.label) !== visited.has(s.label)) throw new Error('FLOWN disagrees with the stations: ' + s.label);
  const report = fs.readFileSync(path.join(ROOT, 'model', 'chart', 'report.md'), 'utf8'), counts = report.match(/TLC reached (\d+) states and (\d+) steps/);
  const path_ = (rule) => { const m = report.match(new RegExp('## ' + rule + ' breaks\\nThe shortest path has (\\d+) steps')); if (!m) throw new Error('no path for ' + rule); return m[1]; };
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const now = (st) => ['booster', 'ship', 'tower'].map((k) => `The ${k}: ${st.regions[k]}`).join('. ') + '.';
  const sections = STATIONS.map((st, i) => {
    if (i === 0) return `<section class="station title" data-key="${st.key}"><div class="card">
<h1>Catch</h1>
<p class="sub">Starship\u2019s booster flies home and is caught by its tower. A statechart in paper, thread and light.</p>
<p class="credits">Charted with the /statechart skill by <a href="https://x.com/poteto">@poteto</a>. Checked by <a href="https://github.com/tlaplus/tlaplus">TLC</a>, laid out by <a href="https://pele.run">pele</a>, built with <a href="https://threejs.org">three.js</a>. Lettering in Kevin Sans, traced from A. V. Hershey\u2019s 1967 fonts. The code is on <a href="https://github.com/kevintngo/statechart-art">GitHub</a>, under the <a href="https://github.com/kevintngo/statechart-art/blob/main/LICENSE">MIT license</a>. An unofficial fan piece.</p>
<p class="now">${esc(now(st))}</p>
<h2>${esc(st.title)}</h2>
<p>${esc(st.text)}</p>
<p class="hint">Scroll to fly. <button type="button" class="hold" aria-pressed="false">Hold the picture still</button></p>
</div><span class="cue" aria-hidden="true">Scroll<svg viewBox="0 0 12 16"><path d="M6.1 1.4C5.6 5.2 6.5 9.1 6 13.7M1.8 9.4C3.4 10.9 4.7 12.3 6 13.9 7.3 12.4 8.6 11 10.3 9.3"/></svg></span></section>`;
    if (i === STATIONS.length - 1) return `<section class="station finale" data-key="${st.key}"><div class="card">
<h2>${esc(st.title)}</h2>
<p>TLC, a model checker, tried every way this model of the flight can go: ${counts ? counts[1] : ''} states and ${counts ? counts[2] : ''} steps, with the booster, the ship and the tower changing side by side, sometimes in the same step.</p>
<ul>
<li>Holds: the arms close only when a booster is coming in to them.</li>
<li>Holds: the booster turns back only after the ship is free.</li>
<li>Holds: the flight never gets stuck.</li>
<li class="breaks">Breaks if the go/no-go poll is skipped and the booster comes in by default: a booster with a failed check heads for the tower anyway (${path_('HeadsForTowerOnlyWhenGo')} steps), and then it hits the tower (${path_('TowerNeverHit')} steps).</li>
</ul>
<p>The poll is the guard. With it, a failed check sends the booster to the sea instead. On real flights the sea is the default: the booster comes in only if every check passes and the flight director calls \u201cgo\u201d before the boostback burn ends.</p>
</div></section>`;
    return `<section class="station" data-key="${st.key}"><div class="card">
${st.step ? `<p class="step">${esc(st.step)}</p>` : ''}
<h2>${esc(st.title)}</h2>
<p class="now">${esc(now(st))}</p>
<p>${esc(st.text)}</p>
</div></section>`;
  }).join('\n');
  const sampler = JSON.parse(fs.readFileSync(path.join(OUT, 'sampler.json'), 'utf8'));
  const plate = `<section class="plate" id="sampler" aria-labelledby="plate-title"><div class="plate-head">
<h2 id="plate-title">The whole chart, in thread</h2>
<p>Every state each part can be in, and every step between them, stitched into one sampler. Gold is the flight that works. Red is where the path TLC found goes wrong when the go/no-go poll is skipped, and a small red knot marks each state on that path. Cream is every other way it can go.</p>
</div>
<figure>
<a href="tex/sampler.webp"><img src="tex/sampler.webp" width="${sampler.width}" height="${sampler.height}" loading="lazy" decoding="async" alt="An embroidered statechart on linen, titled Catch. Under the heading At the same time, three columns run side by side: the booster, the ship and the tower. Navy felt patches with gold borders mark the flight that works, joined by gold running stitches, from Filling with propellant down to Caught by the arms, Splashed down and Holding the booster. Cream linen patches mark holding the count, scrubbing and diverting to the sea. A red stitched path leads to three rust patches where a rule breaks: Coming in on a failed check, Hits the tower, and Damaged."></a>
<figcaption>Drawn in JavaScript, one stitch at a time. See the same chart <a href="chart.svg">as pele draws it</a>, or read its <a href="chart.txt">Mermaid text</a>.</figcaption>
</figure>
</section>`;
  for (const f of ['og.jpg', 'poster.jpg', 'favicon.ico', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) { const from = path.join(OUT, 'brand', f); if (fs.existsSync(from)) copy(from, path.join(SITE, f)); else console.warn('missing', from, '(run node art/brand.js, then node art/og.mjs with the page served)'); }
  fs.writeFileSync(path.join(SITE, 'site.webmanifest'), JSON.stringify({ name: 'Catch', short_name: 'Catch', start_url: './', display: 'browser', background_color: '#14152c', theme_color: '#14152c', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2) + '\n');
  const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8').replace('{{STATIONS}}', sections + '\n' + plate);
  fs.writeFileSync(path.join(SITE, 'index.html'), html);
  console.log('built', SITE, `(${n} textures encoded)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
