import { init, actions, key } from './cellcycle.mjs';
import { state, step as wording } from './view.mjs';

const CELLS = {
  'Growing (G1)': ['g1', 'The gold cell grows, with sugar drifting in toward it.'],
  'Resting (G0)': ['g0', 'The gold cell, small and quiet, resting.'],
  'Damaged, held by p53': ['held-p53', 'A red cross marks broken DNA in the nucleus; green p53 proteins hold on beside it.'],
  'Damaged, and p53 is broken': ['p53-broken', 'A red cross marks broken DNA, and the p53 protein is grey and crossed out.'],
  'Copying its DNA (S)': ['s', 'The nucleus holds doubled threads, gold and blue: the DNA being copied.'],
  'Copying damaged DNA': ['s-damaged', 'The DNA is being copied, and the red damage is copied with it.'],
  'Checking the copy (G2)': ['g2', 'A bigger cell; its nucleus holds two copies of every thread.'],
  'Damaged, held at the second check': ['held-g2', 'Broken DNA in the copied nucleus, with purple repair rings on the break.'],
  'Dies on purpose (apoptosis)': ['apoptosis', 'The cell has broken into round pieces, and a purple cleaner cell comes to eat them.'],
  'Coiling up (prophase)': ['prophase', 'Three X-shaped chromosomes, purple, green and blue, coil up inside the nucleus.'],
  'The spindle reaches in (prometaphase)': ['prometaphase', 'The nucleus breaks open, and two poles reach in with fibres.'],
  'Some caught, the check waits': ['caught-wait', 'Fibres hold two chromosomes from both sides; the blue one is held from one side only, and a red signal says wait.'],
  'Some caught, the check is broken': ['caught-broken', 'The blue chromosome is held from one side only, and the wait signal is grey and broken.'],
  'Lined up in the middle (metaphase)': ['metaphase', 'Three chromosomes line up in the middle, pulled from both poles.'],
  'Pulled apart too soon': ['too-soon', 'Purple and green split in two, but the blue chromosome is dragged whole to one side.'],
  'Sisters pulled apart (anaphase)': ['anaphase', 'Each chromosome splits, and the halves are pulled to opposite poles.'],
  'Two nuclei form (telophase)': ['telophase', 'A long cell with a new nucleus forming at each end.'],
  'Pinching in two (cytokinesis)': ['cytokinesis', 'A red ring pinches the cell in two.'],
  'Two cells with the wrong chromosomes': ['uneven', 'Two cells: one is missing the blue chromosome, and the other has two.'],
  'Two healthy cells': ['healthy', 'Two gold cells, each with one of every chromosome.'],
  'Two cells carrying a mutation': ['mutation', 'Two gold cells; each nucleus carries a red mark, the copied damage.'],
};
const ENDINGS = {
  'Two healthy cells': 'Each daughter begins again at the top.',
  'Two cells carrying a mutation': 'Both daughters carry the copied damage.',
  'Two cells with the wrong chromosomes': 'One daughter has an extra chromosome, and one is short.',
  'Dies on purpose (apoptosis)': 'Too much damage: the cell takes itself apart, so the damage is never passed on.',
};
const ORDER = { gold: 0, plain: 1, red: 2 };

