#!/usr/bin/env node
/**
 * Renders the Sem promo video.
 *
 *   node render.mjs --mode preview        # placeholders for missing recordings
 *   node render.mjs --mode final          # requires real Sem recordings
 *   node render.mjs --still 42.5          # single PNG frame at t=42.5s
 *   node render.mjs --from 20 --to 35     # render a time range only
 *
 * Pipeline:
 *   1. scenes.html draws every motion-graphics frame (Chromium, deterministic in t).
 *   2. ffmpeg composites the real screen recordings from recordings/<slot-id>.mp4
 *      into the browser-window content area, then mixes voice-over, music and
 *      Sem's own audio from the recordings.
 */
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REC_DIR = path.join(ROOT, 'recordings');
const AUDIO_DIR = path.join(ROOT, 'audio');
const BUILD_DIR = path.join(ROOT, 'build');
const VIDEO_EXTS = ['.mp4', '.mov', '.webm', '.mkv'];
const AUDIO_EXTS = ['.wav', '.mp3', '.m4a', '.aac', '.flac'];
const FADE = 0.3;

function parseArgs(argv) {
  const args = {mode: 'preview'};
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

function findFile(dir, base, exts) {
  for (const ext of exts) {
    const p = path.join(dir, base + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function hasAudioStream(file) {
  const res = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file]);
  return res.stdout.toString().trim().length > 0;
}

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

/** Expands the storyboard into a flat timeline and resolves recordings. */
function buildTimeline(board, mode) {
  const problems = [];
  const slots = board.slots.map((s) => ({...s}));

  // Scene 4: only features that are verified to exist in Sem make the final cut.
  const features = board.features.filter((f) => {
    const rec = findFile(REC_DIR, f.id, VIDEO_EXTS);
    return mode === 'preview' ? true : f.verified && rec;
  });
  if (features.length === 0) {
    problems.push('Scene 4 has no verified feature with a recording (set "verified": true and add recordings/<id>.mp4).');
  } else {
    const [a, b] = board.featureWindow;
    const step = (b - a) / features.length;
    features.forEach((f, i) => {
      slots.push({
        id: f.id,
        scene: 4,
        title: f.title,
        start: +(a + i * step).toFixed(3),
        end: +(a + (i + 1) * step).toFixed(3),
        keepAudio: f.keepAudio,
        trimStart: f.trimStart,
        crop: f.crop,
        unverified: !f.verified,
        record: f.record,
        pills: [{mode: 'typed', text: f.prompt}],
      });
    });
  }
  slots.sort((x, y) => x.start - y.start);

  for (const s of slots) {
    s.file = findFile(REC_DIR, s.id, VIDEO_EXTS);
    s.hasRecording = !!s.file;
    if (!s.file && mode === 'final') problems.push(`Missing recording: recordings/${s.id}.mp4 — ${s.record}`);
  }

  let logoDataUrl = null;
  const logo = findFile(path.join(ROOT, 'assets'), 'sem-logo', ['.png', '.svg', '.webp']);
  if (logo) {
    const mime = {'.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp'}[path.extname(logo)];
    logoDataUrl = `data:${mime};base64,${fs.readFileSync(logo).toString('base64')}`;
  }

  return {timeline: {...board, slots, logoDataUrl}, problems};
}

async function openRenderer(timeline) {
  const browser = await chromium.launch({executablePath: findChromium()});
  const page = await browser.newPage({viewport: {width: timeline.width, height: timeline.height}, deviceScaleFactor: 1});
  await page.goto(pathToFileURL(path.join(ROOT, 'scenes.html')).href);
  await page.evaluate((tl) => window.init(tl), timeline);
  await page.evaluate(() => document.fonts.ready);
  return {browser, page};
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {stdio: ['pipe', 'inherit', 'inherit'], ...opts});
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))));
    if (opts.feed) opts.feed(p.stdin).catch(reject);
  });
}

async function renderGraphics(timeline, from, to, fps, outFile) {
  const {browser, page} = await openRenderer(timeline);
  const total = Math.round((to - from) * fps);
  const started = Date.now();
  try {
    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps),
      outFile,
    ], {
      feed: async (stdin) => {
        for (let i = 0; i < total; i++) {
          const t = from + i / fps;
          await page.evaluate((tt) => window.renderAt(tt), t);
          const jpg = await page.screenshot({type: 'jpeg', quality: 94});
          if (!stdin.write(jpg)) await new Promise((r) => stdin.once('drain', r));
          if (i % fps === 0) {
            const eta = ((Date.now() - started) / (i + 1)) * (total - i - 1) / 1000;
            process.stdout.write(`\r  graphics ${t.toFixed(1)}s / ${to}s  (eta ${eta.toFixed(0)}s)   `);
          }
        }
        stdin.end();
        process.stdout.write('\n');
      },
    });
  } finally {
    await browser.close();
  }
}

