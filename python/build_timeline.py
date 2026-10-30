"""Gera timeline estrofe ↔ ms a partir de áudio de referência + letra.

Usa faster-whisper por segmento e mapeia texto ao bloco mais parecido.

Uso:
  .venv/bin/python python/build_timeline.py \\
    --audio test_audio/letras_sintetico.aiff \\
    --lyrics-file app/seed/pilot_cantarei_teus_amor.txt \\
    --out test_audio/pilot_timeline.json
"""

import argparse
import json
import re
import sys

from faster_whisper import WhisperModel, decode_audio

SAMPLE_RATE = 16000


def split_blocks(text: str) -> list[str]:
    return [b.strip() for b in re.split(r"\n\s*\n", text.strip()) if b.strip()]


def normalize(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def overlap_score(a: str, b: str) -> float:
    wa = set(normalize(a).split())
    wb = set(normalize(b).split())
    if not wa:
        return 0.0
    return len(wa & wb) / len(wa)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", required=True)
    parser.add_argument("--lyrics-file", required=True)
    parser.add_argument("--model", default="small")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    lyrics = open(args.lyrics_file, encoding="utf-8").read()
    blocks = split_blocks(lyrics)

    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    audio = decode_audio(args.audio, sampling_rate=SAMPLE_RATE)
    segments, _ = model.transcribe(audio, language="pt", vad_filter=True)

    markers: list[dict] = []
    seen_blocks: set[int] = set()

    for seg in segments:
        text = seg.text.strip()
        if not text:
            continue
        best_i = max(range(len(blocks)), key=lambda i: overlap_score(text, blocks[i]))
        if best_i in seen_blocks:
            continue
        if overlap_score(text, blocks[best_i]) < 0.25:
            continue
        seen_blocks.add(best_i)
        start_ms = int(seg.start * 1000)
        markers.append({"start_ms": start_ms, "block_index": best_i, "hint": text[:60]})

    markers.sort(key=lambda m: m["start_ms"])
    payload = {"markers": markers, "blocks": blocks}
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"Timeline: {len(markers)} marcadores → {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