const wall = document.querySelector('.wall'), panel = document.getElementById('stepper'), opener = document.getElementById('step-open');
const marks = document.getElementById('step-marks'), spot = document.getElementById('step-spot'), route = document.getElementById('step-route'), token = document.getElementById('step-token');
const $ = (id) => document.getElementById(id);
const still = matchMedia('(prefers-reduced-motion: reduce)'), wide = matchMedia('(min-width: 900px)');
const leaf = (v) => { const s = state(v); return s[s.length - 1]; };
const chapterOf = (v) => { const s = state(v); return s.length > 1 ? s[0] : ''; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let data = null, hist = [], playing = false, travelling = null, loop = 0, open = false;
const view = { cur: null, prev: null, fadeStart: 0, fadeDur: 0 };
const frames = new Map();

function moves(set) {
  const here = leaf(set[0]), groups = new Map();
  for (const v of set) for (const a of actions) {
    if (!a.when(v)) continue;
    const w = a.then(v), to = leaf(w);
    if (to === here) continue;
    const label = wording(a.name, v, w), k = label + '>' + to;
    if (!groups.has(k)) groups.set(k, { label, to, next: [] });
    const g = groups.get(k);
    if (!g.next.some((x) => key(x) === key(w))) g.next.push(w);
  }
  return [...groups.values()].map((m) => ({ ...m, edge: edgeOf(here, m.to) })).sort((a, b) => ORDER[a.edge?.kind ?? 'plain'] - ORDER[b.edge?.kind ?? 'plain']);
}
const edgeOf = (from, to) => data.edges.find((e) => e.from === from && e.to === to);
const top = () => hist[hist.length - 1];

function load(slug) {
  if (!frames.has(slug)) frames.set(slug, [0, 1, 2].map((k) => { const im = new Image(); im.decoding = 'async'; im.src = `cells/${slug}-${k}.webp`; im.onload = () => draw(performance.now()); return im; }));
  return frames.get(slug);
}

function draw(now) {
  const cv = $('step-cell'), g = cv.getContext('2d');
  const size = Math.round(cv.clientWidth * (window.devicePixelRatio || 1));
  if (size && cv.width !== size) { cv.width = size; cv.height = size; }
  g.clearRect(0, 0, cv.width, cv.height);
  const k = still.matches ? 0 : [0, 1, 2, 1][Math.floor(now / 180) % 4];
  const t = view.fadeDur ? Math.min(1, (now - view.fadeStart) / view.fadeDur) : 1;
  const paint = (slug, a) => { if (!slug) return; const im = load(slug)[k]; if (!im.complete || !im.naturalWidth) return; g.globalAlpha = a; g.drawImage(im, 0, 0, cv.width, cv.height); };
  if (view.prev && t < 1) paint(view.prev, 1);
  paint(view.cur, t);
  g.globalAlpha = 1;
}

function animate(now) {
  draw(now);
  loop = open && !still.matches ? requestAnimationFrame(animate) : 0;
}

function showCell(label, dur) {
  const slug = CELLS[label][0];
  view.prev = view.cur; view.cur = slug; view.fadeStart = performance.now(); view.fadeDur = still.matches ? 0 : dur;
  $('step-cell').setAttribute('aria-label', CELLS[label][1]);
  draw(performance.now());
}

const pct = (v, of) => `${(v / of) * 100}%`;
function aim(r, round, dur) {
  spot.style.transitionDuration = still.matches ? '0ms' : `${dur}ms`;
  spot.style.left = pct(r.x - 2.2, data.W); spot.style.top = pct(r.y - 2.2, data.total);
  spot.style.width = pct(r.w + 4.4, data.W); spot.style.height = pct(r.h + 4.4, data.total);
  spot.classList.toggle('round', !!round);
}
const startRect = () => ({ x: data.start[0] - 9, y: data.start[1] - 8.5, w: 18, h: 17 });

function visible() { return window.innerHeight - (wide.matches ? 0 : panel.offsetHeight); }
function follow(yMm, smooth) {
  const r = wall.getBoundingClientRect(), y = r.top + window.scrollY + (yMm / data.total) * r.height;
  window.scrollTo({ top: Math.max(0, y - visible() * 0.42), behavior: smooth && !still.matches ? 'smooth' : 'instant' });
}
const centre = (r) => [r.x + r.w / 2, r.y + r.h / 2];
const arrival = (edge, r) => (edge ? edge.pts[edge.pts.length - 1] : [r.x + r.w / 2, r.y - 1.5]);
function put(p) { token.setAttribute('transform', `translate(${p[0]} ${p[1]})`); }

function travel(edge, end) {
  if (travelling) travelling.finish();
  if (!edge || still.matches || document.hidden) { put(end); follow(end[1], false); return Promise.resolve(); }
  route.setAttribute('d', 'M' + edge.pts.map((p) => p.join(' ')).join(' L'));
  const L = route.getTotalLength(), dur = Math.max(800, Math.min(2600, 500 + L * 7));
  route.style.transition = 'none'; route.style.strokeDasharray = `${L}`; route.style.strokeDashoffset = `${L}`; route.style.opacity = '1';
  return new Promise((resolve) => {
    const t0 = performance.now();
    let id = 0, guard = 0;
    const finish = () => { cancelAnimationFrame(id); clearTimeout(guard); put(end); follow(end[1], false); route.style.strokeDashoffset = '0'; route.style.transition = ''; route.style.opacity = '0'; travelling = null; resolve(); };
    const frame = (now) => {
      const u = Math.min(1, (now - t0) / dur), e = 0.5 - Math.cos(Math.PI * u) / 2, p = route.getPointAtLength(e * L);
      put([p.x, p.y]); route.style.strokeDashoffset = `${L * (1 - e)}`; follow(p.y, false);
      if (u < 1) id = requestAnimationFrame(frame); else finish();
    };
    travelling = { finish, dur };
    guard = setTimeout(finish, dur + 400);
    id = requestAnimationFrame(frame);
  });
}

function note(set) {
  const p53 = new Set(set.map((v) => v.p53)), spindle = new Set(set.map((v) => v.spindleCheck)), parts = [];
  if (p53.size === 1 && spindle.size === 1 && [...p53][0] === 'working' && [...spindle][0] === 'working') return 'This cell: both checks work.';
  if (p53.size === 1 && [...p53][0] === 'broken') parts.push('its p53 is broken');
  if (spindle.size === 1 && [...spindle][0] === 'broken') parts.push('its spindle check is broken');
  return parts.length ? `This cell: ${parts.join(', and ')}.` : '';
}

function render(focusFirst) {
  const { set } = top(), here = leaf(set[0]), list = moves(set), end = ENDINGS[here];
  $('step-chapter').textContent = chapterOf(set[0]) || 'The end';
  $('step-now').textContent = here;
  $('step-cell-note').textContent = note(set);
  $('step-ask').textContent = list.length ? 'What can happen next?' : end || 'This is an ending.';
  const ul = $('step-moves');
  ul.replaceChildren(...list.map((m) => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.className = `move ${m.edge?.kind ?? 'plain'}`;
    b.innerHTML = `<span class="swatch" aria-hidden="true"></span><span class="what"></span><span class="to"></span>`;
    b.querySelector('.what').textContent = m.label;
    b.querySelector('.to').textContent = `to ${m.to}`;
    b.addEventListener('click', () => { stopPlay(); choose(m); });
    li.append(b); return li;
  }));
  $('step-hint').hidden = !list.some((m) => m.label.includes('['));
  $('step-back').disabled = hist.length < 2;
  $('step-play').disabled = !list.length;
  const ol = $('step-trail');
  ol.replaceChildren(...hist.map((h, i) => { const li = document.createElement('li'); li.textContent = (h.via ? `${h.via}: ` : '') + leaf(h.set[0]); if (i === hist.length - 1) li.setAttribute('aria-current', 'step'); return li; }));
  $('step-live').textContent = `${here}. ${list.length ? `${list.length} ${list.length === 1 ? 'step' : 'steps'} can happen next.` : end || 'This is an ending.'}`;
  if (focusFirst) (ul.querySelector('button') || $('step-again')).focus({ preventScroll: true });
}

