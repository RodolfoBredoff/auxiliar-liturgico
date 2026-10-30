# Modelo de roteiro — SEDE (WorshipTools)

Referência: [`4 de out - SEDE.pdf`](../4%20de%20out%20-%20SEDE.pdf) (Planning by WorshipTools, 3 páginas).

## Estrutura do PDF

Cada linha útil combina **tempo**, **tipo de item** e **conteúdo**:

| Campo no PDF | Uso no app |
| --- | --- |
| Timestamp acumulado (`0:00`, `5:00`, `1:30:32`) | Metadado opcional `planned_duration_sec` em `external_ref` |
| Título do item (`MÚSICA 1: …`, `Salmo 19`, `Sermão: …`) | `service_items.title` |
| Texto longo (salmo, oração, ceia) | `content` (blocos por linha em branco) |
| Tom (`C`, `D`, `G`, `E`) no fim do título da música | `external_ref.musicKey` |
| Referência bíblica (`Mateus 21:33-46`) | `external_ref.scriptureRef` + texto colado pelo operador |
| `ARTE: …`, `VÍDEO: …` | `type=image` ou `blank` + nota em `content` |
| Cabeçalho de ciclo (`CICLO I – …`) | `type=section` |
| Funções / escalas (pág. 3) | Metadado do culto em `services.liturgy_notes` (texto livre) |

Ciclos no exemplo de 4/out/2026:

1. **CICLO I** — Acolhimento e Adoração (prelúdio, abertura, salmo, 3 músicas, oração comunitária)
2. **CICLO II** — Comunhão e Palavra (visitantes, artes, crianças, sermão ~40 min)
3. **CICLO III** — Mesa do Senhor (ceia, comunhão, texto ceia, oferta)
4. **CICLO IV** — Envio e Resposta (avisos, vídeos, artes, oração final)

## Gap vs schema anterior

| Necessidade | Antes | Depois (migração 002) |
| --- | --- | --- |
| Data / sede / notas do planejamento | Só `services.title` | `service_date`, `venue`, `liturgy_notes` |
| Destino da projeção (Presenter / PPT / nativo) | Só projetor interno | `output_target`, `external_ref` (JSON) |
| Duração planejada / tom / referência | — | Dentro de `external_ref` |

Tipos `video` / `countdown` **não** foram adicionados no MVP; vídeos e vinhetas viram `blank` ou `image` com descrição.

## Saída recomendada por tipo (padrão do import)

| Tipo | `output_target` padrão |
| --- | --- |
| `song` | `powerpoint` (`slideStart` = 1 por música; operador ajusta) |
| `text` (liturgia, salmo, ceia) | `presenter_midi` |
| `image` | `presenter_midi` |
| `blank`, `section` | `native` |

O operador pode alterar por item na tela de culto.

## Import

```bash
.venv/bin/python python/import_roteiro.py "../4 de out - SEDE.pdf"
```

Gera SQL em `app/seed/import_sede.sql` (revisável antes de aplicar no SQLite).
