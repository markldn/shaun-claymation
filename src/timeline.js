// timeline.js: the one source of timing, shared by the picture (window.T) and tools/audio.mjs (require).
// Each shot has local marks (m) that the animation keys AND the sound cues both read, so a boing can't miss its landing.
(function (g) {
  const T = {
    title: 'Shaun the Sheep in "Up, Up & Baa-way!"',
    W: 1920, H: 1080, FPS: 24, DUR: 120,
    loudness: -16,
    shots: [
      { id: 'open',     start: 0,     end: 8,     m: { letters: 3.3, top: 4.5, sub: 5.4, peek: 6.35, wink: 7.2 } },
      { id: 'farmer',   start: 8,     end: 15,    m: { engine: .5, wave: 1.4, horn: 2.1, go: 3.0 } },
      { id: 'count',    start: 15,    end: 19.5,  m: { tick: 1.2, whistle: 3.4 } },
      { id: 'nap',      start: 19.5,  end: 24,    m: { sit: 1.3, phones: 2.1, sleep: 3.0 } },
      { id: 'bored',    start: 24,    end: 31,    m: { sigh: 1.2, squeak: 4.6 } },
      { id: 'balloons', start: 31,    end: 35,    m: {} },
      { id: 'grab',     start: 35,    end: 42,    m: { grab: 1.7, lift: 2.6 } },
      { id: 'shock',    start: 42,    end: 44.5,  m: { take: .45 } },
      { id: 'leap',     start: 44.5,  end: 51,    m: { run: .2, jump: 1.8, plant: 3.05, lift: 4.6 } },
      { id: 'tower',    start: 51,    end: 62,    m: { whistle: .4, s1: 2.6, s2: 3.4, s3: 4.4, s4: 5.6, reach: 6.6, wobble: 7.8, fall: 9.4, crash: 10.6 } },
      { id: 'snore',    start: 62,    end: 65,    m: { drop: .15, bonk: .75, suck: 1.5 } },
      { id: 'idea',     start: 65,    end: 71,    m: { pop: .5, look: 2.2, bulb: 4.4 } },
      { id: 'setup',    start: 71,    end: 79,    m: { measure: 1.6, push: 2.3, up: 4.6, thumbs: 5.3, crouch: 6.2, jump: 6.8 } },
      { id: 'launch',   start: 79,    end: 80.6,  m: { slam: .08 } },
      { id: 'catch',    start: 80.6,  end: 90,    m: { grab: .45, hug: 1.2 } },
      { id: 'descend',  start: 90,    end: 97,    m: { land: 4.5, cheer: 5.1 } },
      { id: 'horn',     start: 97,    end: 99,    m: { horn: .15, snap: .45 } },
      { id: 'wake',     start: 99,    end: 101,   m: { jolt: .2, toss: .75, whistle: 1.2 } },
      { id: 'lineup',   start: 101,   end: 106,   m: { still: 1.9 } },
      { id: 'busted',   start: 106,   end: 113,   m: { stop: 3.2, lookup: 3.6, hand: 4.4, lift: 5.2, deadpan: 6.2 } },
      { id: 'farmback', start: 113,   end: 117,   m: { stop: 2.2, nod: 2.7, up: 3.1 } },
      { id: 'end',      start: 117,   end: 120,   m: { letters: .2, pop: .95, baa: 1.35, wink: 1.9, iris: 2.1 } },
    ],
  };
  T.shot = id => T.shots.find(s => s.id === id);
  if (typeof module !== 'undefined' && module.exports) module.exports = T; else g.T = T;
})(typeof window !== 'undefined' ? window : globalThis);
