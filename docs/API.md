# API: everything `src/shots.js` can use

```js
import { THREE, K, yawTo, X, walk, hop, orbit, clamp, lerp, ease, spring, wobble, pulse, smooth, arc, hash, ground, laneCurve, L, DEG } from './stage.js';
export const SHOTS = {
  myshot: (m, C) => ({                 // m = this shot's marks, C = context (below). Runs ONCE at load.
    hero: 'shaun',                     // who must be readable (check.mjs enforces it); string or array
    cam: lt => ({ pos: [x, y, z], look: [x, y, z], fov: 35 }),   // or a K(...) track with the same fields
    cast: { shaun: lt => ({ x: 0, z: 0, yaw: 0 }), timmy: K([0, { x: 1 }], [2, { x: 3 }]) },
    fx: lt => { /* show props / text for this frame */ },
  }),
};
```

## Time helpers
- `K([t, {fields}, ease?], ...)`: a keyframe track, called as `track(lt)`. Each field interpolates between the keys
  that mention it (numbers and arrays), holding its first/last value outside. Ease names: `lin in out io io3 in3 out3
  out5 in5 outBack inBack outElastic outBounce step`. Default `io`. The ease belongs to the key you travel TO.
- `smooth(a, b, lt)`: 0 before a, 1 after b, smooth in between (the workhorse for switching poses on).
- `clamp, lerp, ease.<name>(u)`, `spring(lt, at, freq=3, damp=.4)` (0 -> 1 with overshoot), `wobble(lt, at, freq, decay)`
  (a decaying ±1 shake), `pulse(lt, at, k)` (1 at `at`, decays), `arc(a, b, u, h)` (ballistic point from a to b with apex h).
- `walk(lt, [x,z], [x2,z2], t0, t1, { run, endYaw, ease })` -> `{ x, z, yaw, gaitAmp, run, gait }`: spread it into a pose.
- `hop(lt, [x,y,z], [x2,y2,z2], t0, t1, h)` -> `{ x, y, z, sq }` with squash/stretch and a landing wobble.
- `orbit(lt, centre, t0, t1, a0, a1, radius, height, fov)` -> a camera object circling `centre`.
- `yawTo([x,z], [x2,z2])`: yaw in degrees that faces the second point.
- `ground(x, z)`: grass height (the field is almost flat, hills rise far away).

