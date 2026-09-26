// render.mjs: drive index.html in headless Chromium on the real GPU (ANGLE/Vulkan).
//   node tools/render.mjs --stills=1.5,7.2 [--out=out/stills] [--w=1920 --h=1080]    full-res PNG/JPEGs
//   node tools/render.mjs --sheet=auto|t1,t2,.. [--cols=5] [--tw=384] [--out=out/sheet.jpg]  contact sheet
//   node tools/render.mjs --frames [--from=0 --to=120] [--workers=3]                  JPEG frames -> out/frames (resumable)
//   node tools/render.mjs --encode [--out=out/shaun.mp4] [--crf=17]                   frames + out/shaun.wav -> MP4
import puppeteer from 'puppeteer-core';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'); process.chdir(ROOT);
const T = createRequire(import.meta.url)(resolve(ROOT, 'src/timeline.js'));
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const pw = `${homedir()}/.cache/ms-playwright`;
const CHROME = process.env.CHROME || readdirSync(pw).filter(d => /^chromium-\d+$/.test(d)).sort().reverse().map(d => `${pw}/${d}/chrome-linux64/chrome`).find(existsSync);
const FPS = T.FPS, FRAMES = 'out/frames';
const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', c => c ? bad(new Error(cmd + ' exited ' + c)) : ok()); });

if (args.encode) {
  const out = args.out || 'out/shaun.mp4', audio = existsSync('out/shaun.wav');
  let gainDb = 0;
  if (audio) {
    const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', 'out/shaun.wav', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
    const S = r.slice(r.lastIndexOf('Summary')), I = +/I:\s+(-?[\d.]+) LUFS/.exec(S)?.[1], TP = +/Peak:\s+(-?[\d.]+) dBFS/.exec(S)?.[1];
    if (Number.isFinite(I) && Number.isFinite(TP)) { gainDb = Math.min((T.loudness ?? -16) - I, -1 - TP); console.log(`audio ${I} LUFS, peak ${TP} dBFS -> gain ${gainDb.toFixed(2)} dB`); }
  }
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${FRAMES}/f%04d.jpg`,
    ...(audio ? ['-i', 'out/shaun.wav', '-map', '0:v', '-map', '1:a', '-af', `volume=${gainDb.toFixed(2)}dB`, '-c:a', 'aac', '-b:a', '256k'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf || 17), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-t', String(T.DUR), out]);
  console.log('wrote ' + out); process.exit(0);
}

// local HTTP server (module imports + fetch need http://)
const PORT = 8997 + Math.floor(Math.random() * 400);
const srv = spawn('node', ['tools/serve.mjs', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore' });
process.on('exit', () => srv.kill());
await new Promise(r => setTimeout(r, 400));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 0,
  args: ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--window-size=1920,1200'] });
let errors = 0;
async function openPage(tag = '') {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1200 });
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) console.log(`[page${tag}]`, m.text().slice(0, 400)); });
  page.on('pageerror', e => { errors++; console.log(`[page error${tag}]`, e.message); });
  const q = new URLSearchParams({ render: 1, ...(args.w ? { w: args.w, h: args.h } : {}), ...(args.q ? Object.fromEntries(String(args.q).split('&').map(kv => kv.split(':'))) : {}) });
  await page.goto(`http://127.0.0.1:${PORT}/index.html?${q}`, { waitUntil: 'load' });
  await page.waitForFunction('window.ready === true || window.loadError', { timeout: 180000 });
  const le = await page.evaluate(() => window.loadError); if (le) { console.log('LOAD ERROR', le); process.exit(1); }
  return page;
}
const b64 = url => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
const auto = () => T.shots.flatMap(s => { const d = s.end - s.start, n = Math.max(1, Math.round(d / 2.5)); return Array.from({ length: n }, (_, k) => +(s.start + d * (k + .6) / n).toFixed(2)); });
const times = s => s === 'auto' ? auto() : String(s).split(',').map(Number);

if (args.stills) {
  const page = await openPage(), out = args.out || 'out/stills'; mkdirSync(out, { recursive: true });
  for (const s of times(args.stills)) {
    const t0 = Date.now(), f = `${out}/t${s.toFixed(2).replace('.', '_')}.${args.png ? 'png' : 'jpg'}`;
    writeFileSync(f, b64(await page.evaluate((t, png) => window.renderAt(t, png ? 'image/png' : 'image/jpeg', .93), s, !!args.png)));
    console.log(`${f}  ${Date.now() - t0} ms`);
  }
} else if (args.sheet) {
  const page = await openPage(), out = args.out || 'out/sheet.jpg'; mkdirSync(dirname(out), { recursive: true });
  const ts = times(args.sheet), cols = +(args.cols || 5), tw = +(args.tw || 384);
  const data = await page.evaluate(async (ts, cols, tw) => {
    const c0 = document.getElementById('c'), th = Math.round(tw * c0.height / c0.width), rows = Math.ceil(ts.length / cols);
    const sc = document.createElement('canvas'); sc.width = cols * tw; sc.height = rows * (th + 18); const g = sc.getContext('2d');
    g.fillStyle = '#111'; g.fillRect(0, 0, sc.width, sc.height); g.font = '13px sans-serif'; g.fillStyle = '#ddd';
    ts.forEach((t, i) => { window.renderFrame(t); const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + 18); g.drawImage(c0, x, y, tw, th);
      const sh = T.shots.find(s => t >= s.start && t < s.end); g.fillText(`${t.toFixed(2)}s ${sh ? sh.id : ''}`, x + 4, y + th + 13); });
    return sc.toDataURL('image/jpeg', .9);
  }, ts, cols, tw);
  writeFileSync(out, b64(data)); console.log(out);
} else if (args.frames) {
  const from = Math.round(+(args.from || 0) * FPS), to = Math.min(Math.round(T.DUR * FPS), Math.round(+(args.to || T.DUR) * FPS)), workers = +(args.workers || 1);
  mkdirSync(FRAMES, { recursive: true });
  const todo = []; for (let i = from; i < to; i++) { const f = `${FRAMES}/f${String(i).padStart(4, '0')}.jpg`; if (args.force || !existsSync(f) || statSync(f).size < 1000) todo.push(i); }
  console.log(`${todo.length} frames, ${workers} workers`);
  let next = 0, done = 0; const start = Date.now();
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await openPage('#' + w);
    while (next < todo.length) {
      const i = todo[next++], f = `${FRAMES}/f${String(i).padStart(4, '0')}.jpg`;
      writeFileSync(f + '.tmp', b64(await page.evaluate(t => window.renderAt(t, 'image/jpeg', .95), i / FPS))); renameSync(f + '.tmp', f);
      if (++done % 48 === 0 || done === todo.length) { const el = (Date.now() - start) / 1000; console.log(`${done}/${todo.length}  ${(el / done * 1000).toFixed(0)} ms/frame  eta ${((todo.length - done) * el / done).toFixed(0)} s`); }
    }
  }));
}
await browser.close(); srv.kill();
if (errors) { console.log(`${errors} page errors`); process.exit(1); }
process.exit(0);
