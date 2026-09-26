// sound.js: the soundtrack in the page. The worker synthesises it at load; Web Audio plays it from any offset.
export function createSound(T, onStatus = () => {}) {
  let data = null, ctx = null, buffer = null, src = null;
  const worker = new Worker(new URL('./soundworker.mjs', import.meta.url), { type: 'module' });
  const plain = JSON.parse(JSON.stringify({ ...T, shot: undefined }));
  onStatus('building soundtrack...');
  worker.onmessage = ({ data: d }) => {
    if (d.error) { onStatus('sound failed: ' + d.error.split('\n')[0]); console.error(d.error); return; }
    data = d; onStatus(`sound ready (${(d.ms / 1000).toFixed(1)} s to synthesise)`); worker.terminate();
  };
  worker.postMessage({ T: plain });
  const ensure = () => {
    if (!data) return false;
    ctx ||= new AudioContext();
    if (!buffer) { buffer = ctx.createBuffer(2, data.L.length, data.SR); buffer.copyToChannel(data.L, 0); buffer.copyToChannel(data.R, 1); }
    return true;
  };
  return {
    get ready() { return !!data; },
    play(t) { this.stop(); if (!ensure()) return; ctx.resume(); src = ctx.createBufferSource(); src.buffer = buffer; src.connect(ctx.destination); src.start(0, Math.max(0, t)); },
    stop() { if (src) { try { src.stop(); } catch {} src.disconnect(); src = null; } },
  };
}
