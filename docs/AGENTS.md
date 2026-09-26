# Claymation story kit: contract for the author

You write a short **Shaun the Sheep–style claymation film** (20–120 s) that renders to MP4. The engine is fixed:
clay puppets, a farm set, lighting, stop-motion timing, post (AO, depth of field, grade) and a synth soundtrack engine.
**You write exactly three files:**

| file | what it holds |
|---|---|
| `src/timeline.js` | title, `DUR`, optional `light`, and the shot table: `{ id, start, end, m: { mark: seconds } }` |
| `src/shots.js` | `export const SHOTS = { <id>: (m, C) => ({ hero, cam, cast, fx }) }`, one entry per shot |
| `src/score.mjs` | `export default function score(api) { ... }`: every music and sound cue |

Never edit anything else. Read `docs/API.md` (actors, pose fields, props, camera, the farm map), `docs/SOUND.md`
(instruments, voices, foley) and `docs/CRAFT.md` (how to make it funny and readable) before writing.

## Rules the engine relies on
- Every frame is a pure function of time. No `Math.random`, no clock, no timers, no state carried between frames:
  compute everything from `lt` (seconds since the shot started) or `t` (absolute). Randomness: `hash(i, seed)`.
- Shots are back to back: shot 1 starts at 0, each starts where the previous ended, the last ends at `DUR`.
- Marks (`m`) are seconds from the shot's start. Use a mark for every event that has a sound (a jump, a bonk,
  a landing) and use the SAME mark in `shots.js` and in `score.mjs` (`at('shot', 'mark', offset)`). That is how
  picture and sound stay in sync.
- Angles are degrees. Positions are metres. `y` is height above the grass unless the pose sets `abs: true`.
- `yaw: 0` faces +Z (towards the usual camera). Use `yawTo([x,z], [x2,z2])` to face something.
- Characters only exist in a shot if they are in its `cast`. Props and text are hidden before every frame; `fx` shows them.
- Anything shared between shots (a prop, a text) is created once in a shot factory and stored on `C` (`C.apple = ...`).

## Workflow
1. Plan: a story with a setup, a problem, an escalation (try, fail, try bigger), a payoff and a button gag.
   Write the shot table (CRAFT.md "planning table") before any code.
2. Write the three files.
3. `node tools/check.mjs` must print PASS. Fix every FAIL; fix warnings too (each gives a concrete fix).
   `node tools/check.mjs --shot=<id> -v` checks one shot and prints each character's size in frame.
4. Look: `node tools/render.mjs --sheet=auto --out=out/sheet.jpg` renders a contact sheet (2–3 stills per shot). Check
   the CRAFT.md critique list against it. Fix and repeat.
5. Watch it: `node tools/serve.mjs --port 8998` then open `/`. The page renders live and synthesises the soundtrack in the
   browser (a few seconds after load); play / scrub / jump to shots. `node tools/audio.mjs` checks score.mjs builds.
6. Optional MP4: `node tools/render.mjs --frames && node tools/audio.mjs && node tools/render.mjs --encode`
   (one render at a time: parallel GPU pages crash).

## Answer format (when a model writes the files)
Each file as a fenced block whose first line is `// FILE: src/timeline.js` (or `src/shots.js`, `src/score.mjs`),
complete file every time, never diffs or `...`.
