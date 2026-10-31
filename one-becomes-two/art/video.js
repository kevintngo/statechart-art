'use strict';
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { once } = require('events');
const tools = require('module').createRequire(path.join(__dirname, '..', '..', 'tools', 'package.json'));
const { createCanvas, loadImage } = tools('@napi-rs/canvas');

const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'out');
const FF = process.env.FFMPEG || 'ffmpeg';
const SIZE = 1080, SRC = 2160, FPS = 60, RAMP = 0.8, FADE = 1.6;
const arg = (k, d) => { const a = process.argv.slice(2).find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const TIMELINE = arg('timeline', path.join(ROOT, 'music', 'render', 'timeline.json'));
const WAV = arg('wav', path.join(path.dirname(TIMELINE), 'song.wav'));
const DEST = arg('out', path.join(OUT, 'video', 'one-becomes-two.mp4'));

function scroll(maxY, duration) {
  const T = duration - FADE, v = maxY / (T - RAMP);
  return (t) => {
    if (t <= 0) return 0;
    if (t < RAMP) return (v * t * t) / (2 * RAMP);
    if (t < T - RAMP) return v * (t - RAMP / 2);
    if (t < T) { const u = T - t; return maxY - (v * u * u) / (2 * RAMP); }
    return maxY;
  };
}

async function main() {
  const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'sheets.json'), 'utf8'));
  const ims = [];
  let H = 0;
  for (const s of meta.sheets) { const im = await loadImage(path.join(OUT, 'sheets', s.file)), h = Math.round((im.height * SRC) / im.width); ims.push({ im, y: H, h }); H += h; }
  const wall = createCanvas(SRC, H), g = wall.getContext('2d');
  for (const s of ims) g.drawImage(s.im, 0, s.y, SRC, s.h);
  const duration = JSON.parse(fs.readFileSync(TIMELINE, 'utf8')).duration;
  const maxY = H - SRC, y = scroll(maxY, duration), frames = Math.round(duration * FPS);
  console.log(`${duration.toFixed(2)} s, ${frames} frames, ${(((maxY / SRC) * 180) / (duration - FADE - RAMP)).toFixed(1)} mm/s, fade from ${(duration - FADE).toFixed(2)} s`);
  const frame = createCanvas(SIZE, SIZE), fg = frame.getContext('2d');
  fg.imageSmoothingEnabled = true; fg.imageSmoothingQuality = 'high';
  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  const fadeAt = (duration - FADE).toFixed(3);
  const ff = spawn(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${SIZE}x${SIZE}`, '-r', String(FPS), '-i', '-', '-i', WAV,
    '-map', '0:v', '-map', '1:a', '-vf', `fade=t=out:st=${fadeAt}:d=${FADE}`, '-af', `afade=t=out:st=${fadeAt}:d=${FADE}`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2', '-g', String(FPS * 2),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', DEST], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < frames; i++) {
    fg.drawImage(wall, 0, y(i / FPS), SRC, SRC, 0, 0, SIZE, SIZE);
    const d = fg.getImageData(0, 0, SIZE, SIZE).data;
    if (!ff.stdin.write(Buffer.from(d.buffer, d.byteOffset, d.byteLength))) await once(ff.stdin, 'drain');
  }
  ff.stdin.end();
  const [code] = await once(ff, 'close');
  if (code) throw new Error('ffmpeg failed');
  console.log('wrote', DEST, (fs.statSync(DEST).size / 1e6).toFixed(1), 'MB');
}

main().catch((e) => { console.error(e); process.exit(1); });
