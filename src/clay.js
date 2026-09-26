// clay.js: the plasticine look. Procedural textures (thumbprints, wool curls, flocked grass, wood grain),
// hand-made lumpy geometry, and the material palette. All seeded, built once at init.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, fbm, noise3 } from './lib.js';

function canvasTex(size, draw, { repeat = 1, color = false, seed = 1 } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size, rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}
// Draw something at (x,y) and at its wrapped copies so the texture tiles seamlessly.
const wrapDraw = (s, x, y, r, fn) => { for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) if (x + dx > -r && x + dx < s + r && y + dy > -r && y + dy < s + r) fn(x + dx, y + dy); };

// Thumbprints: soft dents with fingerprint ridges, tool smears and low lumps. Grey 128 = flat.
function thumbprints(g, s, r) {
  g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
  // low-frequency lumps
  for (let i = 0; i < 90; i++) {
    const x = r() * s, y = r() * s, rad = 30 + r() * 90, v = r() < .5 ? 0 : 255;
    wrapDraw(s, x, y, rad, (X, Y) => { const gr = g.createRadialGradient(X, Y, 0, X, Y, rad);
      gr.addColorStop(0, `rgba(${v},${v},${v},.10)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); g.fillStyle = gr; g.fillRect(X - rad, Y - rad, rad * 2, rad * 2); });
  }
  // thumbprints
  for (let i = 0; i < 70; i++) {
    const x = r() * s, y = r() * s, a = r() * Math.PI, rw = 18 + r() * 26, rh = rw * (.55 + r() * .3);
    wrapDraw(s, x, y, rw * 1.3, (X, Y) => {
      g.save(); g.translate(X, Y); g.rotate(a);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rw); gr.addColorStop(0, 'rgba(0,0,0,.22)'); gr.addColorStop(.8, 'rgba(0,0,0,.06)'); gr.addColorStop(1, 'rgba(255,255,255,.10)');
      g.scale(1, rh / rw); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rw, 0, 7); g.fill();
      g.lineWidth = 1.1;
      for (let k = 3; k < rw; k += 2.6) { g.strokeStyle = (k / 2.6 | 0) % 2 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)'; g.beginPath(); g.ellipse(0, k * .12, k, k * .92, 0, .2 + r() * .4, Math.PI * 2 - .2 - r() * .4); g.stroke(); }
      g.restore();
    });
  }
  // modelling-tool smears
  for (let i = 0; i < 40; i++) {
    const x = r() * s, y = r() * s, a = r() * Math.PI * 2, len = 20 + r() * 60;
    wrapDraw(s, x, y, len, (X, Y) => { g.save(); g.translate(X, Y); g.rotate(a); g.lineCap = 'round';
      g.strokeStyle = 'rgba(0,0,0,.10)'; g.lineWidth = 3 + r() * 4; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len / 2, (r() - .5) * 14, len, 0); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 3); g.quadraticCurveTo(len / 2, 3, len, 3); g.stroke(); g.restore(); });
  }
  // fine pores
  const id = g.getImageData(0, 0, s, s), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - .5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
}
// Wool: tight curls and pulled strands.
function woolCurls(g, s, r) {
  g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const x = r() * s, y = r() * s, rad = 3 + r() * 9, a0 = r() * 7;
    wrapDraw(s, x, y, rad + 2, (X, Y) => {
      g.lineWidth = 1.5 + r() * 2.5; g.strokeStyle = `rgba(0,0,0,${.18 + r() * .2})`;
      g.beginPath(); g.arc(X + 1, Y + 1.5, rad, a0, a0 + 3.5 + r() * 2); g.stroke();
      g.strokeStyle = `rgba(255,255,255,${.25 + r() * .25})`;
      g.beginPath(); g.arc(X, Y, rad, a0, a0 + 3 + r() * 2); g.stroke();
    });
  }
}
function woolColor(g, s, r) {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 400; i++) { const x = r() * s, y = r() * s, rad = 10 + r() * 40, w = r() < .5;
    wrapDraw(s, x, y, rad, (X, Y) => { const gr = g.createRadialGradient(X, Y, 0, X, Y, rad); const c = w ? '255,250,238' : '222,214,198';
      gr.addColorStop(0, `rgba(${c},.5)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(X - rad, Y - rad, rad * 2, rad * 2); }); }
}
// Flocked clay grass: colour map of short strokes.
function grassColor(g, s, r) {
  g.fillStyle = '#6f9a3c'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 60; i++) { const x = r() * s, y = r() * s, rad = 40 + r() * 120;
    wrapDraw(s, x, y, rad, (X, Y) => { const gr = g.createRadialGradient(X, Y, 0, X, Y, rad); const c = r() < .5 ? '140,178,70' : '84,128,48';
      gr.addColorStop(0, `rgba(${c},.35)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(X - rad, Y - rad, rad * 2, rad * 2); }); }
  const cols = ['#5d8a2f', '#7faa45', '#8fbb52', '#4f7a2a', '#a1c35e', '#6a9638'];
  for (let i = 0; i < 26000; i++) {
    const x = r() * s, y = r() * s, a = -Math.PI / 2 + (r() - .5) * 1.2, l = 3 + r() * 7;
    g.strokeStyle = cols[(r() * cols.length) | 0]; g.lineWidth = 1 + r() * 1.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
}
function grassBump(g, s, r) {
  g.fillStyle = '#707070'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 20000; i++) {
    const x = r() * s, y = r() * s, a = -Math.PI / 2 + (r() - .5) * 1.2, l = 3 + r() * 7;
    g.strokeStyle = `rgba(255,255,255,${.2 + r() * .4})`; g.lineWidth = 1 + r() * 1.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
}
function woodGrain(g, s, r) {
  g.fillStyle = '#9a6a3c'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 1) {
    const v = Math.sin(y * .09 + fbm(y * .02, 3.1) * 6) * .5 + .5;
    g.fillStyle = `rgba(70,40,18,${v * .35})`; g.fillRect(0, y, s, 1);
  }
  for (let i = 0; i < 18; i++) { const x = r() * s, y = r() * s; g.strokeStyle = 'rgba(60,34,14,.5)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(x, y, 10 + r() * 8, 3 + r() * 2, 0, 0, 7); g.stroke(); }
}
function stoneColor(g, s, r) {
  g.fillStyle = '#9b988c'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 1400; i++) { const x = r() * s, y = r() * s, rad = 4 + r() * 22; const c = [[122, 118, 108], [168, 162, 148], [110, 124, 84], [140, 134, 118], [178, 170, 150]][(r() * 5) | 0];
    wrapDraw(s, x, y, rad, (X, Y) => { g.fillStyle = `rgba(${c},.35)`; g.beginPath(); g.arc(X, Y, rad, 0, 7); g.fill(); }); }
}
function stripes(g, s) {
  const cols = ['#d8433a', '#f6efe2', '#2f6db5', '#f6efe2'];
  for (let i = 0; i < 8; i++) { g.fillStyle = cols[i % 4]; g.fillRect(i * s / 8, 0, s / 8, s); }
}
function checks(g, s) {   // farmer's shirt
  g.fillStyle = '#e9e2cf'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(160,50,40,.45)'; g.fillRect(i * s / 8, 0, s / 20, s); g.fillRect(0, i * s / 8, s, s / 20); }
}

export const TX = {};
export const M = {};

export function buildMaterials() {
  TX.thumb = canvasTex(1024, thumbprints, { repeat: 2, seed: 3 });
  TX.thumbBig = canvasTex(1024, thumbprints, { repeat: 6, seed: 7 });
  TX.wool = canvasTex(1024, woolCurls, { repeat: 3, seed: 5 });
  TX.woolC = canvasTex(512, woolColor, { repeat: 2, color: true, seed: 6 });
  TX.grass = canvasTex(1024, grassColor, { repeat: 60, color: true, seed: 8 });
  TX.grassB = canvasTex(1024, grassBump, { repeat: 60, seed: 9 });
  TX.wood = canvasTex(512, woodGrain, { repeat: 1, color: true, seed: 10 });
  TX.stone = canvasTex(512, stoneColor, { repeat: 1, color: true, seed: 11 });
  TX.stripes = canvasTex(256, stripes, { repeat: 1, color: true });
  TX.checks = canvasTex(256, checks, { repeat: 2, color: true });

  const clay = (color, o = {}) => new THREE.MeshPhysicalMaterial({
    color, roughness: o.rough ?? .58, metalness: 0, bumpMap: o.bumpMap ?? TX.thumb, bumpScale: o.bump ?? 1.4,
    sheen: o.sheen ?? .25, sheenRoughness: .7, sheenColor: new THREE.Color(o.sheenColor ?? '#ffffff'),
    clearcoat: o.coat ?? 0, clearcoatRoughness: .35, map: o.map ?? null, vertexColors: !!o.vc,
    emissive: o.emissive ?? '#000000', emissiveIntensity: o.ei ?? 1,
  });
  M.clay = clay;
  M.wool = clay('#f4efe4', { rough: .92, bumpMap: TX.wool, bump: 3.2, map: TX.woolC, sheen: .6, sheenColor: '#fff6e0' });
  M.woolGrey = clay('#d9d3c7', { rough: .92, bumpMap: TX.wool, bump: 3.2, map: TX.woolC, sheen: .6 });
  M.face = clay('#1b1a1d', { rough: .42, bump: 1.1, sheen: .35, sheenColor: '#8a8aa0', coat: .15 });
  M.eye = clay('#faf8f0', { rough: .22, bump: .3, coat: .6, sheen: 0 });
  M.pupil = clay('#070708', { rough: .12, bump: .1, coat: 1, sheen: 0 });
  M.mouth = clay('#5b1e25', { rough: .5 });
  M.tongue = clay('#d9667a', { rough: .45 });
  M.teeth = clay('#fbf6e8', { rough: .3 });
  M.pink = clay('#e89aa6', { rough: .5 });
  M.hoof = clay('#2a2624', { rough: .5 });
  M.dummy = clay('#4aa3df', { rough: .3, coat: .5 });
  M.dummyRing = clay('#f2c230', { rough: .3, coat: .5 });
  M.curler = clay('#ff7fb0', { rough: .35, coat: .4 });

  M.tan = clay('#c98f4e', { rough: .55, sheen: .3 });
  M.tanDark = clay('#6f4526', { rough: .55 });
  M.muzzle = clay('#e8c9a0', { rough: .55 });
  M.nose = clay('#161313', { rough: .2, coat: .8 });
  M.hat = clay('#2f5fb4', { rough: .9, bumpMap: TX.wool, bump: 1.6 });
  M.hatRib = clay('#264f98', { rough: .9, bumpMap: TX.wool, bump: 2 });
  M.board = clay('#9a6a3c', { map: TX.wood, rough: .6 });
  M.paper = clay('#f6f1e2', { rough: .8, bump: .5 });
  M.metal = new THREE.MeshStandardMaterial({ color: '#c9cdd3', roughness: .25, metalness: .95 });
  M.phones = clay('#e8672b', { rough: .35, coat: .4 });
  M.watch = clay('#d8a938', { rough: .3, coat: .5 });

  M.skin = clay('#e8b594', { rough: .55, sheen: .4, sheenColor: '#ffd8c0' });
  M.hair = clay('#4a3322', { rough: .8 });
  M.glass = new THREE.MeshPhysicalMaterial({ color: '#dfe8ee', roughness: .05, metalness: 0, transmission: 0, transparent: true, opacity: .25, clearcoat: 1 });
  M.shirt = clay('#e6dcc6', { map: TX.checks, rough: .8 });
  M.carBody = clay('#8fb49a', { rough: .38, coat: .6, bump: .6 });
  M.carTrim = clay('#e9e1cc', { rough: .4, coat: .4 });
  M.tyre = clay('#1d1c1c', { rough: .8 });
  M.window = new THREE.MeshPhysicalMaterial({ color: '#27353d', roughness: .08, clearcoat: 1, transparent: true, opacity: .55 });
  M.lamp = clay('#fff6d0', { rough: .2, emissive: '#fff0b0', ei: .3, coat: 1 });

  M.grass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: TX.grass, bumpMap: TX.grassB, bumpScale: 2.5, roughness: .95, vertexColors: true, sheen: .5, sheenColor: new THREE.Color('#d8f0a0'), sheenRoughness: .8 });
  M.grassTuft = clay('#6c9a38', { rough: .9, bump: 2, sheen: .6, sheenColor: '#e0ffa0' });
  M.flowerW = clay('#fbf7ea', { rough: .6 });
  M.flowerY = clay('#f2c230', { rough: .6 });
  M.hedge = clay('#4d7a2c', { rough: .9, bumpMap: TX.wool, bump: 3, sheen: .5, sheenColor: '#c8ff90' });
  M.leaf = clay('#5a8a30', { rough: .85, bumpMap: TX.wool, bump: 2.6, sheen: .5, sheenColor: '#c8ff90' });
  M.leafDark = clay('#3f6a26', { rough: .85, bumpMap: TX.wool, bump: 2.6, sheen: .4 });
  M.trunk = clay('#6a4a30', { rough: .8, bumpMap: TX.thumbBig, bump: 3 });
  M.stone = clay('#ffffff', { map: TX.stone, rough: .85, bumpMap: TX.thumbBig, bump: 3.5, vc: true });
  M.wood = clay('#ffffff', { map: TX.wood, rough: .7, bump: 1.2 });
  M.woodDark = clay('#8a7a6a', { map: TX.wood, rough: .7, bump: 1.2 });
  M.barn = clay('#b8412e', { rough: .7, map: TX.wood, bump: 1.4 });
  M.trim = clay('#f3eee2', { rough: .6 });
  M.roof = clay('#6d6f73', { rough: .6, bumpMap: TX.thumbBig, bump: 2 });
  M.slate = clay('#4d545c', { rough: .55, bumpMap: TX.thumbBig, bump: 2.5 });
  M.wallWhite = clay('#efe8d8', { rough: .85, bumpMap: TX.thumbBig, bump: 3.5 });
  M.door = clay('#3c6e4a', { rough: .5 });
  M.darkWin = clay('#1e2a33', { rough: .15, coat: 1 });
  M.road = clay('#a08a68', { rough: .95, bumpMap: TX.thumbBig, bump: 4 });
  M.hay = clay('#e3c268', { rough: .9, bumpMap: TX.wool, bump: 3.5, sheen: .5, sheenColor: '#fff0b0' });
  M.stripes = clay('#ffffff', { map: TX.stripes, rough: .8, bump: .6 });
  M.cloud = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, bumpMap: TX.thumb, bumpScale: 2, emissive: '#dfe6f0', emissiveIntensity: .35 });
  M.smoke = new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: 1, transparent: true, opacity: .85, bumpMap: TX.thumb, bumpScale: 1.5 });
  M.puff = new THREE.MeshStandardMaterial({ color: '#d9c7a4', roughness: 1, transparent: true, opacity: .9, bumpMap: TX.thumb, bumpScale: 1.5 });
  M.bulb = new THREE.MeshPhysicalMaterial({ color: '#fff3a0', emissive: '#ffe35a', emissiveIntensity: 1.6, roughness: .15, clearcoat: 1 });
  M.string = new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: .8 });
  M.letter = clay('#fbf8f0', { rough: .45, bump: 1.6, sheen: .3, coat: .2 });
  M.letterEdge = clay('#1b1a1d', { rough: .45 });
  M.letterRed = clay('#d8433a', { rough: .45, coat: .2 });
  M.letterYellow = clay('#f2b630', { rough: .45, coat: .2 });
  M.zzz = clay('#f4f0ff', { rough: .45, emissive: '#b8c8ff', ei: .15 });
  M.butterfly = clay('#f28a2e', { rough: .5 });
  M.balloon = ['#e8392f', '#f5c12e', '#2f7fe0', '#3fb556', '#ef6fb0'].map(c => new THREE.MeshPhysicalMaterial({
    color: c, roughness: .18, metalness: 0, clearcoat: 1, clearcoatRoughness: .08, sheen: .3, bumpMap: TX.thumb, bumpScale: .25,
    transmission: 0, thickness: .5 }));
  return M;
}

// ---------- geometry ----------
// Hand-made: push vertices along their normals by 3D noise so nothing is machine-perfect.
export function lumpy(geo, amp = .02, freq = 3, seed = 0) {
  const pos = geo.attributes.position, nrm = geo.attributes.normal, v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i); n.fromBufferAttribute(nrm, i);
    const d = amp * (noise3(v.x * freq + seed * 7.1, v.y * freq + seed * 3.3, v.z * freq - seed * 5.7) + .5 * noise3(v.x * freq * 2.7 + 9, v.y * freq * 2.7, v.z * freq * 2.7 + seed));
    pos.setXYZ(i, v.x + n.x * d, v.y + n.y * d, v.z + n.z * d);
  }
  geo.computeVertexNormals();
  return geo;
}
// Icosphere with shared vertices (PolyhedronGeometry is non-indexed: displacing it along face normals cracks it open).
export function ico(r, detail = 3) { const g = new THREE.IcosahedronGeometry(r, detail); g.deleteAttribute('normal'); g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-5); m.computeVertexNormals();
  const pos = m.attributes.position, uv = new Float32Array(pos.count * 2);   // spherical uv
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), l = Math.hypot(x, y, z) || 1; uv[i * 2] = Math.atan2(z, x) / (2 * Math.PI) + .5; uv[i * 2 + 1] = Math.acos(y / l) / Math.PI; }
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return m; }
export const blob = (r, detail = 3, amp = .06, seed = 0) => lumpy(ico(r, detail), r * amp, 2.2 / r, seed);
export const ball = (r, amp = .03, seed = 0, ws = 40, hs = 28) => lumpy(new THREE.SphereGeometry(r, ws, hs), r * amp, 2 / r, seed);
export const capsule = (r, len, amp = .04, seed = 0) => lumpy(new THREE.CapsuleGeometry(r, len, 8, 20), r * amp, 1.5 / r, seed);
export function mesh(geo, mat, cast = true, receive = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; return m; }
