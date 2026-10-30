"""Etapa 2: escuta o microfone em blocos curtos e transcreve cada bloco.

Escreve uma linha JSON por bloco na saída padrão, por exemplo:
    {"text": "agora vamos cantar teu amor", "start": 0.0, "end": 3.0, "emitted_at": 1730000000123}

Mensagens de status vão para a saída de erro, para não misturar com o JSON:
    Escutando ...        começou a captar áudio
    NIVEL 0.042          volume do microfone (RMS, 0 a 1), ~3 vezes por segundo
    ATRASO 2.4           segundos de áudio esperando transcrição (só quando há fila)

Com --file, lê um arquivo de áudio em vez do microfone (mesmos blocos), para testes.

Modos de corte do áudio:
    fixo (padrão)        blocos de --seconds com --overlap
    --pause-mode         fecha o bloco numa pausa da fala (ou ao chegar em 2x --seconds)

Contexto para o Whisper (nomes e termos do culto que vem a seguir):
    --prompt "texto"     fixo
    --prompt-file arq    JSON {"prompt": "...", "hotwords": "..."}; relido quando o arquivo muda

Uso:
    .venv/bin/python python/listen.py --model small --seconds 3 --overlap 1
    .venv/bin/python python/listen.py --list-devices
    .venv/bin/python python/listen.py --file test_audio/salmo.aiff
"""

import argparse
import inspect
import json
import os
import queue
import sys
import threading
import time

import numpy as np

SAMPLE_RATE = 16000


def log(message):
    print(message, file=sys.stderr, flush=True)


class PromptSource:
    """Entrega o contexto atual; recarrega o arquivo quando ele muda (o app o atualiza a cada item)."""

    def __init__(self, prompt="", hotwords="", path=None):
        self.prompt = prompt or ""
        self.hotwords = hotwords or ""
        self.path = path
        self._mtime = None

    def get(self):
        if self.path:
            try:
                mtime = os.path.getmtime(self.path)
                if mtime != self._mtime:
                    self._mtime = mtime
                    with open(self.path, encoding="utf-8") as handle:
                        data = json.load(handle)
                    self.prompt = str(data.get("prompt", ""))
                    self.hotwords = str(data.get("hotwords", ""))
            except (OSError, ValueError):
                pass  # sem arquivo ou arquivo meio escrito: segue com o último contexto
        return self.prompt, self.hotwords


def transcribe_kwargs(model, source):
    """Parâmetros opcionais do faster-whisper que a versão instalada aceitar."""
    prompt, hotwords = source.get() if source else ("", "")
    accepted = inspect.signature(model.transcribe).parameters
    kwargs = {}
    if prompt and "initial_prompt" in accepted:
        kwargs["initial_prompt"] = prompt
    if hotwords and "hotwords" in accepted:
        kwargs["hotwords"] = hotwords
    return kwargs


def transcribe(model, block, extra=None, source=None):
    t0 = time.time()
    segments, _ = model.transcribe(
        block,
        language="pt",
        vad_filter=True,
        condition_on_previous_text=False,
        **transcribe_kwargs(model, source),
    )
    transcribe_ms = int((time.time() - t0) * 1000)
    text = " ".join(segment.text.strip() for segment in segments).strip()
    if text:
        payload = {
            "text": text,
            "emitted_at": int(time.time() * 1000),
            "transcribe_ms": transcribe_ms,
            **(extra or {}),
        }
        print(json.dumps(payload, ensure_ascii=False), flush=True)
    return transcribe_ms / 1000.0


def iter_blocks(audio, block_size, hop_size):
    """Gera (start_sample, end_sample) com overlap entre janelas."""
    start = 0
    while start < len(audio):
        end = min(start + block_size, len(audio))
        if end - start < block_size // 2 and start > 0:
            break
        yield start, end
        if end >= len(audio):
            break
        start += hop_size


def rms(chunk):
    if len(chunk) == 0:
        return 0.0
    return float(np.sqrt(np.mean(np.square(chunk, dtype=np.float64))))


