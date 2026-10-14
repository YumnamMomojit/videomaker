#!/usr/bin/env node
/**
 * Builds the "Getting Started with Sem" tutorial video entirely from code:
 *
 *   1. Extracts frames from the real Sem screen recording (tutorial.json → source).
 *   2. Synthesises the narration for every step with Festival (offline TTS) and
 *      sizes each step to fit its narration.
 *   3. Renders every frame in Chromium (tutorial.html): zooms, callouts,
 *      captions, title cards, with privacy masks over the browser's bookmarks.
 *   4. Mixes narration + Sem's own voice from the recording + a generated
 *      music bed (ducked under speech) and writes the MP4 and an SRT file.
 *
 *   node build.mjs                 # full build → ../build/tutorial/sem-tutorial.mp4
 *   node build.mjs --still 12.5    # one PNG frame
 *   node build.mjs --fps 15        # faster draft
 */
import {spawn, spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'build', 'tutorial');
const LEAD = 0.6;   // silence before narration starts in a step
const TAIL = 0.8;   // breathing room after narration
const TITLE_MIN = 5;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { args[key] = next; i++; } else args[key] = true;
  }
  return args;
}

function sh(cmd, args) {
  const res = spawnSync(cmd, args, {encoding: 'utf8'});
  if (res.status !== 0) throw new Error(`${cmd} failed: ${res.stderr || res.error}`);
  return res.stdout;
}

const duration = (file) =>
  Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).trim());

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!fs.existsSync(base)) return undefined;
  for (const dir of fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
    const exe = path.join(base, dir, 'chrome-linux', 'chrome');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

function extractFrames(source, fps) {
  const dir = path.join(OUT, `frames-${fps}`);
  const stamp = path.join(dir, '.source');
  const key = `${source}:${fs.statSync(source).size}`;
  if (!fs.existsSync(stamp) || fs.readFileSync(stamp, 'utf8') !== key) {
    fs.rmSync(dir, {recursive: true, force: true});
    fs.mkdirSync(dir, {recursive: true});
    console.log('  extracting frames from recording');
    sh('ffmpeg', ['-loglevel', 'error', '-i', source, '-vf', `fps=${fps}`, '-q:v', '2', path.join(dir, '%05d.jpg')]);
    fs.writeFileSync(stamp, key);
  }
  return {dir, count: fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).length};
}

/** Festival TTS → cleaned-up 48 kHz mono WAV, cached by text + voice. */
function speak(text, voice) {
  const dir = path.join(OUT, 'tts');
  fs.mkdirSync(dir, {recursive: true});
  const hash = crypto.createHash('sha1').update(voice + '|' + text).digest('hex').slice(0, 12);
  const out = path.join(dir, `${hash}.wav`);
  if (fs.existsSync(out)) return out;
  const raw = path.join(dir, `${hash}.raw.wav`);
  const res = spawnSync('text2wave', ['-eval', `(voice_${voice})`, '-o', raw], {input: text});
  if (res.status !== 0) throw new Error(`text2wave failed: ${res.stderr}`);
  // Warm the thin synthetic voice up a little and even out its level.
  sh('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-af',
    'highpass=f=70,lowpass=f=9000,equalizer=f=180:t=q:w=1:g=3,equalizer=f=3200:t=q:w=1.2:g=2,' +
    'acompressor=threshold=0.08:ratio=3:attack=5:release=120:makeup=2,' +
    'aecho=0.8:0.5:28|46:0.12|0.07,silenceremove=start_periods=1:start_threshold=0.01,areverse,' +
    'silenceremove=start_periods=1:start_threshold=0.01,areverse,aresample=48000',
    '-ac', '1', out]);
  fs.rmSync(raw);
  return out;
}

