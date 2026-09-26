// set.js: Mossy Bottom Farm as a clay model set. Terrain, patchwork hills, dry-stone walls, hedges, trees,
// farmhouse, barn, lane, see-saw, bales, deckchair, sky dome with clay clouds.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, blob, ball, capsule, mesh, lumpy, ico } from './clay.js';
import { rng, fbm, noise3, smooth, clamp, lerp, DEG, hash } from './lib.js';

// ---- layout (metres; +Z = south = towards the usual camera) ----
export const L = {
  gate: [-5, -10], chair: [-7.2, -8.4], seesaw: [-6, 4], bales: [-8.3, 4.1],
  house: [-13, -21], barn: [7, -22], laneZ: -14.5, hedgeX: 14, wallZ: -10, wallW: -16,
};

// Ground height: a gently undulating field inside rolling hills, a flat lane and yard.
export function ground(x, z) {
  const d = Math.hypot(x * .9, z - 2);
  const field = .12 * fbm(x * .08, z * .08, 1.3, 3);
  const hills = smooth(20, 70, d) * (6 * fbm(x * .012 + 3, z * .012 - 1, 0, 4) + 5) + smooth(60, 160, d) * (16 + 14 * fbm(x * .006, z * .006, 5, 3));
  let h = field + hills;
  // lane + yard flattening
  const lane = smooth(3.2, 1.6, Math.abs(z - laneCurve(x)));
  h = lerp(h, .02, lane * smooth(40, 20, Math.abs(x)));
  return h;
}
export const laneCurve = x => L.laneZ + (x > 10 ? (x - 10) * .12 + Math.sin((x - 10) * .05) * 3 : 0) + (x < -20 ? (x + 20) * -.2 : 0);

function terrain() {
  const S = 420, N = 300;
  const g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  // patchwork: rotated grid cells far from the farm get their own green/gold
  const patches = ['#6f9a3c', '#86a846', '#5e8a34', '#9bb04e', '#b7b25a', '#739c40', '#c4ae62', '#688f3a'];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, ground(x, z));
    const d = Math.hypot(x, z - 2);
    const u = (x * .8 + z * .6) / 34, v = (-x * .6 + z * .8) / 28;
    const cell = Math.floor(u + .3 * noise3(v, 1)) * 31 + Math.floor(v + .3 * noise3(u, 2)) * 17;
    const pc = new THREE.Color(patches[Math.abs(cell) % patches.length]);
    const near = new THREE.Color('#ffffff');
    c.copy(near).lerp(pc.multiplyScalar(1.55), smooth(24, 45, d));
    const n = .9 + .12 * fbm(x * .15, z * .15, 2, 2); c.multiplyScalar(n);
    const lane = smooth(1.6, .9, Math.abs(z - laneCurve(x))) * smooth(60, 30, Math.abs(x));
    c.lerp(new THREE.Color('#e0c49a'), lane);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = mesh(g, M.grass, false, true);
  return m;
}

