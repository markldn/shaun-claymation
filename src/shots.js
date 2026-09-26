// shots.js: every shot of the film. Each entry gets its marks (m, from timeline.js) and returns
// { cam(lt), cast: { actor: track | fn(lt) }, fx(lt), ones? }. Angles in degrees, positions in metres.
import { THREE, K, yawTo, still, X, track, clamp, lerp, p, ease, spring, wobble, pulse, hash, arc, smooth, noise3, DEG, ground, laneCurve, L } from './stage.js';

// ---- the flock grazing (reused) ----
const GRAZE = {
  f1: [-2.4, -1.2, 30], f2: [3.4, -2.8, -40], f3: [-4.8, 1.6, 80], f4: [5.6, 1.4, -100], f5: [7.6, -4.4, -60], f6: [-8.2, -3.4, 50],
  mum: [-.6, -3.9, 12], shirley: [-8.6, 5.8, 110],
};
const grazer = (n, extra = {}) => (lt, t) => { const [x, z, y] = GRAZE[n]; return { x, z, yaw: y + Math.sin(t * .3 + x) * 6, graze: 1, ...extra }; };
const grazers = (names, extra) => Object.fromEntries(names.map(n => [n, grazer(n, extra)]));

// ---- Timmy's flight: ONE world path over absolute time, shared by every shot he floats in ----
const FLY = K(
  [37.6, { x: 1.2, y: 0, z: 3.0 }], [38.4, { x: 1.15, y: .45, z: 3.0 }, 'out'], [42, { x: .6, y: 2.2, z: 2.9 }],
  [46.6, { x: .15, y: 3.0, z: 2.8 }], [51, { x: -1.6, y: 3.9, z: 2.7 }], [54, { x: -2.4, y: 4.55, z: 2.6 }],
  [57.6, { x: -2.42, y: 4.48, z: 2.6 }], [59.2, { x: -2.5, y: 4.95, z: 2.6 }], [61, { x: -2.9, y: 5.5, z: 2.6 }], [66, { x: -3.5, y: 6.3, z: 3.0 }],
  [75, { x: -4.2, y: 7.1, z: 3.4 }], [81.05, { x: -4.3, y: 7.45, z: 3.55 }]);
export const timmyAt = t => { const q = FLY(t); return [q.x, q.y + Math.sin(t * 1.7) * .06, q.z]; };

