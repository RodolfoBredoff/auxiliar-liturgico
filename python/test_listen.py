"""Testes do corte por pausa e do contexto do Whisper (sem microfone nem modelo).

Uso: python3 python/test_listen.py
"""

import json
import os
import sys
import tempfile
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from listen import SAMPLE_RATE, PauseSegmenter, PromptSource  # noqa: E402

STEP = int(SAMPLE_RATE * 0.1)


def tone(seconds, amplitude=0.2):
    t = np.arange(int(seconds * SAMPLE_RATE)) / SAMPLE_RATE
    return (amplitude * np.sin(2 * np.pi * 220 * t)).astype(np.float32)


def silence(seconds, amplitude=0.0005):
    rng = np.random.default_rng(1)
    return (amplitude * rng.standard_normal(int(seconds * SAMPLE_RATE))).astype(np.float32)


def run(audio, **kwargs):
    segmenter = PauseSegmenter(**kwargs)
    out = []
    for i in range(0, len(audio), STEP):
        out.extend(segmenter.feed(audio[i:i + STEP]))
    out.extend(segmenter.flush())
    return out


class PauseSegmenterTest(unittest.TestCase):
    def test_corta_nas_pausas(self):
        audio = np.concatenate([silence(1), tone(2), silence(1), tone(1.5), silence(1)])
        segments = run(audio)
        self.assertEqual(len(segments), 2)
        first, second = segments
        self.assertAlmostEqual(first[0], 1.0, delta=0.5)
        self.assertGreater(first[1] - first[0], 2.0)
        self.assertGreater(second[0], first[1])
        self.assertGreater(second[1] - second[0], 1.5)

    def test_ignora_ruido_curto(self):
        audio = np.concatenate([silence(1), tone(0.3), silence(1), tone(2), silence(1)])
        segments = run(audio)
        self.assertEqual(len(segments), 1)
        self.assertGreater(segments[0][0], 1.5)

    def test_fala_continua_fecha_no_tamanho_maximo(self):
        audio = np.concatenate([silence(0.5), tone(14), silence(1)])
        segments = run(audio, max_len=6.0)
        self.assertGreaterEqual(len(segments), 2)
        for start, end, chunk in segments:
            self.assertLessEqual(end - start, 6.5)
            self.assertEqual(len(chunk) / SAMPLE_RATE, end - start)

    def test_silencio_nao_gera_trechos(self):
        self.assertEqual(run(silence(5)), [])

    def test_trecho_final_sem_pausa_e_enviado(self):
        audio = np.concatenate([silence(0.5), tone(2)])
        self.assertEqual(len(run(audio)), 1)


class PromptSourceTest(unittest.TestCase):
    def test_recarrega_arquivo_quando_muda(self):
        with tempfile.TemporaryDirectory() as folder:
            path = os.path.join(folder, "prompt.json")
            source = PromptSource(prompt="inicial", path=path)
            self.assertEqual(source.get(), ("inicial", ""))

            with open(path, "w", encoding="utf-8") as handle:
                json.dump({"prompt": "Cantarei Teu Amor", "hotwords": "aleluia"}, handle)
            self.assertEqual(source.get(), ("Cantarei Teu Amor", "aleluia"))

            with open(path, "w", encoding="utf-8") as handle:
                handle.write("{ meio escrito")
            os.utime(path, (1, 1))
            self.assertEqual(source.get(), ("Cantarei Teu Amor", "aleluia"))


if __name__ == "__main__":
    unittest.main()