async function choose(m) {
  if (travelling) travelling.finish();
  const r = data.nodes[m.to], hadFocus = panel.contains(document.activeElement), depth = hist.length + 1;
  hist.push({ set: m.next, via: m.label });
  const dur = m.edge ? Math.max(800, Math.min(2600, 500 + routeLength(m.edge) * 7)) : 0;
  showCell(m.to, Math.min(dur, 900));
  aim(r, false, dur);
  render(false);
  if (hadFocus) $('step-now').focus({ preventScroll: true });
  await travel(m.edge, arrival(m.edge, r));
  if (hadFocus && !playing && hist.length === depth) ($('step-moves').querySelector('button') || $('step-again')).focus({ preventScroll: true });
}
const routeLength = (e) => { let s = 0; for (let i = 1; i < e.pts.length; i++) s += Math.hypot(e.pts[i][0] - e.pts[i - 1][0], e.pts[i][1] - e.pts[i - 1][1]); return s; };

async function start() {
  stopPlay();
  if (travelling) travelling.finish();
  hist = [{ set: init(), via: '' }];
  const g1 = data.nodes['Growing (G1)'], edge = edgeOf('[*]', 'Growing (G1)');
  put(data.start); aim(startRect(), true, 0); follow(data.start[1], true);
  showCell('Growing (G1)', 0);
  render(true);
  await sleep(still.matches ? 0 : 500);
  aim(g1, false, 1200);
  await travel(edge, arrival(edge, g1));
}

