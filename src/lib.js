// lib.js: pure helpers. Nothing here reads a clock or Math.random, so every frame is a function of t.
export const PI = Math.PI, TAU = PI * 2, DEG = PI / 180;
export const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const invlerp = (a, b, v) => clamp((v - a) / (b - a));
export const smooth = (a, b, v) => { const t = invlerp(a, b, v); return t * t * (3 - 2 * t); };
export const fract = x => x - Math.floor(x);

export const ease = {
  lin: t => t,
  in: t => t * t, out: t => 1 - (1 - t) * (1 - t),
  io: t => -(Math.cos(PI * t) - 1) / 2,                       // inOutSine: the default, gentle
  io3: t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
  in3: t => t ** 3, out3: t => 1 - (1 - t) ** 3,
  out5: t => 1 - (1 - t) ** 5, in5: t => t ** 5,
  outBack: t => { const s = 1.9; return 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2; },
  inBack: t => { const s = 1.7; return (s + 1) * t ** 3 - s * t * t; },
  outElastic: t => t === 0 ? 0 : t === 1 ? 1 : 2 ** (-9 * t) * Math.sin((t * 9 - .75) * (TAU / 3)) + 1,
  outBounce: t => { const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375; return n * (t -= 2.625 / d) * t + .984375; },
  step: t => t < 1 ? 0 : 1, hold: t => 0,
};
export const p = (t, a, b, e = 'io') => ease[e](clamp((t - a) / (b - a)));
export const pulse = (t, at, k = 8) => t < at ? 0 : Math.exp(-(t - at) * k);
// Damped spring 0 -> 1 started at `at`.
export const spring = (t, at = 0, freq = 3, damp = .4) => {
  const x = t - at; if (x <= 0) return 0;
  const w = TAU * freq, wd = w * Math.sqrt(1 - damp * damp);
  return 1 - Math.exp(-damp * w * x) * (Math.cos(wd * x) + (damp * w / wd) * Math.sin(wd * x));
};
// Decaying wobble started at `at` (for impacts): sin * exp.
export const wobble = (t, at, freq = 4, decay = 4) => t < at ? 0 : Math.sin((t - at) * freq * TAU) * Math.exp(-(t - at) * decay);

export const hash = (i, s = 0) => { let h = (i * 374761393 + s * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
export const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// Value noise, range ~[-1, 1].
const h3 = (x, y, z) => hash(x * 73856093 ^ y * 19349663 ^ z * 83492791, 11) * 2 - 1;
const sm = t => t * t * (3 - 2 * t);
export function noise3(x, y = 0, z = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h3(xi, yi, zi), h3(xi + 1, yi, zi), xf), L(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), xf), yf),
           L(L(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), xf), L(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), xf), yf), zf);
}
export const fbm = (x, y, z = 0, oct = 4) => { let s = 0, a = .5, f = 1; for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); a *= .5; f *= 2.03; } return s; };

// ---------- keyframe tracks ----------
// keys: [[t, {param: value | [v...]}, ease?], ...]. Each param interpolates between the keys that mention it,
// using the ease of the key it is travelling TO. Before its first key a param holds that value; after its last, too.
export function track(keys) {
  const by = {};
  for (const [t, obj, e] of keys) for (const k in obj) (by[k] ||= []).push([t, obj[k], obj._e?.[k] || e || 'io']);
  delete by._e;
  for (const k in by) by[k].sort((a, b) => a[0] - b[0]);
  const f = lt => {
    const out = {};
    for (const k in by) {
      const L = by[k];
      if (lt <= L[0][0]) { out[k] = L[0][1]; continue; }
      if (lt >= L[L.length - 1][0]) { out[k] = L[L.length - 1][1]; continue; }
      let i = 1; while (L[i][0] < lt) i++;
      const [t0, v0] = L[i - 1], [t1, v1, e] = L[i];
      const u = ease[e]((lt - t0) / (t1 - t0));
      if (typeof v0 === 'number' && typeof v1 === 'number') out[k] = v0 + (v1 - v0) * u;
      else if (Array.isArray(v0)) out[k] = v0.map((a, j) => a + ((v1[j] ?? a) - a) * u);
      else out[k] = u < 1 ? v0 : v1;                      // booleans / strings switch at the key
    }
    return out;
  };
  f.keys = by;
  return f;
}
// Distance travelled in x/z along a track from 0 to lt (for gait phase), by sampling.
export function travelled(tr, lt, t0 = 0) {
  if (!tr.keys.x && !tr.keys.z) return 0;
  const n = Math.max(2, Math.ceil((lt - t0) * 24)); let d = 0, prev = tr(t0);
  for (let i = 1; i <= n; i++) { const q = tr(t0 + (lt - t0) * i / n); d += Math.hypot((q.x ?? 0) - (prev.x ?? 0), (q.z ?? 0) - (prev.z ?? 0)); prev = q; }
  return d;
}
// Ballistic arc helper: position at u in [0,1] from a to b with apex height h above the higher end.
export const arc = (a, b, u, h) => { const y = lerp(a[1], b[1], u) + 4 * h * u * (1 - u); return [lerp(a[0], b[0], u), y, lerp(a[2], b[2], u)]; };