// Instanced lumpy rocks along a polyline (dry-stone wall).
function stoneWall(points, seed, h = .9) {
  const r = rng(seed), geos = [];
  const base = [0, 1, 2, 3].map(k => blob(1, 1, .18, seed + k));
  for (let s = 0; s < points.length - 1; s++) {
    const [ax, az] = points[s], [bx, bz] = points[s + 1], len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
    for (let row = 0; row < 4; row++) for (let d = (row % 2) * .2; d < len; d += .38 + r() * .12) {
      const x = ax + Math.cos(ang) * d, z = az + Math.sin(ang) * d, w = .9 - row * .14;
      const g = base[(r() * 4) | 0].clone();
      g.scale(.22 + r() * .08, .12 + r() * .04, .18 + r() * .05); g.rotateY(ang + (r() - .5) * .4);
      const off = (r() - .5) * w * .5;
      g.translate(x - Math.sin(ang) * off, ground(x, z) + .1 + row * h / 4.2, z + Math.cos(ang) * off);
      geos.push(g);
    }
    // coping stones on edge
    for (let d = 0; d < len; d += .22) { const x = ax + Math.cos(ang) * d, z = az + Math.sin(ang) * d; const g = base[(r() * 4) | 0].clone();
      g.scale(.1, .16, .2); g.rotateY(ang + Math.PI / 2 + (r() - .5) * .3); g.rotateZ((r() - .5) * .2); g.translate(x, ground(x, z) + h + .05, z); geos.push(g); }
  }
  const g = mergeGeometries(geos);
  // vertex colours: moss on top, variation
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const n = .85 + .3 * noise3(pos.getX(i) * 2, pos.getY(i) * 2, pos.getZ(i) * 2); const moss = smooth(.4, .9, noise3(pos.getX(i) * .7, 3, pos.getZ(i) * .7) + .3) * .5;
    col[i * 3] = n * (1 - moss * .45); col[i * 3 + 1] = n * (1 - moss * .1); col[i * 3 + 2] = n * (1 - moss * .6); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return mesh(g, M.stone);
}
function hedge(points, seed, h = 1.3, mat = M.hedge) {
  const r = rng(seed), geos = [], base = [0, 1, 2].map(k => blob(1, 2, .12, seed + k));
  for (let s = 0; s < points.length - 1; s++) {
    const [ax, az] = points[s], [bx, bz] = points[s + 1], len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
    for (let d = 0; d < len; d += .45) for (let k = 0; k < 3; k++) {
      const x = ax + Math.cos(ang) * d + (r() - .5) * .3, z = az + Math.sin(ang) * d + (r() - .5) * .5, rad = .45 + r() * .3;
      const g = base[(r() * 3) | 0].clone(); g.scale(rad, rad * (h / 1.1), rad); g.translate(x, ground(x, z) + rad * .6 + k * .25, z); geos.push(g);
    }
  }
  return mesh(mergeGeometries(geos), mat);
}
function tree(x, z, s, seed, dark) {
  const g = new THREE.Group(); g.position.set(x, ground(x, z) - .05, z); g.scale.setScalar(s);
  const trunk = mesh(lumpy(new THREE.CylinderGeometry(.22, .34, 3, 14, 6), .04, 2, seed), M.trunk); trunk.position.y = 1.5; g.add(trunk);
  for (const [bx, by, bz, br] of [[.6, 2.9, .2, .5], [-.5, 2.7, -.2, .45]]) { const b = mesh(capsule(.1, br * 2, .05, seed + bx), M.trunk); b.position.set(bx * .5, by - .3, bz); b.rotation.z = -Math.sign(bx) * .9; g.add(b); }
  const r = rng(seed); const parts = [];
  for (let i = 0; i < 9; i++) { const rad = .9 + r() * .7, a = r() * 6.28, d = r() * 1.1; const b = blob(rad, 2, .1, seed + i); b.translate(Math.cos(a) * d, 3.8 + r() * 1.4, Math.sin(a) * d); parts.push(b); }
  g.add(mesh(mergeGeometries(parts), dark ? M.leafDark : M.leaf));
  return g;
}
function farTrees(n, seed) {
  const r = rng(seed), parts = [], trunks = [];
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, d = 45 + r() * 120, x = Math.cos(a) * d, z = Math.sin(a) * d * .9 - 10;
    if (Math.abs(z - laneCurve(x)) < 4) continue;
    const s = 1.2 + r() * 1.5, y = ground(x, z);
    for (let k = 0; k < 3; k++) { const b = blob(s * (.8 + r() * .4), 1, .1, i + k); b.translate(x + (r() - .5) * s, y + s * 2.4 + k * s * .5, z + (r() - .5) * s); parts.push(b); }
    const t = new THREE.CylinderGeometry(.15 * s, .25 * s, s * 2.4, 6); t.translate(x, y + s * 1.2, z); trunks.push(t);
  }
  const gr = new THREE.Group();
  gr.add(mesh(mergeGeometries(parts), M.leafDark)); gr.add(mesh(mergeGeometries(trunks), M.trunk));
  return gr;
}
// patchwork hedgerows on the far hills: cheap merged blobs along cell borders
function farHedges(seed) {
  const r = rng(seed), parts = [], base = blob(1, 1, .1, 3);
  for (let i = 0; i < 1600; i++) {
    const a = r() * 6.28, d = 42 + r() * 150, x = Math.cos(a) * d, z = Math.sin(a) * d - 5;
    const u = (x * .8 + z * .6) / 34, v = (-x * .6 + z * .8) / 28;
    // snap to the nearest cell border in u or v
    let X = x, Z = z;
    if (r() < .5) { const uu = Math.round(u) * 34; const t = (uu - (x * .8 + z * .6)); X += t * .8; Z += t * .6; }
    else { const vv = Math.round(v) * 28; const t = (vv - (-x * .6 + z * .8)); X += t * -.6; Z += t * .8; }
    if (Math.hypot(X, Z - 2) < 40) continue;
    const s = .9 + r() * .6, g = base.clone(); g.scale(s, s * .8, s); g.translate(X, ground(X, Z) + s * .4, Z); parts.push(g);
  }
  return mesh(mergeGeometries(parts), M.hedge);
}