function back() {
  if (hist.length < 2) return;
  stopPlay();
  if (travelling) travelling.finish();
  hist.pop();
  const here = leaf(top().set[0]), r = data.nodes[here];
  const via = hist.length > 1 ? edgeOf(leaf(hist[hist.length - 2].set[0]), here) : edgeOf('[*]', here);
  showCell(here, 300); aim(r, false, 400); put(arrival(via, r)); follow(centre(r)[1], true);
  render(true);
}

async function play() {
  if (playing) { stopPlay(); return; }
  playing = true; $('step-play').textContent = 'Pause'; $('step-play').setAttribute('aria-pressed', 'true');
  while (playing) {
    const list = moves(top().set);
    if (!list.length) break;
    await choose(list[0]);
    if (!playing) break;
    await sleep(still.matches ? 2200 : 1100);
  }
  stopPlay();
}
function stopPlay() { playing = false; const b = $('step-play'); b.textContent = 'Play'; b.setAttribute('aria-pressed', 'false'); }

async function openStepper() {
  if (!data) data = await (await fetch('js/chart.json')).json();
  open = true;
  panel.hidden = false; marks.hidden = false; document.body.classList.add('stepping');
  opener.setAttribute('aria-expanded', 'true');
  Object.values(CELLS).forEach(([slug]) => load(slug));
  wall.querySelectorAll('img[loading="lazy"]').forEach((im) => { im.loading = 'eager'; });
  if (!loop && !still.matches) loop = requestAnimationFrame(animate);
  await start();
}
function closeStepper() {
  stopPlay(); if (travelling) travelling.finish();
  open = false; cancelAnimationFrame(loop); loop = 0;
  panel.hidden = true; marks.hidden = true; document.body.classList.remove('stepping');
  opener.setAttribute('aria-expanded', 'false');
  opener.focus({ preventScroll: true });
  const b = opener.getBoundingClientRect();
  if (b.top < 0 || b.bottom > window.innerHeight) window.scrollTo({ top: Math.max(0, b.top + window.scrollY - 120), behavior: still.matches ? 'instant' : 'smooth' });
}

opener.addEventListener('click', () => (open ? closeStepper() : openStepper()));
$('step-back').addEventListener('click', back);
$('step-play').addEventListener('click', play);
$('step-again').addEventListener('click', () => { start(); });
$('step-close').addEventListener('click', closeStepper);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) closeStepper(); });
still.addEventListener('change', () => { if (open && !still.matches && !loop) loop = requestAnimationFrame(animate); draw(performance.now()); });
window.addEventListener('resize', () => { if (open) draw(performance.now()); });