## Cast (keys of `cast`)
`shaun` (hero sheep, tuft on head), `timmy` (lamb with a dummy), `shirley` (huge round sheep), `mum` (Timmy's mum, curlers),
`f1`..`f6` (flock sheep), `bitzer` (the sheepdog: hat, clipboard, whistle), `car` (the Farmer's car with the Farmer in it),
`balloons` (a bunch of 5), `fly` (a butterfly). A cast entry is a track or `(lt, t) => pose`. Poses are sampled on twos
(12 per second) like stop-motion; the camera moves on every frame.

### Sheep pose (shaun timmy shirley mum f1..f6). Defaults in brackets.
| field | meaning |
|---|---|
| `x z` [0] `y` [0] | position; `y` is height above ground unless `abs: true` (then `y` is world height, for flying) |
| `yaw` [0] | facing, degrees (0 faces +Z) |
| `up` [0] | 0 = on four legs, 1 = standing on hind legs like a person (front legs become arms) |
| `armL armR` [[15,12]] | when `up`: `[raise, spread, twist]` degrees. 0 = hanging, 90 = forward, 180 = straight up. spread + = outward |
| `gaitAmp` [0] `gait` `run` [0] | legs cycling: gaitAmp 0..1, gait = phase (auto from travelled distance for K tracks), run 1 = gallop |
| `sit` [0] `lie` [0] | sit on bottom / lie flat on belly |
| `pitch roll` [0] | lean the body; `rootPitch rootRoll` tip the whole puppet over its feet (falls, towers, upside down = rootRoll 180) |
| `sq` [1] | squash (<1) / stretch (>1) for anticipation and impacts |
| `legs` [[0,0]] | extra swing of the hind legs (kick, dangle) |
| `headYaw headPitch headRoll` [0] | head turn; headPitch + = look down, - = look up |
| `graze` [0] | 1 = head bobs down to eat grass |
| face | `eyeOpen` [1] `blink` [true] `look` [[0,0]] pupils -1..1 (x right, y up) `pupil` [1] size `eyeWide` [1] (1.3 = shock) `lidTilt` [0] (+ = cross, - = sad/bored) `squint` [0] `wink` [0] (left eye) `mouth` [0] open 0..1 `smile` [.3] -1..1 `grin` [0] teeth `ears` [0] -1 droop..1 perk |
| extras | `dummy` (timmy, default shown; false hides it), `suck` 1 = sucking the dummy, `wag` tail, `vis` false = hide |

### Bitzer pose
Same position/face fields as sheep (`x z y abs yaw sq gaitAmp gait run headYaw headPitch headRoll` and the face fields, plus
`brow` 0..1 raised). Also: `lean` (forward, deg), `twist`, `sit` 0..1 with `recline` (deg back) and `legs [l, r]`,
`armL armR` = `[raise, spread, elbow]` (default L `[30,10,60]` holding the clipboard, R `[10,10,20]`), `board` 1/0 clipboard shown,
`whistleUp` 1 = whistle in his right paw (raise the arm to the mouth: `armR: [128, 8, 130]`), `phones` 1 = headphones on,
`paddle` 0..1 legs paddling in the air, `tailWag`. He is 1.3 m tall.

### Car pose
`x z yaw` (yaw 90 = driving towards +X), `engine` 1 = idling judder, `spin` wheel angle (radians; use `-(distance)/.24`),
`tilt` (nose dip on braking, deg), `bounce`, `sq` (honk squash), the Farmer: `fYaw fPitch fRoll` head, `fSmile`, `fArm` wave (deg).
Drive along the lane with `z: laneCurve(x)`.

### Balloons pose
`anchor: [x,y,z]` where the strings meet, OR `hold: 'timmy'` (both hands), `'shaun:R'` / `'shaun:L'` (one hoof), `'bitzer'`
(right paw); `hold2` + `mix` 0..1 hands them from one holder to another. `len` string length [1.5], `lean: [dx, dz]` wind, `sway`.

### Fly pose
`{ pos: [x, y, z], yaw }`.

## Context `C` (in the shot factory and inside cast/fx functions)
- `C.text('WORDS', { size: .8, depth: .24, color: 'white'|'yellow'|'red'|'#hex', edge: true })` -> `{ group, letters: [{ g }], width }`:
  3D clay letters, baseline at y=0, centred on x=0, facing +Z. Create in the factory, then in `fx`:
  `t.group.visible = true; t.group.position.set(x, ground(x, z), z); t.letters.forEach((L, i) => C.letterDrop(L, lt, 0.5 + i * .1));`
- `C.letterDrop(L, lt, t0, y0 = 0, fall = 5, dur = .42)`: a letter falls from above at t0 and squashes on landing.
- `C.prop(({ THREE, M, blob, ball, mesh, capsule, lumpy }) => object3D)`: build any prop once from clay primitives:
  `mesh(geometry, M.<material>)`, `ball(r)` lumpy sphere geometry, `blob(r)` lumpier, `capsule(r, len)`.
  Materials: `M.wool M.face M.hoof M.pink M.tan M.hat M.wood M.woodDark M.stone M.hay M.trunk M.leaf M.leafDark M.hedge
  M.barn M.trim M.roof M.metal M.paper M.board M.phones M.string M.bulb M.cloud M.letter M.letterRed M.letterYellow
  M.balloon[0..4]` (red, yellow, blue, green, pink), or `M.clay('#hex')` for any colour. Show it in `fx` with `.visible = true`.
- `C.puff(i, at, lt, [x,y,z], size = 1, colour?)`: dust puff number i (0–5) bursting at `at` (0.9 s).
- `C.headPos(name)` / `C.hands(name)`: world positions (THREE.Vector3) of a character's head / hands this frame
  (valid in `fx`, and in a cast function for characters listed EARLIER in the same cast).
- `C.A.<actor>`: the rigs (e.g. `C.A.shirley.root.position` to put Shaun on her back: list shirley first in the cast).
- Built-in props: `C.P.bulb` (idea light bulb: `.visible`, `.position`, `.scale`, `.userData.glow.intensity`),
  `C.P.zzz` (three Z letters), `C.P.dummy` (loose dummy), `C.P.seesaw.pose({ angle })` (plank angle, -14..14),
  `C.P.chair` (deckchair, static), `C.P.flyPhones`, `C.P.faceGrass` (grass stuck on Shaun's face).

## Camera (`cam(lt)` or a K track with these fields)
`pos`, `look` (world points), `fov` (vertical degrees: 28–34 close/medium, 36–46 wide), optional `shake` (0.03–0.08 on
impacts), `roll` (deg), `focus` (focus distance in m; default = distance to `look`), `aperture` (default .0022; smaller =
deeper focus), `fade` 0..1 to black, `iris` (radius, 10 = open; animate to 0 for an iris-out) with `irisOn: 'shaun'`,
`shadowAt`/`shadowSize` when the action is far from `look` (flying shots).

## The farm (metres; +Z = south = towards the default camera)
- The **field** is the open grass from about x -15..14, z -9..16 (flat). Walls: north wall z = -10.2 (x -26..14) with a
  closed wooden gate at (-5, -10); west wall x ≈ -17; east hedge x ≈ 15.
- **Lane** north of the wall at z = -14.5 (use `laneCurve(x)`; it bends south-east beyond x = 10). The Farmer's car lives here.
- **Farmhouse** (-13, -21), **barn** (7, -22), both facing south. **Deckchair** (-7.2, -8.4), yaw 28.6.
- **See-saw** pivot (-6, 0.6, 4), plank along X, ends at x -7.7 and -4.3. **Hay bales** at (-8.3, 4.1), two high (top at y 1.0),
  a step bale at (-9.4, 4.4).
- **Trees** (trunk positions): (-11, 11) big oak in the field, (11.5, -6.5), (-22, -4), (20, 10), (-3, -24), (16, -25).
  Lowest leaves about 2.8 m up on the big oak.
- Far away: church spire with bunting (70, -95), patchwork hills all round.
- Sizes: Shaun 0.9 m tall on four legs, 1.45 m standing up; Timmy half that; Shirley 1.6 m round; Bitzer 1.3 m.

## Time of day (timeline.js)
`light: [[0, 'morning'], [60, 'golden']]`: presets `morning day noon afternoon golden dusk night overcast`, interpolated.
Omit it for a morning-to-golden day across the film.
