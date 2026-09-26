// characters.js: clay puppets built from lumpy primitives, each with a pose(p, t) that sets every joint
// from a flat parameter object (degrees for authoring). Local +Z = forward, +X = the puppet's left.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, blob, ball, capsule, mesh, lumpy, ico } from './clay.js';
import { DEG, hash, rng, clamp, lerp, noise3 } from './lib.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent?.add(g); return g; };
const ell = (rx, ry, rz, mat, amp = .03, seed = 0, seg = 36) => { const g = ball(1, amp, seed, seg, Math.round(seg * .7)); g.scale(rx, ry, rz); g.computeVertexNormals(); return mesh(g, mat); };

// Wool: many lumpy blobs over an ellipsoid shell + a core, merged into one mesh.
function woolCloud(rx, ry, rz, n, seed, blobR = .13) {
  const r = rng(seed), parts = [];
  const core = ico(1, 4); core.scale(rx * .9, ry * .9, rz * .9); parts.push(lumpy(core, .02, 3, seed));
  for (let i = 0; i < n; i++) {
    const y = 1 - 2 * (i + .5) / n, rad = Math.sqrt(1 - y * y), th = i * 2.39996 + r() * .3;
    let px = Math.cos(th) * rad, py = y, pz = Math.sin(th) * rad;
    const br = blobR * (.75 + r() * .55) * (rx + ry + rz) / 1.3 * (py < -.5 ? .8 : 1);
    const b = ico(br, 3); lumpy(b, br * .12, 2 / br, seed + i);
    b.translate(px * rx * .89, py * ry * .89, pz * rz * .89); parts.push(b);
  }
  const g = mergeGeometries(parts.map(p => { p.deleteAttribute('uv'); return p; }));
  // spherical UVs so the curl texture wraps the whole cloud
  const pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) / rx, y = pos.getY(i) / ry, z = pos.getZ(i) / rz;
    uv[i * 2] = Math.atan2(z, x) / (2 * Math.PI) * 3 + .5; uv[i * 2 + 1] = Math.acos(clamp(y / Math.hypot(x, y, z), -1, 1)) / Math.PI * 2; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
function tuft(n, r0, seed, spread = 1) {
  const r = rng(seed), parts = [];
  for (let i = 0; i < n; i++) { const a = i / n * 6.28 + r(), br = r0 * (.7 + r() * .5); const b = ico(br, 3); lumpy(b, br * .15, 2 / br, seed + i);
    b.translate(Math.cos(a) * r0 * .7 * spread, r0 * (.2 + r() * .5), Math.sin(a) * r0 * .6 * spread); parts.push(b); }
  const top = ico(r0 * 1.05, 3); lumpy(top, r0 * .15, 2 / r0, seed + 99); top.translate(0, r0 * .7, 0); parts.push(top);
  return mergeGeometries(parts);
}

