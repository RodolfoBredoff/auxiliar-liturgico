"""Núcleo de alinhamento áudio ao vivo ↔ referência (numpy correlate)."""

from __future__ import annotations

import numpy as np


def estimate_pos_ms(
    live: np.ndarray,
    ref: np.ndarray,
    sr: int,
    live_start_sample: int,
    window_samples: int,
    search_center_ms: float,
    search_radius_ms: float = 8000,
) -> tuple[float, float]:
    """Retorna (pos_ms na referência, score)."""
    end = live_start_sample + window_samples
    if live_start_sample >= len(live):
        return 0.0, 0.0
    win = live[live_start_sample:min(end, len(live))].astype(np.float32)
    if len(win) < sr // 10:
        return 0.0, 0.0
    win = win - np.mean(win)
    norm = np.linalg.norm(win)
    if norm < 1e-6:
        return 0.0, 0.0
    win /= norm

    center = int(search_center_ms * sr / 1000)
    radius = int(search_radius_ms * sr / 1000)
    lo = max(0, center - radius)
    hi = min(len(ref), center + radius + len(win))
    segment = ref[lo:hi].astype(np.float32)
    if len(segment) < len(win):
        return 0.0, 0.0

    corr = np.correlate(segment, win, mode="valid")
    if len(corr) == 0:
        return 0.0, 0.0
    best = int(np.argmax(corr))
    score = float(corr[best])
    pos_sample = lo + best
    return pos_sample / sr * 1000, score
