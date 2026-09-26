// audio.mjs: OPTIONAL offline export of the soundtrack to out/shaun.wav (the page synthesises it itself in the browser).
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderSoundtrack } from '../src/synth.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const T = createRequire(import.meta.url)(resolve(ROOT, 'src/timeline.js'));
const score = (await import(pathToFileURL(resolve(ROOT, 'src/score.mjs')))).default;
const { L, R, SR } = renderSoundtrack(T, score), N = L.length, c = v => Math.max(-1, Math.min(1, v));
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let j = 0; j < N; j++) { buf.writeInt16LE(Math.round(c(L[j]) * 32767), 44 + j * 4); buf.writeInt16LE(Math.round(c(R[j]) * 32767), 46 + j * 4); }
mkdirSync(resolve(ROOT, 'out'), { recursive: true }); writeFileSync(resolve(ROOT, 'out/shaun.wav'), buf);
console.log(`wrote out/shaun.wav  ${T.DUR}s`);
