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