function buildTimeline(cfg) {
  let t = 0;
  const steps = cfg.steps.map((s) => {
    const step = {...s, start: t};
    if (s.kind === 'play') {
      step.end = t + (s.play[1] - s.play[0]);
    } else {
      step.voiceFile = speak(s.say, cfg.voice);
      step.voiceDur = duration(step.voiceFile);
      step.voiceAt = t + LEAD;
      step.end = t + Math.max(LEAD + step.voiceDur + TAIL, s.kind === 'title' ? TITLE_MIN : 0);
    }
    step.end = +step.end.toFixed(3);
    t = step.end;
    return step;
  });
  // Consecutive steps with the same label share one badge.
  steps.forEach((s, i) => {
    let a = i, b = i;
    while (a > 0 && steps[a - 1].label === s.label) a--;
    while (b < steps.length - 1 && steps[b + 1].label === s.label) b++;
    s.groupStart = steps[a].start;
    s.groupEnd = steps[b].end;
  });
  return {steps, duration: t};
}

function run(cmd, args, feed) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {stdio: ['pipe', 'inherit', 'inherit']});
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))));
    if (feed) feed(p.stdin).catch(reject);
    else p.stdin.end();
  });
}

async function openPage(timeline) {
  const browser = await chromium.launch({executablePath: findChromium(), args: ['--allow-file-access-from-files']});
  const page = await browser.newPage({viewport: {width: timeline.width, height: timeline.height}});
  await page.goto(pathToFileURL(path.join(HERE, 'tutorial.html')).href);
  await page.evaluate((tl) => window.init(tl), timeline);
  await page.evaluate(() => document.fonts.ready);
  return {browser, page};
}

async function renderVideo(timeline, fps, file) {
  const {browser, page} = await openPage(timeline);
  const total = Math.round(timeline.duration * fps);
  try {
    await run('ffmpeg', [
      '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', file,
    ], async (stdin) => {
      for (let i = 0; i < total; i++) {
        const t = i / fps;
        await page.evaluate((tt) => window.renderAt(tt), t);
        const jpg = await page.screenshot({type: 'jpeg', quality: 93});
        if (!stdin.write(jpg)) await new Promise((r) => stdin.once('drain', r));
        if (i % fps === 0) process.stdout.write(`\r  frames ${t.toFixed(0)}s / ${timeline.duration.toFixed(0)}s   `);
      }
      stdin.end();
      process.stdout.write('\n');
    });
  } finally {
    await browser.close();
  }
}

/** Soft four-chord pad (Cmaj7 – Am7 – Fmaj7 – G), each chord swelling in and out. */
function musicExpr(total) {
  const chords = [
    [130.81, 164.81, 196.0, 246.94],
    [110.0, 130.81, 164.81, 196.0],
    [87.31, 110.0, 130.81, 164.81],
    [98.0, 123.47, 146.83, 196.0],
  ];
  const len = 4;
  const c = `mod(floor(t/${len}),4)`;
  const pick = (j) => `if(eq(${c},0),${chords[0][j]},if(eq(${c},1),${chords[1][j]},if(eq(${c},2),${chords[2][j]},${chords[3][j]})))`;
  const env = `pow(sin(PI*mod(t,${len})/${len}),2)`;
  const voices = [0, 1, 2, 3].map((j) =>
    `0.16*sin(2*PI*${pick(j)}*t)+0.04*sin(2*PI*2*${pick(j)}*t+${j})`).join('+');
  return `aevalsrc='(${voices})*${env}*(0.85+0.15*sin(2*PI*0.2*t))':s=48000:d=${total.toFixed(2)}`;
}

