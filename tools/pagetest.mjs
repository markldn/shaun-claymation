// pagetest.mjs: open the live page (not render mode), wait for the in-browser soundtrack, report errors.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
const pw = `${homedir()}/.cache/ms-playwright`, CHROME = readdirSync(pw).filter(d => /^chromium-\d+$/.test(d)).sort().reverse().map(d => `${pw}/${d}/chrome-linux64/chrome`).find(existsSync);
const PORT = 9800 + Math.floor(Math.random() * 100), srv = spawn('node', ['tools/serve.mjs', '--port', String(PORT), '--host', '127.0.0.1'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 400));
const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push(m.text()); });
const t0 = Date.now(); await p.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await p.waitForFunction(() => /sound ready|sound failed/.test(document.getElementById('snd')?.textContent || ''), { timeout: 120000 }).catch(() => errs.push('sound never finished'));
console.log('status:', await p.$eval('#snd', e => e.textContent.trim()), `(${((Date.now() - t0) / 1000).toFixed(1)} s after load)`);
await p.click('#play'); await new Promise(r => setTimeout(r, 1500));
console.log('playing at', await p.$eval('#lab', e => e.textContent));
console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
await b.close(); srv.kill(); process.exit(errs.length ? 1 : 0);
