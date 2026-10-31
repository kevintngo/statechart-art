import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(here, '..');
const arg = (k, d) => { const a = process.argv.slice(2).find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const SIZE = 1080, FPS = Number(arg('fps', 60)), END = Number(arg('end', 45.5)), FADE = 2, FF = process.env.FFMPEG || 'ffmpeg';
const MUSIC = path.join(ROOT, 'music', 'render'), DEST = arg('out', path.join(ROOT, 'out', 'video', 'catch.mp4'));
const timeline = JSON.parse(fs.readFileSync(path.join(MUSIC, 'timeline.json'), 'utf8'));
const STATIONS_AT_BARS = [[0, 0], [2, 1], [3, 2], [4, 3], [5, 4], [6, 5], [7, 6], [8, 7], [9, 8], [10, 9], [11, 10], [12, 11], [14, 12]];

function hermite(keys) {
  const n = keys.length, d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((keys[i + 1][1] - keys[i][1]) / (keys[i + 1][0] - keys[i][0]));
  for (let i = 0; i < n; i++) m.push(i === 0 || i === n - 1 ? 0 : d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]));
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (keys[i + 1][0] < t) i++;
    const [t0, y0] = keys[i], [t1, y1] = keys[i + 1], h = t1 - t0, u = (t - t0) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * h * m[i + 1];
  };
}

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  userDataDir: path.join(ROOT, 'out', 'chrome-video'),
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check'],
  defaultViewport: { width: SIZE, height: SIZE, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
await page.goto(arg('url', 'http://localhost:5299/'), { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForFunction('document.body.classList.contains("ready")', { timeout: 60000 });
await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
const geo = await page.evaluate(async () => {
  const img = document.querySelector('.plate img');
  img.loading = 'eager';
  if (!img.complete) await new Promise((r) => { img.onload = r; img.onerror = r; });
  const top = (el) => el.getBoundingClientRect().top + window.scrollY;
  return { tops: [...document.querySelectorAll('.station')].map(top), plate: top(document.getElementById('sampler')), img: top(img), h: window.innerHeight, max: document.documentElement.scrollHeight - window.innerHeight };
});

const bar = (n) => timeline.bars[n];
const rest = Math.min(geo.max, geo.img + 10);
const keys = [...STATIONS_AT_BARS.map(([b, s]) => [bar(b), geo.tops[s]]), [bar(16), geo.plate - geo.h / 2], [END - FADE, rest], [END, rest]];
const scrollAt = hermite(keys), frames = Math.round(END * FPS);
console.log(`${frames} frames at ${FPS} fps, ${END} s; ${keys.length} keys; rests at ${Math.round(rest)} of ${Math.round(geo.max)} px`);

fs.mkdirSync(path.dirname(DEST), { recursive: true });
const ff = spawn(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', path.join(MUSIC, 'song.wav'),
  '-map', '0:v', '-map', '1:a', '-vf', `scale=${SIZE}:${SIZE}:flags=lanczos:in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p,fade=t=out:st=${END - FADE}:d=${FADE}`, '-af', `afade=t=out:st=${END - FADE - 0.5}:d=${FADE + 0.5}`, '-t', String(END),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-profile:v', 'high', '-level', '4.2', '-g', String(FPS * 2),
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', DEST], { stdio: ['pipe', 'inherit', 'inherit'] });
const started = Date.now();
for (let i = 0; i < frames; i++) {
  const t = i / FPS;
  await page.evaluate((y, ms) => { window.scrollTo(0, y); window.__catch.film(ms); }, scrollAt(t), t * 1000);
  const shot = await page.screenshot({ type: 'jpeg', quality: 92, optimizeForSpeed: true });
  if (!ff.stdin.write(shot)) await once(ff.stdin, 'drain');
  if (i % (FPS * 5) === 0) console.log(`${t.toFixed(0)} s, ${((Date.now() - started) / 1000).toFixed(0)} s in`);
}
ff.stdin.end();
const [code] = await once(ff, 'close');
await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
browser.process()?.kill('SIGKILL');
if (code) throw new Error('ffmpeg failed');
console.log('wrote', DEST, (fs.statSync(DEST).size / 1e6).toFixed(1), 'MB');
