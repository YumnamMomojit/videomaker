# Sem promo video — renderer

Produces the 90-second **“Stop Just Chatting with AI — Start Working with Sem”**
video for SEMDOK. Motion graphics (logo, headlines, captions, browser frame,
prompt pills, end card) are generated here; every Sem screen comes from a real
screen recording you drop into `recordings/`.

See [SCRIPT.md](SCRIPT.md) for the shot list, voice-over and recording checklist.

## Requirements

Node 18+, ffmpeg, and a Chromium binary (auto-detected under
`$PLAYWRIGHT_BROWSERS_PATH`, or set `CHROMIUM_PATH`).

```bash
cd sem-promo
npm install
```

## Usage

```bash
npm run preview            # build/sem-promo-preview.mp4 — labelled placeholders for missing clips
npm run final              # build/sem-promo-final.mp4 — fails until every required clip exists
npm run still -- 42.5      # build/still-42.50.png — one frame, for quick design checks
node render.mjs --from 20 --to 35   # render only part of the timeline
```

## Inputs

| Path | Purpose |
|---|---|
| `recordings/<slot-id>.mp4` (`.mov`, `.webm`, `.mkv`) | Real Sem screen recordings, one per slot in `storyboard.json` |
| `audio/voiceover.wav` (or `.mp3` / `.m4a`) | Voice-over, starting at 0:00 |
| `audio/music.mp3` | Music bed — looped, faded, ducked under speech |
| `assets/sem-logo.png` (or `.svg`) | Official Sem logo; without it a typographic “Sem” wordmark is used |

Recordings are scaled to fit the 1344×756 browser content area. Per slot you
can set `trimStart` (seconds into the clip), `crop` (`[x, y, w, h]` to zoom in)
and `keepAudio` (include Sem's own voice from the clip).

## Honesty guard

Scene 4 features are listed in `storyboard.json` with `"verified": false`.
The final render includes a feature only when it is marked `"verified": true`
**and** has a recording, so nothing Sem cannot actually do reaches the cut.
The preview shows unverified features with a “VERIFY FEATURE EXISTS” badge.

Recordings, audio and `build/` are git-ignored.

---

# Tutorial video — “Getting Started with Sem”

`tutorial/` builds an ~80 s narrated tutorial from the real Sem screen
recording in the repo root, fully from code:

```bash
cd sem-promo/tutorial
voice/setup_voice.sh           # one-time: Kokoro model + voices from npm, Python venv
node build.mjs                 # → build/tutorial/sem-tutorial.mp4 + .srt
node build.mjs --still 41      # one frame, for layout checks
```

- **Steps** live in `tutorial/tutorial.json`: per step a camera `view`
  (source-pixel rect to zoom into), `callouts`, an on-screen `caption` and the
  narration text `say`. Step lengths follow the narration automatically.
- **Narration** uses a Kokoro-82M neural voice tuned to sound like Sem
  (`tts` in `tutorial.json` → `voice/sem_voice.json`): a blend of stock
  Kokoro voices (af_sarah, af_kore, af_aoede, af_heart), speed 0.93 and a
  light EQ toward Sem's recorded tone. It was picked from ~270 measured
  candidates by speaker similarity to Sem's real voice (Resemblyzer) plus
  pitch, intonation and pace: ~0.82 similarity on the tutorial lines versus
  0.62 for the old Festival voice. To fall back to Festival, set
  `"tts": {"engine": "festival", "voice": "cmu_us_slt_arctic_hts"}` and
  `apt-get install festival festvox-us-slt-hts`. The narration is also
  written out as an `.srt` subtitle file.
- **Sem's own voice** comes from the recording during the `play` step.
- **Music** is a soft generated chord pad, ducked under all speech.
- **Privacy:** `privacyMasks` cover the browser bookmarks bar and profile
  picture visible in the recording.

Everything described in the narration is visible in the recording (address,
avatar with spoken replies and subtitles, message box and send arrow,
microphone/speaker button, top-right toolbar). The toolbar icons' individual
functions are not narrated because the recording doesn't demonstrate them.
