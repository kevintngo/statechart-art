import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(here, '..'), OUT = path.join(ROOT, 'out', 'brand');
const tools = createRequire(path.join(ROOT, '..', 'tools', 'package.json'));
const { createCanvas, loadImage, GlobalFonts } = tools('@napi-rs/canvas');
const FONTS = path.join(ROOT, '..', 'tools', 'fonts');
GlobalFonts.registerFromPath(path.join(FONTS, 'KevinSans-Bold.ttf'), 'Kevin Sans Bold');
GlobalFonts.registerFromPath(path.join(FONTS, 'KevinSans-Regular.ttf'), 'Kevin Sans');

const arg = (k, d) => { const a = process.argv.slice(2).find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const at = Number(arg('at', '7.85')), name = arg('name', 'og'), [W, H] = arg('size', '1200x630').split('x').map(Number);

fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  userDataDir: path.join(ROOT, 'out', 'chrome-profile'),
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check'],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 2 },
});
const page = await browser.newPage();
await page.goto(arg('url', 'http://localhost:5299/'), { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForFunction('document.body.classList.contains("ready")', { timeout: 60000 });
await page.evaluate((s) => { for (const q of ['main', '.regions']) document.querySelector(q).style.display = 'none'; window.__catch.goto(s); }, at);
await new Promise((r) => setTimeout(r, 600));
const shot = await page.screenshot({ type: 'png' });
await browser.close();

if (process.argv.includes('--bare')) { const file = path.join(OUT, `${name}.jpg`), im = await loadImage(shot), c0 = createCanvas(W, H); c0.getContext('2d').drawImage(im, 0, 0, W, H); fs.writeFileSync(file, await c0.encode('jpeg', 86)); console.log(file); process.exit(0); }
const c = createCanvas(W, H), g = c.getContext('2d');
g.imageSmoothingQuality = 'high';
g.drawImage(await loadImage(shot), 0, 0, W, H);
const card = { x: 46, y: 140, w: 460, h: 330 };
g.save(); g.translate(card.x + card.w / 2, card.y + card.h / 2); g.rotate(-0.008); g.translate(-card.w / 2, -card.h / 2);
g.fillStyle = 'rgba(11, 10, 11, 0.85)'; g.fillRect(5, 6, card.w, card.h);
g.fillStyle = '#f6efe2'; g.fillRect(0, 0, card.w, card.h);
g.strokeStyle = '#6f655a'; g.lineWidth = 1.5; g.strokeRect(0.75, 0.75, card.w - 1.5, card.h - 1.5);
g.fillStyle = '#1d1a1e'; g.font = '88px "Kevin Sans Bold"'; g.textBaseline = 'alphabetic'; g.fillText('Catch', 32, 112);
g.fillStyle = '#4a4038'; g.font = '22px "Kevin Sans"';
const lines = ['Starship’s booster flies home', 'and is caught by its tower.', 'A statechart in paper, thread', 'and light.'];
lines.forEach((l, i) => { if (34 + g.measureText(l).width > card.w - 24) throw new Error('og line too wide: ' + l); g.fillText(l, 34, 164 + i * 33); });
g.save(); g.beginPath(); g.roundRect(34, 291, 52, 11, 5.5); g.clip(); g.fillStyle = '#f6ecd2'; g.fillRect(34, 291, 52, 11); g.fillStyle = '#e2b33f'; for (let x = 34; x < 86; x += 14) g.fillRect(x, 291, 8, 11); g.restore(); g.strokeStyle = '#3a2a14'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(34, 291, 52, 11, 5.5); g.stroke();
g.fillStyle = '#4a4038'; g.font = '19px "Kevin Sans"'; g.fillText('Checked by TLC', 100, 301);
g.restore();
const file = path.join(OUT, `${name}.jpg`);
fs.writeFileSync(file, await c.encode('jpeg', 90));
console.log(file);
