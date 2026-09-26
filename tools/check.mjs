// check.mjs: PASS/FAIL gate for a story. Static checks on the timeline, then the page is opened on the GPU and
// every shot is sampled: page errors, framing (how big and how centred each character is), frozen shots.
//   node tools/check.mjs            -> PASS / FAIL with concrete fixes
//   node tools/check.mjs --shot=tower   only that shot (faster while iterating)
// A shot may declare `hero: 'name'` (or ['a','b']) in src/shots.js; the hero is held to a stricter framing rule.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'); process.chdir(ROOT);
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const fails = [], warns = [], info = [];
let T;
try { T = createRequire(import.meta.url)(resolve(ROOT, 'src/timeline.js')); } catch (e) { console.log('FAIL\n  - src/timeline.js does not load: ' + e.message.split('\n')[0]); process.exit(1); }

// ---------- static ----------
const S = T.shots || [];
if (!S.length) fails.push('timeline.js has no shots');
S.forEach((s, i) => {
  if (!/^[a-z][a-z0-9]*$/.test(s.id)) fails.push(`shot id "${s.id}": use lowercase letters/digits only`);
  if (!(s.end > s.start)) fails.push(`shot ${s.id}: end ${s.end} must be after start ${s.start}`);
  if (i && Math.abs(s.start - S[i - 1].end) > 1e-6) fails.push(`shot ${s.id} starts at ${s.start} but ${S[i - 1].id} ends at ${S[i - 1].end}: shots must be back to back`);
  const d = s.end - s.start; if (d < 1.2) warns.push(`shot ${s.id} is only ${d.toFixed(2)} s: under ~1.5 s a viewer can't read it (fine for a deliberate whip/impact)`);
  if (d > 12) warns.push(`shot ${s.id} is ${d.toFixed(1)} s long: split it or give it a camera move, long static shots drag`);
  for (const [k, v] of Object.entries(s.m || {})) if (typeof v !== 'number' || v < 0 || v > d + 1e-6) fails.push(`shot ${s.id}: mark ${k}=${v} is outside the shot (0..${d.toFixed(2)})`);
});
if (S.length && S[0].start !== 0) fails.push('first shot must start at 0');
if (S.length && Math.abs(S[S.length - 1].end - T.DUR) > 1e-6) fails.push(`last shot ends at ${S[S.length - 1].end} but DUR is ${T.DUR}`);
const src = existsSync('src/shots.js') ? readFileSync('src/shots.js', 'utf8').replace(/\/\/.*$/gm, '') : '';
if (!src) fails.push('src/shots.js is missing');
for (const [re, why] of [[/Math\.random/, 'Math.random (frames must be a pure function of time: use hash(i, seed))'], [/Date\.now|performance\.now|new Date/, 'the wall clock (use lt / t)'],
  [/requestAnimationFrame|setTimeout|setInterval/, 'timers (apply() is called per frame for you)'], [/\bthis\.\w+\s*(\+|-)?=/, 'this.* state (nothing may carry over between frames)']])
  if (re.test(src)) fails.push(`src/shots.js uses ${why}`);
for (const s of S) if (src && !new RegExp(`\\b${s.id}\\s*:\\s*\\(`).test(src)) fails.push(`src/shots.js has no entry "${s.id}: (m, C) => ({...})" for shot ${s.id}`);
if (!existsSync('src/score.mjs')) warns.push('src/score.mjs is missing: the film will be silent');
if (fails.length) { console.log('FAIL\n' + fails.map(f => '  - ' + f).join('\n')); process.exit(1); }

// ---------- runtime ----------
const pw = `${homedir()}/.cache/ms-playwright`;
const CHROME = process.env.CHROME || readdirSync(pw).filter(d => /^chromium-\d+$/.test(d)).sort().reverse().map(d => `${pw}/${d}/chrome-linux64/chrome`).find(existsSync);
const PORT = 9400 + Math.floor(Math.random() * 400);
const srv = spawn('node', ['tools/serve.mjs', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 400));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 0,
  args: ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 800 });
const errs = [];
page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 200)); });
await page.goto(`http://127.0.0.1:${PORT}/index.html?render=1&w=640&h=360`, { waitUntil: 'load' });
try { await page.waitForFunction('window.ready === true || window.loadError', { timeout: 180000 }); } catch { errs.push('page never became ready (3 min)'); }
const le = await page.evaluate(() => window.loadError).catch(() => null);
if (le || errs.length) { console.log('FAIL\n  - page failed to start: ' + (le || errs.join(' | ')).slice(0, 900)); await browser.close(); srv.kill(); process.exit(1); }
const heroes = await page.evaluate(() => Object.fromEntries(window.story.shots.map(s => [s.id, s.hero || null])));
const noCam = await page.evaluate(() => window.story.shots.filter(s => typeof s.cam !== 'function').map(s => s.id));
noCam.forEach(id => fails.push(`shot ${id}: no cam(lt) function, the camera sits at a default position`));
const thumb = t => page.evaluate(t => { window.renderFrame(t); const c = document.getElementById('c'), s = document.createElement('canvas'); s.width = 32; s.height = 18; const g = s.getContext('2d'); g.drawImage(c, 0, 0, 32, 18);
  const d = g.getImageData(0, 0, 32, 18).data, o = []; for (let i = 0; i < d.length; i += 4) o.push(.3 * d[i] + .6 * d[i + 1] + .1 * d[i + 2]); return o; }, t);
