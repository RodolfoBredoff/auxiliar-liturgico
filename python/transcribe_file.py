"""Etapa 1: transcreve arquivos de áudio controlados com faster-whisper.

Uso:
    .venv/bin/python python/transcribe_file.py audio1.m4a audio2.wav --model small
"""

import argparse
import time

from faster_whisper import WhisperModel


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="+")
    parser.add_argument("--model", default="small", help="tiny, base, small, medium...")
    args = parser.parse_args()

    start = time.time()
    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    print(f"Modelo '{args.model}' carregado em {time.time() - start:.1f}s\n")

    for path in args.files:
        start = time.time()
        segments, info = model.transcribe(path, language="pt", vad_filter=True)
        text = " ".join(segment.text.strip() for segment in segments)
        elapsed = time.time() - start

        print(f"Arquivo: {path}")
        print(f"Duração do áudio: {info.duration:.1f}s | Transcrição: {elapsed:.1f}s")
        print(f"Texto: {text}\n")


if __name__ == "__main__":
    main()
