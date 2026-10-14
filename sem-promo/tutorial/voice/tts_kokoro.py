#!/usr/bin/env python3
"""Batch Kokoro TTS with the Sem-matched voice recipe.

Reads a JSON list of {"text": ..., "out": ...} from stdin and writes one
24 kHz mono WAV per item, so the model is loaded once per build.

    echo '[{"text": "Hello", "out": "hello.wav"}]' | .venv/bin/python tts_kokoro.py sem_voice.json

The recipe (sem_voice.json) holds the voice blend, speed, pitch shift and the
EQ curve that moves Kokoro's tone toward Sem's recorded voice.
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve, firwin2

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 24000


def blend(voices, weights):
    total = sum(weights.values())
    return sum((w / total) * voices[name] for name, w in weights.items()).astype(np.float32)


def pitch_shift(wav, semitones):
    if abs(semitones) < 1e-3:
        return wav
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "in.wav"), os.path.join(d, "out.wav")
        sf.write(a, wav, SR, subtype="FLOAT")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", a, "-af",
                        f"rubberband=pitch={2 ** (semitones / 12):.6f}:formant=preserved:pitchq=quality:transients=smooth",
                        "-ar", str(SR), "-c:a", "pcm_f32le", b], check=True)
        out, _ = sf.read(b, dtype="float32")
    return out


def apply_eq(wav, freqs, gain_db, strength, numtaps=1023):
    if strength <= 0:
        return wav
    f = np.concatenate([[0.0], np.asarray(freqs, float), [SR / 2]])
    g = np.asarray(gain_db, float)
    g = np.concatenate([[g[0]], g, [g[-1]]])
    taps = firwin2(numtaps, f / (SR / 2), 10 ** (strength * g / 20))
    return fftconvolve(wav, taps, mode="full")[numtaps // 2: numtaps // 2 + len(wav)].astype(np.float32)


def main():
    from kokoro_onnx import Kokoro

    recipe = json.load(open(sys.argv[1]))
    jobs = json.load(sys.stdin)
    kokoro = Kokoro(os.path.join(HERE, "models", "kokoro-q8.onnx"), os.path.join(HERE, "models", "voices.npz"))
    voices = dict(np.load(os.path.join(HERE, "models", "voices.npz")))
    style = blend(voices, recipe["voice"])
    eq = recipe.get("eq") or {}
    for job in jobs:
        wav, sr = kokoro.create(job["text"], voice=style, speed=recipe.get("speed", 1.0), lang="en-us")
        wav = pitch_shift(np.asarray(wav, np.float32), recipe.get("pitch_st", 0.0))
        if eq:
            wav = apply_eq(wav, eq["freqs"], eq["gain_db"], recipe.get("eq_strength", 1.0))
        peak = np.max(np.abs(wav))
        if peak > 0:
            wav = wav * (0.89 / peak)
        sf.write(job["out"], wav, SR)
        print(job["out"], flush=True)


if __name__ == "__main__":
    main()