class PauseSegmenter:
    """Corta o áudio nas pausas da fala em vez de em blocos de tamanho fixo.

    Usa o volume (RMS) contra um piso de ruído que se ajusta sozinho. Um trecho fecha quando há
    `pause` segundos de silêncio depois de ao menos `min_speech` segundos de fala. Trechos
    contínuos (canto sem respiro) fecham em `max_len`, mantendo `keep` segundos de contexto.
    """

    def __init__(self, sample_rate=SAMPLE_RATE, min_speech=0.8, pause=0.5, max_len=6.0, keep=1.0,
                 preroll=0.3, min_threshold=0.008):
        self.sr = sample_rate
        self.min_speech = min_speech
        self.pause = pause
        self.max_len = max_len
        self.keep = keep
        self.preroll_len = preroll
        self.min_threshold = min_threshold
        self.floor = 0.003
        self.clock = 0.0          # segundos de áudio já recebidos
        self._reset_idle()

    def _reset_idle(self):
        self.active = False
        self.chunks = []
        self.preroll = []
        self.speech = 0.0
        self.silence = 0.0
        self.length = 0.0
        self.start = self.clock

    def _emit(self):
        audio = np.concatenate(self.chunks) if self.chunks else np.zeros(0, dtype=np.float32)
        return (self.start, self.start + len(audio) / self.sr, audio)

    def feed(self, chunk):
        """Recebe um pedaço de áudio e devolve a lista de trechos (inicio_s, fim_s, audio) prontos."""
        out = []
        duration = len(chunk) / self.sr
        level = rms(chunk)
        threshold = max(self.min_threshold, self.floor * 3)
        voiced = level > threshold
        self.clock += duration

        if not self.active:
            if voiced:
                self.active = True
                self.chunks = list(self.preroll) + [chunk]
                pre = sum(len(c) for c in self.preroll) / self.sr
                self.start = self.clock - duration - pre
                self.length = pre + duration
                self.speech = duration
                self.silence = 0.0
            else:
                self.floor = 0.95 * self.floor + 0.05 * level
                self.preroll.append(chunk)
                while sum(len(c) for c in self.preroll) / self.sr > self.preroll_len and len(self.preroll) > 1:
                    self.preroll.pop(0)
            return out

        self.chunks.append(chunk)
        self.length += duration
        if voiced:
            self.speech += duration
            self.silence = 0.0
        else:
            self.silence += duration

        if self.silence >= self.pause:
            if self.speech >= self.min_speech:
                out.append(self._emit())
            self._reset_idle()
        elif self.length >= self.max_len:
            out.append(self._emit())
            audio = np.concatenate(self.chunks)
            tail = audio[-int(self.keep * self.sr):]
            self.start = self.clock - len(tail) / self.sr
            self.chunks = [tail]
            self.length = len(tail) / self.sr
            self.speech = self.length
            self.silence = 0.0
        return out

    def flush(self):
        out = []
        if self.active and self.speech >= self.min_speech:
            out.append(self._emit())
        self._reset_idle()
        return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="small")
    parser.add_argument("--seconds", type=float, default=3)
    parser.add_argument("--overlap", type=float, default=1, help="segundos sobrepostos entre blocos")
    parser.add_argument("--device", default=None, help="número ou nome do microfone")
    parser.add_argument("--list-devices", action="store_true")
    parser.add_argument("--file", default=None, help="arquivo de áudio no lugar do microfone")
    parser.add_argument("--pause-mode", action="store_true", help="corta o áudio nas pausas da fala")
    parser.add_argument("--prompt", default="", help="contexto inicial para o Whisper")
    parser.add_argument("--hotwords", default="", help="palavras que o Whisper deve favorecer")
    parser.add_argument("--prompt-file", default=None, help="JSON com prompt e hotwords, relido ao mudar")
    args = parser.parse_args()

    source = PromptSource(args.prompt, args.hotwords, args.prompt_file)
    overlap = max(0.0, min(args.overlap, args.seconds - 0.5))
    block_size = int(SAMPLE_RATE * args.seconds)
    hop_size = max(1, int(SAMPLE_RATE * (args.seconds - overlap)))

    if args.list_devices:
        import sounddevice as sd

        log(sd.query_devices())
        return

    from faster_whisper import WhisperModel

    if args.file:
        from faster_whisper import decode_audio

        model = WhisperModel(args.model, device="cpu", compute_type="int8")
        audio = decode_audio(args.file, sampling_rate=SAMPLE_RATE)
        if args.pause_mode:
            segmenter = PauseSegmenter(max_len=args.seconds * 2)
            step = int(SAMPLE_RATE * 0.1)
            pieces = []
            for i in range(0, len(audio), step):
                pieces.extend(segmenter.feed(audio[i:i + step]))
            pieces.extend(segmenter.flush())
            for start, end, segment in pieces:
                transcribe(model, segment, {"start": start, "end": end}, source)
            return
        for start, end in iter_blocks(audio, block_size, hop_size):
            transcribe(
                model,
                audio[start:end],
                {"start": start / SAMPLE_RATE, "end": end / SAMPLE_RATE},
                source,
            )
        return

    import sounddevice as sd

    device = int(args.device) if args.device and args.device.isdigit() else args.device

    log(f"Carregando modelo '{args.model}'...")
    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    chunks = queue.Queue()
    level = [0.0]
    chunk_frames = int(SAMPLE_RATE * 0.1)

    def on_audio(data, frames, time_info, status):
        mono = data[:, 0].copy()
        level[0] = rms(mono)
        chunks.put(mono)

    def report_level():
        while True:
            time.sleep(0.3)
            log(f"NIVEL {level[0]:.3f}")

    threading.Thread(target=report_level, daemon=True).start()

    def report_lag():
        backlog = chunks.qsize() * chunk_frames / SAMPLE_RATE
        if backlog >= 1.0:
            log(f"ATRASO {backlog:.1f}")

    buffer = np.zeros(0, dtype=np.float32)
    audio_time = 0.0
    segmenter = PauseSegmenter(max_len=args.seconds * 2) if args.pause_mode else None

    with sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype="float32",
        device=device,
        blocksize=chunk_frames,
        callback=on_audio,
    ):
        mode = "por pausa" if segmenter else f"bloco {args.seconds}s, overlap {overlap}s"
        log(f"Escutando ({mode}). Ctrl+C para parar.")
        try:
            while True:
                chunk = chunks.get()
                if segmenter:
                    for start, end, segment in segmenter.feed(chunk):
                        transcribe(model, segment, {"start": start, "end": end}, source)
                        report_lag()
                    continue

                buffer = np.concatenate([buffer, chunk])
                if len(buffer) < block_size:
                    continue

                block = buffer[:block_size]
                buffer = buffer[hop_size:]
                start_sec = audio_time
                end_sec = audio_time + args.seconds
                audio_time += args.seconds - overlap
                transcribe(model, block, {"start": start_sec, "end": end_sec}, source)
                report_lag()
        except KeyboardInterrupt:
            log("Parado.")


if __name__ == "__main__":
    main()