const diff = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;

for (const s of S) {
  if (args.shot && args.shot !== s.id) continue;
  const d = s.end - s.start, ts = [.12, .3, .5, .7, .88].map(u => +(s.start + d * u).toFixed(3));
  const samples = [];
  for (const t of ts) { try { samples.push({ t, p: await page.evaluate(t => window.probe(t), t) }); } catch (e) { fails.push(`shot ${s.id} t=${t}: apply() threw: ${e.message.split('\n')[0]}`); break; } }
  if (errs.length) { fails.push(`shot ${s.id}: page error: ${errs.splice(0).join(' | ').slice(0, 300)}`); continue; }
  if (!samples.length) continue;
  // readable subject: someone >= 14% of frame height, mostly inside the frame
  const seen = a => (a.h >= .14 && a.inside >= .6) || (a.head && a.head.inFrame && a.head.size >= .045);
  const readable = samples.filter(x => x.p.some(seen)).length;
  if (readable < Math.ceil(samples.length * .6)) {
    const best = samples.map(x => x.p.filter(a => a.inside > .3).sort((a, b) => b.h - a.h)[0]).filter(Boolean)[0];
    if (best && best.h >= .14) warns.push(`shot ${s.id}: ${best.name} is big enough (${Math.round(best.h * 100)}%) but mostly outside the frame (${Math.round(best.inside * 100)}% inside) in most samples: aim the camera (look) at them or keep them nearer the centre`);
    else warns.push(`shot ${s.id}: nobody is readable (largest on-screen character ${best ? `${best.name} ${(best.h * 100).toFixed(0)}% of frame height at ${best.dist} m` : 'none'}). `
      + `Aim for the subject at 25-60% of frame height${best ? `: move the camera to about ${(best.dist * best.h / .35).toFixed(1)} m from ${best.name}` : ''}, or narrow fov`);
  }
  // hero rule
  const H = heroes[s.id]; for (const h of (H ? [].concat(H) : [])) {
    const ok = samples.filter(x => x.p.some(a => a.name === h && ((a.h >= .15 && a.inside >= .7) || (a.head && a.head.inFrame && a.head.size >= .05)))).length;
    if (ok < Math.ceil(samples.length * .6)) { const a = samples.map(x => x.p.find(q => q.name === h)).filter(Boolean);
      warns.push(`shot ${s.id}: hero ${h} is ${a.length ? `${Math.round(Math.min(...a.map(q => q.h)) * 100)}-${Math.round(Math.max(...a.map(q => q.h)) * 100)}% of frame height, inside ${Math.round(Math.min(...a.map(q => q.inside)) * 100)}%` : 'never visible (not in cast, hidden, or behind the camera)'}: frame them at >= 15% height and fully in shot`); }
  }
  // blockers: a character filling the frame that isn't the hero
  const heroSet = new Set(H ? [].concat(H) : []);
  const block = {}; samples.forEach(x => x.p.forEach(a => { if (a.h > 1.25 && a.inside > .15 && !heroSet.has(a.name)) block[a.name] = (block[a.name] || 0) + 1; }));
  for (const [n, c] of Object.entries(block)) if (c >= 2) warns.push(`shot ${s.id}: ${n} fills more than the whole frame height in ${c}/${samples.length} samples (too close to the camera: it blocks the shot). Move ${n} or the camera`);
  // edge cutters: persistently half outside
  const cut = {}; samples.forEach(x => x.p.forEach(a => { if (heroSet.has(a.name) && a.head && !a.head.inFrame && a.inside > .05) cut[a.name] = (cut[a.name] || 0) + 1; }));
  for (const [n, c] of Object.entries(cut)) if (c >= 3) warns.push(`shot ${s.id}: ${n} is the hero but their head is outside the frame in ${c}/${samples.length} samples`);
  // frozen shot
  const a = await thumb(s.start + d * .2), b = await thumb(s.start + d * .8);
  if (diff(a, b) < 1.2) warns.push(`shot ${s.id}: the picture barely changes (${diff(a, b).toFixed(2)}): add action or a camera move`);
  info.push(`${s.id.padEnd(10)} ${samples.map(x => x.p.filter(q => q.inside > .3 && q.h > .05).sort((p, q) => q.h - p.h).slice(0, 3).map(q => `${q.name}:${Math.round(q.h * 100)}%`).join(' ') || '-').join(' | ')}`);
}
await browser.close(); srv.kill();
console.log(fails.length ? 'FAIL' : 'PASS');
fails.forEach(f => console.log('  - ' + f)); warns.forEach(w => console.log('  warn: ' + w));
if (args.v || args.verbose) { console.log('  framing (largest characters per sample, % of frame height):'); info.forEach(l => console.log('    ' + l)); }
process.exit(fails.length ? 1 : 0);
