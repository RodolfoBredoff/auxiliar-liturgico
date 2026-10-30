# Avaliação sync sub-300 ms (Fase 0)

## Experimento A — Pipeline textual (Whisper + matching)

Gravação: [`test_audio/voz_real.wav`](../test_audio/voz_real.wav) (extraída do culto).

| Bloco | Mediana atraso até estrofe correta |
| --- | --- |
| 3 s | **10007 ms** — FAIL |
| 1 s | **16008 ms** — FAIL |

Script: [`app/scripts/text_sync_latency.ts`](../app/scripts/text_sync_latency.ts)

**Conclusão:** o caminho textual **não** atinge &lt;300 ms; confirma necessidade de track sync.

## Experimento B — POC referência (correlação)

Script: [`python/eval_track_sync.py`](../python/eval_track_sync.py) + [`python/track_align.py`](../python/track_align.py)

| Cenário | Erro mediano | Critério 300 ms |
| --- | --- | --- |
| `letras_sintetico.aiff` ref = live (sanity) | **0 ms** | PASS |
| `voz_real.wav` ref = live (sanity) | **0 ms** | PASS |
| `voz_real` live vs `letras` ref (arranjos diferentes) | não calibrado | N/A até backing oficial |

## Experimento C — Timeline

- Automático: [`python/build_timeline.py`](../python/build_timeline.py) → [`test_audio/pilot_timeline.json`](../test_audio/pilot_timeline.json) (revisar letra vs áudio).
- Culto real: [`test_audio/pilot_timeline_voz_real.json`](../test_audio/pilot_timeline_voz_real.json) (marcadores manuais aproximados para Cantarei Teu Amor).

## Go / No-Go (DEC-031)

**GO** para integração **modo hybrid** no app:

1. Texto/Whisper permanece para liturgia e fallback.
2. Track sync (`sync_ref.py`) quando a música tem `reference_audio_path` + `timeline_json`.
3. Exige **backing/ensaio** como referência (mesmo arranjo do domingo).

**NO-GO** para prometer &lt;300 ms **sem** faixa de referência alinhada ao click/backing.

Próximo passo operacional: cadastrar WAV de backing por música piloto e calibrar `pa_delay_ms` na mesa.
