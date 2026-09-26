// text.js: 3D clay letters from a TTF (opentype.js outlines -> THREE.Shape -> bevelled extrusion),
// one mesh per letter so each can drop, squash and wobble on its own. A dark outline layer sits behind the face.
import * as THREE from 'three';
import * as opentype from '../vendor/opentype.min.mjs';
import { mesh, lumpy } from './clay.js';

const fonts = {};
export async function loadFont(name, url) { const buf = await (await fetch(url)).arrayBuffer(); fonts[name] = opentype.parse(buf); return fonts[name]; }

function glyphShapes(font, ch, size) {
  const path = font.getPath(ch, 0, 0, size), sp = new THREE.ShapePath();
  for (const c of path.commands) {
    if (c.type === 'M') sp.moveTo(c.x, -c.y); else if (c.type === 'L') sp.lineTo(c.x, -c.y);
    else if (c.type === 'Q') sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
    else if (c.type === 'C') sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
  }
  return sp.toShapes(false);
}
// Returns { group, letters: [{ g, x, w, ch }], width }. Baseline at y=0, text centred on x=0, facing +Z.
export function clayText(str, { font = 'title', size = 1, depth = .22, mat, edgeMat, edge = .045, spacing = .02, seed = 1 } = {}) {
  const f = fonts[font], group = new THREE.Group(), letters = [];
  let x = 0;
  for (const [i, ch] of [...str].entries()) {
    const adv = f.getAdvanceWidth(ch, size);
    if (ch.trim()) {
      const shapes = glyphShapes(f, ch, size);
      const bb = f.getPath(ch, 0, 0, size).getBoundingBox();
      const cx = (bb.x1 + bb.x2) / 2;
      const g = new THREE.Group();
      const face = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: depth * .35, bevelSize: size * .035, bevelSegments: 4, curveSegments: 10 });
      face.translate(-cx, 0, 0);
      const m = mesh(face, mat); g.add(m);
      if (edgeMat) {
        const back = new THREE.ExtrudeGeometry(shapes, { depth: depth * .6, bevelEnabled: true, bevelThickness: depth * .3, bevelSize: edge * size, bevelOffset: edge * size * .6, bevelSegments: 3, curveSegments: 10 });
        back.translate(-cx, 0, -depth * .45); const b = mesh(back, edgeMat); g.add(b);
      }
      // pivot at the letter's base centre so squash happens from the ground
      g.userData = { cx, w: bb.x2 - bb.x1 };
      letters.push({ g, x: x + cx, w: adv, ch });
      group.add(g);
    }
    x += adv + spacing * size;
  }
  const width = x - spacing * size;
  for (const L of letters) { L.x -= width / 2; L.g.position.x = L.x; }
  return { group, letters, width };
}
