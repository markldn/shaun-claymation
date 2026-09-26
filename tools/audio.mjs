// audio.mjs: the whole soundtrack, synthesised. No samples. Every cue is placed from src/timeline.js marks,
// the same numbers the animation keys read, so a boing lands on its frame.
//   node tools/audio.mjs  ->  out/shaun.wav (48 kHz stereo)
// Score: folk-comedy in G (oom-pah tuba, pizzicato, penny whistle, accordion), a balloon waltz, sneaky pizz for the
// plan, chase ostinato, a soaring flight waltz. Foley: formant-synth bleats, rooster, snores, pea whistle, car, boings,
// slide whistles, sad trombone, crashes, birds, wind.
import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const T = createRequire(import.meta.url)(resolve(ROOT, 'src/timeline.js'));
const SR = 48000, N = Math.round(T.DUR * SR);
const L = new Float32Array(N), R = new Float32Array(N), SL = new Float32Array(N), SRv = new Float32Array(N);
let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const r01 = () => (rnd() + 1) / 2;
const TAU = Math.PI * 2, hz = m => 440 * 2 ** ((m - 69) / 12), clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const at = (id, mark = 0, off = 0) => { const s = T.shot(id); return s.start + (typeof mark === 'string' ? s.m[mark] : mark) + off; };
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = n => { if (typeof n === 'number') return n; const m = /^([A-G])([#b]?)(-?\d)$/.exec(n); return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };

// bus gains
const G = { music: .34, sfx: .62, voice: .5, amb: .22 };
function add(t0, len, fn, gain = 1, pan = 0, send = 0) {
  const s0 = Math.round(t0 * SR), n = Math.round(len * SR), gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < n; i++) { const j = s0 + i; if (j < 0 || j >= N) continue; const v = fn(i / SR, i); if (v !== v) continue; L[j] += v * gl; R[j] += v * gr; SL[j] += v * gl * send; SRv[j] += v * gr * send; }
}
function biquad(type) {
  let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return {
    set(f, q = .707, gainDb = 0) {
      const w = TAU * clamp(f, 20, SR * .45) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q); let n0, n1, n2, d0, d1, d2;
      if (type === 'lp') { n0 = (1 - c) / 2; n1 = 1 - c; n2 = n0; d0 = 1 + al; d1 = -2 * c; d2 = 1 - al; }
      else if (type === 'hp') { n0 = (1 + c) / 2; n1 = -(1 + c); n2 = n0; d0 = 1 + al; d1 = -2 * c; d2 = 1 - al; }
      else { n0 = al; n1 = 0; n2 = -al; d0 = 1 + al; d1 = -2 * c; d2 = 1 - al; }       // band-pass (0 dB peak)
      b0 = n0 / d0; b1 = n1 / d0; b2 = n2 / d0; a1 = d1 / d0; a2 = d2 / d0; return this;
    },
    run(x) { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; },
  };
}
const env = (x, a, d, len, rel = .08) => Math.min(1, x / a) * (x < len ? 1 : Math.max(0, 1 - (x - len) / rel)) * (d ? Math.exp(-x * d) : 1);

// =================================== INSTRUMENTS ===================================
// Karplus-Strong string: pizzicato (short), banjo/harp (longer, brighter)
function ks(t, m, { dur = .6, decay = .994, bright = .5, gain = .5, pan = 0, send = .3, lp = 0 } = {}) {
  const f = hz(midi(m)), Nd = Math.max(2, Math.round(SR / f)), buf = new Float32Array(Nd); let prev = 0;
  for (let i = 0; i < Nd; i++) { prev += bright * (rnd() - prev); buf[i] = prev; }
  let k = 0; const flt = lp ? biquad('lp').set(lp, .7) : null;
  add(t, dur + .05, (x) => { const a = buf[k], b = buf[(k + 1) % Nd]; buf[k] = decay * .5 * (a + b); k = (k + 1) % Nd; const v = a * Math.min(1, (dur + .05 - x) / .05); return flt ? flt.run(v) : v; }, gain * G.music, pan, send);
}
const pizz = (t, m, v = 1, pan = 0) => ks(t, m, { dur: .35, decay: .985, bright: .35, gain: .55 * v, pan, lp: 2600 });
const harp = (t, m, v = 1, pan = 0) => ks(t, m, { dur: 1.6, decay: .9975, bright: .6, gain: .32 * v, pan, send: .5 });
const banjo = (t, m, v = 1, pan = 0) => ks(t, m, { dur: .7, decay: .993, bright: .85, gain: .3 * v, pan, lp: 5000 });
// winds: odd-harmonic clarinet, breathy penny whistle
function wind(t, m, len, { kind = 'whistle', vel = .5, pan = 0, send = .35, vib = 1 } = {}) {
  const f = hz(midi(m)), bp = biquad('bp').set(f * 2, 2), ph = [0, 0, 0, 0, 0];
  const H = kind === 'clarinet' ? [1, 0, .45, 0, .22, 0, .12] : kind === 'bassoon' ? [.6, .9, .5, .4, .3, .2, .1] : [1, .12, .05];
  let p = 0;
  add(t, len + .15, (x) => {
    const v5 = 1 + .006 * vib * Math.sin(TAU * 5.2 * x) * clamp((x - .15) * 4);
    p += f * v5 / SR; let s = 0; for (let n = 0; n < H.length; n++) if (H[n]) s += H[n] * Math.sin(TAU * (n + 1) * p);
    const breath = bp.run(rnd()) * (kind === 'whistle' ? .25 : .08);
    return (s * .5 + breath) * env(x, kind === 'whistle' ? .03 : .045, 0, len, .12);
  }, vel * G.music * (kind === 'bassoon' ? .7 : .55), pan, send);
}
// brass: tuba / trombone with an opening filter ("blat")
function brass(t, m, len, { vel = .6, pan = 0, send = .25, bright = 1, slide = 0 } = {}) {
  const f0 = hz(midi(m)), lp = biquad('lp'); let p = 0;
  add(t, len + .12, (x, i) => {
    const f = f0 * (slide ? 2 ** (slide * clamp(x / len) / 12) : 1) * (1 + .004 * Math.sin(TAU * 4.5 * x) * clamp(x * 3 - .3));
    p += f / SR; if (i % 16 === 0) lp.set((f0 * (2 + 5 * bright * Math.min(1, x * 12)) * (x < len ? 1 : .6)), .9);
    const s = 2 * (p - Math.floor(p + .5));
    return lp.run(s) * env(x, .025, 0, len, .1);
  }, vel * G.music, pan, send);
}
// accordion: two detuned reeds (musette) through a soft filter
function accordion(t, notes, len, { vel = .35, pan = 0, send = .3 } = {}) {
  notes.forEach((n, k) => { const f = hz(midi(n)), lp = biquad('lp').set(2200, .7); let p1 = 0, p2 = 0;
    add(t, len + .1, x => { p1 += f / SR; p2 += f * 1.008 / SR; const s = (2 * (p1 - Math.floor(p1 + .5)) + 2 * (p2 - Math.floor(p2 + .5))) * .5; return lp.run(s) * env(x, .06, 0, len, .1) * (1 + .15 * Math.sin(TAU * 5 * x)); },
      vel * G.music / notes.length * 1.6, pan + (k - 1) * .15, send); });
}
function glock(t, m, v = 1, pan = 0) { const f = hz(midi(m)); add(t, 2, x => (Math.sin(TAU * f * x) + .4 * Math.sin(TAU * f * 2.76 * x) * Math.exp(-x * 6) + .2 * Math.sin(TAU * f * 5.4 * x) * Math.exp(-x * 12)) * Math.exp(-x * 2.2) * Math.min(1, x / .002), .22 * v * G.music, pan, .5); }
function strings(t, notes, len, { vel = .4, trem = 0, pan = 0, send = .55, atk = .35 } = {}) {
  notes.forEach((n, k) => { const f = hz(midi(n)), lp = biquad('lp').set(1800 + k * 200, .7), ph = new Float64Array(4);
    add(t, len + .5, x => { let s = 0; for (let j = 0; j < 4; j++) { ph[j] += f * (1 + (j - 1.5) * .004) * (1 + .003 * Math.sin(TAU * (5 + j * .3) * x)) / SR; s += 2 * (ph[j] - Math.floor(ph[j] + .5)); }
      const tr = trem ? .6 + .4 * Math.sin(TAU * trem * x) : 1; return lp.run(s * .25) * tr * Math.min(1, x / atk) * (x < len ? 1 : Math.max(0, 1 - (x - len) / .5)); },
      vel * G.music / Math.sqrt(notes.length), pan + (k % 2 ? .25 : -.25), send); });
}
// percussion
function timp(t, m, v = 1, pan = 0) { const f = hz(midi(m)); let p = 0; add(t, 1.6, x => { p += f * (1 + .15 * Math.exp(-x * 20)) / SR; return (Math.sin(TAU * p) + .3 * Math.sin(TAU * p * 1.5)) * Math.exp(-x * 2.6) + rnd() * .3 * Math.exp(-x * 40); }, .5 * v * G.music, pan, .4); }
function timpRoll(t0, t1, m, v0, v1) { for (let t = t0; t < t1; t += .055) timp(t, m, (v0 + (v1 - v0) * (t - t0) / (t1 - t0)) * .45, (rnd()) * .2); }
function snare(t, v = 1, pan = 0) { const bp = biquad('bp').set(2100, .8); add(t, .25, x => bp.run(rnd()) * Math.exp(-x * 26) * 2 + Math.sin(TAU * 190 * x) * Math.exp(-x * 35) * .5, .35 * v * G.music, pan, .2); }
function snareRoll(t0, t1, v0, v1) { for (let t = t0; t < t1; t += .045) snare(t, (v0 + (v1 - v0) * (t - t0) / (t1 - t0)) * .5, rnd() * .1); }
function brush(t, v = 1) { const bp = biquad('bp').set(4000, .6); add(t, .18, x => bp.run(rnd()) * Math.exp(-x * 18), .12 * v * G.music, .1, .2); }
function cymbal(t, v = 1, len = 2.4) { const hp = biquad('hp').set(5200, .6), bp = biquad('bp').set(7200, 1.2); add(t, len, x => (hp.run(rnd()) * .6 + bp.run(rnd()) * .8) * Math.exp(-x * 2.2 / len * 1.4) * Math.min(1, x / .004), .42 * v * G.music, .15, .5); }
function woodblock(t, m = 'E6', v = 1, pan = 0) { const f = hz(midi(m)); add(t, .15, x => Math.sin(TAU * f * x) * Math.exp(-x * 45) + Math.sin(TAU * f * 2.3 * x) * Math.exp(-x * 70) * .4, .4 * v * G.music, pan, .25); }
function triangle(t, v = 1) { add(t, 2.2, x => [1, 2.2, 3.4, 4.9].reduce((s, h, k) => s + Math.sin(TAU * 2500 * h * x) * Math.exp(-x * (1.2 + k)) / (k + 1), 0), .1 * v * G.music, .3, .5); }
// chords
const CH = { G: ['G3', 'B3', 'D4'], D: ['F#3', 'A3', 'D4'], D7: ['F#3', 'C4', 'D4'], C: ['G3', 'C4', 'E4'], Am: ['A3', 'C4', 'E4'], Em: ['G3', 'B3', 'E4'], B7: ['F#3', 'A3', 'D#4'],
  Bm: ['F#3', 'B3', 'D4'], E: ['G#3', 'B3', 'E4'], A7: ['G3', 'C#4', 'E4'], F: ['F3', 'A3', 'C4'], Cm: ['G3', 'C4', 'Eb4'], Ebmaj: ['G3', 'Bb3', 'Eb4'], Dm: ['F3', 'A3', 'D4'] };
const RT = { G: 'G2', D: 'D2', D7: 'D2', C: 'C2', Am: 'A2', Em: 'E2', B7: 'B1', Bm: 'B1', E: 'E2', A7: 'A2', F: 'F2', Cm: 'C2', Ebmaj: 'Eb2', Dm: 'D2' };
const FIFTH = r => midi(r) + 7;
const up = (n, o = 12) => midi(n) + o;

// =================================== VOICES ===================================
// Formant synth: glottal pulse -> parallel band-pass formants. Bleats get the sheep quaver (6-8 Hz tremolo on pitch + amp).
function voice(t, dur, { f0 = 220, contour = x => 1, formants = [[750, 90, 1], [1650, 110, .6], [2500, 150, .35]], quaver = .5, qRate = 7.5, breath = .08, gain = .5, pan = 0, send = .15, onset = 'b', harsh = 0 } = {}) {
  const fl = formants.map(([f, bw]) => biquad('bp').set(f, f / bw)); let p = 0; const jit = biquad('lp').set(30, .7);
  add(t, dur + .05, (x) => {
    const u = x / dur, q = Math.sin(TAU * qRate * x + 1.3), f = f0 * contour(u) * (1 + quaver * .06 * q) * (1 + .02 * jit.run(rnd()));
    p += f / SR; const ph = p - Math.floor(p);
    let src = Math.pow(Math.max(0, Math.sin(Math.PI * ph)), 3 + harsh * -2) * 2 - .8 + harsh * (2 * ph - 1) * .6;   // pulse, brighter with harsh
    src += rnd() * breath;
    const on = onset === 'b' ? clamp(x / .05) : clamp(x / .02);
    let s = 0; formants.forEach(([ff, bw, g], k) => { s += fl[k].run(src) * g * (onset === 'b' && k === 0 ? .4 + .6 * clamp(x / .06) : 1); });
    const a = on * Math.min(1, (dur + .05 - x) / .08) * (1 - quaver * .45 * (.5 + .5 * q));
    return s * a;
  }, gain * G.voice, pan, send);
}
const VO = { shaun: 250, flock: 190, timmy: 470, shirley: 118, mum: 300 };
function baa(t, who = 'flock', { dur = .75, pan = 0, gain = .55, f0, bend = 1 } = {}) {
  const base = f0 || VO[who] * (who === 'flock' ? .85 + r01() * .35 : 1);
  voice(t, dur, { f0: base, contour: u => (u < .12 ? .88 + u : 1) * (1 - .12 * u * bend), quaver: who === 'timmy' ? .8 : .6, qRate: who === 'shirley' ? 5 : 7.5, gain, pan, formants: [[who === 'shirley' ? 600 : 780, 90, 1], [1600, 120, .55], [2600, 160, .3]] });
}
function giggle(t, who = 'timmy', n = 5) { for (let k = 0; k < n; k++) voice(t + k * .1, .08, { f0: VO[who] * (1.15 - k * .04), quaver: .2, gain: .45, onset: 'h', formants: [[900, 90, 1], [1900, 120, .6], [2800, 160, .3]] }); }
function gasp(t, who = 'shaun') { voice(t, .32, { f0: VO[who] * 1.1, contour: u => 1 + u * .3, quaver: .1, breath: 1.2, gain: .35, onset: 'h', formants: [[850, 150, 1], [1400, 200, .5], [2600, 200, .3]] }); }
function grunt(t, who = 'flock', d = .35) { voice(t, d, { f0: (VO[who] || 150) * .7, contour: u => 1 + .2 * Math.sin(u * 3), quaver: .15, gain: .4, harsh: .6, formants: [[500, 90, 1], [1100, 120, .5], [2400, 160, .25]] }); }
function whoa(t, who = 'flock', d = .9) { voice(t, d, { f0: (VO[who] || 190) * 1.25, contour: u => 1.2 - u * .55, quaver: .5, gain: .45, formants: [[600, 90, 1], [1000, 120, .7], [2500, 160, .3]] }); }
function hmm(t, f0 = 150, d = .5, gain = .4) { voice(t, d, { f0, contour: u => 1 - .1 * u, quaver: 0, breath: .02, gain, onset: 'm', formants: [[280, 60, 1], [900, 100, .15], [2200, 160, .08]] }); }
function sigh(t) { const bp = biquad('bp'); add(t, 1.3, x => { bp.set(900 - x * 400, 1.2); return bp.run(rnd()) * Math.sin(Math.PI * clamp(x / 1.3)) ** 1.5 * 1.4; }, .35 * G.voice, .05, .1); }
function rooster(t) {
  const syl = [[0, .13, 1.0, 1.05], [.16, .1, 1.1, 1.15], [.3, .2, 1.2, 1.35], [.55, .75, 1.4, .9]];
  syl.forEach(([o, d, a, b]) => voice(t + o, d, { f0: 480, contour: u => a + (b - a) * u, quaver: .15, qRate: 11, harsh: 1, gain: .5, onset: 'h', formants: [[700, 90, 1], [1250, 110, .7], [2900, 160, .4]], pan: -.4, send: .45 }));
}
function snore(t) {   // inhale rattle, exhale buzz and whistle
  const bp = biquad('bp'); add(t, 1.1, x => { bp.set(500 + x * 500, 3); return bp.run(rnd()) * (0.4 + .6 * (Math.sin(TAU * 28 * x) > 0 ? 1 : .3)) * Math.sin(Math.PI * x / 1.1) * 3; }, .3 * G.voice, -.2, .1);
  let p = 0; add(t + 1.15, 1.1, x => { p += (1500 - x * 500) / SR; return Math.sin(TAU * p) * .25 * Math.sin(Math.PI * x / 1.1) + (rnd() * .3 * Math.sin(Math.PI * x / 1.1) ** 2); }, .22 * G.voice, -.2, .15);
}
function smack(t) { for (let k = 0; k < 2; k++) { const hp = biquad('hp').set(1500, .8); add(t + k * .13, .03, x => hp.run(rnd()) * Math.exp(-x * 120), .5 * G.sfx, -.1, .05); } }
function suck(t0, t1) { for (let t = t0; t < t1; t += .23) { let p = 0; add(t, .06, x => { p += (1400 + x * 3000) / SR; return Math.sin(TAU * p) * Math.sin(Math.PI * x / .06); }, .05 * G.sfx, -.1, .05); } }

// =================================== FOLEY ===================================
function slide(t, m0, m1, dur, { gain = .5, pan = 0, vib = 1 } = {}) {   // slide whistle
  const f0 = hz(midi(m0)), f1 = hz(midi(m1)), bp = biquad('bp').set(3000, 1); let p = 0;
  add(t, dur + .06, x => { const u = clamp(x / dur), f = f0 * (f1 / f0) ** (u * u * (3 - 2 * u)) * (1 + .012 * vib * Math.sin(TAU * 6.5 * x)); p += f / SR; return (Math.sin(TAU * p) + .08 * Math.sin(TAU * 2 * p) + bp.run(rnd()) * .15) * env(x, .02, 0, dur, .06); }, gain * G.sfx * .5, pan, .3);
}
function peaWhistle(t, dur = .5, { gain = .38, pan = 0 } = {}) {
  const hp = biquad('hp').set(3000, .7); let p = 0;
  add(t, dur + .05, x => { const trill = .5 + .5 * Math.sin(TAU * (26 + 4 * Math.sin(x * 7)) * x); p += 2950 * (1 + .01 * trill) / SR;
    return (Math.sin(TAU * p) * (.55 + .45 * trill) + .1 * Math.sin(TAU * 2 * p) + hp.run(rnd()) * .12) * env(x, .015, 0, dur, .04); }, gain * G.sfx * .55, pan, .25);
}
function fingerWhistle(t) { slide(t, 'B6', 'E7', .22, { gain: .42, vib: 0 }); slide(t + .3, 'E7', 'A6', .35, { gain: .42, vib: 0 }); }
function boing(t, { base = 95, dur = 1.1, gain = .7, pan = 0 } = {}) {
  const bp = biquad('bp'); let p = 0;
  add(t, dur, (x, i) => { const f = base * (1 + .65 * Math.exp(-x * 3.2) * Math.sin(TAU * 11 * x)) * (1 + x * .3); p += f / SR;
    if (i % 16 === 0) bp.set(700 + 1500 * (.5 + .5 * Math.sin(TAU * 11 * x)) * Math.exp(-x * 2), 3);
    const s = 2 * (p - Math.floor(p + .5)); return (bp.run(s) * 1.2 + Math.sin(TAU * p) * .5) * Math.exp(-x * 3.2) * Math.min(1, x / .004); }, gain * G.sfx, pan, .25);
}
function thud(t, g = 1, pan = 0) { let p = 0; const lp = biquad('lp').set(350, .7); add(t, .45, x => { p += (70 - 30 * x) / SR; return Math.sin(TAU * p) * Math.exp(-x * 9) * 1.4 + lp.run(rnd()) * Math.exp(-x * 14) * 1.2; }, .7 * g * G.sfx, pan, .12); }
function poof(t, g = 1, pan = 0) { const lp = biquad('lp').set(900, .7); add(t, .5, x => lp.run(rnd()) * Math.sin(Math.PI * clamp(x / .45)) ** 2 * 2.2, .5 * g * G.sfx, pan, .2); }
function whoosh(t, dur = .5, g = 1, pan = 0) { const bp = biquad('bp'); add(t, dur, (x, i) => { const u = x / dur; if (i % 16 === 0) bp.set(400 + 2200 * Math.sin(Math.PI * u), 1.4); return bp.run(rnd()) * Math.sin(Math.PI * u) ** 2 * 2.5; }, .4 * g * G.sfx, pan, .2); }
function bonk(t, g = 1) { let p = 0; add(t, .3, x => { p += (620 - 500 * Math.min(1, x * 8)) / SR; return Math.sin(TAU * p) * Math.exp(-x * 14) + (x < .005 ? rnd() : 0); }, .5 * g * G.sfx, -.1, .15); woodblock(t, 'A5', .8); }
function plop(t, m = 60, g = 1, pan = 0) { let p = 0; const f = hz(m); add(t, .18, x => { p += f * (1.8 - 1.2 * Math.min(1, x * 12)) / SR; return Math.sin(TAU * p) * Math.exp(-x * 22); }, .45 * g * G.sfx, pan, .2); thud(t, .35 * g, pan); }
function squeak(t, dur = .35, g = 1, pan = 0) { let p = 0; add(t, dur, x => { const f = 780 + 420 * Math.sin(Math.PI * x / dur) + 60 * Math.sin(TAU * 38 * x); p += f / SR; return Math.sin(TAU * p) * (Math.sin(TAU * 38 * x) > -.3 ? 1 : .2) * Math.sin(Math.PI * x / dur); }, .16 * g * G.sfx, pan, .2); }
function ding(t, g = 1) { [1, 2.01, 3.0, 4.2].forEach((h, k) => { const f = 1320 * h; add(t, 1.8, x => Math.sin(TAU * f * x) * Math.exp(-x * (1.6 + k * 1.1)) / (k + 1), .22 * g * G.sfx, .1, .5); }); }
function crash(t) { cymbal(t, 1.4, 2.8); timp(t, 'G2', 1.4); thud(t, 1.3); thud(t + .08, .9, -.3); thud(t + .17, .8, .3); [0, .06, .13, .21, .3].forEach((o, k) => woodblock(t + o, ['C6', 'G5', 'E6', 'A5', 'D6'][k], .8, (k - 2) * .2)); poof(t, 1.2); }
function patter(t0, t1, rate = 9, g = .6, pan = 0) { for (let t = t0; t < t1; t += 1 / rate) { const lp = biquad('lp').set(700, .7); const tt = t + (rnd()) * .01; add(tt, .05, x => lp.run(rnd()) * Math.exp(-x * 80) * 3, .25 * g * G.sfx, pan + rnd() * .1, .05); } }
function carEngine(t0, t1, { rev = () => 1, dist = () => 1, pan = () => 0 } = {}) {   // 4-stroke putter
  const lp = biquad('lp').set(900, .7); let ph = 0, last = -1, bang = 0;
  add(t0, t1 - t0, x => { const t = t0 + x, r = rev(t); ph += (14 + 26 * r) / SR; const k = Math.floor(ph); if (k !== last) { last = k; bang = 1; }
    bang *= Math.exp(-1 / SR * 55); const d = dist(t); const v = (Math.sin(TAU * 95 * x) * bang * .8 + lp.run(rnd()) * bang * .9 + Math.sin(TAU * (110 + 70 * r) * x) * .08) * d; return v * clamp(x / .1) * clamp((t1 - t0 - x) / .2); }, .3 * G.sfx, 0, .1);
}
function horn(t, g = 1, far = false) { [0, .36].forEach(o => { const lp = biquad('lp').set(far ? 900 : 2000, .8); let p1 = 0, p2 = 0;
  add(t + o, .26, x => { p1 += 415 / SR; p2 += 523 / SR; const s = (Math.sign(Math.sin(TAU * p1)) + Math.sign(Math.sin(TAU * p2))) * .5; return lp.run(s) * env(x, .01, 0, .22, .04); }, .32 * g * G.sfx, -.3, far ? .5 : .15); }); }
function brakes(t) { let p = 0; add(t, .45, x => { p += (2300 + 140 * Math.sin(TAU * 13 * x)) / SR; return Math.sin(TAU * p) * Math.sin(Math.PI * x / .45); }, .06 * G.sfx, -.2, .2); }
function headphoneLeak(t0, t1, g = 1) { const hp = biquad('hp').set(1800, .7); add(t0, t1 - t0, x => { const b = x % .25, beat = Math.floor(x / .25) % 4; const k = b < .03 ? rnd() * (beat % 2 ? .6 : 1) : 0; const bass = Math.sign(Math.sin(TAU * [110, 110, 147, 131][Math.floor(x / 1) % 4] * x)) * .2;
  return hp.run(k + bass + Math.sign(Math.sin(TAU * 880 * x)) * .05 * (Math.floor(x * 8) % 3 === 0)); }, .05 * g * G.sfx, -.25, .05); }
function birds(t0, t1, density = .6, g = 1) { for (let t = t0; t < t1; t += .4 + r01() * 1.6 / density) { const n = 2 + (r01() * 4 | 0), f0 = 2800 + r01() * 2500, pan = rnd() * .8;
  for (let k = 0; k < n; k++) { let p = 0; const d = .05 + r01() * .07, dir = rnd() > 0 ? 1 : -1; add(t + k * (d + .03), d, x => { p += f0 * (1 + dir * .35 * x / d) / SR; return Math.sin(TAU * p) * Math.sin(Math.PI * x / d); }, .05 * g * G.amb, pan, .4); } } }
function windBed(t0, t1, g = 1) { const lp = biquad('lp').set(420, .6); add(t0, t1 - t0, x => lp.run(rnd()) * (1 + .5 * Math.sin(x * .7)) * 1.4 * clamp(x / 1.5) * clamp((t1 - t0 - x) / 1.5), .5 * g * G.amb, 0, 0); }
function flockAmbience(t0, t1, every = 3.5) { for (let t = t0 + r01() * every; t < t1 - 1; t += every * (.6 + r01() * .8)) baa(t, 'flock', { dur: .5 + r01() * .4, pan: rnd() * .8, gain: .18 }); }

// =================================== SCORE ===================================
const BEAT = .5;
// Main theme "Mossy Bottom" (G major, 4/4 at 120: beat .5 s). [note, beats]
const THEME = [
  ['G4', .5], ['B4', .5], ['D5', .75], ['B4', .25], ['D5', 1], ['E5', 1],
  ['D5', .5], ['C5', .5], ['B4', .5], ['A4', .5], ['B4', 1], ['G4', 1],
  ['A4', .5], ['B4', .5], ['C5', .75], ['A4', .25], ['C5', 1], ['D5', 1],
  ['C5', .5], ['B4', .5], ['A4', .5], ['G4', .5], ['A4', 2],
  ['G4', .5], ['B4', .5], ['D5', .75], ['B4', .25], ['D5', 1], ['E5', 1],
  ['D5', .5], ['E5', .5], ['F#5', .5], ['G5', .5], ['D5', 1], ['B4', 1],
  ['C5', .5], ['E5', .5], ['D5', .5], ['C5', .5], ['B4', .5], ['A4', .5], ['G4', .5], ['F#4', .5],
  ['G4', 2], [null, 2]];
const THEME_CH = ['G', 'G', 'G', 'D', 'Am', 'Am', 'D', 'D7', 'G', 'G', 'G', 'B7', 'C', 'D', 'G', 'G'];   // two per bar
function melody(t0, notes, { kind = 'whistle', vel = .5, until = 1e9, octave = 0, pan = .1 } = {}) {
  let t = t0; for (const [n, b] of notes) { const d = b * BEAT; if (t >= until) break; if (n) wind(t, midi(n) + octave, Math.min(d, until - t) * .9, { kind, vel, pan }); t += d; } return t;
}
function oompah(t0, bars, chords, { vel = 1, until = 1e9, pah = 'pizz' } = {}) {
  for (let b = 0; b < bars * 2; b++) { const c = chords[b % chords.length], t = t0 + b * 2 * BEAT; if (t >= until) break;
    brass(t, RT[c], .35, { vel: .55 * vel }); if (t + BEAT < until) { if (pah === 'pizz') CH[c].forEach((n, k) => pizz(t + BEAT, up(n, 0), .6 * vel, (k - 1) * .3)); else accordion(t + BEAT, CH[c], .3, { vel: .3 * vel }); }
    // alternate bass to the fifth on the second half of each chord
  }
}
function brushes(t0, t1, v = 1) { for (let t = t0; t < t1; t += BEAT) { brush(t, v * (Math.round(t / BEAT) % 2 ? 1 : .6)); brush(t + BEAT * .5, v * .4); } }
// Balloon waltz (3/4, beat .5, bar 1.5 s)
const WALTZ = [['D5', 2], ['B4', 1], ['G5', 2], ['F#5', 1], ['E5', 1], ['D5', 1], ['C5', 1], ['B4', 3], ['C5', 2], ['A4', 1], ['E5', 2], ['D5', 1], ['C5', 1], ['B4', 1], ['A4', 1], ['G4', 3]];
const WALTZ_CH = ['G', 'Em', 'C', 'G', 'Am', 'C', 'D7', 'G'];
function waltzAcc(t0, bars, { vel = 1, harpArp = true, str = false, chords = WALTZ_CH } = {}) {
  for (let b = 0; b < bars; b++) { const c = chords[b % chords.length], t = t0 + b * 1.5;
    pizz(t, RT[c], .7 * vel); if (harpArp) [0, 1, 2, 1, 2, 0].forEach((k, j) => harp(t + j * .25, up(CH[c][k], 12), .45 * vel, (j - 2.5) * .15));
    else { CH[c].forEach(n => pizz(t + .5, up(n, 0), .45 * vel)); CH[c].forEach(n => pizz(t + 1, up(n, 0), .4 * vel)); }
    if (str) strings(t, CH[c].map(n => up(n, 0)), 1.45, { vel: .38 * vel, atk: .25 }); }
}
function sneak(t0, t1, v = 1) {   // walking pizz in E minor + clarinet stabs
  const line = ['E2', 'G2', 'A2', 'Bb2', 'B2', 'A2', 'G2', 'D2'];
  for (let t = t0, k = 0; t < t1 - .05; t += BEAT, k++) { pizz(t, up(line[k % 8], 12), .9 * v, -.2); if (k % 4 === 1) wind(t + .25, 'E4', .12, { kind: 'clarinet', vel: .35 * v }); if (k % 4 === 3) wind(t + .25, 'G4', .12, { kind: 'clarinet', vel: .35 * v }); if (k % 2) brush(t, .5 * v); }
}
function chase(t0, t1, v = 1, chord = ['E3', 'G3', 'B3', 'E4']) { for (let t = t0, k = 0; t < t1 - .05; t += BEAT / 4, k++) { pizz(t, up(chord[k % 4], 12), (k % 4 ? .5 : .9) * v, (k % 2 ? .3 : -.3)); if (k % 2 === 0) snare(t, (k % 8 ? .25 : .6) * v); } }
function sadTrombone(t) { [['A3', .45, 0], ['G#3', .45, 0], ['G3', .45, 0], ['F#3', 1.4, -.6]].reduce((o, [n, d, sl]) => { brass(t + o, n, d * .92, { vel: .7, bright: .6, slide: sl }); return o + d; }, 0); }
function stab(t, c = 'Cm', v = 1) { brass(t, up(RT[c], 12), .35, { vel: .7 * v, bright: 1.4 }); CH[c].forEach(n => brass(t, up(n, 0), .35, { vel: .45 * v, bright: 1.4 })); timp(t, RT[c], v); }

// =================================== THE CUE SHEET ===================================
const S = id => T.shot(id).start, E = id => T.shot(id).end;
// ---- ambience ----
birds(0, 31, .9); birds(31, 62, .45); birds(65, 97, .5); birds(101, 117, .45);
windBed(80.6, 94, 1.2); windBed(0, 120, .35);
flockAmbience(0, 8, 2.5); flockAmbience(24, 31, 3); flockAmbience(113, 117, 2.5);

// 1. OPEN
rooster(.35);
accordion(1.0, ['G3', 'B3', 'D4'], 2.6, { vel: .28 }); strings(1.0, ['G3', 'D4', 'B4'], 3.2, { vel: .22, atk: 1.2 });
{ const m = T.shot('open').m;
  for (let i = 0; i < 8; i++) { const ti = m.letters + i * .1 + .42; plop(ti, 64 + [0, 2, 4, 5, 7, 9, 11, 12][i], .7, (i - 3.5) * .12); woodblock(ti, midi('G5') + [0, 2, 4, 5, 7, 9, 11, 12][i], .5); }
  for (let i = 0; i < 5; i++) { const ti = m.top + i * .09 + .42; thud(ti, .9, (i - 2) * .15); brass(ti, ['G2', 'B2', 'D3', 'G3', 'B3'][i], .25, { vel: .55 }); }
  cymbal(m.top + .42 + 4 * .09, .5, 1.6);
  for (let i = 0; i < 14; i++) glock(m.sub + i * .045 + .05, midi('G5') + [0, 4, 7, 12, 7, 4, 7, 12, 16, 12, 16, 19, 16, 24][i], .6, (i - 7) * .08);
  slide(m.peek - .05, 'D6', 'G6', .3, { gain: .5 }); pizz(m.peek + .3, 'G4', .8);
  ding(m.wink, .8); triangle(m.wink + .02, .8); gasp(m.peek + .35, 'shaun');
  // theme pick-up into the farmer shot
  wind(6.0, 'D5', .4, { vel: .4 }); wind(6.5, 'E5', .4, { vel: .4 }); wind(7.0, 'F#5', .4, { vel: .4 }); wind(7.5, 'D5', .4, { vel: .4 });
}
// 2-3. FARMER + COUNT: the main theme, oom-pah under it
{ const t0 = S('farmer');
  melody(t0, THEME, { kind: 'whistle', vel: .5, until: at('count', 'whistle') });
  oompah(t0, 8, THEME_CH, { until: at('count', 'whistle') }); brushes(t0, at('count', 'whistle'), .8);
  for (let b = 0; b < 16; b++) { const t = t0 + b * 1.0; if (t < at('count', 'whistle')) banjo(t + .75, up(CH[THEME_CH[b]][2], 12), .5, .35); }
  const m = T.shot('farmer').m;
  carEngine(t0 + m.engine, E('farmer') + 1.5, { rev: t => t < t0 + m.go ? .15 + .05 * Math.sin(t * 3) : clamp((t - t0 - m.go) / 1.8) * .9 + .1, dist: t => t < t0 + m.go + 2 ? 1 : Math.max(.08, 1 - (t - t0 - m.go - 2) * .28) });
  horn(t0 + m.horn); hmm(t0 + m.wave + .1, 140, .4, .25);
  whoosh(t0 + m.go + 1.6, .7, .6, .4);
  const c = T.shot('count').m, c0 = S('count');
  for (let k = 0; k < 4; k++) woodblock(c0 + c.tick + k * .35 + .02, 'C6', .7, .1);
  hmm(c0 + c.tick + 1.5, 160, .35, .3);
  peaWhistle(c0 + c.whistle, .6); stab(c0 + c.whistle, 'G', .6);
  baa(c0 + c.whistle + .5, 'flock', { pan: .4, gain: .3 }); baa(c0 + c.whistle + .65, 'flock', { pan: -.3, gain: .3 });
}
// 4. NAP: lazy clarinet slide, headphone leak, snores
{ const t0 = S('nap'), m = T.shot('nap').m;
  melody(t0 + .2, [['B4', 1], ['A4', 1], ['G4', 1], ['E4', 1], ['D4', 3]], { kind: 'clarinet', vel: .45 });
  brass(t0 + .2, 'G2', 1.6, { vel: .4 }); brass(t0 + 2.2, 'D2', 1.8, { vel: .35 });
  patter(t0, t0 + 1.0, 4.5, .4, -.2); poof(t0 + m.sit + .3, .5); squeak(t0 + m.sit + .32, .2, .4);
  slide(t0 + m.sit, 'G5', 'D5', .35, { gain: .35 });
  headphoneLeak(t0 + m.phones, E('nap'), 1);
  for (let t = t0 + m.sleep + .4; t < E('nap') - .5; t += 2.4) snore(t);
}
// 5. BORED: bassoon plod, sigh, squeak
{ const t0 = S('bored'), m = T.shot('bored').m;
  for (let k = 0; k < 9; k++) wind(t0 + .3 + k * .5, ['D3', 'A2'][k % 2], .3, { kind: 'bassoon', vel: .45 });
  sigh(t0 + m.sigh + .2);
  for (let k = 0; k < 3; k++) woodblock(t0 + 2.8 + k * .5, ['E5', 'C5'][k % 2], .35);
  giggle(t0 + 1.6, 'timmy', 3); giggle(t0 + 3.5, 'timmy', 4);
  squeak(t0 + m.squeak, .4, 1.2, .6); squeak(t0 + m.squeak + .55, .3, .9, .6);
  glock(t0 + m.squeak + .2, 'E6', .6); glock(t0 + m.squeak + .4, 'A6', .6); glock(t0 + m.squeak + .6, 'B6', .7);
  strings(t0 + m.squeak + .3, ['E4', 'A4', 'B4'], 2.0, { vel: .15, trem: 7 });
}
// 6-7. BALLOONS + GRAB: the balloon waltz
{ const t0 = S('balloons');
  waltzAcc(t0, 7, { vel: .8 }); melody(t0 + 1.5, WALTZ.slice(0, 8), { kind: 'whistle', vel: .32, octave: 12 });
  for (let k = 0; k < 6; k++) glock(t0 + .2 + k * .7, midi('D6') + [0, 4, 7, 12, 7, 4][k], .4);
  squeak(t0 + 1.2, .3, .7, .5); squeak(t0 + 2.9, .35, .6, .3);
  const g0 = S('grab'), m = T.shot('grab').m;
  waltzAcc(g0 + .5, 4, { vel: .7, harpArp: false }); melody(g0 + .5, WALTZ.slice(8), { kind: 'clarinet', vel: .4 });
  squeak(g0 + m.grab, .25, .8, .2); giggle(g0 + m.grab + .15, 'timmy', 5);
  slide(g0 + m.lift, 'G5', 'D6', 1.6, { gain: .4 }); for (let k = 0; k < 8; k++) harp(g0 + m.lift + k * .09, midi('G4') + [0, 2, 4, 7, 9, 12, 14, 16][k], .6);
  voice(g0 + m.lift + .3, .9, { f0: 520, contour: u => 1 + .35 * Math.sin(u * 3), quaver: .3, gain: .38, formants: [[350, 80, 1], [2300, 130, .6], [3000, 160, .3]] });   // "wheee"
  giggle(g0 + 4.3, 'timmy', 4);
  strings(g0 + 5.2, ['D4', 'F#4', 'C5'], 1.9, { vel: .22, trem: 9 }); baa(g0 + 5.6, 'timmy', { dur: .4, gain: .35, f0: 560 });
}
// 8. SHOCK
{ const t0 = S('shock'), m = T.shot('shock').m;
  stab(t0 + m.take, 'Cm', 1.1); cymbal(t0 + m.take, .9, 1.8); gasp(t0 + m.take - .05, 'shaun'); slide(t0 + m.take, 'C6', 'C7', .25, { gain: .5 });
  strings(t0 + m.take + .3, ['C4', 'Eb4', 'G4', 'C5'], 1.9, { vel: .3, trem: 12 }); timpRoll(t0 + 1.3, E('shock'), 'C2', .3, .8);
  whoosh(t0 + 1.35, .35, .4); whoosh(t0 + 1.6, .3, .35);
}
// 9. LEAP: chase, jump, faceplant, sad trombone
{ const t0 = S('leap'), m = T.shot('leap').m;
  chase(t0, t0 + m.jump, 1, ['E3', 'G3', 'B3', 'E4']); patter(t0 + m.run, t0 + m.jump, 11, .9, .2);
  brass(t0 + m.jump - .5, 'E3', .2, { vel: .5 }); brass(t0 + m.jump - .25, 'G3', .2, { vel: .5 });
  slide(t0 + m.jump, 'C5', 'C7', .6, { gain: .6 }); whoosh(t0 + m.jump + .1, .6, .7, -.2); baa(t0 + m.jump + .25, 'shaun', { dur: .5, f0: 300, gain: .45 });
  slide(t0 + m.jump + .65, 'C7', 'C5', .55, { gain: .45 });
  thud(t0 + m.plant, 1.3); poof(t0 + m.plant, 1); timp(t0 + m.plant, 'C2', 1.2); cymbal(t0 + m.plant, .4, 1);
  sadTrombone(t0 + m.plant + .55); giggle(t0 + m.plant + .3, 'timmy', 4);
  const sp = biquad('hp').set(1200, .7); add(t0 + 5.12, .2, x => sp.run(rnd()) * Math.exp(-x * 18) * 2, .5 * G.sfx, -.2, .1);   // "pfft" grass spit
  hmm(t0 + m.lift + .1, 200, .45, .25);
}
// 10. TOWER
{ const t0 = S('tower'), m = T.shot('tower').m;
  fingerWhistle(t0 + m.whistle);
  for (let k = 0; k < 3; k++) baa(t0 + .9 + k * .25, 'flock', { dur: .45, pan: .6 - k * .2, gain: .35 });
  patter(t0 + .8, t0 + m.s3, 10, .7, .5);
  for (let t = t0 + 1.0; t < t0 + m.reach; t += BEAT) { snare(t, Math.round((t - t0) / BEAT) % 2 ? .35 : .6); if (Math.round((t - t0) / BEAT) % 2 === 0) brass(t, 'G2', .2, { vel: .4 }); }
  [[m.s1, 'G2'], [m.s2 + .5, 'B2'], [m.s3 + .5, 'D3'], [m.s4 + .7, 'G3']].forEach(([o, n], k) => { brass(t0 + o, n, .3, { vel: .7, bright: 1.3 }); poof(t0 + o, .4); grunt(t0 + o + .05, 'flock', .3); pizz(t0 + o, up(n, 24), .8); });
  strings(t0 + m.reach, ['D4', 'F#4', 'A4', 'C5'], m.wobble - m.reach + .2, { vel: .3, trem: 11 }); slide(t0 + m.reach + .2, 'G6', 'A6', 1.0, { gain: .25 }); grunt(t0 + m.reach + .4, 'shaun', .6);
  giggle(t0 + m.reach + .6, 'timmy', 4);
  for (let t = t0 + m.wobble; t < t0 + m.fall; t += .32) { slide(t, 'E5', 'G5', .15, { gain: .25 }); slide(t + .16, 'G5', 'E5', .15, { gain: .25 }); }
  timpRoll(t0 + m.wobble, t0 + m.fall, 'D2', .3, 1.1); whoa(t0 + m.wobble + .6, 'flock', .7);
  slide(t0 + m.fall, 'C7', 'C4', 1.15, { gain: .55 }); whoa(t0 + m.fall + .1, 'shaun', 1.0); whoa(t0 + m.fall + .2, 'flock', 1.0); whoa(t0 + m.fall + .3, 'flock', .9);
  crash(t0 + m.crash);
}
// 11. SNORE: the dummy drop
{ const t0 = S('snore'), m = T.shot('snore').m;
  headphoneLeak(t0, E('snore'), 1); snore(t0 - .9);
  slide(t0 + m.drop, 'C7', 'G5', m.bonk - m.drop, { gain: .35 }); bonk(t0 + m.bonk); smack(t0 + m.bonk + .35); smack(t0 + m.bonk + .6);
  suck(t0 + m.suck, E('snore')); glock(t0 + m.suck, 'G6', .5); glock(t0 + m.suck + .15, 'D7', .4); hmm(t0 + m.suck + .2, 130, .6, .25);
}
// 12. IDEA
{ const t0 = S('idea'), m = T.shot('idea').m;
  grunt(t0 + .1, 'flock', .5); grunt(t0 + .5, 'flock', .45); plop(t0 + m.pop, 67, .8);
  for (let k = 0; k < 7; k++) glock(t0 + .7 + k * .17, midi('C7') + [0, 4, 7, 4, 0, 4, 7][k], .35, Math.sin(k) * .6);   // dizzy tweets
  wind(t0 + m.look, 'D3', .35, { kind: 'bassoon', vel: .5 }); wind(t0 + m.look + .5, 'F3', .35, { kind: 'bassoon', vel: .5 }); wind(t0 + m.look + 1.0, 'A3', .6, { kind: 'bassoon', vel: .5 });
  hmm(t0 + m.look + 1.4, 240, .5, .3);
  ding(t0 + m.bulb, 1.2); for (let k = 0; k < 10; k++) harp(t0 + m.bulb + k * .05, midi('G4') + [0, 2, 4, 7, 9, 12, 14, 16, 19, 21][k], .7);
  strings(t0 + m.bulb + .1, ['G4', 'B4', 'D5'], 1.4, { vel: .3 }); triangle(t0 + m.bulb + .05);
}
// 13. SETUP: the plan (sneaky pizz), push, roll
{ const t0 = S('setup'), m = T.shot('setup').m;
  sneak(t0, t0 + m.crouch, 1);
  patter(t0, t0 + 1.2, 5, .5, .3); ding(t0 + m.measure + .3, .35);
  for (let k = 0; k < 5; k++) grunt(t0 + m.push + k * .45, k % 2 ? 'flock' : 'shirley', .3);
  brass(t0 + m.up, 'G2', .3, { vel: .45 }); brass(t0 + m.up + .12, 'D3', .4, { vel: .45 }); thud(t0 + m.up + .05, .7); thud(t0 + m.up + .22, .5); thud(t0 + m.up + .3, .5);
  glock(t0 + m.thumbs, 'B6', .6); triangle(t0 + m.thumbs, .6);
  snareRoll(t0 + m.crouch, E('setup') + .08, .2, 1.1); slide(t0 + m.jump, 'C5', 'G6', .6, { gain: .4 }); baa(t0 + m.jump + .1, 'shirley', { dur: .8, gain: .4 });
}
// 14-15. LAUNCH + CATCH + the flight waltz
{ const t0 = S('launch'), m = T.shot('launch').m, ts = t0 + m.slam;
  boing(ts, { base: 80, dur: 1.4, gain: .9 }); thud(ts, 1.2); cymbal(ts, 1.2, 2.5); timp(ts, 'G2', 1.2); poof(ts, .9);
  slide(ts + .05, 'C4', 'C7', 1.85, { gain: .6 }); whoosh(ts + .05, 1.2, .8); baa(ts + .15, 'shaun', { dur: 1.1, f0: 320, bend: -.8, gain: .45 });
  for (let k = 0; k < 12; k++) harp(ts + .1 + k * .12, midi('G3') + [0, 2, 4, 7, 9, 11, 12, 14, 16, 19, 21, 24][k], .6);
  const c0 = S('catch'), cm = T.shot('catch').m, tg = c0 + cm.grab;
  ding(tg, .8); glock(tg, 'G6', .8); glock(tg + .1, 'B6', .7); glock(tg + .2, 'D7', .7); giggle(tg + .3, 'timmy', 5); baa(tg + .9, 'shaun', { dur: .5, gain: .35 });
  // soaring waltz: 8 bars from 81.5, strings + whistle melody + harp + glock, then gently down
  const w0 = 81.5;
  waltzAcc(w0, 9, { vel: .9, str: true }); melody(w0, WALTZ, { kind: 'whistle', vel: .55, octave: 0 }); melody(w0, WALTZ, { kind: 'clarinet', vel: .25, octave: -12 });
  for (let b = 0; b < 8; b++) glock(w0 + b * 1.5, up(CH[WALTZ_CH[b]][2], 24), .45);
  cymbal(w0, .35, 3);
}
// 16. DESCEND: landing + cheer
{ const t0 = S('descend'), m = T.shot('descend').m;
  waltzAcc(93.5, 1, { vel: .6, str: true, chords: ['D7'] }); patter(t0 + .3, t0 + 3.2, 13, .7, -.1);
  poof(t0 + m.land, 1.1); boing(t0 + m.land + .02, { base: 140, dur: .8, gain: .5 }); baa(t0 + m.land + .15, 'shirley', { dur: .6, gain: .4 });
  // tutti cadence
  const tc = t0 + m.cheer; brass(tc, 'G2', 1.5, { vel: .6 }); ['G3', 'B3', 'D4', 'G4'].forEach(n => brass(tc, n, 1.5, { vel: .35 })); strings(tc, ['G4', 'B4', 'D5', 'G5'], 1.7, { vel: .45 }); cymbal(tc, .9, 2.5); timp(tc, 'G2', 1); wind(tc, 'G5', 1.5, { vel: .55 });
  for (let k = 0; k < 9; k++) baa(tc + .05 + r01() * .7, ['flock', 'flock', 'mum', 'shaun', 'timmy'][k % 5], { dur: .45 + r01() * .4, pan: rnd() * .8, gain: .38 });
  patter(tc, E('descend'), 7, .4);
}
// 17. HORN
{ const t0 = S('horn'), m = T.shot('horn').m;
  horn(t0 + m.horn, .8, true); whoosh(t0 + m.snap - .05, .22, .8); brass(t0 + m.snap, 'C#3', .25, { vel: .6, bright: 1.5 }); brass(t0 + m.snap, 'G3', .25, { vel: .5, bright: 1.5 }); woodblock(t0 + m.snap, 'C6', 1);
  strings(t0 + m.snap + .2, ['C#4', 'G4', 'C#5'], 1.3, { vel: .22, trem: 13 });
}
// 18. WAKE
{ const t0 = S('wake'), m = T.shot('wake').m;
  headphoneLeak(t0, t0 + m.jolt, 1); boing(t0 + m.jolt, { base: 180, dur: .6, gain: .6 }); gasp(t0 + m.jolt, 'shaun'); whoosh(t0 + m.jolt + .1, .5, .5, .3);
  whoosh(t0 + m.toss, .5, .5, -.4); slide(t0 + m.toss, 'G5', 'G6', .5, { gain: .3 });
  peaWhistle(t0 + m.whistle, .16); peaWhistle(t0 + m.whistle + .22, .16); peaWhistle(t0 + m.whistle + .44, .3);
  chase(t0 + 1.5, E('wake'), .8, ['D3', 'F#3', 'A3', 'D4']); patter(t0 + 1.55, E('wake'), 10, .7);
}
// 19. LINEUP: scramble, then the flock whistles the theme, innocently
{ const t0 = S('lineup'), m = T.shot('lineup').m;
  chase(t0, t0 + m.still, 1, ['D3', 'F#3', 'A3', 'D4']); patter(t0, t0 + m.still, 16, 1);
  for (let k = 0; k < 4; k++) baa(t0 + .2 + k * .35, 'flock', { dur: .35, pan: rnd() * .6, gain: .3 });
  woodblock(t0 + m.still - .02, 'G5', 1); poof(t0 + m.still - .1, .5);
  melody(t0 + m.still + .3, THEME.slice(0, 12), { kind: 'whistle', vel: .42, until: E('lineup') });
  for (let t = t0 + m.still + .3; t < E('lineup'); t += BEAT * 2) { pizz(t, 'G2', .5); pizz(t + BEAT, 'D3', .4); }
  peaWhistle(t0 + 2.75, .5); patter(t0 + .2, t0 + 2.4, 9, .5, -.4);
}
// 20. BUSTED
{ const t0 = S('busted'), m = T.shot('busted').m;
  for (let t = t0, k = 0; t < t0 + m.stop; t += BEAT, k++) { wind(t, ['E3', 'G3', 'B3', 'A3', 'G3', 'F#3'][k % 6], .3, { kind: 'bassoon', vel: .5 }); brush(t, .5); }
  woodblock(t0 + m.stop, 'E5', .8); hmm(t0 + m.lookup + .2, 140, .6, .35);
  strings(t0 + m.lookup, ['E4', 'B4'], .8, { vel: .15, trem: 9 });
  baa(t0 + m.lookup + .7, 'shaun', { dur: .35, gain: .3, f0: 280 });   // sheepish
  squeak(t0 + m.hand, .35, 1, .1);
  slide(t0 + m.lift, 'C5', 'G6', 2.2, { gain: .45 }); for (let k = 0; k < 8; k++) harp(t0 + m.lift + .2 + k * .12, midi('C4') + [0, 4, 7, 12, 16, 19, 24, 28][k], .5);
  brass(t0 + m.deadpan, 'C2', 1.4, { vel: .55, bright: .5, slide: -1 });
  melody(t0 + m.deadpan + .4, [['G4', 1], ['E4', 1], ['C4', 2]], { kind: 'clarinet', vel: .35 });
  wind(t0 + m.deadpan + .3, 'A4', 1.0, { kind: 'whistle', vel: .15 });     // Bitzer's resigned whine
  baa(t0 + 6.4, 'flock', { dur: .4, gain: .25, pan: .4 });
}
// 21. FARMER BACK
{ const t0 = S('farmback'), m = T.shot('farmback').m;
  carEngine(t0 - .5, t0 + m.stop + .3, { rev: t => t < t0 + m.stop - .8 ? .5 : .15, dist: t => clamp(.35 + (t - t0) * .3, 0, 1) });
  brakes(t0 + m.stop - .15);
  accordion(t0 + .3, CH.G, 1.8, { vel: .25 }); accordion(t0 + 2.1, CH.C, 1.0, { vel: .25 }); accordion(t0 + 3.1, CH.D, .9, { vel: .25 });
  melody(t0 + .3, THEME.slice(0, 6), { kind: 'clarinet', vel: .35 });
  hmm(t0 + m.nod, 120, .3, .3); hmm(t0 + m.nod + .35, 125, .3, .3);
  for (let k = 0; k < 6; k++) glock(t0 + m.up + k * .1, midi('D6') + [0, 2, 4, 7, 9, 12][k], .4);
}
// 22. THE END
{ const t0 = S('end'), m = T.shot('end').m;
  for (let i = 0; i < 6; i++) { const ti = t0 + m.letters + i * .1 + .42; plop(ti, 60 + [0, 4, 7, 12, 7, 12][i], .7, (i - 2.5) * .15); woodblock(ti, midi('G5') + [0, 4, 7, 12, 7, 12][i], .5); }
  slide(t0 + m.pop, 'D5', 'D6', .3, { gain: .45 }); boing(t0 + m.pop + .35, { base: 200, dur: .4, gain: .35 });
  baa(t0 + m.baa, 'shaun', { dur: .5, gain: .8, f0: 270 });
  ding(t0 + m.wink, .9); triangle(t0 + m.wink);
  const tf = t0 + m.iris; brass(tf, 'G2', 1.2, { vel: .6 }); ['G3', 'B3', 'D4'].forEach(n => brass(tf, n, 1.1, { vel: .35 })); accordion(tf, ['G3', 'B3', 'D4', 'G4'], 1.1, { vel: .35 });
  cymbal(tf, .7, 1.6); timp(tf, 'G2', 1); glock(tf, 'G6', .8); glock(tf + .08, 'D7', .7); glock(tf + .16, 'G7', .6);
  wind(t0 + .1, 'D5', .4, { vel: .35 }); wind(t0 + .5, 'B4', .4, { vel: .35 }); wind(t0 + .9, 'G4', .8, { vel: .35 });
}

// =================================== REVERB + MIX ===================================
// Freeverb-style: 8 combs + 4 allpasses per side on the send bus.
function reverb(inp, sp) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(n => ({ b: new Float32Array(Math.round((n + sp) * SR / 44100)), i: 0, f: 0 }));
  const aps = [556, 441, 341, 225].map(n => ({ b: new Float32Array(Math.round((n + sp) * SR / 44100)), i: 0 }));
  const out = new Float32Array(N), fb = .84, damp = .25;
  for (let j = 0; j < N; j++) {
    const x = inp[j] * .015; let s = 0;
    for (const c of combs) { const y = c.b[c.i]; c.f = y * (1 - damp) + c.f * damp; c.b[c.i] = x + c.f * fb; c.i = (c.i + 1) % c.b.length; s += y; }
    for (const a of aps) { const y = a.b[a.i]; a.b[a.i] = s + y * .5; a.i = (a.i + 1) % a.b.length; s = y - s; }
    out[j] = s;
  }
  return out;
}
const RL = reverb(SL, 0), RR = reverb(SRv, 23);
{ const hl = biquad('hp').set(38, .7), hr = biquad('hp').set(38, .7); let pk = 0;
  for (let j = 0; j < N; j++) { L[j] = hl.run(L[j] + RL[j] * 1.1); R[j] = hr.run(R[j] + RR[j] * 1.1); pk = Math.max(pk, Math.abs(L[j]), Math.abs(R[j])); }
  // glue compressor: RMS follower (att 15 ms, rel 250 ms), 2.5:1 above -20 dB re peak, so quiet scenes sit closer to loud ones
  let e = 0; const aA = Math.exp(-1 / (SR * .015)), aR = Math.exp(-1 / (SR * .25)), thr = pk * .1;
  for (let j = 0; j < N; j++) { const x = (L[j] * L[j] + R[j] * R[j]) * .5, c = x > e ? aA : aR; e = c * e + (1 - c) * x; const rms = Math.sqrt(e);
    const gg = rms > thr ? (rms / thr) ** (1 / 2.5 - 1) : 1; L[j] *= gg; R[j] *= gg; } }
