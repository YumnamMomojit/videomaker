#!/usr/bin/env bash
# One-time setup for the Kokoro narration voice (offline TTS).
#
# Fetches the Kokoro-82M ONNX model and the stock voice styles from the npm
# registry (they are published there as plain data files), verifies the model
# checksum, and creates a small Python venv for tts_kokoro.py.
#
#   ./setup_voice.sh
set -euo pipefail
cd "$(dirname "$0")"

MODEL_SHA256=fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478
mkdir -p models
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

if [ ! -f models/kokoro-q8.onnx ]; then
  echo "Fetching Kokoro-82M q8 model…"
  (cd "$tmp" && npm pack kokoro-q8-shards@1.0.0 --silent >/dev/null && tar xzf kokoro-q8-shards-1.0.0.tgz)
  cat "$tmp"/package/kokoro-q8.part{0,1,2,3,4,5}.bin > models/kokoro-q8.onnx
fi
echo "$MODEL_SHA256  models/kokoro-q8.onnx" | sha256sum -c -

if [ ! -d .venv ]; then
  python3 -m venv .venv
  .venv/bin/pip install -q --upgrade pip
  .venv/bin/pip install -q -r requirements.txt
fi

if [ ! -f models/voices.npz ]; then
  echo "Fetching Kokoro voice styles…"
  (cd "$tmp" && npm pack kokoro-local-runtime@0.1.0 --silent >/dev/null && tar xzf kokoro-local-runtime-0.1.0.tgz)
  .venv/bin/python - "$tmp/package/voices" models/voices.npz <<'PY'
import glob, os, sys
import numpy as np
src, dst = sys.argv[1], sys.argv[2]
voices = {os.path.basename(f)[:-4]: np.fromfile(f, dtype=np.float32).reshape(-1, 1, 256)
          for f in sorted(glob.glob(os.path.join(src, "*.bin")))}
np.savez(dst, **voices)
print(f"{len(voices)} voices → {dst}")
PY
fi
echo "Voice ready."
