#!/usr/bin/env node
/**
 * Renders the Centre of AI session video "RAG — what it is and its use cases in finance".
 *
 *   node render.mjs                  # build/rag-in-finance.mp4
 *   node render.mjs --still 42.5     # build/still-42.50.png — one frame, for layout checks
 *   node render.mjs --from 20 --to 35
 *
 * Pipeline:
 *   1. scenes.html draws every frame in Chrome (deterministic in t).
 *   2. A soft music pad with scene-change chimes is synthesised here.
 *   3. ffmpeg encodes the frames and mixes in the music.
 */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = path.join(ROOT, 'build');
const WIDTH = 1920;
const HEIGHT = 1080;
const SAMPLE_RATE = 48000;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '');
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function findChrome() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  const local = path.join(ROOT, '.tools', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  return fs.existsSync(local) ? local : 'ffmpeg';
}
const FFMPEG = findFfmpeg();

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {stdio: ['pipe', 'inherit', 'inherit']});
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))));
    if (opts.feed) opts.feed(p.stdin).catch(reject);
    else p.stdin.end();
  });
}

async function openPage() {
  const browser = await chromium.launch({executablePath: findChrome()});
  const page = await browser.newPage({viewport: {width: WIDTH, height: HEIGHT}, deviceScaleFactor: 1});
  await page.goto(pathToFileURL(path.join(ROOT, 'scenes.html')).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
  const info = await page.evaluate(() => ({total: window.TOTAL, starts: SCENES.map((s) => s.start)}));
  return {browser, page, ...info};
}

/** One JPEG frame at time t; retries when Chrome occasionally stalls on a screenshot. */
async function frameAt(page, t, attempts = 3) {
  for (let k = 1; ; k++) {
    try {
      await page.evaluate((tt) => window.renderAt(tt), t);
      return await page.screenshot({type: 'jpeg', quality: 95, timeout: 20000});
    } catch (err) {
      if (k >= attempts) throw err;
      process.stdout.write(`\n  screenshot at ${t.toFixed(2)}s failed (${err.name}), retrying\n`);
    }
  }
}

async function renderFrames(page, from, to, fps, outFile) {
  const total = Math.round((to - from) * fps);
  const started = Date.now();
  await run(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-color_range', 'tv',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-r', String(fps),
    outFile,
  ], {
    feed: async (stdin) => {
      for (let i = 0; i < total; i++) {
        const t = from + i / fps;
        const jpg = await frameAt(page, t);
        if (!stdin.write(jpg)) await new Promise((r) => stdin.once('drain', r));
        if (i % fps === 0) {
          const eta = ((Date.now() - started) / (i + 1)) * (total - i - 1) / 1000;
          process.stdout.write(`\r  frames ${t.toFixed(0)}s / ${to.toFixed(0)}s  (eta ${eta.toFixed(0)}s)   `);
        }
      }
      stdin.end();
      process.stdout.write('\n');
    },
  });
}

/** Soft chord pad (Cmaj7 – Am7 – Fmaj7 – G6) with a gentle chime at each scene change. */
function synthMusic(duration, chimeTimes, outFile) {
  const n = Math.ceil(duration * SAMPLE_RATE);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const chords = [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 64]];
  const BAR = 8;
  const XF = 2;
  const TAU = 2 * Math.PI;

  for (let c = 0; c * BAR < duration; c++) {
    const notes = chords[c % chords.length];
    const t0 = c * BAR - XF / 2;
    const t1 = (c + 1) * BAR + XF / 2;
    const i0 = Math.max(0, Math.floor(t0 * SAMPLE_RATE));
    const i1 = Math.min(n, Math.ceil(t1 * SAMPLE_RATE));
    const voices = [...notes.map((m) => ({f: hz(m), a: 0.05})), {f: hz(notes[0] - 12), a: 0.06}];
    for (let i = i0; i < i1; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.sin(Math.PI / 2 * Math.min(1, (t - t0) / XF, (t1 - t) / XF)) ** 2;
      const lfo = 0.85 + 0.15 * Math.sin(TAU * 0.11 * t);
      let l = 0;
      let r = 0;
      for (const v of voices) {
        l += v.a * (Math.sin(TAU * v.f * 0.9985 * t) + 0.25 * Math.sin(TAU * 2 * v.f * t));
        r += v.a * (Math.sin(TAU * v.f * 1.0015 * t) + 0.25 * Math.sin(TAU * 2 * v.f * t + 0.7));
      }
      L[i] += l * env * lfo;
      R[i] += r * env * lfo;
    }
  }

  for (const ct of chimeTimes) {
    const i0 = Math.floor(ct * SAMPLE_RATE);
    const len = Math.min(n - i0, 3 * SAMPLE_RATE);
    for (let k = 0; k < len; k++) {
      const t = k / SAMPLE_RATE;
      const e = Math.exp(-t * 2.2) * Math.min(1, t / 0.005);
      const s = 0.06 * e * (Math.sin(TAU * hz(88) * t) + 0.4 * Math.sin(TAU * hz(95) * t));
      L[i0 + k] += s;
      R[i0 + k] += s;
    }
  }

  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const gain = 0.6 / peak;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(clampAudio(L[i] * gain) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(clampAudio(R[i] * gain) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(outFile, buf);
}
const clampAudio = (x) => Math.max(-1, Math.min(1, x));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(BUILD_DIR, {recursive: true});
  const fps = +(args.fps || 30);
  const {browser, page, total, starts} = await openPage();
  try {
    if (args.still !== undefined) {
      const t = +args.still;
      await page.evaluate((tt) => window.renderAt(tt), t);
      const out = path.join(BUILD_DIR, `still-${t.toFixed(2)}.png`);
      await page.screenshot({path: out});
      console.log(out);
      return;
    }

    const from = +(args.from || 0);
    const to = Math.min(total, +(args.to || total));
    const dur = to - from;
    const tag = from === 0 && to === total ? '' : `-${from}-${to}`;
    const frames = path.join(BUILD_DIR, `frames${tag}.mp4`);
    const music = path.join(BUILD_DIR, `music${tag}.wav`);
    const out = path.join(BUILD_DIR, `rag-in-finance${tag}.mp4`);

    console.log(`Rendering ${dur.toFixed(1)}s at ${fps} fps (${Math.round(dur * fps)} frames)`);
    await renderFrames(page, from, to, fps, frames);

    console.log('Synthesising music');
    const chimes = starts.filter((s) => s > 0 && s >= from && s < to).map((s) => s - from);
    synthMusic(dur, chimes, music);

    console.log('Muxing');
    await run(FFMPEG, [
      '-y', '-loglevel', 'error',
      '-i', frames, '-i', music,
      '-filter_complex',
      `[1:a]lowpass=f=3200,aecho=0.8:0.6:70|140:0.22|0.12,volume=1.5,afade=in:d=2,afade=out:st=${Math.max(0, dur - 3)}:d=3[a]`,
      '-map', '0:v', '-map', '[a]',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', String(SAMPLE_RATE),
      '-t', String(dur), '-movflags', '+faststart', out,
    ]);
    console.log(out);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
