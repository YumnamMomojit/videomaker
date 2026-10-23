# RAG session video — Centre of AI, Indira University

A ~2 min 36 s, 1920×1080 explainer video, **"Retrieval-Augmented Generation (RAG):
what it is and how it is used in finance"**. All on-screen text, the animation
and the music are generated from code.

| Time | Scene |
|---|---|
| 0:00 | Title: Indira University logo, Centre of AI presents |
| 0:07 | 01 · The problem: knowledge cut-off, hallucinations, no access to private data |
| 0:21 | 02 · What is RAG: Retrieve → Augment → Generate, "open-book exam" analogy |
| 0:34 | 03 · How RAG works: indexing pipeline and question-time pipeline (animated) |
| 0:55 | 04 · Why finance needs RAG |
| 1:06 | 05 · Six finance use cases: compliance Q&A, report analysis, customer service, underwriting, fraud/AML, investment research |
| 1:36 | 06 · RAG in action: a bank policy assistant (illustrative, sample documents) |
| 1:53 | 07 · Beyond Q&A — an AI research notebook built on RAG: add sources (PDF, docs, web, video), then grounded chat, briefing docs, study guides & FAQs, audio overviews, mind maps, timelines |
| 2:17 | 08 · Benefits and watch-outs |
| 2:29 | Thank you / end card |

## Build

Requirements: Node 18+, Google Chrome or Microsoft Edge (or set `CHROMIUM_PATH`),
and ffmpeg (on `PATH`, at `.tools/ffmpeg.exe`, or set `FFMPEG_PATH`).

```bash
npm install
node render.mjs                 # → build/rag-in-finance.mp4
node render.mjs --still 42.5    # → build/still-42.50.png, one frame for checking layout
node render.mjs --from 34 --to 55
```

- **Text and timing** are in `scenes.html`. Each scene's length is set in the
  `SCENES` list, and each element's entry time is set with `data-in` (seconds
  into the scene).
- **Logo:** `assets/indira-logo.png` is the original.
  `assets/indira-logo-transparent.png` is the same logo with its outer white
  background removed, and it is the one the video uses.
- **Music** is a soft chord pad with a chime at each scene change, generated in
  `render.mjs`.