/** Overlays recordings into the browser content area and mixes the audio. */
async function composite(timeline, graphicsFile, from, to, fps, outFile) {
  const [cx, cy, cw, ch] = timeline.contentRect;
  const dur = to - from;
  const inputs = ['-i', graphicsFile];
  const filters = [];
  const audioLabels = [];
  let base = '0:v';
  let idx = 1;

  const slots = timeline.slots.filter((s) => s.file && s.end > from && s.start < to);
  for (const s of slots) {
    const start = Math.max(s.start, from) - from;
    const end = Math.min(s.end, to) - from;
    const skip = (s.trimStart || 0) + Math.max(0, from - s.start);
    const len = end - start;
    inputs.push('-i', s.file);
    const crop = s.crop ? `crop=${s.crop.join(':')},` : '';
    filters.push(
      `[${idx}:v]trim=start=${skip}:duration=${len},setpts=PTS-STARTPTS+${start}/TB,fps=${fps},${crop}` +
      `scale=${cw}:${ch}:force_original_aspect_ratio=decrease,pad=${cw}:${ch}:(ow-iw)/2:(oh-ih)/2:color=0x06150f,` +
      `format=yuva420p,fade=in:st=${start}:d=${FADE}:alpha=1,fade=out:st=${end - FADE}:d=${FADE}:alpha=1[r${idx}]`,
      `[${base}][r${idx}]overlay=${cx}:${cy}:enable='between(t,${start},${end})':eof_action=pass[v${idx}]`,
    );
    base = `v${idx}`;
    if (s.keepAudio && hasAudioStream(s.file)) {
      const ms = Math.round(start * 1000);
      filters.push(
        `[${idx}:a]atrim=start=${skip}:duration=${len},asetpts=PTS-STARTPTS,` +
        `afade=in:d=${FADE},afade=out:st=${len - FADE}:d=${FADE},adelay=${ms}:all=1,apad=whole_dur=${dur}[ra${idx}]`,
      );
      audioLabels.push(`ra${idx}`);
    }
    idx++;
  }

  // Voice-over (starts at t=0 of the full timeline) and music bed.
  const vo = findFile(AUDIO_DIR, 'voiceover', AUDIO_EXTS);
  const music = findFile(AUDIO_DIR, 'music', AUDIO_EXTS);
  if (vo) {
    inputs.push('-i', vo);
    filters.push(`[${idx}:a]atrim=start=${from}:duration=${dur},asetpts=PTS-STARTPTS,apad=whole_dur=${dur}[vo]`);
    audioLabels.push('vo');
    idx++;
  }
  let musicLabel = null;
  if (music) {
    inputs.push('-stream_loop', '-1', '-i', music);
    filters.push(`[${idx}:a]atrim=start=${from}:duration=${dur},asetpts=PTS-STARTPTS,volume=0.35,afade=in:d=1.5,afade=out:st=${Math.max(0, dur - 3)}:d=3[mus]`);
    musicLabel = 'mus';
    idx++;
  }

  let audioOut = null;
  if (audioLabels.length) {
    // Speech = voice-over + Sem's own voice from the recordings.
    filters.push(`${audioLabels.map((l) => `[${l}]`).join('')}amix=inputs=${audioLabels.length}:duration=longest:normalize=0[speech]`);
    if (musicLabel) {
      // Duck the music under speech so the assistant's voice stays audible.
      filters.push('[speech]asplit=2[sp][key]');
      filters.push(`[${musicLabel}][key]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=400[ducked]`);
      filters.push('[sp][ducked]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[aout]');
    } else {
      filters.push('[speech]alimiter=limit=0.95[aout]');
    }
    audioOut = '[aout]';
  } else if (musicLabel) {
    audioOut = `[${musicLabel}]`;
  }

  const maps = ['-map', base.includes(':') ? base : `[${base}]`];
  if (audioOut) maps.push('-map', audioOut);
  else {
    inputs.push('-f', 'lavfi', '-t', String(dur), '-i', 'anullsrc=r=48000:cl=stereo');
    maps.push('-map', `${idx}:a`);
  }

  const args = ['-y', '-loglevel', 'error', ...inputs];
  if (filters.length) args.push('-filter_complex', filters.join(';'));
  args.push(...maps,
    '-t', String(dur),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart', outFile);
  await run('ffmpeg', args);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const board = JSON.parse(fs.readFileSync(path.join(ROOT, 'storyboard.json'), 'utf8'));
  const mode = args.mode === 'final' ? 'final' : 'preview';
  const {timeline, problems} = buildTimeline(board, mode);
  fs.mkdirSync(BUILD_DIR, {recursive: true});

  if (args.still !== undefined) {
    const t = Number(args.still === true ? 0 : args.still);
    const {browser, page} = await openRenderer(timeline);
    await page.evaluate((tt) => window.renderAt(tt), t);
    const out = args.out || path.join(BUILD_DIR, `still-${t.toFixed(2)}.png`);
    await page.screenshot({path: out});
    await browser.close();
    console.log(`Wrote ${out}`);
    return;
  }

  if (problems.length) {
    const log = mode === 'final' ? console.error : console.warn;
    log(`${mode === 'final' ? 'Cannot render final cut' : 'Preview notes'}:\n  - ${problems.join('\n  - ')}`);
    if (mode === 'final') process.exit(1);
  }

  const fps = Number(args.fps || timeline.fps);
  const from = Number(args.from || 0);
  const to = Math.min(Number(args.to || timeline.duration), timeline.duration);
  const graphics = path.join(BUILD_DIR, `graphics-${mode}.mp4`);
  const out = args.out || path.join(BUILD_DIR, `sem-promo-${mode}.mp4`);

  console.log(`Rendering ${mode} ${from}s → ${to}s at ${fps} fps`);
  await renderGraphics(timeline, from, to, fps, graphics);
  console.log('  compositing recordings + audio');
  await composite(timeline, graphics, from, to, fps, out);
  console.log(`Wrote ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
