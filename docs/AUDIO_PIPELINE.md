# Audio Pipeline

## Objetivo

Receber áudio do microfone, transformar em texto e comparar o texto com os próximos itens da sequência do culto.

## Fluxo

```text
Microfone
   ↓
Script Python local
   (captura + faster-whisper)
   ↓
Transcrição
   ↓
Normalização          ← a partir daqui, TypeScript
   ↓
Matching
   ↓
Sugestão
```

## 1. Script Python local

O faster-whisper é uma biblioteca Python.

Por isso existe um único script Python local, iniciado pelo Tauri.

O script:

1. captura o microfone em blocos curtos (padrão **3 s**, overlap **1 s** — `settings`)
2. transcreve cada bloco com faster-whisper
3. escreve uma linha JSON por bloco na saída padrão

```json
{"text": "agora vamos cantar teu amor"}
```

O Tauri lê essas linhas e entrega o texto para a interface.

O script não acessa o banco e não faz matching.

Não enviar o áudio para serviços externos.

No MVP o script roda com o Python instalado no computador. Não empacotar o Python dentro do aplicativo.

## 2. Pausar escuta

O operador pode pausar e retomar a escuta a qualquer momento.

Pausar significa parar o script. Retomar significa iniciá-lo novamente.

Útil durante o sermão ou outros momentos longos sem texto preparado.

## 3. Transcrição

Usar faster-whisper localmente, em português.

Usar o filtro de voz (VAD) do próprio faster-whisper para ignorar silêncio e reduzir texto inventado.

O modelo (`tiny`, `base`, `small`...) será escolhido no primeiro teste, equilibrando qualidade e velocidade no computador da igreja.

## 4. Normalização

Antes do matching, normalizar o texto.

* converter para minúsculas
* remover pontuação
* normalizar espaços
* remover acentuação

## 5. Matching

O matching roda em TypeScript, na aplicação.

### Candidatos

Comparar somente com:

* o item atual
* os próximos itens da sequência que tenham texto (quantidade definida em `match_window`)

Itens `section`, `blank` e `image` não são candidatos.

Não comparar com todas as músicas cadastradas.

### Comparação

Para cada candidato, comparar a transcrição com:

* o título do item (detecta anúncios como "vamos cantar Teu Amor")
* cada bloco da letra ou do texto (detecta o trecho)

### Resultado

```text
Item: Música 2 — Teu Amor
Trecho: estrofe 3
Confiança: 94%
```

Exemplo:

Transcrição:

```text
teu amor nunca falha
```

Bloco cadastrado:

```text
teu amor nunca falha
sempre está comigo
```

Resultado:

```text
Música: Teu Amor
Trecho: estrofe 1
Confiança: alta
```

## 6. Sugestão

Quando o matching atingir o nível mínimo definido:

```text
Possível item:

Música 2 — Teu Amor
Estrofe 1

[ MOSTRAR ]
[ IGNORAR ]
```

O operador decide.

* **MOSTRAR**: vai para o item e o trecho sugeridos na sequência e os exibe na apresentação.
* **IGNORAR**: descarta a sugestão.

Não sugerir o que já está sendo exibido.

Regras do MVP:

* uma sugestão nova substitui a anterior
* a sugestão some quando o operador chega manualmente ao item e trecho sugeridos
* uma sugestão ignorada (mesmo item e trecho) não volta por 20 segundos
* atalhos: Enter = MOSTRAR, Esc = IGNORAR

## 7. Confiança

No início, usar um cálculo simples: proporção de palavras da transcrição que aparecem no bloco.

Refinamentos (tamanho do trecho, ordem das palavras) somente se o cálculo simples falhar nos testes.

Limite padrão: 60% (`confidence_threshold = 0.6`). Mantido após os testes com áudio controlado (DEC-024).

Não usar inicialmente:

* embeddings
* LLM
* sistemas complexos de decisão

## 8. Testes

Não depender de uma gravação real.

Primeiro criar áudios controlados, do mais fácil para o mais difícil:

1. leitura falada do salmo
2. "Agora vamos cantar Teu Amor."
3. letra falada
4. letra cantada sem instrumentos
5. letra cantada com instrumentos

Depois testar:

* diferentes pessoas
* diferentes microfones
* ruído
* distância do microfone

Somente depois testar em gravações reais de culto.

Como testar fora da interface:

```text
.venv/bin/python python/listen.py --file test_audio/x.aiff > test_audio/x.jsonl
cd app && node scripts/pipeline_check.ts [limite] [passivo]
```

O `--file` usa os mesmos blocos de 5 s do microfone. O `pipeline_check.ts` roda o matching com o culto de referência, compara com o trecho esperado de cada bloco e conta acertos, erros (sugestão errada) e perdidos (certo, mas abaixo do limite).

## 9. Falha

Se a confiança for baixa:

```text
não sugerir
```

É melhor não fazer nada do que sugerir conteúdo errado.

## 10. Track sync (músicas com backing)

Quando `sync_mode` é `hybrid` ou `reference` e a música tem faixa de referência + timeline JSON:

```text
Microfone → sync_ref.py (correlação) → pos_ms → block_index → slide / PPT / MIDI
```

Whisper continua em paralelo em `hybrid` para detectar entrada na música e liturgia.

Ver [`docs/TRACK_SYNC_EVAL.md`](TRACK_SYNC_EVAL.md) e DEC-031.

## 11. Futuro

Depois de validar o pipeline, poderão ser avaliados:

* detecção de fala livre (oração espontânea, sermão, avisos)
* palavras-chave por item
* detecção de músicas fora da sequência
* automação

Essas funcionalidades não fazem parte do MVP.
