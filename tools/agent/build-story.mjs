#!/usr/bin/env node
// build-story.mjs: a local model (llama-swap / any OpenAI-compatible server) writes a claymation story in THIS project.
// Design pass (story beats + planning table) -> src/timeline.js + src/shots.js + src/score.mjs -> tools/check.mjs and
// tools/audio.mjs run -> failures and warnings go back to the model until PASS -> optional vision critique -> optional render.
//
//   node tools/agent/build-story.mjs --brief "60 s: Timmy loses his dummy down a rabbit hole, the flock digs, Bitzer falls in"
// Options:
//   --model qwen3.8-27b        author model alias          --url http://127.0.0.1:8686/v1
//   --rounds 6                 max fix rounds              --temp 0.5
//   --polish 2                 rounds spent on check warnings after PASS (kept only if still PASS with fewer warnings)
//   --vision <alias>           a vision model critiques a contact sheet; one fix round (reverted if it breaks the check)
//   --example                  ALSO send the full 2-minute Shaun film (examples/shaun) as reference (~25k tokens)
//   --continue                 improve the current files instead of starting from the brief
//   --render                   after PASS: audio + frames + MP4 (out/film.mp4)
// Log: out/agent-log.md (every prompt, answer and check result).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(ROOT);
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const brief = opt('brief'), model = opt('model', 'qwen3.8-27b'), url = opt('url', 'http://127.0.0.1:8686/v1');
const rounds = +opt('rounds', 6), temp = +opt('temp', .5), vision = opt('vision', null);
if (!brief || brief === true) { console.error('usage: node tools/agent/build-story.mjs --brief "<the story>" [--model alias] [--vision alias] [--render]'); process.exit(1); }

const read = f => fs.readFileSync(f, 'utf8');
const WRITABLE = ['src/timeline.js', 'src/shots.js', 'src/score.mjs'];
const FORMAT = `ANSWER FORMAT (strict). Output each file as its own fenced block whose FIRST line is a path comment:
\`\`\`js
// FILE: src/timeline.js
...complete file...
\`\`\`
Only ${WRITABLE.join(', ')} may be written. Always send COMPLETE files, never diffs, never "..." placeholders.`;
const docs = ['docs/AGENTS.md', 'docs/API.md', 'docs/SOUND.md', 'docs/CRAFT.md'];
const starter = WRITABLE.map(f => `===== working example ${f} (a 24 s story, "The Apple": shows the format and API; write your OWN story) =====\n\`\`\`js\n${read(f)}\`\`\``).join('\n');
const example = opt('example') ? ['examples/shaun/timeline.js', 'examples/shaun/shots.js', 'examples/shaun/score.mjs']
  .map(f => `===== reference ${f} (the 2-minute film "Up, Up & Baa-way!": mechanics only, never reuse its story, gags or tunes) =====\n\`\`\`js\n${read(f)}\`\`\``).join('\n') : '';
const system = `You are the director, animator and composer of a silent slapstick claymation short in the style of Shaun the Sheep.
You write it as code for the kit documented below. You have NO tools: do not call functions, list or read files. Everything you
need (the docs, src/stage.js, a working example of all three files) is in this message; answer with text and FILE blocks only.
${FORMAT}

${docs.map(f => `===== ${f} =====\n${read(f)}`).join('\n\n')}

===== src/stage.js (the helpers shots.js imports; read-only) =====
\`\`\`js
${read('src/stage.js')}\`\`\`

${starter}
${example}`;

fs.mkdirSync('out', { recursive: true });
const logf = 'out/agent-log.md', log = s => fs.appendFileSync(logf, s + '\n');
fs.writeFileSync(logf, `# Agent log\n\nModel: ${model}\nVision: ${vision || 'none'}\nBrief: ${brief}\nStarted: ${new Date().toISOString()}\n\n`);

