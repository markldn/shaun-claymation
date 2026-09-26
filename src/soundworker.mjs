// soundworker.mjs: synthesises the soundtrack off the main thread when the page opens (a few seconds of CPU).
import { renderSoundtrack } from './synth.mjs';
self.onmessage = async ({ data }) => {
  try {
    const T = data.T; T.shot = id => T.shots.find(s => s.id === id);
    const score = (await import('./score.mjs')).default;
    const t0 = performance.now(), { L, R, SR } = renderSoundtrack(T, score, 44100);
    // loudness: gated mean-square over 400 ms blocks (a K-weighting-free LUFS estimate) -> target, peak <= -1 dBFS
    const blk = Math.round(SR * .4), ms = [];
    for (let i = 0; i + blk <= L.length; i += blk) { let s = 0; for (let j = i; j < i + blk; j++) s += L[j] * L[j] + R[j] * R[j]; ms.push(s / blk); }
    const lufs = v => -.691 + 10 * Math.log10(v + 1e-12), abs = ms.filter(v => lufs(v) > -70), m0 = abs.reduce((a, b) => a + b, 0) / (abs.length || 1);
    const gated = abs.filter(v => lufs(v) > lufs(m0) - 10), I = lufs(gated.reduce((a, b) => a + b, 0) / (gated.length || 1));
    let peak = 0; for (let j = 0; j < L.length; j++) peak = Math.max(peak, Math.abs(L[j]), Math.abs(R[j]));
    const g = Math.min(10 ** (((T.loudness ?? -16) - I) / 20), .89 / (peak || 1));
    for (let j = 0; j < L.length; j++) { L[j] *= g; R[j] *= g; }
    self.postMessage({ L, R, SR, ms: performance.now() - t0 }, [L.buffer, R.buffer]);
  } catch (e) { self.postMessage({ error: String(e.stack || e) }); }
};