function house() {
  const g = new THREE.Group(); const [x, z] = L.house; g.position.set(x, ground(x, z), z);
  const w = 7, d = 5, h = 3.6;
  const walls = mesh(lumpy(new THREE.BoxGeometry(w, h, d, 12, 8, 10), .05, .8, 3), M.wallWhite); walls.position.y = h / 2; g.add(walls);
  const roofShape = new THREE.Shape([new THREE.Vector2(-w / 2 - .4, 0), new THREE.Vector2(w / 2 + .4, 0), new THREE.Vector2(0, 2.4)].map(v => new THREE.Vector2(v.x, v.y)));
  const rs = new THREE.Shape(); rs.moveTo(-d / 2 - .45, 0); rs.lineTo(d / 2 + .45, 0); rs.lineTo(0, 2.3); rs.closePath();
  const roofG = new THREE.ExtrudeGeometry(rs, { depth: w + .6, bevelEnabled: true, bevelSize: .06, bevelThickness: .06, bevelSegments: 2 }); roofG.translate(0, 0, -(w + .6) / 2); roofG.rotateY(Math.PI / 2);
  const roof = mesh(lumpy(roofG, .03, 1, 4), M.slate); roof.position.y = h; g.add(roof);
  const ch = mesh(lumpy(new THREE.BoxGeometry(.8, 1.8, .8, 3, 4, 3), .03, 1, 5), M.wallWhite); ch.position.set(w / 2 - 1, h + 2, 0); g.add(ch);
  const pot = mesh(new THREE.CylinderGeometry(.18, .2, .4, 12), M.barn); pot.position.set(w / 2 - 1, h + 3.1, 0); g.add(pot);
  const door = mesh(lumpy(new THREE.BoxGeometry(1.1, 2.1, .15, 3, 4, 1), .01, 2, 6), M.door); door.position.set(-.6, 1.05, d / 2 + .02); g.add(door);
  const knob = mesh(new THREE.SphereGeometry(.05, 10, 8), M.watch); knob.position.set(-.2, 1.05, d / 2 + .12); g.add(knob);
  for (const [wx, wy] of [[1.9, 1.3], [-2.6, 1.3], [1.9, 2.9], [-2.6, 2.9], [-.6, 2.9]]) {
    const win = mesh(new THREE.BoxGeometry(1, .9, .1), M.darkWin); win.position.set(wx, wy, d / 2 + .02); g.add(win);
    const fr = mesh(new THREE.BoxGeometry(1.15, .1, .16), M.trim); fr.position.set(wx, wy - .5, d / 2 + .05); g.add(fr);
    const fv = mesh(new THREE.BoxGeometry(.08, .9, .14), M.trim); fv.position.set(wx, wy, d / 2 + .06); g.add(fv);
    const fh = mesh(new THREE.BoxGeometry(1, .07, .14), M.trim); fh.position.set(wx, wy, d / 2 + .06); g.add(fh);
  }
  // porch roses
  const r = rng(8); for (let i = 0; i < 16; i++) { const b = mesh(blob(.18 + r() * .1, 1, .1, i), i % 3 ? M.leaf : M.balloon[4]); b.position.set(-1.4 + (i % 2) * 1.6 + (r() - .5) * .3, .3 + (i >> 1) * .28, d / 2 + .2); g.add(b); }
  return g;
}
function barn() {
  const g = new THREE.Group(); const [x, z] = L.barn; g.position.set(x, ground(x, z), z); g.rotation.y = -.15;
  const w = 8, d = 6, h = 4;
  const walls = mesh(lumpy(new THREE.BoxGeometry(w, h, d, 10, 6, 8), .04, .8, 9), M.barn); walls.position.y = h / 2; g.add(walls);
  const rs = new THREE.Shape(); rs.moveTo(-w / 2 - .4, 0); rs.lineTo(-w / 4, 1.6); rs.lineTo(0, 2.3); rs.lineTo(w / 4, 1.6); rs.lineTo(w / 2 + .4, 0); rs.closePath();
  const roofG = new THREE.ExtrudeGeometry(rs, { depth: d + .6, bevelEnabled: false }); roofG.translate(0, 0, -(d + .6) / 2);
  const roof = mesh(lumpy(roofG, .03, 1, 10), M.roof); roof.position.y = h; g.add(roof);
  const gable = new THREE.Shape(); gable.moveTo(-w / 2, 0); gable.lineTo(-w / 4, 1.5); gable.lineTo(0, 2.2); gable.lineTo(w / 4, 1.5); gable.lineTo(w / 2, 0); gable.closePath();
  const gb = mesh(new THREE.ShapeGeometry(gable), M.barn); gb.position.set(0, h, d / 2 + .01); g.add(gb);
  for (const s of [1, -1]) { const dr = mesh(lumpy(new THREE.BoxGeometry(1.6, 2.8, .12, 3, 4, 1), .01, 2, 11), M.barn); dr.position.set(s * .85, 1.4, d / 2 + .05); g.add(dr);
    for (const q of [1, -1]) { const x1 = mesh(new THREE.BoxGeometry(.12, 3.1, .06), M.trim); x1.position.set(s * .85, 1.4, d / 2 + .13); x1.rotation.z = q * .52; g.add(x1); }
    const fr = mesh(new THREE.BoxGeometry(1.7, .12, .06), M.trim); fr.position.set(s * .85, 2.8, d / 2 + .13); g.add(fr); }
  const loft = mesh(new THREE.BoxGeometry(1.2, 1, .1), M.darkWin); loft.position.set(0, h + .8, d / 2 + .05); g.add(loft);
  return g;
}
function lane() {
  const pts = []; for (let x = -60; x <= 140; x += 2) pts.push([x, laneCurve(x)]);
  const g = new THREE.BufferGeometry(), v = [], idx = [];
  pts.forEach(([x, z], i) => { for (const s of [-1.4, 1.4]) v.push(x, ground(x, z + s) + .03 + (Math.abs(s) < 1 ? .01 : 0), z + s); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx);
  const uv = []; pts.forEach((_, i) => uv.push(i * .5, 0, i * .5, 1)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return mesh(g, M.road, false, true);
}
function gate() {
  const g = new THREE.Group(); const [x, z] = L.gate; g.position.set(x, ground(x, z), z);
  for (const s of [-1.6, 1.6]) { const p = mesh(lumpy(new THREE.BoxGeometry(.22, 1.4, .22, 2, 4, 2), .01, 3, s), M.woodDark); p.position.set(s, .7, 0); g.add(p); }
  const leaf = new THREE.Group(); leaf.position.set(-1.5, 0, 0); g.add(leaf);   // hinged on the left, open towards the field
  for (let i = 0; i < 5; i++) { const b = mesh(new THREE.BoxGeometry(3, .09, .06), M.wood); b.position.set(1.5, .25 + i * .22, 0); leaf.add(b); }
  const diag = mesh(new THREE.BoxGeometry(3.3, .09, .06), M.wood); diag.position.set(1.5, .7, 0); diag.rotation.z = .3; leaf.add(diag);
  leaf.rotation.y = .12;
  return g;
}
export function makeSeesaw() {
  const g = new THREE.Group(); const [x, z] = L.seesaw; g.position.set(x, ground(x, z), z);
  const log = mesh(lumpy(new THREE.CylinderGeometry(.28, .3, 1, 16, 3), .02, 3, 1), M.trunk); log.rotation.x = Math.PI / 2; log.position.y = .28; g.add(log);
  for (const s of [.5, -.5]) { const ring = mesh(new THREE.CircleGeometry(.27, 20), M.hay); ring.position.set(0, .28, s + Math.sign(s) * .01); ring.rotation.y = s > 0 ? 0 : Math.PI; g.add(ring); }
  const pivot = new THREE.Group(); pivot.position.y = .6; g.add(pivot);
  const plank = mesh(lumpy(new THREE.BoxGeometry(3.4, .09, .42, 12, 1, 2), .006, 2, 3), M.wood); pivot.add(plank);
  return { root: g, pivot, pose: p => { pivot.rotation.z = p.angle * DEG; } };
}
function bales() {
  const g = new THREE.Group(); const [x, z] = L.bales; g.position.set(x, ground(x, z), z);
  const bale = (bx, by, bz, ry) => { const b = mesh(lumpy(new THREE.BoxGeometry(1.1, .5, .6, 6, 3, 3), .02, 3, bx * 10 + by), M.hay); b.position.set(bx, by + .25, bz); b.rotation.y = ry; g.add(b);
    for (const s of [-.3, .3]) { const t = mesh(new THREE.BoxGeometry(.02, .52, .62), M.trunk); t.position.set(bx + s, by + .25, bz); t.rotation.y = ry; g.add(t); } };
  bale(0, 0, 0, 0); bale(0, 0, .65, .05); bale(-.05, .5, .3, -.04); bale(-1.1, 0, .3, .1);
  return g;
}
export function makeDeckchair() {
  const g = new THREE.Group(); const [x, z] = L.chair; g.position.set(x, ground(x, z), z); g.rotation.y = .5;
  const w = .62;
  const rail = (len, px, py, pz, rx) => { for (const s of [1, -1]) { const r = mesh(new THREE.BoxGeometry(.04, .04, len), M.wood); r.position.set(s * w / 2, py, pz); r.rotation.x = rx; g.add(r); } };
  rail(1.25, 0, .5, -.1, -1.0); rail(.9, 0, .32, .25, .9);
  const cloth = new THREE.PlaneGeometry(w - .04, 1.25, 1, 16); const cp = cloth.attributes.position;
  for (let i = 0; i < cp.count; i++) { const y = cp.getY(i); cp.setZ(i, -.08 * Math.cos(y / 1.25 * Math.PI)); }
  cloth.computeVertexNormals();
  const cm = mesh(cloth, M.stripes); cm.material.side = THREE.DoubleSide; cm.position.set(0, .5, -.12); cm.rotation.x = -1.0 - Math.PI / 2 + Math.PI / 2; cm.rotation.x = -.57; g.add(cm);
  cm.rotation.set(-Math.PI / 2 + .57 + .4, 0, 0);
  return g;
}
function flowers(seed) {
  const r = rng(seed), wh = [], ye = [];
  for (let i = 0; i < 900; i++) { const x = (r() - .5) * 34, z = -9 + r() * 24; if (Math.abs(x - L.seesaw[0]) < 2.4 && Math.abs(z - L.seesaw[1]) < 1.2) continue;
    const y = ground(x, z); const c = new THREE.CylinderGeometry(.035, .035, .015, 8); c.translate(x, y + .05, z); ye.push(c);
    for (let k = 0; k < 5; k++) { const pet = new THREE.SphereGeometry(.03, 6, 4); pet.scale(1, .3, .6); const a = k / 5 * 6.28; pet.translate(x + Math.cos(a) * .04, y + .045, z + Math.sin(a) * .04); wh.push(pet); } }
  const g = new THREE.Group(); g.add(mesh(mergeGeometries(wh), M.flowerW, false)); g.add(mesh(mergeGeometries(ye), M.flowerY, false)); return g;
}
function tufts(seed) {
  const r = rng(seed), parts = [], base = [0, 1, 2].map(k => { const g = new THREE.ConeGeometry(.03, .14, 6); g.translate(0, .07, 0); return g; });
  for (let i = 0; i < 2600; i++) {
    const x = (r() - .5) * 44, z = -12 + r() * 32; const y = ground(x, z);
    if (Math.abs(x) < 3.2 && z > 7.6 && z < 10.4) continue;
    for (let k = 0; k < 4; k++) { const g = base[k % 3].clone(); g.rotateZ((r() - .5) * .9); g.rotateY(r() * 6.28); const s = .5 + r() * .7; g.scale(s, s, s); g.translate(x + (r() - .5) * .08, y - .02, z + (r() - .5) * .08); parts.push(g); }
  }
  return mesh(mergeGeometries(parts), M.grassTuft, false, true);
}
function clouds(seed) {
  const r = rng(seed), g = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI * .95 + i / 16 * Math.PI * 1.9 + (r() - .5) * .2, d = 300, el = .12 + r() * .22;
    const c = new THREE.Group(); c.position.set(Math.sin(a) * d * Math.cos(el), 20 + Math.sin(el) * d, -Math.cos(a) * d * Math.cos(el) + 20);
    const n = 5 + (r() * 4 | 0); const parts = [];
    for (let k = 0; k < n; k++) { const b = blob(8 + r() * 7, 2, .08, i * 10 + k); b.translate((k - n / 2) * 8 + (r() - .5) * 4, (r() - .2) * 5 * (1 - Math.abs(k - n / 2) / n), (r() - .5) * 4); parts.push(b); }
    const m = mesh(mergeGeometries(parts), M.cloud, false, false); m.scale.set(1, .6, .45); c.add(m);
    c.lookAt(0, c.position.y, 0);
    g.add(c);
  }
  return g;
}
function skyDome() {
  const geo = new THREE.SphereGeometry(900, 48, 24);
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#5d9be0') }, mid: { value: new THREE.Color('#a8d0f0') }, hor: { value: new THREE.Color('#fbe9cf') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color('#fff2d0') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform vec3 top, mid, hor, sunDir, sunCol; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = mix(hor, mid, smoothstep(-.02, .18, h)); c = mix(c, top, smoothstep(.15, .7, h));
        float s = max(dot(normalize(vP), normalize(sunDir)), 0.); c += sunCol * (pow(s, 600.) * 3. + pow(s, 12.) * .25);
        // painted-backdrop mottling
        float n = fract(sin(dot(floor(vP.xy * 180.), vec2(12.9898, 78.233))) * 43758.5453); c *= .985 + .03 * n;
        gl_FragColor = vec4(c, 1.); }` });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = -1; m.frustumCulled = false;
  return m;
}
function smokePuffs() { const g = new THREE.Group(); for (let i = 0; i < 8; i++) { const m = mesh(blob(.3, 2, .12, i), M.smoke.clone(), false, false); g.add(m); } return g; }
function church() {
  const g = new THREE.Group(); const x = 70, z = -95; g.position.set(x, ground(x, z), z);
  const nave = mesh(lumpy(new THREE.BoxGeometry(6, 4, 10, 4, 3, 5), .06, .6, 3), M.wallWhite); nave.position.y = 2; g.add(nave);
  const tower = mesh(lumpy(new THREE.BoxGeometry(3, 8, 3, 3, 6, 3), .05, .6, 4), M.stone); tower.position.set(0, 4, 6); g.add(tower);
  const spire = mesh(new THREE.ConeGeometry(2.2, 6, 4), M.slate); spire.position.set(0, 11, 6); spire.rotation.y = Math.PI / 4; g.add(spire);
  const rs = new THREE.Shape(); rs.moveTo(-3.4, 0); rs.lineTo(3.4, 0); rs.lineTo(0, 2.6); rs.closePath();
  const roof = mesh(new THREE.ExtrudeGeometry(rs, { depth: 10, bevelEnabled: false }), M.slate); roof.position.set(0, 4, -5); g.add(roof);
  // bunting from the fete: triangles on a line from tower to a pole
  const cols = M.balloon; for (let i = 0; i < 14; i++) { const f = mesh(new THREE.ConeGeometry(.35, .7, 3), cols[i % 5], false); const u = i / 13; f.position.set(lerp(1.5, 12, u), lerp(7, 3, u) - Math.sin(u * Math.PI) * 1.2, lerp(6, 10, u)); f.rotation.x = Math.PI; g.add(f); }
  const pole = mesh(new THREE.CylinderGeometry(.1, .1, 4, 8), M.woodDark); pole.position.set(12, 1.5, 10); g.add(pole);
  return g;
}

export function buildSet(scene) {
  const S = {};
  S.sky = skyDome(); scene.add(S.sky);
  S.terrain = terrain(); scene.add(S.terrain);
  S.clouds = clouds(4); scene.add(S.clouds);
  // walls around the field: north wall with the gate gap, west wall; hedge on the east
  scene.add(stoneWall([[-26, -10.4], [-6.7, -10.2]], 11));
  scene.add(stoneWall([[-3.3, -10.2], [9, -10.3], [14, -10.6]], 12));
  scene.add(stoneWall([[-16.5, -10.3], [-17, 2], [-18, 16], [-19, 30]], 13));
  scene.add(hedge([[14.5, -10], [15, 4], [15.5, 20], [16, 34]], 21, 1.5));
  scene.add(hedge([[-30, -18.3], [-17, -18.2]], 22, 1.1));
  scene.add(hedge([[16, -18.2], [40, -17.2], [70, -12]], 23, 1.1));
  // the far side of the lane
  scene.add(stoneWall([[-4, -18.6], [3, -18.6]], 14, .7));
  S.lane = lane(); scene.add(S.lane);
  S.house = house(); scene.add(S.house);
  S.barn = barn(); scene.add(S.barn);
  S.gate = gate(); scene.add(S.gate);
  S.bales = bales(); scene.add(S.bales);
  S.flowers = flowers(5); scene.add(S.flowers);
  S.tufts = tufts(6); scene.add(S.tufts);
  S.church = church(); scene.add(S.church);
  for (const [x, z, s, sd, dk] of [[-11, 11, 1.25, 1, 0], [11.5, -6.5, 1.0, 2, 1], [-22, -4, 1.4, 3, 0], [20, 10, 1.3, 4, 1], [-3, -24, 1.2, 5, 0], [16, -25, 1.1, 6, 1], [-26, 18, 1.5, 7, 1], [28, -4, 1.4, 8, 0], [-19, -26, 1.3, 9, 1]])
    scene.add(tree(x, z, s, sd, dk));
  scene.add(farTrees(170, 3));
  scene.add(farHedges(9));
  S.smoke = smokePuffs(); scene.add(S.smoke);
  return S;
}
// chimney smoke: puffs rising and swelling, a pure function of time
export function poseSmoke(S, t) {
  const [hx, hz] = L.house, base = new THREE.Vector3(hx + 2.5, ground(hx, hz) + 7.4, hz);
  S.smoke.children.forEach((m, i) => { const u = ((t * .12 + i / 8) % 1 + 1) % 1; m.position.set(base.x + u * 3.5 + Math.sin(u * 6 + i) * .3, base.y + u * 5, base.z + u * 1.2); m.scale.setScalar(.6 + u * 2.4); m.material.opacity = .85 * (1 - u); });
}
