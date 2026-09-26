// stage.js: the vocabulary a story file uses. Import everything from here in src/shots.js:
//   import { K, yawTo, X, walk, hop, hold, orbit, THREE, ... } from './stage.js';
import * as THREE from 'three';
import { track, clamp, lerp, p, ease, spring, wobble, pulse, hash, arc, smooth, noise3, DEG } from './lib.js';
import { ground, laneCurve, L } from './set.js';
export { THREE, track, clamp, lerp, p, ease, spring, wobble, pulse, hash, arc, smooth, noise3, DEG, ground, laneCurve, L };

// Keyframe track: K([t, {params}, ease?], ...). Params interpolate between the keys that mention them.
export const K = (...keys) => track(keys);
// Yaw (degrees) that makes a character at a=[x,z] face b=[x,z]. yaw 0 faces +Z (towards the default camera).
export const yawTo = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]) / DEG;
export const still = o => () => o;
// Expressions: spread into a pose, e.g. { ...X.shock, x: 1 }.
export const X = {
  happy: { smile: .8 }, shock: { eyeWide: 1.3, pupil: .55, mouth: .85, ears: 1, smile: 0 }, bored: { eyeOpen: .5, lidTilt: -6, smile: -.4, ears: -1 },
  sly: { eyeOpen: .62, lidTilt: 8, smile: 1, grin: .8 }, grin: { grin: 1, smile: 1 }, calm: { mouth: 0, eyeWide: 1, pupil: 1, ears: 0 },
  sleep: { eyeOpen: 0, blink: false, mouth: .15 }, sad: { smile: -.8, ears: -1, eyeOpen: .7, lidTilt: -10 }, cross: { smile: -.6, lidTilt: 14, eyeOpen: .7 },
};
// Walk/run from a to b ([x,z]) between t0 and t1; before t0 stands at a, after t1 stands at b facing `endYaw`.
// Returns pose fields to spread: { ...walk(lt, [0,0], [3,1], 1, 3) }. run=true for a trot/gallop.
export function walk(lt, a, b, t0, t1, { run = false, endYaw = null, ease: e = 'io' } = {}) {
  const u = clamp((lt - t0) / (t1 - t0)), k = ease[e](u), moving = u > 0 && u < 1;
  return { x: lerp(a[0], b[0], k), z: lerp(a[1], b[1], k), yaw: moving || endYaw == null ? yawTo(a, b) : endYaw, gaitAmp: moving ? 1 : 0, run: run ? 1 : 0, gait: lt * (run ? 16 : 10) };
}
// Jump from a to b ([x,y,z]) between t0 and t1 with apex height h: { x, y, z, sq } (squash/stretch included).
export function hop(lt, a, b, t0, t1, h = .8) {
  const u = clamp((lt - t0) / (t1 - t0)), q = arc(a, b, u, h), land = lt - t1;
  return { x: q[0], y: q[1], z: q[2], sq: u < 1 ? 1 + .15 * Math.sin(u * Math.PI) : 1 - .18 * Math.exp(-land * 9) * Math.cos(land * 28) };
}
// Camera orbiting a centre: angle a0->a1 (degrees, 0 = camera on +Z side), radius r, height h, over t0..t1.
export function orbit(lt, c, t0, t1, a0, a1, r, h, fov = 35) {
  const a = lerp(a0, a1, ease.io(clamp((lt - t0) / (t1 - t0)))) * DEG;
  return { pos: [c[0] + Math.sin(a) * r, c[1] + h, c[2] + Math.cos(a) * r], look: c, fov };
}