// lookahead peak limiter (5 ms look, 120 ms release): pre-gain so the body of the mix is +6 dB hotter, ceiling .89
{ let pk = 0; for (let j = 0; j < N; j++) pk = Math.max(pk, Math.abs(L[j]), Math.abs(R[j]));
  const pre = 2 * .89 / pk, look = Math.round(SR * .005), rel = Math.exp(-1 / (SR * .12)), need = new Float32Array(N);
  for (let j = 0; j < N; j++) { const a = Math.max(Math.abs(L[j]), Math.abs(R[j])) * pre; need[j] = a > .89 ? .89 / a : 1; }
  // min over the lookahead window (sliding, via a simple backwards pass), then smooth the release
  const gmin = new Float32Array(N); let q = []; 
  for (let j = N - 1; j >= 0; j--) { let m = need[j]; for (let k = 1; k <= look && j + k < N; k += 16) m = Math.min(m, need[j + k]); gmin[j] = m; }
  let gcur = 1; for (let j = 0; j < N; j++) { gcur = gmin[j] < gcur ? gmin[j] : gcur * rel + (1 - rel) * gmin[j]; L[j] *= pre * gcur; R[j] *= pre * gcur; } }
let peak = 0; for (let j = 0; j < N; j++) peak = Math.max(peak, Math.abs(L[j]), Math.abs(R[j]));
const g = Math.min(1, .89 / (peak || 1));
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let j = 0; j < N; j++) { buf.writeInt16LE(Math.round(clamp(L[j] * g, -1, 1) * 32767), 44 + j * 4); buf.writeInt16LE(Math.round(clamp(R[j] * g, -1, 1) * 32767), 46 + j * 4); }
mkdirSync(resolve(ROOT, 'out'), { recursive: true }); writeFileSync(resolve(ROOT, 'out/shaun.wav'), buf);
console.log(`wrote out/shaun.wav  ${T.DUR}s  peak ${peak.toFixed(2)} -> x${g.toFixed(2)}`);
