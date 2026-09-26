// main.js: renderer + compositor. window.renderAt(t) draws the frame for time t (pure: every actor and prop is
// re-posed from the story each frame), window.ready flags the headless renderer.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { buildMaterials, TX } from './clay.js';
import { buildSet, poseSmoke } from './set.js';
import { buildStory } from './story.js';
import { hash } from './lib.js';

const T = window.T;
const Q = new URLSearchParams(location.search);
const W = +(Q.get('w') || T.W), H = +(Q.get('h') || T.H);
const canvas = document.getElementById('c'); canvas.width = W; canvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, W / H, .05, 2000);

buildMaterials();
// environment: a soft sky/ground gradient for reflections on glossy eyes and balloons
{
  const env = new THREE.Scene();
  const g = new THREE.SphereGeometry(10, 32, 16);
  env.add(new THREE.Mesh(g, new THREE.ShaderMaterial({ side: THREE.BackSide, vertexShader: 'varying vec3 p; void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec3 p; void main(){ vec3 sky=mix(vec3(.9,.95,1.),vec3(.45,.65,1.),smoothstep(0.,.8,p.y)); vec3 gr=vec3(.35,.45,.2); vec3 c=p.y>0.?sky:gr; c+=vec3(3.,2.8,2.4)*pow(max(dot(p,normalize(vec3(.5,.7,.4))),0.),64.); gl_FragColor=vec4(c,1.);}' })));
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, .02).texture; scene.environmentIntensity = .55;
}
const sun = new THREE.DirectionalLight('#fff0d8', 3.2); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02; sun.shadow.radius = 4;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight('#bcd8ff', '#6f8a45', 1.1); scene.add(hemi);
const rim = new THREE.DirectionalLight('#ffe6c8', .8); scene.add(rim, rim.target);
scene.fog = new THREE.Fog('#cfe0ee', 80, 420);

const SET = buildSet(scene);
const story = await buildStory(scene, SET, camera);

