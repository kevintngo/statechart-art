import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), OUT = path.join(here, '..', 'out', 'shots');
const arg = (k, d) => { const a = process.argv.slice(2).find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const url = arg('url', 'http://localhost:5299/'), size = arg('size', '1440x900').split('x').map(Number), at = arg('at', ''), name = arg('name', 'shot'), eval_ = arg('eval', ''), scroll = arg('scroll', '');
fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  userDataDir: arg('profile', path.join(here, '..', 'out', 'chrome-profile')),
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', ...(process.argv.includes('--nogl') ? ['--disable-webgl', '--disable-3d-apis'] : [])],
  defaultViewport: { width: size[0], height: size[1], deviceScaleFactor: Number(arg('dpr', 1)) },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForFunction('document.body.classList.contains("ready") || document.documentElement.classList.contains("no-webgl")', { timeout: 60000 }).catch(() => logs.push('never ready'));
const info = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'no webgl2'; });
const points = scroll ? scroll.split(',') : at ? at.split(',') : [''];
for (const [i, p] of points.entries()) {
  if (scroll && p !== '') { await page.evaluate((s) => window.scrollTo(0, Number(s) * window.innerHeight), p); await new Promise((r) => setTimeout(r, 2200)); }
  else if (p !== '') await page.evaluate((s) => window.__catch.goto(Number(s)), p);
  if (eval_) await page.evaluate(eval_);
  await new Promise((r) => setTimeout(r, 400));
  const file = path.join(OUT, `${name}${points.length > 1 ? '-' + String(i).padStart(2, '0') : ''}.png`);
  await page.screenshot({ path: file });
  console.log(file);
}
console.log('renderer:', info);
for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();
