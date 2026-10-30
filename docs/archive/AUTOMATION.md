# Auxiliar Litúrgico — Automation Engine

## 1. Objetivo

Transformar sinais do culto em ações seguras dentro do roteiro.

---

# 2. Princípio

A automação nunca deve agir fora do roteiro.

Se não houver confiança suficiente:

```text
NO_ACTION
```

---

# 3. Sinais

Possíveis sinais:

```text
speech
keyword
lyric_match
song_match
bible_match
timer
operator
silence
```

---

# 4. Pipeline

```text
INPUT
 ↓
NORMALIZATION
 ↓
MATCHING
 ↓
CONTEXT
 ↓
SCORING
 ↓
STABILITY
 ↓
DECISION
 ↓
ACTION
```

---

# 5. Normalização

Texto deve ser normalizado:

* lowercase;
* remoção de pontuação;
* normalização de acentos;
* espaços;
* palavras comuns opcionais.

Exemplo:

```text
"Vamos cantar, TEU AMOR!"
```

vira:

```text
"vamos cantar teu amor"
```

---

# 6. Matching

Possíveis métodos:

* exact match;
* fuzzy match;
* token similarity;
* lyric similarity;
* keyword match.

Começar com métodos simples.

Não utilizar embeddings ou LLM antes de demonstrar necessidade.

---

# 7. Contexto

O candidato deve ser comparado com:

* item atual;
* próximo item;
* itens posteriores;
* tipo do item;
* histórico recente.

O próximo item deve receber prioridade.

---

# 8. Confidence

Exemplo conceitual:

```text
keyword = 0.90
lyric = 0.95
context = 1.00
state = 1.00
temporal = 0.80
```

Combinar os sinais em uma pontuação configurável.

Os pesos devem ser ajustáveis.

---

# 9. Threshold

Exemplo:

```text
< 0.60
NO_ACTION

0.60–0.84
SUGGEST

>= 0.85
CANDIDATE_FOR_EXECUTION
```

Valores iniciais são experimentais.

Não tratar esses valores como definitivos.

---

# 10. Hysteresis

Uma detecção deve permanecer estável antes de ser confirmada.

Exemplo:

```text
0.72
0.76
0.84
0.91
0.94
```

Depois:

```text
CONFIRMED
```

---

# 11. Cooldown

Após uma ação automática:

```text
COOLDOWN
```

Durante esse período, sinais equivalentes não devem disparar outra ação.

---

# 12. Estado

A decisão deve considerar:

```text
currentItem
nextItem
automationMode
lastAction
lastDetection
confidence
cooldown
```

---

# 13. Ações

Possíveis ações:

```text
NO_ACTION
SUGGEST
SHOW_ITEM
NEXT
PREVIOUS
SHOW_SLIDE
PAUSE_AUTOMATION
```

---

# 14. Modo assistido

No modo assistido:

```text
candidate
   ↓
confidence
   ↓
suggestion
```

O operador decide.

---

# 15. Modo automático

No automático:

```text
candidate
   ↓
threshold
   ↓
stability
   ↓
cooldown
   ↓
execute
```

---

# 16. Override

Se o operador executar:

```text
NEXT
```

a automação deve considerar essa ação como autoridade.

---

# 17. Pausa

Quando:

```text
AUTOMATION_PAUSED
```

nenhum sinal de áudio deve produzir ação.

A transcrição pode continuar opcionalmente.

---

# 18. Segurança

Nunca:

* apagar conteúdo;
* alterar permanentemente o roteiro;
* pular múltiplos itens sem autorização;
* chamar ação externa sem confirmação adequada.

---

# 19. Logs

Registrar:

```text
input
candidate
confidence
current_item
next_item
action
reason
```

---

# 20. Testes

Criar testes para:

* confiança baixa;
* confiança alta;
* sinais conflitantes;
* detecção duplicada;
* cooldown;
* hysteresis;
* operador;
* pausa;
* retomada;
* item incorreto;
* ausência de candidato.