// Eye with pupil and a rotating upper lid.
function makeEye(parent, x, y, z, r, lidMat) {
  const e = grp(parent, x, y, z);
  e.add(mesh(new THREE.SphereGeometry(r, 32, 24), M.eye));
  const look = grp(e); const pup = mesh(new THREE.SphereGeometry(1, 20, 14), M.pupil); pup.scale.set(r * .42, r * .42, r * .2); pup.position.z = r * .9; look.add(pup);
  const tilt = grp(e); const lid = grp(tilt);
  const lidM = mesh(new THREE.SphereGeometry(r * 1.07, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), lidMat); lidM.material = lidMat; lid.add(lidM);
  const lower = grp(tilt); const lowM = mesh(new THREE.SphereGeometry(r * 1.06, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lidMat); lower.add(lowM);
  return { e, look, pup, tilt, lid, lower, r };
}
function setEye(E, open, look, pupil, tiltDeg, wide, side, squint = 0) {
  E.e.scale.setScalar(wide);
  E.look.rotation.set(-look[1] * .55, look[0] * .7, 0);
  E.pup.scale.set(E.r * .42 * pupil, E.r * .42 * pupil, E.r * .2);
  E.tilt.rotation.z = tiltDeg * DEG * side;
  // lid: -100deg = tucked back (open), +90deg = covering the front (closed)
  E.lid.rotation.x = lerp(90, -100, clamp(open)) * DEG;
  E.lower.rotation.x = lerp(-60, -100, clamp(1 - squint)) * DEG * -1 + 0;
  E.lower.visible = squint > .02;
}

function makeLeg(parent, x, y, z, r, len, mat, hoofMat) {
  const pv = grp(parent, x, y, z);
  const l = mesh(capsule(r, len, .05, x * 100 + z), mat); l.position.y = -len / 2 - r * .3; pv.add(l);
  const h = mesh(new THREE.CylinderGeometry(r * 1.25, r * 1.4, r * 1.6, 16), hoofMat); h.position.y = -len - r * .6; pv.add(h);
  return pv;
}

const DEF_FACE = { eyeOpen: 1, look: [0, 0], pupil: 1, lidTilt: 0, eyeWide: 1, squint: 0, mouth: 0, smile: .3, grin: 0, ears: 0, blink: true };

// ============================ SHEEP ============================
// kinds: shaun (tuft, close eyes), flock, timmy (lamb + dummy), shirley (huge, wool over eyes), mum (curlers)
export function makeSheep(kind = 'flock', seed = 1, sc = 1) {
  const K = { shaun: 1, flock: 1, mum: 1, timmy: .52, shirley: 1.05 }[kind] * sc;
  const big = kind === 'shirley', lamb = kind === 'timmy';
  const rx = big ? .78 : .4, ry = big ? .74 : .36, rz = big ? .82 : .52;
  const legLen = big ? .2 : lamb ? .3 : .32, legR = lamb ? .04 : .036;
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const scaleG = grp(root); scaleG.scale.setScalar(K);
  const hipY = legLen + .1 + (big ? .05 : 0);
  const hips = grp(scaleG, 0, hipY, -rz * .55);
  const body = grp(hips, 0, ry * .55, rz * .55);
  body.add(mesh(woolCloud(rx, ry, rz, big ? 300 : lamb ? 110 : 170, seed * 13 + 1, big ? .1 : .092), kind === 'flock' && seed % 3 === 2 ? M.woolGrey : M.wool));
  const tail = mesh(blob(big ? .14 : .09, 2, .15, seed), M.wool); tail.position.set(0, ry * .3, -rz * .98); body.add(tail);
  // front legs hang from the shoulders
  const fl = makeLeg(body, rx * .42, -ry * .55, rz * .5, legR * .9, legLen + ry * .45 - .02, M.face, M.hoof);
  const fr = makeLeg(body, -rx * .42, -ry * .55, rz * .5, legR * .9, legLen + ry * .45 - .02, M.face, M.hoof);
  const bl = makeLeg(scaleG, rx * .42, hipY, -rz * .45, legR * .9, hipY - .05, M.face, M.hoof);
  const br = makeLeg(scaleG, -rx * .42, hipY, -rz * .45, legR * .9, hipY - .05, M.face, M.hoof);
  // head
  const hs = lamb ? 1.4 : big ? 1.05 : 1.18;
  const neck = grp(body, 0, ry * .42, rz * (big ? .97 : 1.0) + .02);
  const head = grp(neck); head.scale.setScalar(hs);
  const skullGeo = mergeGeometries([ (() => { const g = ball(1, .03, seed, 36, 26); g.scale(.15, .15, .15); g.translate(0, .045, 0); return g; })(),
    (() => { const g = ball(1, .03, seed + 5, 36, 26); g.scale(.12, .105, .17); g.rotateX(.25); g.translate(0, -.055, .1); return g; })() ]);
  const skull = mesh(skullGeo, M.face); head.add(skull);
  // nostrils
  for (const s of [1, -1]) { const n = mesh(new THREE.SphereGeometry(.012, 10, 8), M.hoof); n.scale.set(1, .6, .5); n.position.set(s * .035, -.04, .255); head.add(n); }
  const er = lamb ? .062 : big ? .06 : .066, gap = kind === 'shaun' ? .06 : lamb ? .058 : .072;
  const eyeL = makeEye(head, gap, .135, .08, er, M.face), eyeR = makeEye(head, -gap, .135, .08, er, M.face);
  // ears
  const ears = [1, -1].map(s => { const p = grp(head, s * .13, .1, -.03); const e = ell(.1, .03, .05, M.face, .05, seed + s); e.position.x = s * .08; p.add(e);
    const inner = ell(.07, .012, .03, M.pink, .04, seed + s + 3); inner.position.set(s * .085, .018, .008); p.add(inner); return p; });
  // mouth: smile arc, open mouth, teeth
  const mouthG = grp(head, 0, -.122, .212); mouthG.rotation.x = -.55;
  const smileM = mesh(new THREE.TorusGeometry(.045, .007, 8, 24, Math.PI * .75), M.mouth); smileM.rotation.z = Math.PI + Math.PI * .125; mouthG.add(smileM);
  const openM = ell(.064, .05, .035, M.mouth, .02, seed + 8); openM.position.z = .0; mouthG.add(openM);
  const tongue = ell(.035, .012, .02, M.tongue, .02, seed + 9); tongue.position.set(0, -.02, .01); openM.add(tongue);
  const teeth = mesh(new THREE.BoxGeometry(.045, .025, .012), M.teeth); teeth.position.set(0, .012, .02); mouthG.add(teeth);
  // hair
  let top = null;
  if (kind === 'shaun') { top = mesh(tuft(6, .05, 77), M.wool); top.position.set(0, .165, -.01); top.rotation.x = -.2; head.add(top); }
  else if (lamb) { top = mesh(tuft(4, .035, 31), M.wool); top.position.set(0, .17, 0); head.add(top); }
  else if (big) { top = mesh(tuft(9, .09, 55, 1.4), M.wool); top.position.set(0, .15, .06); top.scale.set(1.35, 1, 1.2); head.add(top); }
  else { top = mesh(tuft(7, .055, seed * 7 + 3, 1.2), M.wool); top.position.set(0, .16, -.03); top.scale.set(1.2, .8, 1); head.add(top); }
  if (kind === 'mum') {
    for (let i = 0; i < 4; i++) { const c = mesh(new THREE.CylinderGeometry(.022, .022, .09, 14), M.curler); c.rotation.z = Math.PI / 2; c.position.set((i - 1.5) * .05, .235 + (i % 2) * .01, -.02 + (i % 2 ? .02 : -.02)); head.add(c); }
  }
  let dummy = null;
  if (lamb) {
    dummy = grp(head, 0, -.075, .27);
    const shield = ell(.05, .035, .014, M.dummy, .02, 4); dummy.add(shield);
    const ring = mesh(new THREE.TorusGeometry(.028, .008, 10, 20), M.dummyRing); ring.position.z = .02; dummy.add(ring);
  }
  const shoulder = [fl.position.clone(), fr.position.clone()];
  const rig = { kind, root, scaleG, hips, body, neck, head, fl, fr, bl, br, shoulder, rx, eyeL, eyeR, ears, mouthG, smileM, openM, teeth, tail, top, dummy, K, ry, rz, hipY, legLen, seed, big, lamb };
  rig.pose = (p, t) => poseSheep(rig, p, t);
  rig.handPos = side => { const v = new THREE.Vector3(0, -(legLen + ry * .45 + .03), 0); (side > 0 ? fl : fr).localToWorld(v); return v; };
  return rig;
}

export const SHEEP_DEF = { x: 0, y: 0, z: 0, yaw: 0, up: 0, pitch: 0, roll: 0, rootPitch: 0, rootRoll: 0, sq: 1, gait: null, gaitAmp: 0, run: 0,
  headYaw: 0, headPitch: 0, headRoll: 0, armL: [15, 12], armR: [15, 12], legs: [0, 0], sit: 0, lie: 0, graze: 0, breathe: 1, ...DEF_FACE };

function autoBlink(t, seed) { const P = 2.6 + hash(seed, 3) * 2.2, ph = ((t + seed * 1.37) % P + P) % P; return ph < .14 ? 0 : 1; }

function poseSheep(R, p, t) {
  const up = clamp(p.up), sit = clamp(p.sit), lie = clamp(p.lie);
  R.root.position.set(p.x, p.y, p.z);
  R.root.rotation.set(p.rootPitch * DEG, p.yaw * DEG, p.rootRoll * DEG);
  const s = p.sq; R.scaleG.scale.set(R.K / Math.sqrt(s), R.K * s, R.K / Math.sqrt(s));
  const ph = p.gait ?? 0, A = p.gaitAmp, run = p.run;
  const bob = A * (run ? .06 : .025) * Math.abs(Math.sin(ph));
  const theta = -80 * up * DEG + p.pitch * DEG + (run ? Math.sin(ph * 2) * .06 * A : 0) * (1 - up);
  R.hips.position.set(0, R.hipY + bob - lie * (R.legLen + .02) - sit * (R.hipY - .12), -R.rz * .55 * (1 - up));
  R.hips.rotation.set(theta + sit * -55 * DEG * (1 - up), 0, p.roll * DEG);
  const br = 1 + .012 * Math.sin(t * 2.4 + R.seed) * p.breathe; R.body.scale.set(br, 1 / br, br);
  // legs
  const sw = (off) => A * (run ? 50 : 32) * Math.sin(ph + off) * DEG;
  const quadF = [sw(0), sw(Math.PI)], quadB = [sw(Math.PI), sw(0)];
  const bipB = [sw(0) * 1.1, sw(Math.PI) * 1.1];
  const lieF = -80 * DEG, lieB = 75 * DEG, sitB = -85 * DEG;
  const hind = i => lerp(lerp(quadB[i], bipB[i], up), lieB, lie) * (1 - sit) + sitB * sit + (p.legs[i] || 0) * DEG;
  R.bl.rotation.set(hind(0), 0, (8 * lie + 6 * sit) * DEG); R.br.rotation.set(hind(1), 0, -(8 * lie + 6 * sit) * DEG);
  R.bl.position.y = R.br.position.y = R.hipY + bob - lie * (R.legLen + .02) - sit * (R.hipY - .12);
  R.bl.position.z = R.br.position.z = -R.rz * .45 * (1 - up) + up * .02;
  // front legs: gait when on four, arms (pitch forward-up, roll outward) when upright
  const bodyPitch = R.hips.rotation.x;
  const arm = (a, i, side) => {
    const armSw = up * A * 25 * Math.sin(ph + (i ? 0 : Math.PI)) * DEG;
    const qp = lerp(quadF[i], lieF, lie) - bodyPitch * (1 - up) * 0 ;
    const bip = -a[0] * DEG - bodyPitch + armSw;
    return [lerp(qp, bip, up), lerp(0, a[1] * DEG * side, up), (a[2] || 0) * DEG];
  };
  const aL = arm(p.armL, 0, 1), aR = arm(p.armR, 1, -1);
  R.shoulder.forEach((s0, i) => { const sd = i ? -1 : 1; (i ? R.fr : R.fl).position.set(sd * lerp(Math.abs(s0.x), R.rx * .84, up), lerp(s0.y, -R.ry * .35, up), lerp(s0.z, R.rz * .5, up)); });
  R.neck.position.set(0, R.ry * lerp(.42, -.28, up), R.rz * (1.0 - .05 * up) + .02);
  R.fl.rotation.set(aL[0], aL[2], aL[1]); R.fr.rotation.set(aR[0], -aR[2], aR[1]);
  // head: compensate body pitch so the face looks forward
  const graze = p.graze ? (.5 + .5 * Math.sin(t * 3.1 + R.seed)) * p.graze : 0;
  R.neck.rotation.set(-bodyPitch * .92 + (p.headPitch + graze * 45 + lie * -5) * DEG, p.headYaw * DEG, p.headRoll * DEG, 'YXZ');
  R.neck.rotation.order = 'YXZ';
  // face
  const bl = p.blink ? autoBlink(t, R.seed) : 1;
  const open = p.eyeOpen * bl;
  setEye(R.eyeL, open * (1 - (p.wink || 0)), p.look, p.pupil, p.lidTilt, p.eyeWide, 1, p.squint);
  setEye(R.eyeR, open, p.look, p.pupil, p.lidTilt, p.eyeWide, -1, p.squint);
  R.ears.forEach((e, i) => { const sd = i ? -1 : 1; e.rotation.set(0, 0, sd * (-18 + p.ears * 30 + Math.sin(t * 1.3 + R.seed + i) * 3) * DEG); });
  const mo = clamp(p.mouth);
  R.openM.scale.set(1 + mo * .15, Math.max(.02, mo), 1); R.openM.visible = mo > .03;
  R.smileM.visible = mo < .25; R.smileM.scale.set(1, clamp(p.smile, -1, 1) || .01, 1);
  R.teeth.visible = p.grin > .05 && mo < .4; R.teeth.scale.set(1 + p.grin * .5, p.grin, 1);
  if (R.dummy) R.dummy.visible = p.dummy !== false, R.dummy.position.z = .27 + (p.suck ? Math.sin(t * 9) * .006 : 0);
  R.tail.rotation.y = Math.sin(t * 5 + R.seed) * .3 * (p.wag ?? .3);
}

// ============================ BITZER ============================
export function makeBitzer() {
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const legLen = .3;
  const pelvis = grp(root, 0, legLen + .06, 0);
  const legs = [1, -1].map(s => { const pv = grp(pelvis, s * .075, 0, 0);
    const l = mesh(capsule(.05, legLen - .06, .05, s + 3), M.tan); l.position.y = -legLen / 2; pv.add(l);
    const foot = ell(.055, .035, .085, M.tan, .05, s + 7); foot.position.set(0, -legLen - .02, .03); pv.add(foot); return pv; });
  const torso = grp(pelvis, 0, .02, 0);
  const tm = ell(.165, .23, .135, M.tan, .03, 21); tm.position.y = .15; torso.add(tm);
  const belly = ell(.105, .15, .06, M.muzzle, .03, 22); belly.position.set(0, .13, .092); torso.add(belly);
  const tail = grp(torso, 0, .06, -.1); const tl = mesh(capsule(.025, .12, .05, 2), M.tan); tl.position.y = .06; tail.add(tl); tail.rotation.x = -.6;
  const collar = mesh(new THREE.TorusGeometry(.085, .018, 10, 24), M.hat); collar.rotation.x = Math.PI / 2; collar.position.y = .36; torso.add(collar);
  const whistleOnChest = mesh(new THREE.CylinderGeometry(.013, .013, .05, 12), M.metal); whistleOnChest.rotation.z = Math.PI / 2; whistleOnChest.position.set(.02, .31, .1); torso.add(whistleOnChest);
  const arms = [1, -1].map(s => {
    const sh = grp(torso, s * .15, .31, 0);
    const up = mesh(capsule(.045, .12, .05, s + 11), M.tan); up.position.y = -.09; sh.add(up);
    const el = grp(sh, 0, -.18, 0);
    const fo = mesh(capsule(.043, .1, .05, s + 13), M.tan); fo.position.y = -.07; el.add(fo);
    const paw = ell(.055, .05, .055, M.tan, .05, s + 15); paw.position.y = -.15; el.add(paw);
    const hand = grp(el, 0, -.16, 0);
    return { sh, el, hand };
  });
  // watch on the left wrist
  const watch = mesh(new THREE.TorusGeometry(.04, .012, 8, 18), M.watch); watch.rotation.x = Math.PI / 2; watch.position.y = -.1; arms[0].el.add(watch);
  // clipboard in the left paw, pencil and whistle in the right
  const board = grp(arms[0].hand, 0, 0, .04); const bm = mesh(new THREE.BoxGeometry(.2, .26, .012), M.board); bm.position.set(0, .02, 0); board.add(bm);
  const paper = mesh(new THREE.BoxGeometry(.17, .21, .004), M.paper); paper.position.set(0, .0, .009); board.add(paper);
  const clip = mesh(new THREE.BoxGeometry(.08, .025, .02), M.metal); clip.position.set(0, .14, .01); board.add(clip);
  for (let i = 0; i < 5; i++) { const ln = mesh(new THREE.BoxGeometry(.12, .006, .002), M.mouth); ln.position.set(-.01, .06 - i * .035, .012); board.add(ln); }
  board.rotation.set(-1.2, 0, 0);
  const whistle = mesh(new THREE.CylinderGeometry(.016, .016, .06, 12), M.metal); whistle.rotation.x = Math.PI / 2; arms[1].hand.add(whistle); whistle.position.z = .03;
  // head
  const neck = grp(torso, 0, .4, .01); neck.rotation.order = 'YXZ';
  const head = grp(neck, 0, .12, 0); head.scale.setScalar(1.18);
  const skull = ell(.15, .14, .14, M.tan, .03, 31); head.add(skull);
  const muzzle = ell(.085, .07, .13, M.muzzle, .03, 32); muzzle.position.set(0, -.04, .13); head.add(muzzle);
  const nose = ell(.035, .027, .025, M.nose, .02, 33); nose.position.set(0, -.015, .255); head.add(nose);
  const mouthG = grp(head, 0, -.085, .19); mouthG.rotation.x = -.2;
  const smileM = mesh(new THREE.TorusGeometry(.04, .006, 8, 20, Math.PI * .75), M.mouth); smileM.rotation.z = Math.PI + Math.PI * .125; mouthG.add(smileM);
  const openM = ell(.05, .035, .03, M.mouth, .02, 34); mouthG.add(openM);
  const tongue = ell(.03, .01, .02, M.tongue, .02, 9); tongue.position.set(0, -.018, .012); openM.add(tongue);
  const eyeL = makeEye(head, .054, .075, .115, .056, M.tan), eyeR = makeEye(head, -.054, .075, .115, .056, M.tan);
  const brow = [1, -1].map(s => { const b = ell(.045, .012, .02, M.tanDark, .03, 40 + s); b.position.set(s * .054, .145, .13); head.add(b); return b; });
  const ears = [1, -1].map(s => { const pv = grp(head, s * .13, .06, -.02); const e = ell(.045, .11, .03, M.tanDark, .05, 41 + s); e.position.y = -.08; e.rotation.z = s * .15; pv.add(e); return pv; });
  const hatG = grp(head, 0, .085, -.035);
  const hat = mesh(new THREE.SphereGeometry(.158, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.hat); hat.scale.set(1, 1.05, 1.05); hatG.add(hat);
  const rib = mesh(new THREE.TorusGeometry(.155, .025, 10, 32), M.hatRib); rib.rotation.x = Math.PI / 2; rib.scale.set(1, 1.04, 1); hatG.add(rib);
  hatG.rotation.x = -.42;
  const phones = grp(head, 0, .02, 0);
  const band = mesh(new THREE.TorusGeometry(.18, .014, 8, 24, Math.PI), M.phones); band.position.y = .03; band.rotation.y = 0; phones.add(band);
  for (const s of [1, -1]) { const cup = mesh(new THREE.CylinderGeometry(.055, .055, .04, 20), M.phones); cup.rotation.z = Math.PI / 2; cup.position.set(s * .17, .02, 0); phones.add(cup); }
  const rig = { kind: 'bitzer', root, pelvis, legs, torso, tail, arms, neck, head, eyeL, eyeR, brow, ears, mouthG, smileM, openM, board, whistle, phones, seed: 9, legLen };
  rig.pose = (p, t) => poseBitzer(rig, p, t);
  rig.handPos = side => { const v = new THREE.Vector3(); arms[side > 0 ? 0 : 1].hand.getWorldPosition(v); return v; };
  return rig;
}
export const BITZER_DEF = { x: 0, y: 0, z: 0, yaw: 0, lean: 0, twist: 0, roll: 0, sq: 1, gait: null, gaitAmp: 0, run: 0, sit: 0, recline: 0, legs: [0, 0], paddle: 0,
  armL: [30, 10, 60], armR: [10, 10, 20], headYaw: 0, headPitch: 0, headRoll: 0, brow: 0, board: 1, whistleUp: 0, phones: 0, tailWag: .5, ...DEF_FACE };

function poseBitzer(R, p, t) {
  R.root.position.set(p.x, p.y, p.z); R.root.rotation.set(0, p.yaw * DEG, p.roll * DEG);
  R.root.scale.set(1.32 / Math.sqrt(p.sq), 1.32 * p.sq, 1.32 / Math.sqrt(p.sq));
  const ph = p.gait ?? 0, A = p.gaitAmp, sit = clamp(p.sit);
  const bob = A * (p.run ? .05 : .02) * Math.abs(Math.sin(ph));
  R.pelvis.position.y = R.legLen + .06 + bob - sit * .02;
  R.pelvis.rotation.x = -sit * p.recline * DEG;
  const sw = off => A * (p.run ? 55 : 34) * Math.sin(ph + off) * DEG;
  const pad = p.paddle ? Math.sin(t * 14) * 30 * p.paddle * DEG : 0;
  R.legs[0].rotation.x = sw(0) - sit * 88 * DEG + (p.legs[0] || 0) * DEG + pad;
  R.legs[1].rotation.x = sw(Math.PI) - sit * 88 * DEG + (p.legs[1] || 0) * DEG - pad;
  R.torso.rotation.set(p.lean * DEG + (p.run ? .25 * A : 0), p.twist * DEG, 0);
  const asw = off => A * 30 * Math.sin(ph + off) * DEG;
  [[p.armL, 1, Math.PI], [p.armR, -1, 0]].forEach(([a, s, off], i) => {
    const arm = R.arms[i];
    arm.sh.rotation.set(-a[0] * DEG + asw(off) * (p.armSwing ?? 1), 0, s * a[1] * DEG, 'XYZ');
    arm.el.rotation.set(-(a[2] || 0) * DEG, 0, 0);
  });
  R.board.visible = p.board > .5;
  R.whistle.visible = p.whistleUp > .5;
  R.neck.rotation.set(p.headPitch * DEG - p.lean * DEG * .5, p.headYaw * DEG, p.headRoll * DEG);
  const bl = p.blink ? autoBlink(t, R.seed) : 1;
  setEye(R.eyeL, p.eyeOpen * bl, p.look, p.pupil, p.lidTilt, p.eyeWide, 1, p.squint);
  setEye(R.eyeR, p.eyeOpen * bl, p.look, p.pupil, p.lidTilt, p.eyeWide, -1, p.squint);
  R.brow.forEach((b, i) => { const s = i ? -1 : 1; b.position.y = .145 + p.brow * .02 + (1 - p.eyeWide) * -.05; b.rotation.z = s * -p.brow * .3 + s * p.lidTilt * DEG * .5; });
  R.ears.forEach((e, i) => { const s = i ? -1 : 1; e.rotation.z = s * (10 + p.ears * 25 + Math.sin(t * 4 + i) * 4 * (A + .3)) * DEG; e.rotation.x = -A * .3 * Math.abs(Math.sin(ph)); });
  const mo = clamp(p.mouth); R.openM.scale.set(1, Math.max(.02, mo), 1); R.openM.visible = mo > .03; R.smileM.visible = mo < .25; R.smileM.scale.set(1, clamp(p.smile, -1, 1) || .01, 1);
  R.phones.visible = p.phones > .5;
  R.tail.rotation.z = Math.sin(t * 9) * .5 * p.tailWag;
}

// ============================ FARMER'S CAR ============================
export function makeCar() {
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const body = grp(root, 0, .42, 0);
  const shell = mesh((() => { const g = new THREE.CapsuleGeometry(.5, 1.3, 10, 24); g.rotateX(Math.PI / 2); g.scale(1.25, .62, 1); return lumpy(g, .012, 2, 3); })(), M.carBody); body.add(shell);
  const cab = mesh((() => { const g = new THREE.SphereGeometry(.62, 36, 24, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, .75, 1.1); return lumpy(g, .01, 2, 5); })(), M.carBody); cab.position.set(0, .2, -.15); body.add(cab);
  // windows: dark glass inset (front windscreen transparent so we see the farmer)
  const ws = mesh(new THREE.SphereGeometry(.625, 36, 24, -Math.PI * .32, Math.PI * .64, Math.PI * .12, Math.PI * .34), M.window); ws.scale.set(1, .75, 1.1); ws.position.copy(cab.position); body.add(ws);
  for (const s of [1, -1]) { const sw = mesh(new THREE.SphereGeometry(.628, 30, 20, s > 0 ? Math.PI * .1 : Math.PI * 1.1, Math.PI * .8, Math.PI * .14, Math.PI * .3), M.window); sw.scale.set(1, .75, 1.1); sw.position.copy(cab.position); body.add(sw); }
  const bumper = [1, -1].map(s => { const b = mesh(capsule(.06, .95, .02, s), M.metal); b.rotation.z = Math.PI / 2; b.position.set(0, -.18, s * 1.12); body.add(b); return b; });
  for (const s of [1, -1]) { const hl = mesh(new THREE.SphereGeometry(.09, 20, 14), M.lamp); hl.position.set(s * .38, .02, 1.02); body.add(hl);
    const rim = mesh(new THREE.TorusGeometry(.09, .018, 8, 20), M.metal); rim.position.set(s * .38, .02, 1.05); body.add(rim); }
  const plate = mesh(new THREE.BoxGeometry(.3, .08, .02), M.carTrim); plate.position.set(0, -.08, 1.14); body.add(plate);
  const exhaust = mesh(new THREE.CylinderGeometry(.03, .03, .15, 10), M.metal); exhaust.rotation.x = Math.PI / 2; exhaust.position.set(.3, -.22, -1.12); body.add(exhaust);
  const wheels = [];
  for (const [x, z] of [[.58, .68], [-.58, .68], [.58, -.68], [-.58, -.68]]) {
    const w = grp(root, x, .24, z);
    const ty = mesh(new THREE.TorusGeometry(.16, .08, 14, 28), M.tyre); ty.rotation.y = Math.PI / 2; w.add(ty);
    const hub = mesh(new THREE.CylinderGeometry(.11, .11, .1, 20), M.carTrim); hub.rotation.z = Math.PI / 2; w.add(hub);
    const cap = mesh(new THREE.SphereGeometry(.04, 12, 8), M.metal); cap.position.x = Math.sign(x) * .06; w.add(cap);
    const spoke = mesh(new THREE.BoxGeometry(.11, .03, .19), M.metal); w.add(spoke);
    wheels.push(w);
  }
  // the Farmer
  const farmer = grp(body, -.22, .1, -.05);
  const torso = ell(.2, .22, .14, M.shirt, .03, 51); torso.position.y = .02; farmer.add(torso);
  const fneck = grp(farmer, 0, .22, 0); fneck.rotation.order = 'YXZ';
  const fhead = grp(fneck, 0, .16, 0);
  fhead.add(ell(.13, .16, .135, M.skin, .03, 52));
  const fnose = ell(.035, .05, .04, M.skin, .03, 53); fnose.position.set(0, -.01, .135); fhead.add(fnose);
  const hair = mesh(new THREE.TorusGeometry(.12, .035, 10, 24, Math.PI * 1.3), M.hair); hair.rotation.set(Math.PI / 2, 0, -Math.PI * .15 - Math.PI * .5); hair.position.y = .02; fhead.add(hair);
  for (const s of [1, -1]) { const ear = ell(.025, .045, .02, M.skin, .03, 54 + s); ear.position.set(s * .13, 0, 0); fhead.add(ear);
    const lens = mesh(new THREE.TorusGeometry(.04, .007, 8, 20), M.hoof); lens.position.set(s * .05, .03, .13); fhead.add(lens);
    const gl = mesh(new THREE.CircleGeometry(.038, 20), M.glass); gl.position.set(s * .05, .03, .132); fhead.add(gl);
    const eye = mesh(new THREE.SphereGeometry(.013, 10, 8), M.pupil); eye.position.set(s * .05, .03, .12); fhead.add(eye); }
  const bridge = mesh(new THREE.BoxGeometry(.03, .007, .007), M.hoof); bridge.position.set(0, .03, .135); fhead.add(bridge);
  const fmouth = mesh(new THREE.TorusGeometry(.03, .006, 8, 16, Math.PI * .8), M.mouth); fmouth.rotation.z = Math.PI + Math.PI * .1; fmouth.position.set(0, -.07, .125); fhead.add(fmouth);
  const farmArm = grp(farmer, -.18, .12, .05); const fa = mesh(capsule(.045, .25, .03, 56), M.shirt); fa.position.y = -.15; farmArm.add(fa);
  const fhand = ell(.045, .045, .045, M.skin, .03, 57); fhand.position.y = -.31; farmArm.add(fhand);
  const wheel = mesh(new THREE.TorusGeometry(.12, .015, 8, 24), M.hoof); wheel.position.set(-.22, .12, .3); wheel.rotation.x = -.9; body.add(wheel);
  const rig = { kind: 'car', root, body, wheels, farmer, fneck, fhead, fmouth, farmArm, exhaust };
  rig.pose = (p, t) => {
    root.position.set(p.x, p.y, p.z); root.rotation.set(0, p.yaw * DEG, 0);
    const judder = p.engine ? Math.sin(t * 61) * .006 + Math.sin(t * 23) * .004 : 0;
    body.position.y = .42 + judder + p.bounce * .05; body.rotation.x = p.tilt * DEG; body.rotation.z = judder * .6;
    body.scale.set(1 / Math.sqrt(p.sq), p.sq, 1 / Math.sqrt(p.sq));
    wheels.forEach(w => w.rotation.x = p.spin);
    fneck.rotation.set(p.fPitch * DEG, p.fYaw * DEG, p.fRoll * DEG);
    fmouth.scale.y = p.fSmile;
    farmArm.rotation.set(-p.fArm * DEG, 0, -p.fArm * .4 * DEG);
  };
  return rig;
}
export const CAR_DEF = { x: 0, y: 0, z: 0, yaw: 0, engine: 0, bounce: 0, tilt: 0, sq: 1, spin: 0, fPitch: 0, fYaw: 0, fRoll: 0, fSmile: .6, fArm: 0 };

// ============================ BALLOONS ============================
export function makeBalloons(n = 5) {
  const root = new THREE.Group();
  const items = [];
  for (let i = 0; i < n; i++) {
    const g = grp(root);
    const geo = new THREE.SphereGeometry(.34, 40, 30); { const pos = geo.attributes.position; for (let k = 0; k < pos.count; k++) { const y = pos.getY(k); pos.setY(k, y * 1.18 - (y < 0 ? y * y * .35 : 0)); const f = 1 - Math.max(0, -y - .2) * .5; pos.setX(k, pos.getX(k) * f); pos.setZ(k, pos.getZ(k) * f); } geo.computeVertexNormals(); }
    const b = mesh(geo, M.balloon[i % M.balloon.length]); g.add(b);
    const knot = mesh(new THREE.ConeGeometry(.045, .07, 12), M.balloon[i % M.balloon.length]); knot.position.y = -.42; g.add(knot);
    const str = mesh(new THREE.CylinderGeometry(.006, .006, 1, 5), M.string, true, false); root.add(str);
    items.push({ g, b, str });
  }
  const rig = { kind: 'balloons', root, items };
  const tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  rig.pose = (p, t) => {
    const a = new THREE.Vector3(...p.anchor);
    items.forEach((it, i) => {
      const ang = i / n * Math.PI * 2 + .4, rad = .38 * p.spread;
      const sway = Math.sin(t * 1.3 + i * 1.7) * .12 * p.sway, sway2 = Math.cos(t * 1.1 + i * 2.3) * .12 * p.sway;
      const top = new THREE.Vector3(a.x + Math.cos(ang) * rad + sway + p.lean[0], a.y + p.len + (i % 2) * .28 + (i === 2 ? .35 : 0), a.z + Math.sin(ang) * rad + sway2 + p.lean[1]);
      it.g.position.copy(top); it.g.rotation.set(sway2 * .8, i, -sway * .8);
      const s = p.scale * (p.popped?.[i] ? 0 : 1); it.g.scale.setScalar(s); it.str.visible = s > 0;
      const bottom = top.clone().add(new THREE.Vector3(0, -.45 * p.scale, 0));
      tmp.subVectors(bottom, a); const len = tmp.length();
      it.str.position.copy(a).addScaledVector(tmp, .5); it.str.scale.set(1, len, 1);
      it.str.quaternion.setFromUnitVectors(up, tmp.normalize());
    });
    root.visible = p.vis !== false;
  };
  return rig;
}
export const BALLOON_DEF = { anchor: [0, 0, 0], len: 1.5, spread: 1, sway: 1, lean: [0, 0], scale: 1 };

// ============================ BUTTERFLY ============================
export function makeButterfly() {
  const root = new THREE.Group();
  const bodyM = mesh(capsule(.012, .06, .02, 1), M.hoof); bodyM.rotation.x = Math.PI / 2; root.add(bodyM);
  const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.bezierCurveTo(.06, .07, .13, .05, .1, -.01); shape.bezierCurveTo(.12, -.06, .05, -.08, 0, -.02);
  const wg = new THREE.ShapeGeometry(shape, 12);
  const wings = [1, -1].map(s => { const pv = grp(root); const w = mesh(wg, M.butterfly); w.rotation.x = -Math.PI / 2; w.scale.x = s; pv.add(w); w.material = M.butterfly; w.material.side = THREE.DoubleSide; return pv; });
  const rig = { kind: 'butterfly', root, wings };
  rig.pose = (p, t) => { root.position.set(...p.pos); root.rotation.y = p.yaw * DEG; const f = Math.sin(t * 22) * .9; wings[0].rotation.z = f; wings[1].rotation.z = -f; root.scale.setScalar(p.scale ?? 1.4); };
  return rig;
}
