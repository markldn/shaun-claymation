# Shaun the Sheep: "Up, Up & Baa-way!"

A 2-minute claymation-style short (fan work), made entirely in code: three.js puppets built from lumpy clay primitives, procedural thumbprint and wool textures, stop-motion posing on twos (12 poses/s), GTAO + depth of field + film grade, and a fully synthesised soundtrack (score + Foley, no samples).

Everything runs in the browser: the picture is rendered live in WebGL and the soundtrack is synthesised by a Web Worker when the page opens (~8 s), then played with Web Audio in sync with the scrubber. No video or audio files.

- `src/timeline.js`: shot table and marks, shared by picture and sound
- `src/shots.js`: every shot (camera + cast keys); `src/stage.js`: the helpers it uses
- `src/score.mjs`: the sound cue sheet; `src/synth.mjs`: the synthesiser (instruments, bleats, foley, mix)
- `src/characters.js`, `src/set.js`, `src/clay.js`, `src/text.js`, `src/story.js`, `src/main.js`: puppets, farm set, materials, 3D letters, shot engine, renderer
- `docs/`: how to write a new story (API, sound, craft); `tools/agent/build-story.mjs`: a local model writes one

```bash
npm install
node tools/serve.mjs --port 8998          # open http://localhost:8998/  (play / scrub / jump to shots)
node tools/check.mjs                       # framing + timeline gate for the story
node tools/render.mjs --sheet=auto         # contact sheet of stills (optional dev tool)
```
