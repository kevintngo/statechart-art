'use strict';
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { once } = require('events');
const tools = require('module').createRequire(path.join(__dirname, '..', '..', 'tools', 'package.json'));
const { createCanvas, loadImage } = tools('@napi-rs/canvas');

const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'out');
const FF = process.env.FFMPEG || 'ffmpeg';
const VW = 1080, VH = 1920, FPS = 30, SIGMA = 0.9, HOLD = 3.6;
const arg = (k, d) => { const a = process.argv.slice(2).find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const TIMELINE = arg('timeline', path.join(ROOT, 'music', 'render', 'timeline.json'));
const WAV = arg('wav', path.join(path.dirname(TIMELINE), 'song.wav'));
const DEST = arg('out', path.join(OUT, 'video', 'one-becomes-two.mp4'));
const ONLY = arg('frames', '');

const TARGETS = { one: 0, interphase: 5, copying: 13, checks: 16, mitosis: 23, metaphase: 30, anaphase: 32, two: 36 };

function sections() {
  if (!fs.existsSync(TIMELINE)) return { at: TARGETS, duration: 44, end: 44, real: false };
  const tl = JSON.parse(fs.readFileSync(TIMELINE, 'utf8')), at = {};
  for (const s of tl.sections) if (!(s.name in at)) at[s.name] = s.t0;
  for (const k of Object.keys(TARGETS)) if (!(k in at)) throw new Error(`the music has no [${k}] section`);
  return { at, duration: tl.duration, end: tl.musicEnd, real: true };
}

function smooth(keys, duration) {
  const dt = 1 / 240, n = Math.ceil(duration / dt) + 1, lin = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    let k = 0;
    while (k < keys.length - 2 && keys[k + 1][0] <= t) k++;
    const [t0, y0] = keys[k], [t1, y1] = keys[k + 1];
    lin[i] = t <= t0 ? y0 : t >= t1 ? y1 : y0 + ((y1 - y0) * (t - t0)) / (t1 - t0);
  }
  const r = Math.ceil((3 * SIGMA) / dt), w = [];
  for (let j = -r; j <= r; j++) w.push(Math.exp(-0.5 * ((j * dt) / SIGMA) ** 2));
  const sum = w.reduce((a, b) => a + b, 0), out = new Float64Array(n);
  for (let i = 0; i < n; i++) { let acc = 0; for (let j = -r; j <= r; j++) acc += lin[Math.min(n - 1, Math.max(0, i + j))] * w[j + r]; out[i] = acc / sum; }
  return (t) => out[Math.min(n - 1, Math.max(0, Math.round(t / dt)))];
}

async function main() {
  const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'sheets.json'), 'utf8'));
  const placed = [];
  let py = 0;
  for (const s of meta.sheets) {
    const im = await loadImage(path.join(OUT, 'sheets', s.file)), ph = Math.round((im.height * VW) / im.width);
    placed.push({ ...s, im, py, ph });
    py += ph;
  }
  const H = py, wall = createCanvas(VW, H), g = wall.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  for (const s of placed) g.drawImage(s.im, 0, s.py, VW, s.ph);
  const px = (id, mm) => { const s = placed.find((q) => q.id === id); return s.py + ((mm == null ? s.h / 2 : mm) * s.ph) / s.h; };
  const maxY = H - VH;
  const view = (focus, frac) => Math.max(0, Math.min(maxY, focus - frac * VH));
  const { at, duration, end, real } = sections();
  const tEnd = Math.min(end, duration - HOLD);
  const keys = [
    [0, 0], [at.interphase, 0],
    [at.copying, view(px('copying'), 0.55)],
    [at.checks, view(px('second-check'), 0.55)],
    [at.mitosis, view(px('prophase', 24), 0.3)],
    [at.metaphase, view(px('metaphase'), 0.5)],
    [at.anaphase, view(px('anaphase'), 0.5)],
    [at.two, view(px('cytokinesis'), 0.5)],
    [tEnd, maxY], [duration, maxY],
  ];
  const mmps = VW / meta.W;
  for (let i = 1; i < keys.length; i++) { const [t0, y0] = keys[i - 1], [t1, y1] = keys[i]; console.log(`${t0.toFixed(2)}s → ${t1.toFixed(2)}s  ${(y0 / mmps).toFixed(0)} → ${(y1 / mmps).toFixed(0)} mm  ${t1 > t0 ? ((y1 - y0) / mmps / (t1 - t0)).toFixed(1) : '-'} mm/s`); }
  const y = smooth(keys, duration), frames = Math.round(duration * FPS), ys = [];
  let last = 0, peak = 0;
  for (let i = 0; i < frames; i++) { const v = Math.max(last, Math.min(maxY, Math.round(y(i / FPS)))); peak = Math.max(peak, v - last); ys.push(v); last = v; }
  console.log(`${real ? 'music' : 'target'} timing, ${duration.toFixed(2)} s, ${frames} frames, wall ${VW}x${H}, peak ${(peak * FPS / mmps).toFixed(1)} mm/s`);
  const data = g.getImageData(0, 0, VW, H).data, buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength), row = VW * 4;
  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  if (ONLY) {
    for (const t of ONLY.split(',').map(Number)) {
      const c = createCanvas(VW, VH), cg = c.getContext('2d'), img = cg.createImageData(VW, VH), v = ys[Math.min(frames - 1, Math.round(t * FPS))];
      img.data.set(buf.subarray(v * row, (v + VH) * row)); cg.putImageData(img, 0, 0);
      fs.writeFileSync(path.join(path.dirname(DEST), `frame-${t}.jpg`), await c.encode('jpeg', 85));
    }
    return;
  }
  const silent = DEST.replace(/\.mp4$/, '-silent.mp4');
  const ff = spawn(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${VW}x${VH}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2', '-g', String(FPS * 4), '-movflags', '+faststart', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (const v of ys) if (!ff.stdin.write(buf.subarray(v * row, (v + VH) * row))) await once(ff.stdin, 'drain');
  ff.stdin.end();
  const [code] = await once(ff, 'close');
  if (code) throw new Error('ffmpeg failed while encoding frames');
  if (!real || !fs.existsSync(WAV)) { console.log('wrote', silent, '(no music yet)'); return; }
  const mux = spawn(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-i', silent, '-i', WAV, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', DEST], { stdio: 'inherit' });
  const [code2] = await once(mux, 'close');
  if (code2) throw new Error('ffmpeg failed while adding the music');
  fs.rmSync(silent);
  console.log('wrote', DEST, (fs.statSync(DEST).size / 1e6).toFixed(1), 'MB');
}

main().catch((e) => { console.error(e); process.exit(1); });