async function mixAudio(cfg, timeline, source, file) {
  const inputs = [];
  const filters = [];
  const speech = [];
  let n = 0;

  for (const s of timeline.steps) {
    if (s.voiceFile) {
      inputs.push('-i', s.voiceFile);
      filters.push(`[${n}:a]adelay=${Math.round(s.voiceAt * 1000)}:all=1,apad=whole_dur=${timeline.duration}[v${n}]`);
      speech.push(`v${n}`);
      n++;
    } else if (s.kind === 'play') {
      // Sem's real voice from the screen recording.
      const len = s.play[1] - s.play[0];
      inputs.push('-i', source);
      filters.push(`[${n}:a]atrim=start=${s.play[0]}:duration=${len},asetpts=PTS-STARTPTS,aformat=channel_layouts=mono,` +
        `volume=1.3,afade=in:d=0.15,afade=out:st=${len - 0.3}:d=0.3,adelay=${Math.round(s.start * 1000)}:all=1,` +
        `apad=whole_dur=${timeline.duration}[v${n}]`);
      speech.push(`v${n}`);
      n++;
    }
  }
  inputs.push('-f', 'lavfi', '-i', musicExpr(timeline.duration));
  filters.push(`[${n}:a]lowpass=f=1800,aecho=0.8:0.7:180|320:0.3|0.2,volume=0.22,` +
    `afade=in:d=2,afade=out:st=${timeline.duration - 3}:d=3,aformat=channel_layouts=mono[mus]`);

  filters.push(`${speech.map((l) => `[${l}]`).join('')}amix=inputs=${speech.length}:duration=longest:normalize=0,asplit=2[sp][key]`);
  filters.push('[mus][key]sidechaincompress=threshold=0.015:ratio=10:attack=30:release=500[duck]');
  filters.push('[sp][duck]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000[aout]');

  await run('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filters.join(';'),
    '-map', '[aout]', '-t', String(timeline.duration), '-ac', '2', '-c:a', 'pcm_s16le', file]);
}

function writeSrt(timeline, file) {
  const ts = (x) => {
    const ms = Math.round(x * 1000);
    const p = (v, l = 2) => String(v).padStart(l, '0');
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
  };
  const cues = timeline.steps.filter((s) => s.say).map((s, i) =>
    `${i + 1}\n${ts(s.voiceAt)} --> ${ts(s.voiceAt + s.voiceDur)}\n${s.say.replace(/sem dock/gi, 'SEMDOK').replace(/live dot SEMDOK dot com/gi, 'live.semdok.com')}\n`);
  fs.writeFileSync(file, cues.join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = JSON.parse(fs.readFileSync(path.join(HERE, 'tutorial.json'), 'utf8'));
  const source = path.resolve(HERE, cfg.source);
  if (!fs.existsSync(source)) throw new Error(`Source recording not found: ${source}`);
  const fps = Number(args.fps || cfg.fps);
  fs.mkdirSync(OUT, {recursive: true});

  console.log('Preparing narration and frames');
  const frames = extractFrames(source, fps);
  const {steps, duration: total} = buildTimeline(cfg);
  const timeline = {
    ...cfg, steps, duration: total, fps,
    frameCount: frames.count, framesUrl: pathToFileURL(frames.dir).href,
  };
  for (const s of steps) console.log(`  ${s.start.toFixed(1).padStart(5)}–${s.end.toFixed(1).padStart(5)}s  ${s.id}`);

  if (args.still !== undefined) {
    const t = Number(args.still === true ? 0 : args.still);
    const {browser, page} = await openPage(timeline);
    await page.evaluate((tt) => window.renderAt(tt), t);
    const out = path.join(OUT, `still-${t.toFixed(2)}.png`);
    await page.screenshot({path: out});
    await browser.close();
    console.log(`Wrote ${out}`);
    return;
  }

  const video = path.join(OUT, 'video.mp4');
  const audio = path.join(OUT, 'audio.wav');
  const final = path.join(OUT, 'sem-tutorial.mp4');
  console.log(`Rendering ${total.toFixed(1)}s at ${fps} fps`);
  await renderVideo(timeline, fps, video);
  console.log('  mixing narration, Sem audio and music');
  await mixAudio(cfg, timeline, source, audio);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-i', audio, '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', final]);
  writeSrt(timeline, path.join(OUT, 'sem-tutorial.srt'));
  console.log(`Wrote ${final}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
