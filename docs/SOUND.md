# SOUND: the `score(api)` cue sheet

`src/score.mjs` exports `default function score(api)`. Destructure what you use from `api` and call it; each call places
one sound at an absolute time in seconds. The engine mixes, adds reverb, compresses, limits and normalises
(the encode lands at -16 LUFS). No samples: everything is synthesised, so any number of cues is fine.

## Timing
- `at('shot', 'mark', offset = 0)`: absolute time of a mark (the same mark the animation uses). Use it for EVERY sync point.
- `S('shot')`, `E('shot')`: shot start / end. `T.DUR`, `BEAT` (= 0.5 s: the score is written at 120 BPM, bar = 2 s).
- Notes are names (`'G4'`, `'F#3'`, `'Bb2'`) or MIDI numbers; `up(note, semitones)`.
- Chord names for `CH` / `oompah` / `waltzAcc`: `G D D7 C Am Em B7 Bm E A7 F Cm Ebmaj Dm`.

## Music phrases (the fast way to score a scene)
| call | what |
|---|---|
| `melody(t0, [[note, beats], ...], { kind: 'whistle'|'clarinet'|'bassoon', vel: .5, until, octave })` | a tune; `null` note = rest. Returns the end time |
| `oompah(t0, bars, ['G','D7',...], { until, vel, pah: 'pizz'|'accordion' })` | folk oom-pah: tuba on 1 and 3, chord on 2 and 4 (two chords per bar) |
| `brushes(t0, t1, v)` | soft brush-snare groove |
| `waltzAcc(t0, bars, { chords, harpArp: true, str: false, vel })` | 3/4 waltz accompaniment (bar = 1.5 s), harp arpeggios, `str` adds strings |
| `sneak(t0, t1, v)` | tiptoe pizzicato walking bass (sneaky plans, inspections) |
| `chase(t0, t1, v, [chord notes])` | fast pizz ostinato + snare (running, panic) |
| `sadTrombone(t)` | wah-wah-wah-waaah (failure) |
| `stab(t, 'Cm', v)` | orchestral hit (shock) |
| `strings(t, [notes], len, { vel, trem: 0|12 })` | sustained chord; `trem` = tremolo for suspense |
| `accordion(t, [notes], len)`, `brass(t, note, len, { vel, slide })`, `wind(t, note, len, { kind })` | single instruments |
| `pizz(t, note, v, pan)`, `harp(t, note)`, `banjo(t, note)`, `glock(t, note)` | plucked / bell notes |
| `timp(t, note, v)`, `timpRoll(t0, t1, note, v0, v1)`, `snare(t, v)`, `snareRoll(t0, t1, v0, v1)`, `cymbal(t, v, len)`, `woodblock(t, note)`, `triangle(t)` | percussion (a snare roll into a big moment, cymbal on the payoff) |

## Voices (formant-synth, no words; the characters never speak)
`baa(t, who, { dur: .75, f0, gain, pan })` with who = `'shaun' 'timmy' 'shirley' 'mum' 'flock'` · `giggle(t, who, n)` ·
`gasp(t)` · `grunt(t, who, dur)` (effort) · `whoa(t, who, dur)` (falling) · `hmm(t, f0, dur)` (Bitzer / Farmer hum) ·
`sigh(t)` · `snore(t)` (one 2.3 s cycle: loop it every 2.4 s) · `smack(t)` (lips) · `rooster(t)` (dawn).

## Foley
`slide(t, fromNote, toNote, dur)` slide whistle (jumps up, falls down) · `boing(t, { base: 95, dur: 1.1 })` spring ·
`thud(t, g)` · `poof(t, g)` (landing in wool / dust) · `whoosh(t, dur)` · `bonk(t)` (head hit) · `plop(t, midi)` (letters,
small drops) · `squeak(t, dur)` (balloon rubber) · `ding(t)` (idea!) · `crash(t)` (pile-up) · `patter(t0, t1, rate)`
(footsteps: rate 4 walking, 10+ running) · `peaWhistle(t, dur)` (Bitzer) · `fingerWhistle(t)` (Shaun calls the flock) ·
`carEngine(t0, t1, { rev: t => 0..1, dist: t => 0..1 })` · `horn(t, g, far)` (beep-beep) · `brakes(t)` ·
`headphoneLeak(t0, t1)` · `suck(t0, t1)` (dummy).

## Ambience
`birds(t0, t1, density)` · `windBed(t0, t1, g)` (put one quiet bed under the whole film) · `flockAmbience(t0, t1, every)` (distant baas).

## Rules that make it sound finished
- Every visible impact, jump, landing, hit, gag has a sound AT its mark. Silence on a hit reads as a mistake.
- Music changes with the story beat (calm, sneaky, chase, suspense, triumph) and stops dead for a gag
  (a horn, a whistle, a crash), then restarts. A 0.5–1 s silence before a payoff makes it land.
- Rise with the action: `slide` up on a jump, `snareRoll` before the big moment, `cymbal` + `stab` on it.
- Compose your own tune for the film (key, 8–16 notes, `[note, beats]`); do not reuse the example's melodies.
