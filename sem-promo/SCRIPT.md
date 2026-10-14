# Stop Just Chatting with AI — Start Working with Sem

**Runtime:** 90 s · 1920×1080 · 30 fps
**Brand:** SEMDOK — Sem AI Assistant · https://live.semdok.com
**Palette:** emerald `#10b981`, forest `#062019` / `#03110c`, metallic gold `#d4af37` → `#f5df8e`
**Type:** Inter Display (headlines), Inter (UI / pills)

Rule for the whole film: every Sem screen is a real screen recording of the
current Sem build. No mocked Sem UI, no invented answers, no features Sem does
not have. Motion graphics only frame the recordings.

---

## Shot list

| Time | Scene | Picture | On-screen text | Slot |
|---|---|---|---|---|
| 0.0–5.4 | 1 Hook | Generic, unbranded grey chatbot: user types a question, gets a one-line text answer, starts typing again. | “AI can answer your questions.” | — (motion graphic) |
| 5.4–7.6 | 1 Hook | Dark emerald field, headline. | “But what if AI could help you **get things done?**” | — |
| 7.6–10.2 | 1 Hook | Sem logo reveal, gold light sweep, SEMDOK underline. | — | — |
| 10.0–19.8 | 2 Meet Sem | Browser window (`live.semdok.com`) with recording. Pill: typed prompt, then voice pill. | “Meet Sem — your AI assistant by **SEMDOK.**” | `s2-hello` |
| 20–23 | 3 Ask | Recording | “Ask. Explore. Learn. Create.” (words light up one by one) | `s3-agentic` |
| 23–26 | 3 Ask | Recording | 〃 | `s3-plan` |
| 26–29 | 3 Ask | Recording | 〃 | `s3-summarize` |
| 29–32 | 3 Ask | Recording | 〃 | `s3-email` |
| 32–35 | 3 Ask | Recording | 〃 | `s3-code` |
| 35–55 | 4 Beyond | Verified features only, 20 s split evenly. Feature name top-left, instruction in pill. | “From questions to **practical outcomes.**” | `s4-*` |
| 55–61 | 5 Voice+Text | Typed prompt recording | “Your choice. **Your conversation.**” | `s5-typed` |
| 61–70 | 5 Voice+Text | Spoken follow-up, waveform pill, Sem's voice audible | 〃 | `s5-voice` |
| 70–75.6 | 6 Close | Clean idle Sem interface | — | `s6-clean` |
| 76–78.9 | 6 Close | Logo reveal | — | — |
| 78.9–84.6 | 6 Close | Two-line headline | “Stop Just Chatting with AI.” / “Start Working with **Sem.**” | — |
| 84.6–90 | 6 Close | Logo + end card, fade to black | “SEM — **Your AI. Live.**” · “Explore Sem at **live.semdok.com**” · “Discover what you can do with Sem.” | — |

---

## Voice-over (≈ 190 words, upbeat and confident)

Record as one take to `audio/voiceover.wav`, starting at 0:00. Leave the
bracketed gaps silent so Sem's own voice is heard.

| Cue | Line |
|---|---|
| 0:01 | AI can answer your questions. |
| 0:05 | But what if it could help you actually get things done? |
| 0:08 | *(beat — logo)* |
| 0:10.5 | Meet Sem — the AI assistant by SEMDOK. |
| 0:13 | *[silence ~4 s — Sem's spoken reply plays]* |
| 0:17 | Type to it… or just talk. |
| 0:20 | Ask Sem to explain a big idea. Plan your day. Summarize information. Draft a professional email. Or walk through code, step by step. |
| 0:35 | And Sem goes beyond conversation. |
| 0:38 | Give it a real task — like turning scattered meeting notes into clear action items — and get a result you can actually use. |
| 0:50 | From questions… to practical outcomes. |
| 0:55 | Start with text. |
| 0:58 | *[silence — Sem answers]* |
| 1:01 | Then follow up with your voice. |
| 1:03 | *[silence ~6 s — Sem's spoken reply]* |
| 1:09 | Your choice. Your conversation. |
| 1:16 | Stop just chatting with AI. |
| 1:20 | Start working with Sem. |
| 1:24 | Sem — your AI. Live. |
| 1:26 | Explore Sem at live dot semdok dot com. |

If Scene 4 ends up showing additional verified features (files, browsing,
scheduling), add one short line naming them — and only them — at 0:44.

**Music:** `audio/music.mp3` — light, modern, mid-tempo. It is mixed at -9 dB
and automatically ducked under the voice-over and Sem's voice.

---

## Recording checklist (on https://live.semdok.com)

Capture setup: 1920×1080 browser at 125–150 % zoom so text is legible, clean
browser profile, no bookmarks bar, system audio on for clips marked 🔊. Save
each clip as `recordings/<slot-id>.mp4`. Use Sem's real responses — re-record
rather than edit text.

| Slot | Length | 🔊 | What to record |
|---|---|---|---|
| `s2-hello` | 9.2 s | 🔊 | Type “Hi Sem, what can you help me with?”, send, Sem replies in text + voice. Then switch to voice input once. |
| `s3-agentic` | 3 s | | “Explain agentic AI in simple terms.” → answer |
| `s3-plan` | 3 s | | “Help me plan my day.” → answer |
| `s3-summarize` | 3 s | | Paste a paragraph + “Summarize this information.” → summary |
| `s3-email` | 3 s | | “Help me write a professional email.” (+ one line of context) → draft |
| `s3-code` | 3 s | 🔊 | Paste a short function + “Explain this code step by step.” → explanation (voice playback if supported) |
| `s4-notes` | — | | Paste rough notes + “Sem, help me organize these notes into clear action items.” → list |
| `s4-files` | — | | **Only if supported:** working with files in the user's workspace |
| `s4-browse` | — | | **Only if supported:** browsing a website |
| `s4-code` | — | | Writing and explaining code |
| `s4-schedule` | — | | **Only if supported:** creating a task/event, show the created item |
| `s5-typed` | 6 s | 🔊 | Type “Explain cloud computing.” → answer |
| `s5-voice` | 9 s | 🔊 | Same chat, ask aloud “Can you give me a real-world example?” → spoken reply |
| `s6-clean` | 5.6 s | | Clean, idle Sem interface |

Long takes are fine: set `trimStart` (seconds) on the slot in
`storyboard.json` to choose the best moment, and `crop: [x, y, w, h]` to zoom
into the important part of the screen.

For each Scene 4 feature that you have confirmed works in the current Sem
build, set `"verified": true`. Unverified or unrecorded features are dropped
from the final cut automatically and the remaining ones share the 20 s.
