"""Modo track sync: emite pos_ms na referência ~10 Hz (JSON por linha).

Uso:
  .venv/bin/python python/sync_ref.py --reference path.wav [--device N]
  .venv/bin/python python/sync_ref.py --reference path.wav --file live.wav
"""

import argparse
import json
import queue
import sys
import time

import numpy as np
import sounddevice as sd
from faster_whisper import decode_audio

from track_align import estimate_pos_ms

SAMPLE_RATE = 16000


def log(msg):
    print(msg, file=sys.stderr, flush=True)


def process_windows(ref, live: np.ndarray, hop_ms, window_ms, pa_delay_ms, song_id):
    hop_samples = int(SAMPLE_RATE * hop_ms / 1000)
    win_samples = int(SAMPLE_RATE * window_ms / 1000)
    last_pos = 0.0

    for start in range(0, max(1, len(live) - win_samples), hop_samples):
        live_ms = start / SAMPLE_RATE * 1000
        search_center = last_pos if last_pos > 500 else live_ms
        pos_ms, score = estimate_pos_ms(
            live,
            ref,
            SAMPLE_RATE,
            start,
            win_samples,
            search_center_ms=search_center,
            search_radius_ms=5000,
        )
        pos_ms = max(0.0, pos_ms - pa_delay_ms)
        if score > 0.3:
            last_pos = pos_ms
        print(
            json.dumps(
                {
                    "mode": "track",
                    "song_id": song_id,
                    "pos_ms": int(pos_ms),
                    "confidence": round(float(score), 4),
                    "emitted_at": int(time.time() * 1000),
                },
                ensure_ascii=False,
            ),
            flush=True,
        )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference", required=True)
    parser.add_argument("--file", default=None)
    parser.add_argument("--device", default=None)
    parser.add_argument("--hop-ms", type=int, default=100)
    parser.add_argument("--window-ms", type=int, default=2000)
    parser.add_argument("--pa-delay-ms", type=int, default=0)
    parser.add_argument("--song-id", type=int, default=0)
    args = parser.parse_args()

    ref = decode_audio(args.reference, sampling_rate=SAMPLE_RATE)

    if args.file:
        live = decode_audio(args.file, sampling_rate=SAMPLE_RATE)
        process_windows(ref, live, args.hop_ms, args.window_ms, args.pa_delay_ms, args.song_id)
        return

    device = int(args.device) if args.device and args.device.isdigit() else args.device
    q = queue.Queue()
    win_samples = int(SAMPLE_RATE * args.window_ms / 1000)
    hop_samples = int(SAMPLE_RATE * args.hop_ms / 1000)
    buffer = np.zeros(0, dtype=np.float32)
    live_samples = 0
    last_pos = 0.0

    def on_audio(data, frames, time_info, status):
        q.put(data[:, 0].copy())

    log("Track sync escutando...")
    with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="float32", device=device, callback=on_audio):
        try:
            while True:
                buffer = np.concatenate([buffer, q.get()])
                while len(buffer) >= win_samples:
                    start = live_samples
                    live_ms = start / SAMPLE_RATE * 1000
                    search_center = last_pos if last_pos > 500 else live_ms
                    pos_ms, score = estimate_pos_ms(
                        buffer,
                        ref,
                        SAMPLE_RATE,
                        0,
                        win_samples,
                        search_center_ms=search_center,
                        search_radius_ms=5000,
                    )
                    pos_ms = max(0.0, pos_ms - args.pa_delay_ms)
                    if score > 0.3:
                        last_pos = pos_ms
                    print(
                        json.dumps(
                            {
                                "mode": "track",
                                "song_id": args.song_id,
                                "pos_ms": int(pos_ms),
                                "confidence": round(float(score), 4),
                                "emitted_at": int(time.time() * 1000),
                            },
                            ensure_ascii=False,
                        ),
                        flush=True,
                    )
                    buffer = buffer[hop_samples:]
                    live_samples += hop_samples
        except KeyboardInterrupt:
            log("Parado.")


if __name__ == "__main__":
    main()
