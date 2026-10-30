# Prompt Mestre — MVP Experimental do Auxiliar Litúrgico

Leia primeiro:

* `docs/PRODUCT_SPEC.md`
* `docs/MVP.md`
* `docs/DECISIONS.md`

Ignore `docs/archive/`.

## Contexto

Estamos criando um pequeno software desktop para auxiliar durante um culto.

O usuário prepara previamente uma sequência contendo itens como:

* músicas
* leituras bíblicas e salmos
* orações
* textos da ceia
* avisos
* sermão
* imagens

O culto de referência da igreja, organizado em quatro ciclos, está em `docs/MVP.md` (seção 3).

## Objetivo atual

Testar se conseguimos fazer:

Áudio
→ transcrição
→ comparação com os próximos itens da sequência preparada
→ identificação do item e do trecho
→ sugestão ao operador

O sistema não controla automaticamente o culto.

## Funcionalidades do MVP

Implementar:

1. cadastro de música (título e letra no mesmo cadastro)
2. criação de culto
3. criação de sequência com separadores de ciclo
4. duplicação de culto
5. apresentação na própria janela
6. execução manual da sequência, bloco a bloco
7. captura de áudio
8. transcrição com faster-whisper
9. exibição da transcrição
10. comparação com os próximos itens da sequência
11. identificação de item e trecho
12. sugestão ao operador

Exemplo:

Possível item:

Música 2 — Teu Amor

Estrofe 3

Confiança: 94%

[ MOSTRAR ] [ IGNORAR ]

## Teste inicial

Não temos gravação real de culto.

Os primeiros testes usam áudio controlado, do mais fácil para o mais difícil:

1. leitura falada do salmo
2. "Agora vamos cantar Teu Amor."
3. letra falada
4. letra cantada sem instrumentos
5. letra cantada com instrumentos

Somente depois testar com áudio real.

## Tecnologias

Usar:

* Tauri
* React
* TypeScript
* SQLite
* faster-whisper (em um único script Python local, iniciado pelo Tauri)

Evitar qualquer tecnologia adicional sem necessidade.

## Não implementar agora

Não implementar:

* backend remoto ou servidor
* cloud
* PostgreSQL
* Redis
* Docker
* Kubernetes
* microserviços
* login
* usuários
* permissões
* multi-igreja
* SaaS
* OpenLP
* OBS
* ProPresenter
* LLM externo
* automação completa
* detecção de fala livre (oração espontânea, sermão, avisos)
* detecção de músicas fora da sequência
* banco de Bíblia
## Arquitetura

Manter:

React
↓
Application
↓
SQLite

E:

Microfone
↓
Script Python (captura + faster-whisper)
↓
Tauri lê o texto
↓
Matching (TypeScript)
↓
Sugestão

Não criar abstrações para problemas futuros.

## Banco

Começar somente com:

* songs
* services
* service_items
* settings

Detalhes em `docs/DATABASE.md`.

## Matching

Começar com:

* normalização
* candidatos: item atual e próximos itens com texto
* comparação com título e com cada bloco
* similaridade simples
* confiança

Não usar inicialmente:

* embeddings
* RAG
* LLM
* modelos complexos

## Apresentação

Área de apresentação dentro da janela principal, para:

* texto
* letra
* imagem
* tela em branco

## Controle

O operador sempre pode:

* ignorar sugestões
* pausar a escuta
* avançar e voltar
* esconder a tela
* assumir controle manual

Se a confiança for baixa, não sugerir.

## Ordem de desenvolvimento

### Etapa 1

Teste isolado do faster-whisper: script Python transcreve arquivos de áudio controlados. Escolher o modelo.

### Etapa 2

Script em modo microfone: captura blocos curtos e imprime uma linha JSON por bloco.

### Etapa 3

Tauri + React + TypeScript com tela vazia.

### Etapa 4

SQLite e cadastro de músicas.

### Etapa 5

Culto e sequência: itens, ciclos, ordenar, duplicar. Cadastrar o culto de referência.

### Etapa 6

Apresentação na janela e execução manual (texto, letra, tela em branco; avançar e voltar por bloco).

### Etapa 7

Tauri inicia o script, mostra a transcrição ao vivo e permite pausar a escuta.

### Etapa 8

Matching: candidatos da sequência, título e blocos, confiança.

### Etapa 9

Sugestão com MOSTRAR e IGNORAR ligada à execução.

### Etapa 10

Imagem.

### Etapa 11

Testes com áudio controlado usando o culto de referência, e ajustes.

### Etapa 12

Teste com áudio real.

### Etapa 13 (pós-MVP)

Janela de projetor: segunda janela só com o slide, aberta manualmente, com a prévia mantida na janela do operador. Ver `docs/PROJECTOR.md`.

## Regra fundamental

Construir primeiro a menor coisa capaz de testar a hipótese.

Não construir o produto final agora.