export const SHOTS = {
  // ======================= 1. OPEN: crane down from the sky, the title lands in the field =======================
  open: (m, C) => {
    const title1 = C.text('SHAUN', { size: .95, depth: .26 }), title2 = C.text('THE SHEEP', { size: .52, depth: .22 });
    const title3 = C.text('UP, UP & BAA-WAY!', { size: .3, depth: .1, color: 'yellow', edgeWidth: .06 });
    const Z = 8.5, g0 = ground(0, Z);
    const row2Top = new THREE.Box3().setFromObject(title2.group).max.y;
    return {
      hero: ['shaun'],
      cam: K([0, { pos: [5, 24, 44], look: [-6, 27, -60], fov: 34 }], [4.4, { pos: [.4, 1.6, 15.4], look: [-.1, 1.1, Z] }, 'io3'], [8, { pos: [.25, 1.3, 14.3], look: [0, 1.0, Z] }, 'lin']),
      cast: {
        ...grazers(['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'mum', 'shirley']),
        timmy: (lt, t) => ({ x: .2, z: -3.2, yaw: -30, graze: .3, headYaw: Math.sin(t * .8) * 20, suck: 1 }),
        shaun: K([0, { vis: false, x: 1.9, z: Z - .5, up: 1, rootRoll: 0, yaw: -8, armL: [20, 10], armR: [20, 10], ...X.happy, look: [0, 0] }],
          [m.peek - .05, { vis: false }], [m.peek, { x: 1.9, rootRoll: 0, vis: true }], [m.peek + .35, { x: 2.35, rootRoll: -26, headRoll: -10, look: [-.1, 0] }, 'outBack'],
          [m.wink - .1, { wink: 0, grin: 0 }], [m.wink + .05, { wink: 1, grin: 1, smile: 1 }, 'out'], [m.wink + .5, { wink: 1 }], [m.wink + .6, { wink: 0 }]),
      },
      fx: (lt) => {
        const place = (t, y) => { t.group.visible = true; t.group.position.set(0, g0 + y, Z); };
        place(title2, 0); place(title1, row2Top - .02); title3.group.visible = true; title3.group.position.set(0, g0 + .02, Z + 1.05);
        title2.letters.forEach((L, i) => C.letterDrop(L, lt, m.letters + i * .1, 0, 5));
        title1.letters.forEach((L, i) => C.letterDrop(L, lt, m.top + i * .09, 0, 4));
        // the top row thump makes the bottom row wobble
        title2.group.rotation.z = wobble(lt, m.top + .42, 5, 6) * .012;
        title3.letters.forEach((L, i) => { const s = spring(lt, m.sub + i * .045, 3.2, .35); L.g.visible = s > .01; L.g.scale.setScalar(Math.max(.001, s)); L.g.rotation.z = (1 - s) * .8; L.g.position.y = Math.sin(lt * 3 + i * .7) * .02 * s; });
      },
    };
  },

  // ======================= 2. FARMER drives off; Bitzer salutes =======================
  farmer: (m, C) => {
    const X0 = -6.8, carTr = K([0, { x: X0 }], [m.go, { x: X0 }], [m.go + 1.8, { x: -1.2 }, 'in'], [7, { x: 26 }, 'lin']);
    const carAt = lt => { const x = carTr(lt).x; return [x, laneCurve(x)]; };
    const B = [-4.8, -11.3];
    return {
      hero: 'bitzer',
      cam: lt => { const cx = carAt(lt)[0], k = smooth(m.go + 1.2, 6.2, lt);
        return { pos: [lerp(-9.6, -8.4, k), 1.25, lerp(-10.9, -11.4, k)], look: [lerp(-5.7, Math.min(16, cx * .8), k), lerp(.95, 1.1, k), lerp(-13.3, -15.5, k)], fov: 36, focus: lerp(4.6, 10, k) }; },
      cast: {
        car: lt => { const [x, z] = carAt(lt), x2 = carAt(lt + .05);
          const honk = pulse(lt, m.horn, 10) + pulse(lt, m.horn + .35, 10);
          return { x, z, yaw: 90 - Math.atan2(x2[1] - z, x2[0] - x + 1e-6) / DEG * 0, engine: lt > m.engine ? 1 : 0, sq: 1 - .09 * honk, spin: -(x - X0) / .24,
            tilt: lt > m.go && lt < m.go + 1 ? -2 * Math.sin((lt - m.go) * Math.PI) : 0,
            fYaw: lt < m.go + 1.2 ? -40 : lerp(-40, -90, smooth(m.go + 1.2, m.go + 2.2, lt)), fArm: lt > m.wave && lt < m.go + .4 ? 120 + Math.sin(lt * 14) * 18 : 0, fSmile: .9 }; },
        bitzer: (lt, t) => { const carX = carAt(lt)[0], look = Math.atan2(carX - B[0], -14.5 - B[1]) / DEG;
          const sal = smooth(m.wave - .3, m.wave, lt) * (1 - smooth(m.go + .3, m.go + .7, lt));
          const wave = smooth(m.go + .5, m.go + .9, lt) * (1 - smooth(6.4, 6.9, lt));
          return { x: B[0], z: B[1], yaw: -125, headYaw: clamp(look + 125, -80, 80) * .85, lean: -3,
            armR: [lerp(lerp(10, 150, sal), 150, wave), lerp(10, 40, sal) + wave * Math.sin(t * 16) * 25, lerp(20, 120, sal) * (1 - wave) + 30 * wave],
            armL: [40, 10, 70], smile: .7, eyeOpen: 1, brow: sal * .5 }; },
        ...grazers(['f1', 'f2']),
      },
      fx: lt => { if (lt > m.engine - .1) { const e = C.A.car.exhaust.getWorldPosition(new THREE.Vector3());
        [0, 1, 2, 3].forEach(i => { const period = lt < m.go ? .55 : .3, k = Math.floor((lt - m.engine) / period) - i; if (k < 0) return; C.puff(i, m.engine + k * period, lt, e.toArray(), .45, '#cfcac0'); }); } },
    };
  },
};

// ---- look-development: characters in a row, turntable (index.html?look=<yaw>) ----
SHOTS.look = (m, C, arg) => {
  const yaw = +arg || 0;
  const row = { shaun: [-1.8, 0], timmy: [-.8, 0], mum: [.2, 0], shirley: [1.7, .2], bitzer: [3.2, 0], f1: [-3, .1] };
  const cast = {};
  for (const n in row) cast[n] = (lt, t) => ({ x: row[n][0], z: row[n][1], yaw: yaw + (lt < 3 ? lt * 40 : 0), ...(lt >= 3 ? { up: n === 'bitzer' ? 0 : 1, armL: [lt > 4 ? 160 : 20, 15], ...(lt > 5 ? { mouth: .8, eyeWide: 1.25, pupil: .6, ears: 1 } : {}) } : {}) });
  return { cast, cam: lt => ({ pos: [0.4, 1.1, 5.2], look: [0.4, .55, 0], fov: 40, aperture: 0.0008 }) };
};

// ============================================================================================================
// shared staging
const CHAIR = { x: -7.1, z: -8.25, yaw: 28.6, sit: 1, recline: 34, y: -.14, legs: [42, 38], board: 0 };
const ASLEEP = { ...CHAIR, eyeOpen: 0, blink: false, phones: 1, mouth: .18, headRoll: 16, headPitch: 8, armL: [15, 28, 95], armR: [15, 28, 95], tailWag: 0 };
const TB = [-2.4, 2.6], LV = [0, .95, 1.9, 2.85];                    // tower base and level heights
const PILE = {
  f1: { x: -3.4, z: 2.4, yaw: 60, lie: 1, rootRoll: 10, eyeOpen: .4, blink: false, smile: -.5 },
  f2: { x: -3.7, z: 2.8, y: .42, yaw: -30, lie: .6, rootRoll: -25, eyeOpen: .3, blink: false, smile: -.5 },
  f3: { x: -4.5, z: 2.4, y: .78, yaw: 20, rootRoll: 180, legs: [20, -20], eyeOpen: .2, blink: false, mouth: .3 },
  shaun: { x: -3.8, z: 2.6, y: .72, yaw: -10, lie: .5, rootRoll: 15, pitch: 20, eyeOpen: .5, blink: false, smile: -.4 },
};
const LINE = { f1: -3.4, f2: -2.3, shirley: -1.0, mum: .35, timmy: .95, f3: 1.7, f4: 2.7, shaun: 3.9 }, LZ = -6.3;
// Shaun's launch: ballistic from the plank (79.12) to the apex (81.0) where he grabs Timmy
const LAUNCH = { t0: 79.12, y0: .24, g: 3.38, v: 6.35, x0: -4.4, z0: 4.0, x1: -4.3, z1: 3.6 };
const launchAt = t => { const tau = Math.max(0, t - LAUNCH.t0), u = clamp(tau / 1.93);
  return [lerp(LAUNCH.x0, LAUNCH.x1, u), LAUNCH.y0 + LAUNCH.v * tau - .5 * LAUNCH.g * tau * tau, lerp(LAUNCH.z0, LAUNCH.z1, u)]; };
// the pair (Shaun hugging Timmy) floating down: 81.05 -> landing on Shirley at 94.5
const PAIR = K([81.05, { x: -4.3, y: 6.05, z: 3.55 }], [83, { x: -4.1, y: 6.15, z: 3.6 }, 'out'], [90, { x: -3.3, y: 5.0, z: 3.8 }], [94.5, { x: -1.2, y: 1.42, z: 4.5 }, 'io3']);
const pairAt = t => { const q = PAIR(t); return [q.x, q.y + (t < 94.5 ? Math.sin(t * 1.6) * .05 : 0), q.z]; };
const timmyOnShaun = (C, extra = {}) => { const r = C.A.shaun.root; const a = r.rotation.y;
  const ox = .34, oz = .3; return { x: r.position.x + Math.cos(a) * ox + Math.sin(a) * oz, y: r.position.y + .5, z: r.position.z - Math.sin(a) * ox + Math.cos(a) * oz, yaw: a / DEG + 25, abs: true, up: .85, sit: .5,
    armL: [60, 10], armR: [100, -35], legs: [-20, 10], dummy: false, ...X.happy, smile: 1, ...extra }; };
const zzz = (C, lt, from, head) => C.P.zzz.forEach((z, i) => { if (lt < from) return; const u = ((lt - from) / 2.4 + i / 3) % 1; z.visible = true;
  z.position.set(head.x + .12 + u * .45 + Math.sin(u * 7 + i) * .06, head.y + .25 + u * .8, head.z + .05); z.scale.setScalar(.35 + u * .9); z.rotation.set(0, -.3, Math.sin(u * 5 + i) * .3); });

Object.assign(SHOTS, {
  // ======================= 3. COUNT: Bitzer ticks off the flock, one blast of the whistle =======================
  count: (m, C) => ({
    hero: 'bitzer',
    cam: K([0, { pos: [-4.1, 1.05, -5.7], look: [-5, 1.0, -8.4], fov: 30 }], [4.5, { pos: [-4.25, 1.05, -6.05], look: [-5, 1.0, -8.4] }, 'lin']),
    cast: {
      bitzer: (lt, t) => {
        const ticks = lt > m.tick && lt < m.tick + 1.4 ? Math.floor((lt - m.tick) / .35) : -1;
        const scan = lt < m.tick ? -10 : lt < m.tick + 1.4 ? -35 + ticks * 18 : 0;
        const wh = smooth(m.whistle - .3, m.whistle, lt) * (1 - smooth(m.whistle + .7, m.whistle + 1, lt));
        return { x: -5, z: -8.4, yaw: 0, headPitch: lt < m.tick - .3 ? 26 : wh ? -8 : ticks >= 0 ? 4 : -4, headYaw: scan, look: lt < m.tick - .3 ? [0, -.7] : [0, 0],
          armL: [70, 8, 85], armR: lerp(1, 0, wh) ? [lerp(55, 125, wh) + (ticks >= 0 && (lt - m.tick) % .35 < .12 ? 12 : 0), 5, lerp(70, 135, wh)] : [55, 5, 70],
          whistleUp: wh > .5 ? 1 : 0, eyeOpen: wh > .5 ? .25 : 1, blink: wh < .5, mouth: wh > .5 ? .2 : 0, smile: lt > m.tick + 1.5 && wh < .5 ? .8 : .2, brow: wh > .5 ? .8 : 0,
          sq: 1 + wh * .04 * Math.sin(t * 40) };
      },
      ...grazers(['f5', 'f6']),
    },
  }),

  // ======================= 4. NAP: deckchair, headphones, gone =======================
  nap: (m, C) => ({
    hero: 'bitzer',
    cam: K([0, { pos: [-4.6, 1.15, -5.5], look: [-6.3, .75, -8.3], fov: 34 }], [4.5, { pos: [-5.2, 1.0, -6.2], look: [-7.0, .62, -8.25] }]),
    cast: {
      bitzer: K([0, { x: -5.2, z: -8.7, yaw: -90, gaitAmp: .8, board: 1, armL: [40, 8, 80], smile: .4 }],
        [1.0, { x: -6.85, z: -8.1, gaitAmp: .8 }, 'lin'], [1.1, { gaitAmp: 0 }], [1.3, { yaw: CHAIR.yaw, x: -7.0, z: -8.15 }],
        [m.sit, { sit: 0, y: 0, recline: 0, legs: [0, 0], board: 1 }], [m.sit + .35, { sit: 1, y: CHAIR.y, recline: 18, legs: CHAIR.legs, x: CHAIR.x, z: CHAIR.z, board: 0 }, 'out'],
        [m.phones - .35, { armL: [40, 8, 80], armR: [10, 10, 20] }], [m.phones - .05, { armL: [150, 25, 110], armR: [150, 25, 110], phones: 0 }], [m.phones, { phones: 1 }],
        [m.phones + .5, { armL: [15, 28, 95], armR: [15, 28, 95], recline: 34, headRoll: 0, eyeOpen: 1, mouth: 0, smile: .7 }],
        [m.sleep, { eyeOpen: .5 }], [m.sleep + .4, { eyeOpen: 0, headRoll: 16, headPitch: 8, mouth: .18, smile: 0, blink: false }]),
    },
    fx: (lt) => { zzz(C, lt, m.sleep + .45, C.headPos('bitzer')); },
  }),

  // ======================= 5. BORED: Shaun sulks, Timmy chases a butterfly, a squeak =======================
  bored: (m, C) => {
    const FLYP = lt => [-.2 + Math.sin(lt * 1.3) * .9 + lt * .12, .45 + Math.sin(lt * 3.1) * .18 + smooth(3.8, 5, lt) * 2, 1.2 + Math.cos(lt * 1.1) * .5];
    return {
      hero: 'shaun',
      cam: K([0, { pos: [2.0, .52, 6.6], look: [1.3, .42, 2.7], fov: 30 }], [m.squeak, { pos: [1.85, .48, 5.7], look: [1.35, .45, 2.7] }, 'lin'], [7, { pos: [1.8, .5, 5.5], look: [1.4, .55, 2.7] }]),
      cast: {
        shaun: K([0, { x: 1.6, z: 2.6, yaw: 8, lie: 1, headPitch: 22, ...X.bored, look: [.2, -.1] }],
          [m.sigh, { sq: 1 }], [m.sigh + .35, { sq: 1.09, look: [0, .6] }], [m.sigh + 1.1, { sq: .93 }], [m.sigh + 1.6, { sq: 1, look: [-.5, -.1] }],
          [3.4, { look: [-.6, 0], headYaw: -12 }], [m.squeak, { ears: -1, eyeOpen: .5, headPitch: 22, headYaw: -12 }],
          [m.squeak + .15, { ears: 1, eyeOpen: 1, eyeWide: 1.12, lidTilt: 0, smile: 0, look: [.7, .6] }, 'out'], [m.squeak + .5, { headPitch: -28, headYaw: 30, lie: .75 }, 'outBack']),
        timmy: (lt, t) => { const f = FLYP(lt - .45), hop = Math.abs(Math.sin(lt * 7));
          const reach = smooth(3.2, 3.5, lt) * (1 - smooth(4.0, 4.4, lt));
          return { x: f[0] - .5, z: f[2] - .05, y: hop * .06, yaw: yawTo([f[0] - .5, f[2]], [FLYP(lt)[0], FLYP(lt)[2]]), gait: lt * 11, gaitAmp: .8 * (1 - reach),
            up: reach, armL: [150, 15], armR: [150, 15], headPitch: -25, look: [0, .6], ...X.happy, suck: 1 }; },
        fly: lt => ({ pos: FLYP(lt), yaw: lt * 60 }),
        ...grazers(['f1', 'f2', 'f3', 'mum', 'f4']),
      },
    };
  },

  // ======================= 6. BALLOONS drift over the hedge =======================
  balloons: (m, C) => ({
    hero: 'balloons',
    cam: K([0, { pos: [8.4, .55, 6.8], look: [13.6, 2.9, 1.9], fov: 34 }], [4, { pos: [8.1, .5, 6.5], look: [12.4, 2.3, 2.3] }, 'lin']),
    cast: {
      balloons: K([0, { anchor: [17.2, 3.1, 1.6], lean: [-.7, .1], len: 1.3 }], [4, { anchor: [12.2, 1.2, 2.3], lean: [-.55, .1] }, 'lin']),
      ...grazers(['f4']),
    },
  }),

  // ======================= 7. GRAB: Timmy takes the string ... and goes up =======================
  grab: (m, C) => ({
    hero: ['timmy', 'balloons'],
    cam: lt => { const ty = timmyAt(35 + lt)[1]; return { pos: [2.5, .7 + ty * .3, 5.9], look: [1.15, .42 + ty * .9, 3.0], fov: 32 }; },
    cast: {
      timmy: (lt, t) => {
        const flying = t >= 37.6, pos = flying ? timmyAt(t) : [1.2, 0, 3.0];
        const stand = smooth(1.0, 1.4, lt), grab = smooth(m.grab - .1, m.grab + .1, lt), worry = smooth(5.2, 5.6, lt);
        return { x: pos[0], y: pos[1], z: pos[2], abs: flying, yaw: lerp(80, 20, smooth(3, 5, lt)), up: flying ? 1 : stand, armL: [lerp(70, 165, grab), 12], armR: [lerp(70, 165, grab), 12],
          legs: flying ? [Math.sin(t * 7) * 25, -Math.sin(t * 7) * 25] : [0, 0], headPitch: lerp(10, -10, grab) + worry * 30, headYaw: lerp(-30, 0, stand),
          look: worry ? [0, -.8] : [.3, -.2], smile: lerp(.8, .1, worry), mouth: lt > m.grab && lt < m.grab + .6 ? .6 : worry * .5, eyeWide: 1 + worry * .2, suck: 1, dummy: true };
      },
      balloons: (lt) => lt < m.grab ? { anchor: [lerp(6.2, 1.55, ease.out3(clamp(lt / m.grab))), .14, 3.08], lean: [-.4, 0], len: 1.3 } : { hold: 'timmy', len: 1.3, lean: [-.15, 0] },
      shirley: grazer('shirley'),
    },
  }),

  // ======================= 8. SHOCK: Shaun's take =======================
  shock: (m, C) => ({
    hero: 'shaun',
    cam: K([0, { pos: [-.3, 1.2, 3.7], look: [1.95, 1.2, 2.2], fov: 30 }], [2.5, { pos: [-.15, 1.25, 3.55], look: [1.95, 1.3, 2.2] }, 'lin']),
    cast: {
      shaun: (lt, t) => {
        const take = spring(lt, m.take, 2.6, .35), sq = 1 + wobble(lt, m.take + .05, 3, 5) * .18;
        const dbl = lt > 1.3 && lt < 1.9 ? Math.sin((lt - 1.3) * 26) * 14 * (1 - (lt - 1.3) / .6) : 0;
        return { x: 1.95, z: 2.2, yaw: -63, up: clamp(take), sq, headPitch: -32 + take * 10, headYaw: 8 + dbl, look: [0, .55],
          armL: [take * 22, take * 38], armR: [take * 22, take * 38], ...(lt > m.take ? X.shock : { mouth: 0, smile: .2 }), eyeWide: lt > m.take ? 1.32 : 1,
          pitch: lt > 2.1 ? -8 : 0 };
      },
    },
  }),

  // ======================= 9. LEAP: sprint, jump, miss, faceplant =======================
  leap: (m, C) => {
    const A0 = [1.6, 0, 2.6], A1 = [-.4, 0, 2.7];
    return {
      hero: 'shaun',
      cam: lt => ({ pos: [lerp(3.6, 1.6, smooth(0, 3.4, lt)), .55 + smooth(3, 4, lt) * .35, 6.2], look: [lerp(3.2, .1, smooth(0, 3.4, lt)), lerp(1.2, 1.7, smooth(0, 2.2, lt)) - smooth(3.1, 4, lt) * 1.1, 2.6], fov: 46 }),
      cast: {
        shaun: (lt, t) => {
          if (lt < m.jump) { const u = clamp((lt - m.run) / (m.jump - m.run)); const x = lerp(4.3, A0[0], u);
            return { x, z: lerp(2.1, A0[2], u), yaw: -80, run: 1, gaitAmp: lt > m.run ? 1 : 0, gait: lt * 17, pitch: -4, ...X.shock, mouth: .3, eyeWide: 1.1, ears: 1 }; }
          if (lt < m.plant) { const u = (lt - m.jump) / (m.plant - m.jump), q = arc(A0, A1, u, 1.3);
            return { x: q[0], y: q[1], z: q[2], yaw: -80, up: smooth(0, .25, u) * (1 - smooth(.75, 1, u)), armL: [178, 10], armR: [178, 10], sq: 1 + .15 * Math.sin(u * Math.PI),
              pitch: smooth(.6, 1, u) * 60, headPitch: -40 * (1 - u), look: [0, .8], mouth: .5, eyeWide: 1.15, ears: 1 }; }
          const imp = lt - m.plant, lift = smooth(m.lift, m.lift + .3, lt);
          return { x: A1[0], z: A1[2], yaw: -80, pitch: 38 - lift * 20, lie: .7, legs: [55, 60], sq: 1 - .25 * Math.exp(-imp * 10) * Math.cos(imp * 30),
            headPitch: lerp(30, -28, lift), look: [0, lift * .7], eyeOpen: lift ? .75 : 0, blink: false, lidTilt: lift * -8, smile: -.6, mouth: lt > 5.1 && lt < 5.35 ? .45 : 0, ears: -1 };
        },
        timmy: (lt, t) => { const q = timmyAt(t); return { x: q[0], y: q[1], z: q[2], abs: true, yaw: 20, up: 1, armL: [165, 12], armR: [165, 12], legs: [Math.sin(t * 6) * 20, -Math.sin(t * 6) * 20], look: [0, -.8], headPitch: 25, smile: .9, suck: 1 }; },
        balloons: { hold: 'timmy', len: 1.3 },
        ...grazers(['f1', 'mum', 'f3']),
      },
      fx: (lt) => { C.P.faceGrass.visible = lt > m.plant; C.puff(0, m.plant, lt, [A1[0] - .45, .1, A1[2]], 1.1); C.puff(1, m.plant + .05, lt, [A1[0] - .1, .05, A1[2] + .2], .8); },
    };
  },

  // ======================= 10. TOWER: the sheep pyramid, a hair short, and down it goes =======================
  tower: (m, C) => {
    const lvl = (k, lt) => {             // position of tower level k under the sway/fall angle
      const sway = smooth(m.wobble, m.fall, lt) * 7 * Math.sin((lt - m.wobble) * Math.PI * 2 * 1.25) + smooth(m.wobble + .6, m.fall, lt) * 3;
      const fu = clamp((lt - m.fall) / (m.crash - m.fall)), th = (sway + ease.in(fu) * (78 + k * 6)) * DEG;
      return {
      hero: 'shaun', x: TB[0] - Math.sin(th) * (LV[k] + fu * k * .3), y: Math.cos(th) * LV[k] - fu * .2 * k, z: TB[1] + fu * (k - 1.5) * .25, rootRoll: th / DEG + fu * k * 25 };
    };
    const member = (name, k, run0, runT, jumpT, extra = {}) => (lt, t) => {
      if (lt >= m.crash) { const b = Math.exp(-(lt - m.crash) * 8); return { ...PILE[name], y: (PILE[name].y || 0) + Math.abs(Math.sin((lt - m.crash) * 20)) * .25 * b, sq: 1 - .2 * b }; }
      const L = lvl(k, lt);
      if (lt >= jumpT + .5 || (k === 0 && lt >= runT)) return { ...L, yaw: 0, up: 1, armL: k === 3 ? [178, 8] : [155, 25], armR: k === 3 ? [178, 8] : [155, 25], headPitch: k === 3 ? -40 : -15, look: [0, .7],
        mouth: lt > m.fall ? .8 : .1, eyeWide: lt > m.wobble ? 1.25 : 1, pupil: lt > m.wobble ? .6 : 1, smile: lt > m.wobble ? -.3 : .5, sq: k === 3 ? 1 + smooth(m.reach, m.reach + .5, lt) * .07 : 1, ...extra };
      if (lt >= jumpT && k > 0) { const u = (lt - jumpT) / .5, below = lvl(k - 1, lt), from = [run0[0] + (TB[0] - run0[0]) * 0, 0, run0[1]];
        const land = [TB[0], LV[k], TB[1]], q = arc([runT ? RUNEND[name][0] : 0, 0, RUNEND[name][1]], land, u, .7);
        return { x: q[0], y: q[1], z: q[2], yaw: 0, up: smooth(0, .4, u), armL: [120, 20], armR: [120, 20], sq: 1 + .15 * Math.sin(u * Math.PI), ...extra }; }
      const u = clamp((lt - (runT - 1.6)) / 1.6), e = RUNEND[name];
      return { x: lerp(run0[0], e[0], u), z: lerp(run0[1], e[1], u), yaw: yawTo(run0, e), run: 1, gaitAmp: u > 0 && u < 1 ? 1 : 0, gait: lt * 16, ...extra };
    };
    const RUNEND = { f1: TB, f2: [-1.3, 2.9], f3: [-1.2, 2.3], shaun: [-1.35, 2.55] };
    return {
      cam: lt => { const up = smooth(m.s3, m.reach, lt), down = smooth(m.fall, m.crash, lt);
        const rise = smooth(m.s1, m.reach, lt); return { pos: [.6, 1.0 + rise * .6 - down * .4, 8.8], look: [lerp(-1.2, -2.4, rise) - down * 1.0, .9 + rise * 2.4 + up * .3 - down * 2.3, 2.6], fov: 44, shake: pulse(lt, m.crash, 5) * .08, focus: 6.8 }; },
      cast: {
        f1: member('f1', 0, [4.5, 1.2], m.s1, 99),
        f2: member('f2', 1, [4.8, 4.4], m.s2 - .1, m.s2),
        f3: member('f3', 2, [5.4, 3.0], m.s3 - .1, m.s3),
        shaun: (lt, t) => {
          if (lt < m.s4) { const wh = smooth(m.whistle - .2, m.whistle, lt) * (1 - smooth(m.whistle + .7, m.whistle + .9, lt)), pt = smooth(1.2, 1.5, lt) * (1 - smooth(2.4, 2.8, lt));
            const u = clamp((lt - 3.0) / 1.2);
            return { x: lerp(-.4, -1.35, u), z: lerp(2.7, 2.55, u), yaw: lt < 3 ? -20 : -60, up: smooth(0, .35, lt), gaitAmp: u > 0 && u < 1 ? .7 : 0, gait: lt * 9,
              armL: [lerp(20, 125, wh), lerp(12, -30, wh), wh * 60], armR: pt ? [150, 20] : [lerp(20, 125, wh), lerp(12, -30, wh), wh * 60], mouth: wh * .3, headPitch: pt ? -30 : 0, look: pt ? [0, .7] : [0, 0], smile: .6 }; }
          return member('shaun', 3, [-1.35, 2.55], m.s4 - .1, m.s4)(lt, t);
        },
        timmy: (lt, t) => { const q = timmyAt(t); return { x: q[0], y: q[1], z: q[2], abs: true, yaw: 10, up: 1, armL: [165, 12], armR: [165, 12], legs: [Math.sin(t * 6) * 20, -Math.sin(t * 6) * 20], look: [0, -.8], headPitch: 25, smile: .9, suck: 1 }; },
        balloons: { hold: 'timmy', len: 1.3 },
        ...grazers(['mum', 'f4']),
      },
      fx: (lt) => { C.puff(0, m.crash, lt, [-3.8, .15, 2.6], 1.6); C.puff(1, m.crash + .08, lt, [-4.6, .1, 2.2], 1.2); C.puff(2, m.crash + .04, lt, [-3.0, .1, 2.9], 1.1); },
    };
  },

  // ======================= 11. SNORE: the dummy falls from the sky into Bitzer's mouth =======================
  snore: (m, C) => ({
    hero: 'bitzer',
    cam: K([0, { pos: [-5.85, 1.3, -6.95], look: [-7.1, .8, -8.25], fov: 30 }], [3, { pos: [-5.95, 1.28, -7.1], look: [-7.1, .78, -8.25] }]),
    cast: {
      bitzer: (lt, t) => { const bonk = lt > m.bonk ? Math.exp(-(lt - m.bonk) * 6) : 0, smack = lt > m.bonk + .25 && lt < m.suck ? .25 + .25 * Math.sin((lt - m.bonk) * 22) : 0;
        return { ...ASLEEP, sq: 1 + bonk * .06, headPitch: 8 - bonk * 14, mouth: lt > m.suck ? .05 : smack || .18, smile: lt > m.suck ? .9 : 0, headRoll: lt > m.suck ? 10 : 16, eyeOpen: bonk > .5 ? .25 : 0 }; },
    },
    fx: (lt, t) => {
      const head = C.headPos('bitzer'), nose = head.clone().add(new THREE.Vector3(.12, -.05, .28));
      if (lt < m.bonk) { const u = clamp((lt - m.drop) / (m.bonk - m.drop)); C.P.dummy.visible = lt > m.drop; C.P.dummy.position.set(nose.x, nose.y + 3 * (1 - u * u), nose.z); C.P.dummy.rotation.set(lt * 9, lt * 5, 0); C.P.dummy.scale.setScalar(1.1); }
      else if (lt < m.suck) { const u = (lt - m.bonk) / (m.suck - m.bonk); C.P.dummy.visible = true; C.P.dummy.position.set(nose.x + u * .1, nose.y + Math.sin(u * Math.PI) * .25 - u * .1, nose.z); C.P.dummy.rotation.set(0, 0, u * 6); }
      C.P.bDummy.visible = lt >= m.suck; C.P.bDummy.position.z = .25 + Math.sin(lt * 9) * .012;
      zzz(C, lt, m.suck + .3, head);
    },
  }),

  // ======================= 12. IDEA: out of the heap, a look around, a light bulb =======================
  idea: (m, C) => ({
    hero: 'shaun',
    cam: lt => { const pan = smooth(2.5, 3.5, lt) * (1 - smooth(3.9, 4.5, lt));
      return { pos: [-1.5, 1.3, 6.1], look: [lerp(-3.8, -7.0, pan), lerp(1.05, .8, pan), lerp(2.7, 4.5, pan)], fov: 30 }; },
    cast: {
      f1: { ...PILE.f1, mouth: .2 }, f2: { ...PILE.f2 }, f3: (lt, t) => ({ ...PILE.f3, legs: [20 + Math.sin(t * 5) * 8, -20] }),
      shaun: (lt, t) => { const pop = spring(lt, m.pop, 2.4, .4), dizzy = lt < 2 ? Math.sin(lt * 9) * 14 * (1 - lt / 2) : 0;
        const see = smooth(m.look, m.look + .4, lt) * (1 - smooth(4.0, 4.3, lt)), aha = spring(lt, m.bulb, 3, .35);
        return { x: -3.8, z: 2.65, y: lerp(.35, .72, pop), up: clamp(pop) * .85, sit: .6, yaw: lerp(-10, -5, see), headYaw: see * -55, headRoll: dizzy, headPitch: 5, look: see ? [-.8, 0] : [0, 0],
          eyeOpen: lt < 1.8 ? .55 : 1, blink: lt > 1.8, smile: lt > m.bulb ? 1 : 0, grin: lt > m.bulb ? 1 : 0, ears: lt > m.bulb ? 1 : 0, eyeWide: 1 + aha * .15,
          armR: lt > m.bulb ? [lerp(20, 160, clamp(aha)), 8] : [20, 12], armL: [20, 25], faceGrass: 1 }; },
      shirley: grazer('shirley'),
    },
    fx: (lt) => {
      C.P.faceGrass.visible = lt < 1.2;
      const s = spring(lt, m.bulb, 3.2, .35); if (s > .01) { const h = C.headPos('shaun'); C.P.bulb.visible = true; C.P.bulb.position.set(h.x, h.y + .45, h.z); C.P.bulb.scale.setScalar(s);
        C.P.bulb.userData.glow.intensity = 2.5 * s; C.P.bulb.userData.rays.rotation.z = lt * 1.5; C.P.bulb.userData.rays.scale.setScalar(1 + .15 * Math.sin(lt * 12)); }
    },
  }),

  // ======================= 13. SETUP: measure up, heave Shirley onto the bales =======================
  setup: (m, C) => {
    const top = [-8.35, 1.0, 4.4], high = [-7.7, .98, 4.0];
    return {
      hero: ['shaun', 'shirley'],
      cam: K([0, { pos: [-5.4, 2.4, 13.4], look: [-6.4, 1.2, 4.1], fov: 33 }], [8, { pos: [-5.6, 2.05, 11.4], look: [-6.5, 1.3, 4.1] }, 'lin']),
      cast: {
        shaun: K([0, { x: -3.1, z: 3.3, yaw: -110, up: 1, gaitAmp: .7, smile: .7, armL: [15, 12], armR: [15, 12] }], [1.2, { x: -4.45, z: 4.0, y: .02, gaitAmp: .7 }, 'lin'],
          [1.3, { gaitAmp: 0, y: .24, yaw: -10 }], [m.measure, { headPitch: 0, look: [0, 0], armR: [15, 12], wink: 0 }], [m.measure + .3, { headPitch: -42, look: [0, .8], armR: [98, 2], wink: 1 }],
          [m.measure + 1.2, { headPitch: -42, armR: [98, 2], wink: 1 }], [m.measure + 1.5, { headPitch: -5, look: [-.4, 0], armR: [15, 12], wink: 0, headYaw: -40 }],
          [m.thumbs - .2, { armR: [15, 12] }], [m.thumbs, { armR: [100, -12], wink: 1, grin: 1 }, 'outBack'], [m.thumbs + .9, { armR: [100, -12], wink: 1 }], [m.thumbs + 1.1, { armR: [15, 12], wink: 0, grin: 0, headPitch: -20, look: [-.3, .5] }]),
        shirley: (lt, t) => {
          if (lt < m.push) return { x: -10.4, z: 4.4, yaw: 90, graze: lt < 1.5 ? 1 : 0, headPitch: 0, eyeOpen: 1 };
          if (lt < m.up) { const u = (lt - m.push) / (m.up - m.push), x = lerp(-10.4, top[0], ease.io(u)), y = u < .5 ? ease.out(u * 2) * .5 : .5 + ease.out((u - .5) * 2) * .5;
            return { x, z: 4.4, y: y + Math.abs(Math.sin(lt * 11)) * .03, yaw: 90, rootRoll: Math.sin(lt * 7) * 5, pitch: -8, eyeWide: 1.15, mouth: .3, legs: [Math.sin(lt * 14) * 25, -Math.sin(lt * 14) * 25] }; }
          if (lt < m.jump) { const cr = smooth(m.crouch, m.crouch + .3, lt), nod = lt > m.thumbs + .3 && lt < m.thumbs + .9 ? Math.sin((lt - m.thumbs - .3) * 21) * 12 : 0;
            return { x: top[0], z: top[2], y: top[1], yaw: 105, sq: 1 - cr * .2, headPitch: nod, smile: .8, eyeOpen: 1 }; }
          const u = clamp((lt - m.jump) / 1.2), q = arc(top, high, u, 1.3);
          return { x: q[0], y: q[1], z: q[2], yaw: 105, sq: 1 + .15 * Math.sin(u * Math.PI), legs: [-30, -30], eyeWide: 1.1, mouth: .4, smile: .5 };
        },
        f1: (lt, t) => { const push = smooth(m.push - .5, m.push, lt), u = clamp((lt - m.push) / (m.up - m.push)), fall = smooth(m.up, m.up + .25, lt);
          return { x: lerp(-12, -11.05, push) + ease.io(u) * 1.6, z: 4.15, yaw: 90, up: 1 - fall * .2, pitch: 25 * push * (1 - fall), armL: [95, 5], armR: [95, 5], gaitAmp: push * (1 - fall) * .8, gait: lt * 10, sit: fall, mouth: .3 * push, eyeOpen: push && !fall ? .3 : 1, blink: !push }; },
        f2: (lt, t) => { const push = smooth(m.push - .5, m.push, lt), u = clamp((lt - m.push) / (m.up - m.push)), fall = smooth(m.up + .1, m.up + .35, lt);
          return { x: lerp(-12.2, -11.1, push) + ease.io(u) * 1.6, z: 4.75, yaw: 90, up: 1 - fall * .2, pitch: 25 * push * (1 - fall), armL: [95, 5], armR: [95, 5], gaitAmp: push * (1 - fall) * .8, gait: lt * 10 + 1, sit: fall, mouth: .3 * push, eyeOpen: push && !fall ? .3 : 1, blink: !push }; },
        f3: { ...PILE.f3, x: -2.6, z: 2.0, rootRoll: 0, y: 0, up: 0, eyeOpen: 1, blink: true, mouth: 0, headPitch: -20, look: [-.5, .3], yaw: -60 },
      },
    };
  },

  // ======================= 14. LAUNCH: Shirley lands, Shaun goes up (on ones) =======================
  launch: (m, C) => ({
    hero: 'shaun',
    ones: true,
    cam: lt => { const s = launchAt(79 + lt), w = smooth(.12, .55, lt);
      return { pos: [-2.2, .75, 8.2], look: [lerp(-4.9, s[0], w), lerp(.8, s[1] + .6, w), lerp(4.0, s[2], w)], fov: lerp(34, 40, w), shake: pulse(lt, m.slam, 7) * .06, roll: w * 4, focus: 5 }; },
    cast: {
      shaun: (lt, t) => { const q = launchAt(t), air = lt > .1;
        return { x: q[0], y: air ? q[1] : .24 - lt * .5, z: q[2], abs: true, yaw: -10, up: 1, sq: air ? 1 + .3 * Math.exp(-(lt - .1) * 3) : .8, armL: air ? [176, 12] : [60, 20], armR: air ? [176, 12] : [60, 20],
          legs: air ? [15, -10] : [0, 0], ...X.shock, eyeWide: 1.2, ears: 1, headPitch: -30, look: [0, .8] }; },
      shirley: (lt, t) => { const u = clamp(lt / m.slam); return { x: -7.72, z: 4.0, y: lerp(1.45, .95, ease.in(u)) - (lt > m.slam ? .55 * clamp((lt - m.slam) / .08) : 0), yaw: 105, sq: lt > m.slam ? 1 - .28 * Math.exp(-(lt - m.slam) * 7) : 1.1, smile: 1, grin: 1, eyeOpen: 1 }; },
      f1: { x: -10.6, z: 4.2, yaw: 60, sit: 1, up: .8, headPitch: -40, look: [.6, .8], mouth: .6, eyeWide: 1.2 },
      f2: { x: -10.5, z: 4.9, yaw: 80, sit: 1, up: .8, headPitch: -40, look: [.6, .8], mouth: .6, eyeWide: 1.2 },
    },
    fx: (lt) => { const a = lt < m.slam ? -14 : lerp(-14, 14, ease.out(clamp((lt - m.slam) / .07))) + wobble(lt, m.slam + .07, 6, 7) * 3; C.P.seesaw.pose({ angle: a });
      C.puff(0, m.slam, lt, [-7.7, .1, 4.0], 1.1); C.puff(1, m.slam + .02, lt, [-4.4, .1, 4.1], .8); },
  }),

  // ======================= 15. CATCH: the grab at the top, then the view =======================
  catch: (m, C) => ({
    hero: ['shaun', 'timmy'],
    ones: true,
    cam: lt => { const t = 80.6 + lt, c = t < 81.05 ? [-4.3, 6.3, 3.55] : pairAt(t), o = smooth(2.0, 9.4, lt), a = lerp(18, 118, ease.io(o)) * DEG, R = lerp(4.6, 6.2, o);
      return { pos: [c[0] + Math.sin(a) * R, c[1] + .9 + o * 1.8, c[2] + Math.cos(a) * R], look: [c[0], c[1] + .75 - o * .3, c[2]], fov: 32, focus: R, shadowAt: [c[0], 0, c[2]], shadowSize: 18 }; },
    cast: {
      shaun: (lt, t) => { if (t < 81.05) { const q = launchAt(t); return { x: q[0], y: q[1], z: q[2], abs: true, yaw: -10, up: 1, armL: [176, 12], armR: [176, 12], sq: 1.06, ...X.shock, eyeWide: 1.15, headPitch: -30, look: [0, .8] }; }
        const q = pairAt(t), hug = smooth(81.05, 81.8, t);
        return { x: q[0], y: q[1], z: q[2], abs: true, yaw: lerp(-10, 0, hug), up: 1, armR: [172, 8], armL: [lerp(176, 85, hug), lerp(12, -30, hug)], legs: [Math.sin(t * 2) * 12, -Math.sin(t * 2) * 12],
          headPitch: lerp(-30, -5, hug), look: [0, lerp(.8, .1, hug)], smile: 1, grin: lt > m.hug ? .6 : 0, eyeOpen: lt > 3.2 && lt < 4.2 ? .15 : 1, blink: false, ears: .5 }; },
      timmy: (lt, t) => { if (t < 81.05) { const q = timmyAt(t); return { x: q[0], y: q[1], z: q[2], abs: true, yaw: 10, up: 1, armL: [165, 12], armR: [165, 12], legs: [Math.sin(t * 6) * 20, -Math.sin(t * 6) * 20], look: [0, -.8], headPitch: 30, smile: .6, dummy: false }; }
        return timmyOnShaun(C, { eyeOpen: lt > 3.2 && lt < 4.2 ? .15 : 1, blink: false, headRoll: 10 }); },
      balloons: (lt, t) => t < 81.05 ? { hold: 'timmy', len: 1.3 } : { hold: 'shaun:R', len: 1.3, sway: 1.4 },
    },
  }),

  // ======================= 16. DESCEND: soft landing on Shirley, the flock cheers =======================
  descend: (m, C) => {
    const SH = [-1.2, 4.5];
    const cheer = (x, z, yaw, ph) => (lt, t) => { const u = clamp((lt - .6 - ph * .3) / 2.8), c = smooth(m.cheer, m.cheer + .3, lt);
      const from = [x - 5 + ph * 1.5, z - 2 + ph]; return {
      hero: 'shaun', x: lerp(from[0], x, ease.out(u)), z: lerp(from[1], z, ease.out(u)), yaw: u < 1 ? yawTo(from, [x, z]) : yaw, run: 1, gaitAmp: u > 0 && u < 1 ? 1 : 0, gait: lt * 15 + ph,
        up: c, armL: [170, 20], armR: [170, 20], y: c * Math.abs(Math.sin(t * 8 + ph)) * .18, headPitch: lerp(-30, -10, c), look: [0, lerp(.6, 0, c)], mouth: c * (Math.sin(t * 6 + ph) > 0 ? .7 : .3), ...X.happy, eyeWide: 1.05 }; };
    return {
      cam: lt => ({ pos: [2.0, 1.1, 11.8], look: [lerp(-2.6, -1.2, smooth(0, 4.5, lt)), lerp(3.4, 1.3, smooth(.5, 4.8, lt)), 4.4], fov: 34, shake: pulse(lt, m.land, 6) * .03 }),
      cast: {
        shirley: (lt, t) => { const u = clamp((lt - .3) / 2.9), land = lt > m.land ? Math.exp(-(lt - m.land) * 5) * Math.cos((lt - m.land) * 18) : 0;
          return { x: lerp(-7.6, SH[0], ease.io(u)), z: lerp(4.0, SH[1], u), yaw: u < 1 ? 80 : lerp(80, 20, smooth(3.2, 4, lt)), run: 1, gaitAmp: u > 0 && u < 1 ? 1 : 0, gait: lt * 22,
            sq: 1 - land * .25, headPitch: lt < 4.5 ? -30 : -10, look: [0, lt < 4.5 ? .8 : .2], smile: lt > m.land ? 1 : .2, eyeWide: 1.05 }; },
        shaun: (lt, t) => { if (t < 94.5) { const q = pairAt(t); return { x: q[0], y: q[1], z: q[2], abs: true, yaw: 0, up: 1, armR: [172, 8], armL: [85, -30], legs: [Math.sin(t * 2) * 12, -12], headPitch: 10, look: [0, -.6], smile: .8, ears: .5 }; }
          const b = lt - m.land, bounce = Math.abs(Math.sin(b * 7)) * .5 * Math.exp(-b * 3.5), c = smooth(m.cheer, m.cheer + .3, lt);
          const sh = C.A.shirley.root.position;
          return { x: sh.x, y: sh.y + 1.42 * 1.0 + bounce - (1 - Math.exp(-b * 6)) * .06, z: sh.z, abs: true, yaw: 0, up: 1, sit: .8, armR: [172, 8], armL: [lerp(85, 150, c), lerp(-30, 25, c)], ...X.grin, headPitch: -5, ears: 1 }; },
        timmy: (lt, t) => { if (lt < 5.4) return timmyOnShaun(C, { headPitch: 20, look: [0, -.4] });
          const u = clamp((lt - 5.4) / .8), s = C.A.shaun.root.position, q = arc([s.x + .1, s.y + .6, s.z + .2], [-1.95, ground(-1.95, 5.6), 5.6], u, .5);
          return { x: q[0], y: q[1], z: q[2], abs: true, yaw: 0, up: 1, armL: [lerp(95, 160, u), 15], armR: [lerp(95, 160, u), 15], ...X.happy, smile: 1, mouth: .5, dummy: false }; },
        mum: (lt, t) => { const hug = smooth(6.1, 6.5, lt); return { ...cheer(-2.3, 5.65, 30, 1.3)(lt, t), ...(hug ? { up: 1, armL: [80, -25], armR: [80, -25], yaw: 90, y: 0, eyeOpen: .2, blink: false, smile: 1 } : {}) }; },
        f1: cheer(-3.1, 4.0, 40, 0), f2: cheer(.6, 3.6, -30, .6), f3: cheer(-2.8, 3.0, 20, 1.0), f4: cheer(.2, 5.8, -20, 1.6),
        balloons: { hold: 'shaun:R', len: 1.3 },
      },
      fx: (lt) => { C.puff(0, m.land, lt, [SH[0], 1.3, SH[1] + .2], .7, '#ffffff'); },
    };
  },
});

// staging for the ending
const HORNPOS = { shirley: [-1.2, 4.5, 20], f1: [-3.1, 4.0, 40], f2: [.6, 3.6, -30], f3: [-2.8, 3.0, 20], f4: [.5, 5.1, -20], mum: [-2.3, 5.65, 90] };
const BITZER_SKY = K([113, { x: 3.9, y: 3.2, z: -7.35 }], [114.2, { x: .5, y: 3.4, z: -10.5 }, 'lin'], [117, { x: -2.9, y: 3.9, z: -12.6 }, 'lin'], [120, { x: -.8, y: 7.4, z: -13.5 }, 'lin']);
const floating = (t, extra = {}) => { const q = BITZER_SKY(t); return { x: q.x, y: q.y + Math.sin(t * 1.5) * .08, z: q.z, abs: true, yaw: 90 + (t - 113) * 12, paddle: .6, armR: [165, 8, 10], armL: [20, 20, 30],
  board: 0, eyeOpen: .55, blink: false, smile: -.15, ears: -1, headPitch: 10, legs: [10, -10], ...extra }; };

Object.assign(SHOTS, {
  // ======================= 17. HORN: beep-beep, every head snaps =======================
  horn: (m, C) => {
    const froze = (n, extra = {}) => (lt, t) => { const [x, z, yaw] = HORNPOS[n], snap = lt > m.snap ? 1 : 0, drop = smooth(1.2, 1.9, lt);
      return {
      hero: 'shaun', x, z, yaw, up: n === 'shirley' ? 0 : 1, armL: [lerp(170, 20, drop), 20], armR: [lerp(170, 20, drop), 20], headYaw: snap ? clamp(65 - yaw, -85, 85) : 0, headPitch: snap ? -5 : -10,
        eyeWide: snap ? 1.3 : 1.05, pupil: snap ? .6 : 1, mouth: snap ? .35 : .6, smile: snap ? 0 : .8, ears: snap, ...extra }; };
    return {
      cam: K([0, { pos: [.8, 1.35, 8.7], look: [-1.3, 1.25, 4.6], fov: 34 }], [2, { pos: [.7, 1.33, 8.3], look: [-1.3, 1.2, 4.6] }, 'lin']),
      cast: {
        shirley: froze('shirley', { armL: [0, 0], armR: [0, 0] }), f1: froze('f1'), f2: froze('f2'), f3: froze('f3'), f4: froze('f4'),
        mum: froze('mum', { armL: [80, -25], armR: [80, -25] }),
        timmy: (lt) => ({ x: -1.95, z: 5.6, yaw: -90, up: 1, armL: [150, 15], armR: [150, 15], headYaw: lt > m.snap ? 80 : 0, eyeWide: lt > m.snap ? 1.3 : 1, mouth: .4, dummy: false }),
        shaun: (lt, t) => { const sh = C.A.shirley.root.position, snap = lt > m.snap;
          return { x: sh.x, y: sh.y + 1.36, z: sh.z, abs: true, yaw: 0, up: 1, sit: .8, armR: [172, 8], armL: [150, 25], headYaw: snap ? 65 : 0, ...(snap ? { eyeWide: 1.3, pupil: .6, mouth: .4, ears: 1 } : X.grin) }; },
        balloons: { hold: 'shaun:R', len: 1.3 },
      },
    };
  },

  // ======================= 18. WAKE: Bitzer jolts up, the dummy goes over his shoulder, whistle! =======================
  wake: (m, C) => ({
    hero: 'bitzer',
    cam: K([0, { pos: [-5.45, .95, -6.5], look: [-7.0, .68, -8.2], fov: 31 }], [2, { pos: [-5.3, 1.05, -6.3], look: [-6.6, .9, -8.0] }, 'io']),
    cast: {
      bitzer: (lt, t) => {
        if (lt < m.jolt) return { ...ASLEEP };
        const u = clamp((lt - m.jolt) / .35), st = { x: lerp(CHAIR.x, -6.75, u), z: lerp(CHAIR.z, -7.85, u), y: lerp(CHAIR.y, 0, u) + Math.sin(u * Math.PI) * .45, yaw: CHAIR.yaw, sit: 1 - u, recline: CHAIR.recline * (1 - u), legs: CHAIR.legs.map(v => v * (1 - u)) };
        const wh = smooth(m.whistle - .15, m.whistle, lt), run = smooth(1.55, 1.75, lt), toss = smooth(m.toss - .2, m.toss, lt) * (1 - smooth(m.toss + .05, m.toss + .25, lt));
        return { ...st, x: st.x + run * (lt - 1.55) * 2.4, z: st.z + run * (lt - 1.55) * 1.2, yaw: lerp(CHAIR.yaw, 70, run), gaitAmp: run, run: 1, gait: lt * 16, board: 0, phones: 0,
          eyeWide: 1.4 - wh * .3, pupil: .5, brow: 1, mouth: wh ? .15 : .5, eyeOpen: 1, blink: false, ears: 1, sq: 1 + pulse(lt, m.jolt, 8) * .2,
          armR: wh ? [128, 8, 130] : toss ? [lerp(40, 125, toss), 10, 120] : [40, 30, 40], armL: [60, 35, 30], whistleUp: wh > .5 ? 1 : 0 };
      },
    },
    fx: (lt) => {
      C.P.bDummy.visible = lt < m.toss;
      if (lt >= m.toss) { const h = C.headPos('bitzer'), u = (lt - m.toss) / 1.2; C.P.dummy.visible = u < 1; C.P.dummy.scale.setScalar(1.1);
        C.P.dummy.position.set(h.x - u * 1.8, h.y + .1 + u * 2.2 - u * u * 2.6, h.z - u * 1.4); C.P.dummy.rotation.set(u * 14, u * 9, 0); C.P.dummy.scale.setScalar(1.1); }
      if (lt >= m.jolt) { const h = C.headPos('bitzer'), u = (lt - m.jolt) / .9, ph = C.P.flyPhones; ph.visible = u < 1;
        ph.position.set(h.x + .3 * u, h.y + .1 + u * 1.6 - u * u * 1.2, h.z + .2 * u); ph.rotation.set(u * 10, u * 4, u * 6); ph.scale.setScalar(1.55); }
    },
  }),

  // ======================= 19. LINE-UP: scramble, innocence =======================
  lineup: (m, C) => {
    const FROM = { f1: [-3.1, 4.0], f2: [.6, 3.6], shirley: [-1.2, 4.5], mum: [-2.3, 5.65], timmy: [-1.95, 5.6], f3: [-2.8, 3.0], f4: [.2, 5.8], shaun: [-.4, 4.1] };
    const ARR = { f1: 1.2, f2: 1.1, shirley: 1.95, mum: 1.45, timmy: 1.7, f3: 1.3, f4: 1.5, shaun: 1.6 };
    const runner = n => (lt, t) => {
      const a = FROM[n], b = [LINE[n], LZ], u = clamp(lt / ARR[n]), e = n === 'shirley' ? ease.in(u) : ease.io(u), done = lt > ARR[n];
      const inno = smooth(m.still, m.still + .3, lt);
      return {
      hero: 'bitzer', x: lerp(a[0], b[0], e), z: lerp(a[1], b[1], e), yaw: done ? 180 : yawTo(a, b), run: 1, gaitAmp: done ? 0 : 1, gait: lt * (n === 'shirley' ? 24 : 16),
        sq: done ? 1 - .12 * Math.exp(-(lt - ARR[n]) * 9) * Math.cos((lt - ARR[n]) * 30) : 1, up: n === 'shaun' || n === 'timmy' ? inno : 0,
        look: [Math.sin(t * .7 + LINE[n]) * .3 * inno, .45 * inno], headPitch: -12 * inno, mouth: inno ? .12 : 0, smile: .4, eyeOpen: inno ? .8 : 1, roll: inno * Math.sin(t * 2 + LINE[n]) * 3,
        ...(n === 'shaun' ? { armL: [-40, 20], armR: [-40, 20], grin: .5 * inno } : {}), ...(n === 'timmy' ? { dummy: true, suck: 1, armL: [15, 12], armR: [15, 12] } : {}) };
    };
    return {
      cam: K([0, { pos: [-8.9, 2.5, -9.3], look: [.2, .5, -5.9], fov: 36 }], [5, { pos: [-8.6, 2.3, -9.2], look: [.5, .6, -6.2] }, 'lin']),
      cast: {
        ...Object.fromEntries(Object.keys(LINE).map(n => [n, runner(n)])),
        balloons: { hold: 'shaun', len: 1.2 },
        bitzer: K([0, { x: -5.0, z: -9.8, yaw: 120, gaitAmp: 1, run: 1, board: 1, armL: [70, 8, 85] }], [2.4, { x: -3.9, z: -7.4, gaitAmp: 1 }, 'lin'], [2.5, { gaitAmp: 0, yaw: 0 }],
          [2.6, { armR: [40, 10, 40], whistleUp: 0 }], [2.75, { armR: [128, 8, 130], whistleUp: 1, eyeOpen: .3 }], [3.3, { armR: [128, 8, 130], whistleUp: 1 }], [3.45, { armR: [45, 5, 60], whistleUp: 0, eyeOpen: 1, squint: .5, lidTilt: 10, yaw: 90, headYaw: -70 }],
          [3.5, { x: -3.9, gaitAmp: 0 }], [3.6, { gaitAmp: .6 }], [5, { x: -1.9, gaitAmp: .6 }, 'lin']),
      },
    };
  },

  // ======================= 20. BUSTED: the balloons change hands =======================
  busted: (m, C) => {
    const liftY = lt => lt < m.lift ? 0 : 3.2 * ease.in(clamp((lt - m.lift) / 1.8));
    return {
      hero: ['shaun', 'bitzer'],
      cam: lt => { const by = liftY(lt); return { pos: [5.9, 1.45 + by * .3, -9.9], look: [3.9, 1.35 + by * .8, -6.6], fov: 36 }; },
      cast: {
        bitzer: (lt, t) => {
          const walk = clamp(lt / m.stop), turned = smooth(m.stop - .1, m.stop + .2, lt), up = smooth(m.lookup, m.lookup + .2, lt) * (1 - smooth(m.lookup + .6, m.lookup + .8, lt));
          const take = smooth(m.hand, m.hand + .35, lt), spin = smooth(m.lift + .3, m.deadpan, lt), by = liftY(lt);
          return { x: lerp(1.0, 3.9, walk), z: -7.35, y: by, abs: false, yaw: lerp(90, 0, turned) + spin * 140, gaitAmp: walk < 1 ? .6 : 0, headYaw: lerp(-70, 0, turned), headPitch: up * -42 + (1 - up) * 0,
            look: up ? [0, .8] : [0, 0], squint: lerp(.55, 0, take), lidTilt: lerp(10, 0, take), brow: lt > m.lookup + .8 && lt < m.hand ? 1 : 0, board: take < .5 ? 1 : 0,
            armR: by > 0 ? [165, 8, 10] : [lerp(45, 85, take), 5, lerp(60, 20, take)], armL: [70, 8, 85 - take * 50], paddle: smooth(m.lift + .4, m.lift + .8, lt) * .8,
            ...(lt > m.deadpan ? { eyeOpen: .55, blink: false, smile: -.15, ears: -1, look: [0, 0], headYaw: 0, headPitch: 8 } : {}) };
        },
        shaun: (lt, t) => { const give = smooth(m.hand - .1, m.hand + .3, lt), wave = smooth(m.deadpan, m.deadpan + .3, lt);
          return { x: LINE.shaun, z: LZ, yaw: 180, up: 1, armR: give < 1 && lt < m.hand + .5 ? [lerp(-40, 80, give), lerp(20, 5, give)] : [lerp(80, 15, smooth(m.hand + .5, m.hand + .9, lt)), 10],
            armL: wave ? [150, 30 + Math.sin(t * 14) * 20] : [lerp(-40, 15, give), 20], grin: lt > m.lookup + .6 ? 1 : .4, smile: 1, look: lt > m.lookup + .6 && lt < m.hand ? [.6, .2] : [0, lt > m.lift ? .6 : 0],
            headPitch: lt > m.lift ? -30 : 0, headRoll: lt > m.lookup + .6 && lt < m.hand ? 10 : 0 }; },
        f4: (lt, t) => ({ x: LINE.f4, z: LZ, yaw: 180, look: [.4, .3], smile: .4, headPitch: lt > m.lift + .6 ? -30 : 0 }),
        f3: (lt, t) => ({ x: LINE.f3, z: LZ, yaw: 180, look: [.4, .3], smile: .4, headPitch: lt > m.lift + .8 ? -30 : 0 }),
        balloons: (lt) => ({ hold: 'shaun', hold2: 'bitzer', mix: smooth(m.hand, m.hand + .4, lt), len: 1.55, lean: [0, lt < m.hand ? .7 : 0] }),
      },
    };
  },

  // ======================= 21. FARMER BACK: all in order ... apart from the dog in the sky =======================
  farmback: (m, C) => {
    const carTr = K([0, { x: 19 }], [m.stop, { x: -4.6 }, 'out3']);
    return {
      hero: 'car',
      cam: K([0, { pos: [2.2, 2.8, -3.3], look: [-3.6, 1.35, -14.4], fov: 40, focus: 12, aperture: .0014 }], [4, { pos: [2.0, 2.75, -3.7], look: [-3.5, 1.6, -14.4] }, 'lin']),
      cast: {
        car: (lt, t) => { const x = carTr(lt).x, st = lt - m.stop, nod = lt > m.nod && lt < m.nod + .7 ? Math.sin((lt - m.nod) * 18) * 10 : 0;
          return { x, z: laneCurve(x), yaw: -90, engine: 1, spin: (x - 19) / .24, tilt: st > 0 ? wobble(lt, m.stop, 2.5, 5) * 4 : 0, fYaw: lt > m.stop - .5 ? 72 : 20, fPitch: nod, fSmile: lt > m.nod ? 1.2 : .6 }; },
        ...Object.fromEntries(Object.keys(LINE).filter(n => n !== 'timmy').map((n, i) => [n, (lt, t) => ({ x: LINE[n], z: LZ, yaw: 180, headPitch: -48 * smooth(m.up + i * .08, m.up + .3 + i * .08, lt), look: [0, .5 * smooth(m.up, m.up + .3, lt)], ...(n === 'shaun' ? { up: 1 } : {}) })])),
        timmy: (lt, t) => ({ x: LINE.timmy, z: LZ, yaw: 180, up: 1, dummy: true, suck: 1, headPitch: -45 * smooth(m.up + .3, m.up + .6, lt) }),
        bitzer: (lt, t) => floating(113 + lt),
        balloons: { hold: 'bitzer', len: 1.2 },
      },
    };
  },

  // ======================= 22. THE END: letters, a "Baa!", a wink, iris out =======================
  end: (m, C) => {
    const endT = C.text('THE END', { size: .8 }), Z = 5.2, g0 = ground(0, Z);
    return {
      hero: 'shaun',
      cam: lt => ({ pos: [.5, 1.2, 10.4], look: [lerp(.2, .9, smooth(m.wink, m.iris + .4, lt)), .95, Z], fov: 34, irisOn: lt > m.pop + .2 ? 'shaun' : null, iris: lt < m.iris ? 10 : lt < m.iris + .45 ? lerp(2.2, .17, ease.out3((lt - m.iris) / .45)) : lt < 2.6 ? .17 : lerp(.17, 0, ease.in3(clamp((lt - 2.6) / .3))), fade: smooth(2.85, 3, lt) }),
      cast: {
        shaun: (lt, t) => { if (lt < m.pop) return { x: 4, z: Z + .9, y: -3, vis: false };
          const u = clamp((lt - m.pop) / .35), q = arc([3.4, 0, Z + .9], [1.75, 0, Z + .85], u, .8), baa = lt > m.baa && lt < m.baa + .45, land = lt - m.pop - .35;
          return { x: q[0], y: q[1], z: q[2], yaw: -8, up: 1, sq: land > 0 ? 1 - .15 * Math.exp(-land * 9) * Math.cos(land * 28) : 1.08, armL: baa ? [60, 45] : [20, 15], armR: lt > m.wink ? [100, -12] : baa ? [60, 45] : [20, 15],
            mouth: baa ? .95 : 0, headPitch: baa ? -12 : 0, wink: lt > m.wink ? 1 : 0, grin: lt > m.wink ? 1 : 0, smile: 1, ears: baa ? 1 : .3 }; },
        ...grazers(['f1', 'f2', 'mum']),
      },
      fx: (lt) => { endT.group.visible = true; endT.group.position.set(-.4, g0, Z); endT.letters.forEach((L, i) => C.letterDrop(L, lt, m.letters + i * .1, 0, 4.5)); },
    };
  },
});
