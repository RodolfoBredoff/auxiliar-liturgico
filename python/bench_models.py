"""Compara modelos do Whisper neste computador: tempo de carga, tempo por bloco e texto obtido.

Use um áudio real do culto (ou o que o `say` do macOS gerar) e rode antes de escolher o modelo.
O número que importa é "por bloco": precisa ser bem menor que o tamanho do bloco (ex.: < 1,5 s
para blocos de 3 s), senão a fila de áudio cresce e as sugestões chegam atrasadas.

Uso:
    .venv/bin/python python/bench_models.py caminho/audio.wav
    .venv/bin/python python/bench_models.py audio.wav --models tiny small medium large-v3-turbo
"""

import argparse
import statistics
import time

from faster_whisper import WhisperModel, decode_audio

SAMPLE_RATE = 16000


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio")
    parser.add_argument("--models", nargs="+", default=["tiny", "base", "small"])
    parser.add_argument("--seconds", type=float, default=3, help="tamanho do bloco")
    parser.add_argument("--compute-type", default="int8")
    args = parser.parse_args()

    audio = decode_audio(args.audio, sampling_rate=SAMPLE_RATE)
    size = int(args.seconds * SAMPLE_RATE)
    blocks = [audio[i:i + size] for i in range(0, len(audio) - size // 2, size)]
    print(f"{len(audio) / SAMPLE_RATE:.1f}s de áudio, {len(blocks)} blocos de {args.seconds}s\n")

    for name in args.models:
        t0 = time.time()
        try:
            model = WhisperModel(name, device="cpu", compute_type=args.compute_type)
        except Exception as error:  # modelo inexistente, sem rede, sem memória...
            print(f"{name}: falhou ao carregar ({error})\n")
            continue
        load = time.time() - t0

        times, texts = [], []
        for block in blocks:
            t0 = time.time()
            segments, _ = model.transcribe(block, language="pt", vad_filter=True)
            texts.append(" ".join(s.text.strip() for s in segments).strip())
            times.append(time.time() - t0)

        median = statistics.median(times)
        verdict = "ok" if median < args.seconds / 2 else "LENTO para tempo real"
        print(f"{name}: carga {load:.1f}s | por bloco mediana {median:.2f}s, máx {max(times):.2f}s | {verdict}")
        for text in texts[:3]:
            print(f"    {text}")
        print()


if __name__ == "__main__":
    main()