async function chat(msgs, m = model, maxTokens = 32000) {
  const t0 = Date.now();
  const r = await fetch(url + '/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: m, messages: msgs, temperature: temp, max_tokens: maxTokens, stream: true }) });
  if (!r.ok) throw new Error(`model HTTP ${r.status}: ${(await r.text()).slice(0, 400)}`);
  let text = '', buf = '', toks = 0, think = 0, last = Date.now();
  const dec = new TextDecoder();
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true });
    let i; while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith('data:') || line === 'data: [DONE]') continue;
      let j; try { j = JSON.parse(line.slice(5)); } catch { continue; }
      if (j.error) throw new Error('model error: ' + JSON.stringify(j.error).slice(0, 300));
      const d = j.choices?.[0]?.delta || {};
      if (d.content) { text += d.content; toks++; } if (d.reasoning_content) think++;
      if (Date.now() - last > 30000) { last = Date.now(); console.log(`  ... ${((Date.now() - t0) / 1000).toFixed(0)} s, ${think} thinking + ${toks} answer chunks`); }
    }
  }
  text = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  console.log(`  ${m} answered in ${((Date.now() - t0) / 1000).toFixed(0)} s (${think} thinking + ${toks} answer chunks)`);
  return text;
}
function files(text) {
  const out = [];
  for (const m of text.matchAll(/```(?:js|javascript|mjs)?\s*\n\s*\/\/\s*FILE:\s*(\S+)\s*\n([\s\S]*?)```/g)) {
    const p = m[1].replace(/^\.\//, '');
    if (WRITABLE.includes(p)) out.push([p, m[2].trimEnd() + '\n']); else console.log(`  ignored file outside the story files: ${p}`);
  }
  return out;
}
// The gate: the framing/timeline check, then the soundtrack must build.
function check() {
  const c = spawnSync('node', ['tools/check.mjs'], { encoding: 'utf8', timeout: 900000 });
  let text = (c.stdout + c.stderr).trim(), ok = c.status === 0;
  if (ok) { const a = spawnSync('node', ['tools/audio.mjs'], { encoding: 'utf8', timeout: 300000 });
    if (a.status !== 0) { ok = false; text = `FAIL\n  - src/score.mjs: tools/audio.mjs crashed:\n${(a.stderr || a.stdout).split('\n').filter(l => l.trim()).slice(0, 8).join('\n')}\n` + text.replace(/^PASS/, ''); } }
  return { ok, text };
}
const warnsOf = r => r.text.split('\n').filter(l => l.trim().startsWith('warn:'));
const writeAll = fsOut => { const backup = new Map(); for (const [p, src] of fsOut) { backup.set(p, fs.existsSync(p) ? read(p) : null); fs.writeFileSync(p, src); console.log(`  wrote ${p} (${src.length} B)`); } return backup; };
const restore = backup => { for (const [p, src] of backup) src == null ? fs.rmSync(p) : fs.writeFileSync(p, src); };
const current = () => WRITABLE.map(p => `\`\`\`js\n// FILE: ${p}\n${read(p)}\`\`\``).join('\n');

const DESIGN = `Before any code, write the DESIGN (no code in this answer):
1. REQUIREMENTS: every explicit ask in the brief, numbered (characters, events, length, mood, ending).
2. STORY: logline, then the five parts of CRAFT section 1 (setup, problem, escalation with 2-3 failing attempts, payoff, button), one or two sentences each.
3. PLANNING TABLE (CRAFT section 2): | # | id | start-end | what the audience must understand | primary action | camera (size, angle, move, distance in m) | marks with sounds |
   Shots back to back from 0 to DUR, 2-7 s each (1-1.5 s for reaction cut-ins).
4. STAGING: for every shot, where each character stands (x, z on the farm map in API.md), where the camera is, and why nothing blocks the hero.
5. MUSIC: key, your own 8-16 note tune as [note, beats], which phrase plays under which shots (calm / sneaky / chase / suspense / triumph), where the silences are.
Use ONLY what API.md lists: the cast (the Farmer exists only sitting in his car), the built-in props, the farm layout
(coordinates!). Any other object (a cake, a ball, a hose) is built with C.prop from clay primitives. Keep the action in the open field or
on the lane; check every camera and character position against the farm map (walls at z -10.2, the gate at (-5,-10), trees).
Invent a new story from the brief. Do not reuse the working example's apple gag or the reference film's gags, shots or tunes.`;
const IMPLEMENT = `Now implement YOUR design exactly: src/timeline.js (shots + marks + light), src/shots.js (one entry per shot, each with hero, cam, cast, fx as needed), src/score.mjs (every mark that has an action gets its sound via at(shot, mark)). Follow docs/API.md exactly: import helpers from './stage.js', characters only from the cast list, props via C.prop, text via C.text.`;

const messages = [{ role: 'system', content: system }];
let result = { ok: false, text: 'not run' }, design = '';
if (opt('continue')) {
  messages.push({ role: 'user', content: `Improve this existing film. Brief: ${brief}\n\nCurrent files:\n${current()}\n\nCheck output:\n${check().text}\n\nFix every FAIL and warning and anything that breaks CRAFT. Resend changed files as COMPLETE files.` });
} else {
  console.log(`design pass: asking ${model}`);
  messages.push({ role: 'user', content: `Brief: ${brief}\n\n${DESIGN}` });
  design = await chat(messages); messages.push({ role: 'assistant', content: design }); log(`## Design\n\n${design}\n`);
  messages.push({ role: 'user', content: IMPLEMENT });
}
for (let round = 1; round <= rounds; round++) {
  console.log(`round ${round}: asking ${model}`);
  const ans = await chat(messages); messages.push({ role: 'assistant', content: ans }); log(`## Round ${round}: answer\n\n${ans}\n`);
  const fsOut = files(ans);
  if (!fsOut.length) {
    const tool = /<tool_call>|<function=/.test(ans);
    messages.push({ role: 'user', content: tool ? `There are no tools here: nothing you call will run. Everything is already in the system message (docs, src/stage.js, the three example files). Write the three files now, as FILE blocks. ${FORMAT}` : `I found no files. ${FORMAT}` });
    log(`## Round ${round}: no files${tool ? ' (tool call attempted)' : ''}\n`); continue; }
  writeAll(fsOut);
  result = check(); console.log(result.text.split('\n').map(l => '  ' + l).join('\n'));
  log(`## Round ${round}: check\n\n\`\`\`\n${result.text}\n\`\`\`\n`);
  if (result.ok) break;
  messages.push({ role: 'user', content: `The check says:\n\n${result.text}\n\nFix every FAIL line. Resend each file you change as a COMPLETE file in the FILE format.` });
}
for (let k = 1; result.ok && k <= +opt('polish', 2) && warnsOf(result).length; k++) {
  console.log(`polish ${k}: ${warnsOf(result).length} warnings`);
  messages.push({ role: 'user', content: `PASS, but the check warns:\n${warnsOf(result).join('\n')}\n\nThese are real problems a viewer will see (a character too small, blocked, off-screen, a frozen shot). Fix them: usually move the camera (pos/look) or the characters. Resend each changed file as a COMPLETE file.` });
  const ans = await chat(messages); messages.push({ role: 'assistant', content: ans }); log(`## Polish ${k}: answer\n\n${ans}\n`);
  const backup = writeAll(files(ans)), r2 = check(); log(`## Polish ${k}: check\n\n\`\`\`\n${r2.text}\n\`\`\`\n`); console.log(r2.text.split('\n').map(l => '  ' + l).join('\n'));
  if (r2.ok && warnsOf(r2).length < warnsOf(result).length) result = r2;
  else { console.log('  not better: restoring'); restore(backup); messages.push({ role: 'user', content: `That change was reverted (${r2.ok ? 'no fewer warnings' : 'it broke the check'}).` }); messages.push({ role: 'assistant', content: 'Understood.' }); }
}
if (result.ok && design) {
  console.log('self-review against the design');
  messages.push({ role: 'user', content: `Review your files against your STORY and PLANNING TABLE. For each shot and each mark, write DONE or MISSING (does the action happen on screen at that mark? does it have its sound in score.mjs?). Then resend COMPLETE files that fix every MISSING item, or answer "NO CHANGES".` });
  const ans = await chat(messages); messages.push({ role: 'assistant', content: ans }); log(`## Self-review\n\n${ans}\n`);
  const fsR = files(ans);
  if (fsR.length) { const backup = writeAll(fsR), r2 = check(); log(`## Self-review: check\n\n\`\`\`\n${r2.text}\n\`\`\`\n`); console.log(r2.text.split('\n').map(l => '  ' + l).join('\n'));
    if (r2.ok && warnsOf(r2).length <= warnsOf(result).length) result = r2; else { console.log('  broke the check or added warnings: restoring'); restore(backup); } }
}
if (result.ok && vision) {
  spawnSync('node', ['tools/render.mjs', '--sheet=auto', '--cols=5', '--tw=320', '--out=out/sheet.jpg'], { stdio: 'inherit' });
  const img = 'data:image/jpeg;base64,' + fs.readFileSync('out/sheet.jpg').toString('base64');
  const critique = await chat([{ role: 'user', content: [
    { type: 'text', text: `A contact sheet of a claymation short (each still is labelled with its time and shot id). Brief: "${brief}".
List up to 6 concrete, fixable problems with shot ids: a character too small to read, a character hidden behind another character, a wall, a tree or a prop, the hero cut off by the frame edge, a reaction shot where the face is turned away, two neighbouring shots that look the same, an unclear gag. Be specific ("shot tower 53 s: Shaun is a speck in the middle distance"). Ignore motion blur and mid-action poses.` },
    { type: 'image_url', image_url: { url: img } }] }], vision, 2000);
  log(`## Vision critique (${vision})\n\n${critique}\n`); console.log('critique:\n' + critique);
  messages.push({ role: 'user', content: `A director reviewed a contact sheet of your film:\n\n${critique}\n\nFix the problems that are real. Resend changed files as COMPLETE files.` });
  const ans = await chat(messages); log(`## Vision fix: answer\n\n${ans}\n`);
  const backup = writeAll(files(ans)), r2 = check(); log(`## Vision fix: check\n\n\`\`\`\n${r2.text}\n\`\`\`\n`); console.log(r2.text);
  if (!r2.ok) { console.log('  broke the check: restoring the passing version'); restore(backup); }
}
console.log(result.ok ? 'PASS' : 'FAIL after ' + rounds + ' rounds');
if (result.ok && opt('render')) for (const a of [['tools/audio.mjs'], ['tools/render.mjs', '--frames', '--force'], ['tools/render.mjs', '--encode']]) spawnSync('node', a, { stdio: 'inherit' });
log(`\nFinished: ${new Date().toISOString()}  ${result.ok ? 'PASS' : 'FAIL'}\n`);
process.exit(result.ok ? 0 : 1);
