"""POC: alinha áudio ao vivo/gravado com faixa de referência (sub-300 ms).

Uso:
  .venv/bin/python python/eval_track_sync.py --reference test_audio/voz_real.wav \\
      --live test_audio/voz_real.wav --hop-ms 100 \\
      --markers '[{"live_ms":15000,"ref_ms":15000}]'
"""

from __future__ import annotations

import argparse
import json
import sys

import numpy as np
from faster_whisper import decode_audio

from track_align import estimate_pos_ms

SAMPLE_RATE = 16000


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference", required=True)
    parser.add_argument("--live", required=True)
    parser.add_argument("--hop-ms", type=int, default=100)
    parser.add_argument("--window-ms", type=int, default=2000)
    parser.add_argument("--pa-delay-ms", type=int, default=0)
    parser.add_argument("--search-radius-ms", type=int, default=6000)
    parser.add_argument("--markers", default="", help='JSON: [{"live_ms": 15000, "ref_ms": 15000}]')
    args = parser.parse_args()

    ref = decode_audio(args.reference, sampling_rate=SAMPLE_RATE)
    live = decode_audio(args.live, sampling_rate=SAMPLE_RATE)

    hop_samples = int(SAMPLE_RATE * args.hop_ms / 1000)
    win_samples = int(SAMPLE_RATE * args.window_ms / 1000)

    results = []
    last_pos = 0.0
    for start in range(0, len(live) - win_samples, hop_samples):
        live_ms = start / SAMPLE_RATE * 1000
        search_center = last_pos if last_pos > 500 else live_ms
        pos_ms, score = estimate_pos_ms(
            live,
            ref,
            SAMPLE_RATE,
            start,
            win_samples,
            search_center_ms=search_center,
            search_radius_ms=args.search_radius_ms,
        )
        pos_ms = max(0.0, pos_ms - args.pa_delay_ms)
        if score > 0.5:
            last_pos = pos_ms
        results.append({"live_ms": int(live_ms), "pos_ms": int(pos_ms), "confidence": round(score, 4)})

    for row in results[::10]:
        print(json.dumps(row), flush=True)

    if args.markers:
        markers = json.loads(args.markers)
        errors = []
        for m in markers:
            live_ms = m["live_ms"]
            ref_ms = m["ref_ms"]
            nearest = min(results, key=lambda r: abs(r["live_ms"] - live_ms))
            errors.append(abs(nearest["pos_ms"] - ref_ms))
        errors.sort()
        med = errors[len(errors) // 2] if errors else float("nan")
        print(
            f"Marcadores: {len(errors)} erro_mediano_ms={med:.0f} max={max(errors):.0f}",
            file=sys.stderr,
        )
        print(f"CRITERIO_300ms: {'PASS' if med <= 300 else 'FAIL'}", file=sys.stderr)
    else:
        print(f"Amostras={len(results)} (use --markers para erro mediano)", file=sys.stderr)


if __name__ == "__main__":
    main()
