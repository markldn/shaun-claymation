// score.mjs: the soundtrack cue sheet for THIS story. tools/audio.mjs calls score(api) once.
// Times come from src/timeline.js marks via at(shot, mark, offset) / S(shot) / E(shot), the same numbers the animation uses.
// Every instrument, voice and foley call is documented in the kit's docs/SOUND.md.
export default function score(api) {
const { S, E, T, at, midi, up, CH, RT, FIFTH, clamp, rnd, r01, biquad, add, G, SR, BEAT, ks, pizz, harp, banjo, wind, brass, accordion, glock, strings, timp, timpRoll, snare, snareRoll, brush, cymbal, woodblock, triangle, voice, baa, giggle, gasp, grunt, whoa, hmm, sigh, rooster, snore, smack, suck, slide, peaWhistle, fingerWhistle, boing, thud, poof, whoosh, bonk, plop, squeak, ding, crash, patter, carEngine, horn, brakes, headphoneLeak, birds, windBed, flockAmbience, melody, oompah, brushes, waltzAcc, sneak, chase, sadTrombone, stab } = api;
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
const WALTZ = [['D5', 2], ['B4', 1], ['G5', 2], ['F#5', 1], ['E5', 1], ['D5', 1], ['C5', 1], ['B4', 3], ['C5', 2], ['A4', 1], ['E5', 2], ['D5', 1], ['C5', 1], ['B4', 1], ['A4', 1], ['G4', 3]];
const WALTZ_CH = ['G', 'Em', 'C', 'G', 'Am', 'C', 'D7', 'G'];
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

}
