// story.js: the film. Builds the cast and props, then apply(t) poses EVERYTHING for time t from the shot table
// (pure: nothing carries over between frames). Characters are evaluated on twos (12 poses/s) like stop-motion;
// the camera moves on ones (motion control).
import * as THREE from 'three';
import { makeSheep, makeBitzer, makeCar, makeBalloons, makeButterfly, SHEEP_DEF, BITZER_DEF, CAR_DEF, BALLOON_DEF } from './characters.js';
import { makeSeesaw, makeDeckchair, ground, laneCurve, L } from './set.js';
import { M, blob, mesh, ball } from './clay.js';
import { loadFont, clayText } from './text.js';
import { track, travelled, clamp, lerp, p, ease, spring, wobble, pulse, hash, arc, DEG, smooth, noise3 } from './lib.js';
import { SHOTS } from './shots.js';

const T = window.T;

export async function buildStory(scene, SET, camera) {
  await loadFont('title', 'assets/LuckiestGuy-Regular.ttf');
  // ---- cast ----
  const A = {
    shaun: makeSheep('shaun', 1), timmy: makeSheep('timmy', 2), shirley: makeSheep('shirley', 3), mum: makeSheep('mum', 4),
    f1: makeSheep('flock', 5, 1.02), f2: makeSheep('flock', 6, .96), f3: makeSheep('flock', 7, 1.05), f4: makeSheep('flock', 8, .98),
    f5: makeSheep('flock', 9, 1), f6: makeSheep('flock', 10, .94),
    bitzer: makeBitzer(), car: makeCar(), balloons: makeBalloons(5), fly: makeButterfly(),
  };
  const DEF = n => n === 'bitzer' ? BITZER_DEF : n === 'car' ? CAR_DEF : n === 'balloons' ? BALLOON_DEF : n === 'fly' ? { pos: [0, 0, 0], yaw: 0 } : SHEEP_DEF;
  const STRIDE = { timmy: .36, shirley: .55, bitzer: .62, car: 1 };
  for (const k in A) scene.add(A[k].root);

  // ---- props ----
  const P = {};
  P.seesaw = makeSeesaw(); scene.add(P.seesaw.root);
  P.chair = makeDeckchair(); scene.add(P.chair);
  // light bulb (idea)
  P.bulb = new THREE.Group(); { const gl = mesh(new THREE.SphereGeometry(.13, 24, 18), M.bulb, false); gl.position.y = .16; P.bulb.add(gl);
    const neck = mesh(new THREE.CylinderGeometry(.06, .075, .1, 16), M.metal, false); neck.position.y = .02; P.bulb.add(neck);
    for (let i = 0; i < 3; i++) { const r = mesh(new THREE.TorusGeometry(.062, .01, 6, 16), M.metal, false); r.rotation.x = Math.PI / 2; r.position.y = -.01 - i * .025; P.bulb.add(r); }
    const glow = new THREE.PointLight('#ffe07a', 0, 3); glow.position.y = .16; P.bulb.add(glow); P.bulb.userData.glow = glow;
    const rays = new THREE.Group(); for (let i = 0; i < 8; i++) { const r = mesh(new THREE.BoxGeometry(.02, .09, .02), M.bulb, false); const a = i / 8 * Math.PI * 2; r.position.set(Math.cos(a) * .25, .16 + Math.sin(a) * .25, 0); r.rotation.z = a - Math.PI / 2; rays.add(r); } P.bulb.add(rays); P.bulb.userData.rays = rays;
    scene.add(P.bulb); }
  // Zzz
  P.zzz = [0, 1, 2].map(i => { const t = clayText('Z', { size: .22, depth: .05, mat: M.zzz, seed: 40 + i }); scene.add(t.group); return t.group; });
  // loose dummy (Timmy's dummy, the running gag)
  P.dummy = new THREE.Group(); { const sh = mesh(new THREE.SphereGeometry(1, 20, 14), M.dummy); sh.scale.set(.05 * .52 * 1.35, .035 * .52 * 1.35, .014 * .52 * 1.35); P.dummy.add(sh);
    const ring = mesh(new THREE.TorusGeometry(.028 * .7, .008 * .7, 10, 20), M.dummyRing); ring.position.z = .014; P.dummy.add(ring);
    const teat = mesh(new THREE.SphereGeometry(.014, 10, 8), M.dummyRing); teat.scale.set(1, 1, 1.6); teat.position.z = -.02; P.dummy.add(teat); scene.add(P.dummy); }
  // dust puffs: a pool of blob clusters with their own materials (opacity per puff)
  P.puffs = Array.from({ length: 6 }, (_, i) => { const g = new THREE.Group(); const mat = M.puff.clone();
    for (let k = 0; k < 7; k++) { const b = mesh(blob(.18, 2, .12, i * 10 + k), mat, false, false); const a = k / 7 * Math.PI * 2; b.userData.dir = new THREE.Vector3(Math.cos(a), .3 + hash(k, i) * .5, Math.sin(a)); g.add(b); }
    g.userData.mat = mat; scene.add(g); return g; });
  // grass stuck on Shaun's face after the faceplant
  P.faceGrass = new THREE.Group(); for (let i = 0; i < 5; i++) { const c = mesh(new THREE.ConeGeometry(.018, .12, 5), M.grassTuft, false); c.position.set((i - 2) * .025, .05, 0); c.rotation.z = (i - 2) * .25; P.faceGrass.add(c); }
  A.shaun.head.add(P.faceGrass); P.faceGrass.position.set(0, .07, .2);
  // Bitzer's headphones fly off in the wake shot; the hand-held dummy for the snore shot sits in his mouth
  P.flyPhones = A.bitzer.phones.clone(); scene.add(P.flyPhones);
  P.bDummy = P.dummy.clone(); A.bitzer.head.add(P.bDummy); P.bDummy.position.set(0, -.07, .26); P.bDummy.scale.setScalar(1.0);
  // titles
  const title1 = clayText('SHAUN', { size: .95, depth: .26, mat: M.letter, edgeMat: M.letterEdge, seed: 1 });
  const title2 = clayText('THE SHEEP', { size: .52, depth: .22, mat: M.letter, edgeMat: M.letterEdge, seed: 20 });
  const title3 = clayText('UP, UP & BAA-WAY!', { size: .3, depth: .1, mat: M.letterYellow, edgeMat: M.letterEdge, edge: .06, seed: 60 });
  const endT = clayText('THE END', { size: .8, depth: .24, mat: M.letter, edgeMat: M.letterEdge, seed: 80 });
  for (const t of [title1, title2, title3, endT]) scene.add(t.group);
  P.titles = { title1, title2, title3, endT };

  // ---- light over the day ----
  const LIGHT = track([
    [0, { az: 72, el: 17, sun: '#ffd49a', sunI: 2.7, hemiI: 1.0, skyC: '#c8dcff', groundC: '#6f8a45', rim: '#ffd8b0', rimI: .9, fog: '#e4e2dc', skyTop: '#6aa2e2', skyMid: '#b4d4f0', skyHor: '#fde2c0', exposure: 1.0 }],
    [24, { az: 55, el: 30, sun: '#ffe9c8', sunI: 3.1, hemiI: 1.1, skyC: '#c0d8ff', groundC: '#6f8a45', rim: '#ffe6c8', rimI: .8, fog: '#d8e4ee', skyTop: '#5d9be0', skyMid: '#a8d0f0', skyHor: '#f4ead8', exposure: 1.0 }],
    [70, { az: 25, el: 42, sun: '#fff1dc', sunI: 3.3, hemiI: 1.15, skyC: '#bcd6ff', groundC: '#6f8a45', rim: '#fff0dc', rimI: .7, fog: '#d4e2ee', skyTop: '#5896de', skyMid: '#a4ccf0', skyHor: '#f0ead8' }],
    [96, { az: -30, el: 24, sun: '#ffd09a', sunI: 3.1, hemiI: 1.0, skyC: '#c8d4f0', groundC: '#74874a', rim: '#ffc890', rimI: 1.0, fog: '#ecdcc8', skyTop: '#6194d6', skyMid: '#b8cce6', skyHor: '#fbd8b0', exposure: 1.02 }],
    [120, { az: -42, el: 15, sun: '#ffb877', sunI: 3.0, hemiI: .9, skyC: '#d4ccec', groundC: '#7a8048', rim: '#ffb070', rimI: 1.2, fog: '#f0d4b8', skyTop: '#6a8ccc', skyMid: '#c4c4e0', skyHor: '#ffc896', exposure: 1.04 }],
  ]);

  const ctx = { A, P, scene, camera, T, SET };
  const shots = T.shots.map(s => ({ ...s, ...(SHOTS[s.id] ? SHOTS[s.id](s.m, ctx) : {}) }));
  const Q = new URLSearchParams(location.search);
  const lookShot = Q.has('look') && SHOTS.look ? { id: 'look', start: 0, end: 1e9, ...SHOTS.look({}, ctx, Q.get('look')) } : null;
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();

  // helpers the shots use from fx()
  ctx.headPos = n => A[n].head.getWorldPosition(new THREE.Vector3());
  ctx.hands = n => { const r = A[n]; return r.handPos(1).add(r.handPos(-1)).multiplyScalar(.5); };
  const anchorOf = h => { const [n, side] = h.split(':'); if (n === 'bitzer') return A.bitzer.handPos(-1); if (side) return A[n].handPos(side === 'L' ? 1 : -1); return ctx.hands(n); };
  ctx.puff = (i, at, lt, pos, size = 1, col) => {
    const g = P.puffs[i], u = (lt - at) / .9; if (u < 0 || u > 1) return;
    g.visible = true; g.position.set(...pos); g.userData.mat.opacity = .9 * (1 - u) ** 1.5; if (col) g.userData.mat.color.set(col); else g.userData.mat.color.set('#d9c7a4');
    g.children.forEach(b => { const d = b.userData.dir; b.position.copy(d).multiplyScalar(ease.out3(u) * .55 * size); b.scale.setScalar((.5 + u * 1.3) * size); });
  };
  ctx.letterDrop = (L, lt, t0, y0 = 0, fall = 5, dur = .42) => {       // drop from above, squash on impact
    const u = (lt - t0) / dur;
    if (u < 0) { L.g.visible = false; return; }
    L.g.visible = true;
    const y = u < 1 ? y0 + fall * (1 - u * u) : y0;
    const sq = u < 1 ? 1 + .25 * u : 1 - .3 * Math.exp(-(lt - t0 - dur) * 9) * Math.cos((lt - t0 - dur) * 30);
    L.g.position.y = y; L.g.scale.set(1 / Math.sqrt(sq), sq, 1);
  };

  function hideAll() {
    for (const k in A) A[k].root.visible = false;
    P.bulb.visible = false; P.zzz.forEach(z => z.visible = false); P.dummy.visible = false; P.puffs.forEach(g => g.visible = false);
    P.faceGrass.visible = false; P.bDummy.visible = false; P.flyPhones.visible = false;
    for (const k in P.titles) P.titles[k].group.visible = false;
    P.seesaw.pose({ angle: -14 });
  }

  function apply(t) {
    if (!lookShot) t = clamp(t, 0, T.DUR - 1e-6);
    const sh = lookShot || shots.find(s => t >= s.start && t < s.end) || shots[shots.length - 1];
    const lt = t - sh.start;
    const tq = Math.floor(t * 12 + 1e-6) / 12;                         // on twos
    const lta = sh.ones ? lt : Math.max(0, tq - sh.start);
    const at = sh.ones ? t : tq;
    hideAll();
    const cast = sh.cast || {};
    for (const name in cast) {
      const src = cast[name], rig = A[name];
      const q = { ...DEF(name), ...(typeof src === 'function' ? src(lta, at) : src) };
      if (name === 'balloons' || name === 'fly') continue;             // posed after the others (anchors follow hands)
      if (q.gaitAmp > 0 && q.gait == null) q.gait = (src.keys ? travelled(src, lta) : (q.dist || 0)) * Math.PI * 2 / ((STRIDE[name] || .7) * (rig.K || 1));
      if (name === 'car') { q.spin = -(src.keys ? travelled(src, lta) : 0) / .24 + (q.spinOff || 0); }
      if (!q.abs) q.y += ground(q.x, q.z);
      rig.pose(q, at); rig.root.visible = q.vis !== false;
    }
    scene.updateMatrixWorld();
    for (const name of ['balloons', 'fly']) if (cast[name]) {
      const src = cast[name], q = { ...DEF(name), ...(typeof src === 'function' ? src(lta, at) : src) };
      if (q.hold) { let a = anchorOf(q.hold); if (q.hold2) a = a.lerp(anchorOf(q.hold2), q.mix); q.anchor = a.toArray(); }
      A[name].pose(q, at); A[name].root.visible = q.vis !== false;
    }
    sh.fx?.(lta, at, lt);
    // camera (smooth)
    const c = typeof sh.cam === 'function' ? sh.cam(lt) : { pos: [0, 2, 12], look: [0, 1, 0], fov: 35 };
    const shake = c.shake || 0;
    camera.position.set(c.pos[0] + noise3(t * 30, 1) * shake, c.pos[1] + noise3(t * 30, 2) * shake, c.pos[2]);
    camera.fov = c.fov || 35; camera.updateProjectionMatrix();
    camera.lookAt(v1.set(...c.look)); if (c.roll) camera.rotateZ(c.roll * DEG);
    // focus: a named actor's head, a number, or the look point
    let focus = camera.position.distanceTo(v1);
    if (typeof c.focusOn === 'string') focus = camera.position.distanceTo(ctx.headPos(c.focusOn));
    else if (typeof c.focus === 'number') focus = c.focus;
    let irisC = c.irisC || [.5, .5];
    if (c.irisOn) { const h = ctx.headPos(c.irisOn).project(camera); irisC = [(h.x + 1) / 2, (h.y + 1) / 2]; }
    const Lt = LIGHT(t); Lt.exposure ??= 1;
    return {
      light: Lt, shadowAt: v2.set(...(c.shadowAt || c.look)), shadowSize: c.shadowSize || 14,
      focus, aperture: c.aperture ?? .0022, maxblur: c.maxblur ?? .0055,
      fade: c.fade || 0, iris: c.iris ?? 2, irisC,
    };
  }
  return { apply, A, P, shots };
}
