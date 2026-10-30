# Latência da transcrição (benchmark)

Comando:

```bash
.venv/bin/python python/listen.py --file test_audio/salmo_sintetico.aiff --seconds 5 --overlap 0 > /tmp/5s.jsonl
.venv/bin/python python/listen.py --file test_audio/salmo_sintetico.aiff --seconds 3 --overlap 1 > /tmp/3s.jsonl
cd app && node scripts/latency_report.ts /tmp/5s.jsonl /tmp/3s.jsonl
```

Exemplo (Mac M-series, modelo `small`, CPU int8):

| Config | Blocos | transcribe_ms (média) |
| --- | --- | --- |
| 5 s, overlap 0 | 2 | ~176 |
| 3 s, overlap 1 | 5 | ~31 |

Blocos menores reduzem o tempo de inferência por chamada e permitem reagir mais cedo ao canto, ao custo de mais chamadas ao Whisper.

A latência percebida na execução também inclui:

- tempo até fechar o buffer de áudio (`block_seconds` − overlap);
- auto-avanço em músicas (DEC-030), que elimina o clique em MOSTRAR no louvor.

Reavalie com gravação real de culto (`test_audio/`) antes de mudar o limiar de confiança.
