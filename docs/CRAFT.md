# CRAFT: how to make it read and make it funny

## 1. Story shape (60–120 s)
Silent slapstick: nobody speaks, everything is shown. The reliable shape:
1. **Setup** (10–20%): the place, the characters, the normal day. Title card here.
2. **Problem** (15%): something arrives or goes wrong (an object, a runaway, a rule, a rival).
3. **Escalation** (35–40%): try, fail, try something bigger, fail bigger. Each attempt is its own shot or two.
   The failure is the joke: it must be visible and it must have a sound.
4. **Payoff** (15%): the clever or lucky solution. Give it a light-bulb moment first.
5. **Button** (10%): one last twist that turns the solution on someone else, then an ending card (iris out on the hero).
Keep the authority figure (Bitzer, the Farmer) about to catch them: it gives the plot a clock.

## 2. Planning table (write it BEFORE the code)
| # | id | start–end | what the audience must understand | primary action | camera (shot size, angle, move) | marks with sounds |
Shots of 2–7 s. 1–1.5 s for a reaction or an impact cut-in. A new shot for every new idea; cut on the action
(the landing happens as the new shot starts). About 12–24 shots for 2 minutes.

## 3. Framing (check.mjs measures this, in % of frame height)
- The subject of every shot fills **25–60% of the frame height** (medium), 60–120% for a close-up face, 12–25% only
  for an establishing wide. Too-far is the most common mistake: a character at 8 m in a 35° frame is a speck.
  Rough distances with fov 35: Shaun standing 1.45 m -> 3–5 m for a medium, 1.8–2.5 m for a close-up.
- Put the camera at the character's eye level or a little lower (0.5–1.3 m). Low angles make jumps and towers big.
- Look at the action, not at the ground between characters. If two characters matter, both must be in frame and
  not overlapping: place them at different distances or offset them sideways from the camera line.
- Nothing between the camera and the subject: check walls (0.9 m), trees, the gate, and other characters walking
  past the lens. When someone must cross the frame, let them cross BEHIND the subject.
- Things held above a character (balloons, a bulb) need headroom: tilt the camera or pull back.
- For something high (flying, a tower), use a low camera looking up with fov 40–46, or a camera up in the air.
- Faces: a reaction shot needs the face turned to the camera (within ~30°). A side view hides the mouth and eyes.

## 4. Acting (the puppets)
- One clear pose per beat, held long enough to read (0.5 s+), then move to the next. Stop-motion animates on twos: fine.
- Anticipation before every big move: crouch (`sq: .8`) 0.2–0.3 s, then the move with stretch (`sq: 1.15–1.3`),
  then an impact squash and a settle (`hop()` does this).
- Takes: a surprise is 3 frames of stillness, then `X.shock` + `up: 1` + arms out (`armL/R: [25, 40]`) with a springy `sq`.
- Heads lead: turn the head (`headYaw`, `look`) a beat before the body turns or walks.
- Eyes sell everything: `look` at the thing they care about; `lidTilt` + for scheming, - for sad/bored; `wink` for the button.
- Keep everyone else alive: grazing (`graze: 1`), breathing (automatic), small head turns, blinking (automatic).
- Shaun stands up (`up: 1`) to act like a person (pointing, thumbs up `armR: [100, -12]`, measuring, whistling
  `armL/R: [125, -30, 60]`); on four legs (`up: 0`) he is being a sheep.

## 5. Camera language
- Establishing wide -> medium -> close-up for a reaction -> back out. Alternate sizes between neighbouring shots.
- Move the camera slowly during a shot (a push-in of 0.3–0.8 m, or a pan following the action). Whip-pans (fast
  pan over 0.3 s) for surprises. Shake (`shake: .05`) only on impacts.
- Keep screen direction: if the runaway goes left in one shot, it goes left in the next.

## 6. Critique list (run it on the contact sheet)
1. Can you tell who each shot is about in one second? Is that character 25–60% of the frame height?
2. Is anything blocking the subject (another character, a wall, a prop, balloons)?
3. Does every shot have a primary action, and does the camera or a background character add life?
4. Is every gag set up (we saw the object before), attempted, failed with a sound, and paid off?
5. Do the reactions face the camera? Are the expressions readable (eyes, mouth)?
6. Is the ending a button (a twist + iris out), not just a stop?
7. Sound: every impact/jump/landing has a cue at its mark; music follows the beats; there is one moment of silence before the payoff.

## 7. Mistakes already made (don't repeat them)
- Wide shots with the actor as a speck: the checker flags it; fix by moving the camera, not by enlarging fov.
- A character walking between the camera and the hero, hiding them for most of the shot.
- A wooden gate/wall between the camera and the action (cameras outside the field see walls first).
- Balloons held behind a character floated right in front of the camera; give them `len` and headroom, check the still.
- A car behind a 0.9 m wall was invisible: raise the camera (2.5–3 m) to see over walls.
- An iris-out centred on a character at the frame edge closes on nothing: frame the hero centre/centre-right at the end.
- Close-ups from the side make an open mouth look like a lip: shoot reactions front-on.
- Running two renders at once on the GPU crashes the browser; `tools/render.mjs` defaults to one worker.