// ---- post ----
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, W, H); gtao.output = GTAOPass.OUTPUT.Default; gtao.blendIntensity = .85;
gtao.updateGtaoMaterial({ radius: .35, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 16, distanceFallOff: 1 });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
composer.addPass(gtao);
const bokeh = new BokehPass(scene, camera, { focus: 10, aperture: .0025, maxblur: .006 }); composer.addPass(bokeh);
composer.addPass(new OutputPass());
const film = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, frame: { value: 0 }, res: { value: new THREE.Vector2(W, H) }, weave: { value: new THREE.Vector2() },
    flicker: { value: 1 }, fade: { value: 0 }, fadeCol: { value: new THREE.Color(0, 0, 0) }, vig: { value: .32 }, grain: { value: .035 }, warm: { value: .04 }, iris: { value: 2 }, irisC: { value: new THREE.Vector2(.5, .5) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float frame, flicker, fade, vig, grain, warm, iris; uniform vec2 res, weave, irisC; uniform vec3 fadeCol; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = (vUv - .5) * .994 + .5 + weave;
      vec3 c = texture2D(tDiffuse, uv).rgb;
      // grade: warm highlights, cool-green shadows, gentle S-curve
      float l = dot(c, vec3(.299, .587, .114));
      c += warm * vec3(1., .45, -.2) * smoothstep(.45, 1., l) + warm * vec3(-.3, .05, .35) * (1. - smoothstep(0., .35, l));
      c = mix(c, c * c * (3. - 2. * c), .18);
      c = mix(vec3(l), c, 1.06);
      c *= flicker;
      vec2 d = (vUv - .5) * vec2(1., .82); c *= mix(1., smoothstep(.95, .28, length(d)), vig);
      c += (h(vUv * res + frame * 1.37) - .5) * grain;
      // iris wipe (classic cartoon ending)
      vec2 q = (vUv - irisC) * vec2(res.x / res.y, 1.); float ir = smoothstep(iris, iris - .004, length(q));
      c = mix(fadeCol, c, ir);
      c = mix(c, fadeCol, fade);
      gl_FragColor = vec4(c, 1.);
    }` });
composer.addPass(film);

// ---- frame ----
const tmpV = new THREE.Vector3();
function renderFrame(t) {
  const f = Math.round(t * T.FPS);
  const S = story.apply(t);          // poses everything, returns camera/light/post settings
  // light
  const L = S.light;
  sun.color.set(L.sun); sun.intensity = L.sunI;
  const az = L.az * Math.PI / 180, el = L.el * Math.PI / 180;
  const dir = tmpV.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const focusPt = S.shadowAt;
  sun.target.position.copy(focusPt); sun.position.copy(focusPt).addScaledVector(dir, 60);
  const sz = S.shadowSize; Object.assign(sun.shadow.camera, { left: -sz, right: sz, top: sz, bottom: -sz, near: 1, far: 160 }); sun.shadow.camera.updateProjectionMatrix();
  rim.position.copy(focusPt).add(new THREE.Vector3(-dir.x * 40, 25, -dir.z * 40)); rim.target.position.copy(focusPt); rim.intensity = L.rimI; rim.color.set(L.rim);
  hemi.color.set(L.skyC); hemi.groundColor.set(L.groundC); hemi.intensity = L.hemiI;
  scene.fog.color.set(L.fog);
  SET.sky.material.uniforms.top.value.set(L.skyTop); SET.sky.material.uniforms.mid.value.set(L.skyMid); SET.sky.material.uniforms.hor.value.set(L.skyHor);
  SET.sky.material.uniforms.sunDir.value.copy(dir); SET.sky.material.uniforms.sunCol.value.set(L.sun);
  renderer.toneMappingExposure = L.exposure;
  SET.sky.position.copy(camera.position);
  poseSmoke(SET, t);
  // stop-motion "boil": the clay surface shifts a hair between each 12 fps pose
  const step = Math.floor(t * 12 + 1e-6);
  TX.thumb.offset.set(hash(step, 1) * .004, hash(step, 2) * .004); TX.wool.offset.set(hash(step, 3) * .003, hash(step, 4) * .003);
  // post
  bokeh.uniforms.focus.value = S.focus; bokeh.uniforms.aperture.value = S.aperture; bokeh.uniforms.maxblur.value = S.maxblur;
  bokeh.enabled = S.aperture > 0;
  film.uniforms.frame.value = f;
  film.uniforms.weave.value.set((hash(f, 7) - .5) * .0007, (hash(f, 8) - .5) * .0007);
  film.uniforms.flicker.value = 1 + (hash(step, 9) - .5) * .018;
  film.uniforms.fade.value = S.fade; film.uniforms.iris.value = S.iris; film.uniforms.irisC.value.set(...S.irisC);
  composer.render();
}

window.renderAt = (t, type = 'image/jpeg', q = .95) => { renderFrame(t); return canvas.toDataURL(type, q); };
window.renderFrame = renderFrame;
window.story = story;

// ---- live preview (index.html without ?render) ----
if (!Q.has('render')) {
  const ui = document.getElementById('ui'); ui.hidden = false;
  const range = document.getElementById('t'), lab = document.getElementById('lab'), audio = document.getElementById('au');
  range.max = T.DUR; range.step = 1 / T.FPS;
  let playing = false, t0 = 0, s0 = 0;
  const show = t => { renderFrame(t); const sh = T.shots.find(s => t >= s.start && t < s.end); lab.textContent = `${t.toFixed(2)} s   ${sh ? sh.id : ''}`; };
  range.oninput = () => { playing = false; audio.pause(); show(+range.value); };
  document.getElementById('play').onclick = () => { playing = !playing; if (playing) { t0 = performance.now(); s0 = +range.value; audio.currentTime = s0; audio.play().catch(() => {}); loop(); } else audio.pause(); };
  const loop = () => { if (!playing) return; const t = s0 + (performance.now() - t0) / 1000; if (t >= T.DUR) { playing = false; return; } range.value = t; show(t); requestAnimationFrame(loop); };
  const jump = document.getElementById('shots');
  T.shots.forEach(s => { const b = document.createElement('button'); b.textContent = s.id; b.onclick = () => { range.value = s.start + .01; show(s.start + .01); }; jump.appendChild(b); });
  show(+(Q.get('t') || 0));
}
window.ready = true;
