# Shaun the Sheep: "Up, Up & Baa-way!"

A 2-minute claymation-style short (fan work), made entirely in code: three.js puppets built from lumpy clay primitives, procedural thumbprint and wool textures, stop-motion posing on twos (12 poses/s), GTAO + depth of field + film grade, and a fully synthesised soundtrack (score + Foley, no samples).

- `src/timeline.js`: shot table and marks, shared by picture and sound
- `src/shots.js`: every shot (camera + cast keys)
- `src/characters.js`, `src/set.js`, `src/clay.js`, `src/text.js`: puppets, farm set, materials, 3D title letters
- `tools/audio.mjs`: soundtrack -> `out/shaun.wav`
- `tools/render.mjs`: stills / contact sheets / frames / MP4 encode (headless Chromium on the GPU)

```bash
npm install
node tools/serve.mjs --port 8998          # live preview with scrubber: http://localhost:8998/
node tools/audio.mjs                       # soundtrack
node tools/render.mjs --frames --workers=3 && node tools/render.mjs --encode   # out/shaun.mp4
```
