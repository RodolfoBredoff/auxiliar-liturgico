# MVP — Auxiliar Litúrgico Experimental

## 1. Objetivo

Criar uma versão pequena e experimental de um auxiliar litúrgico para uso interno da igreja.

Queremos testar se é possível:

> preparar previamente uma sequência de culto, ouvir o áudio localmente, transcrever o que está acontecendo, identificar em qual item e em qual trecho o culto está e sugerir ao operador o conteúdo correspondente.

O projeto não tem objetivo comercial neste momento.

## 2. Hipótese

A hipótese principal é:

> Um sistema simples consegue relacionar o áudio de um culto com uma sequência previamente preparada?

Não precisamos resolver todos os problemas do produto final.

Precisamos descobrir se essa ideia funciona.

## 3. Culto de referência

O MVP será planejado e testado com a liturgia real da igreja.

```text
CICLO 1
- Abertura com leitura bíblica
- Oração espontânea
- Leitura de salmo
- Música 1
- Música 2
- Música 3
- Oração comunitária

CICLO 2
- Visitantes e arte
- Convite às crianças
- Sermão principal

CICLO 3 — Ceia
- Comunhão
- Texto da ceia

CICLO 4 — Envio e resposta
- Ofertório (música)
- Avisos
- Envio: oração final e encerramento
```

### Como cada item funciona no MVP

| Item | Tipo | Detectável pelo áudio? |
| --- | --- | --- |
| Abertura com leitura bíblica | text | sim (texto lido) |
| Oração espontânea | blank | não (sem texto prévio) |
| Leitura de salmo | text | sim (texto lido) |
| Música 1, 2, 3 | song | sim (título e letra) |
| Oração comunitária | text | sim, se houver texto preparado |
| Visitantes e arte | text ou image | não |
| Convite às crianças | text ou image | não |
| Sermão principal | text ou blank | não (fala livre) |
| Comunhão | text | sim, se houver texto preparado |
| Texto da ceia | text | sim (texto lido) |
| Ofertório | song | sim (título e letra) |
| Avisos | text ou image | não |
| Oração final e encerramento | text ou blank | não |

Itens sem texto prévio são conduzidos manualmente pelo operador.

O sistema volta a sugerir quando o áudio corresponder a um dos próximos itens com texto.

Exemplo: durante o sermão nada é sugerido; quando o texto da ceia começa a ser lido, o sistema sugere "Texto da ceia".

Os ciclos são apenas separadores visuais na sequência. Eles não são exibidos na tela.

## 4. Funcionalidades

### Músicas

* criar
* editar
* excluir
* armazenar título e letra no mesmo cadastro
* letra dividida em blocos (estrofes) por linha em branco

### Cultos

* criar
* editar
* excluir
* duplicar um culto existente (para reaproveitar a liturgia da semana anterior)
* adicionar itens
* adicionar separadores de ciclo
* ordenar itens
* executar sequência

### Textos

Leituras bíblicas, salmos, orações e textos da ceia são colados pelo operador no próprio item.

Não existe banco de Bíblia no MVP.

Textos também são divididos em blocos por linha em branco.

### Apresentação

Área de apresentação dentro da própria janela do aplicativo.

Suportar:

* texto
* letra
* imagem
* tela em branco

### Áudio

* capturar microfone
* processar localmente
* transcrever com faster-whisper
* mostrar transcrição
* pausar e retomar a escuta

### Matching

Comparar a transcrição com os próximos itens da sequência que tenham texto.

O sistema identifica:

* o item (qual música ou leitura)
* o trecho (qual bloco da letra ou do texto)

Exemplo:

Possível item:

Música 2 — Teu Amor

Trecho: estrofe 3

Confiança: 94%

[ MOSTRAR ]
[ IGNORAR ]

## 5. Fora do MVP

Não implementar:

* automação completa
* troca automática de slides
* detecção de fala livre (oração espontânea, sermão, avisos)
* detecção de músicas que não estão na sequência
* banco de Bíblia
* transmissão
* OBS
* OpenLP
* ProPresenter (substituição total; integração mínima Presenter/PPT — DEC-027)
* cloud
* servidor remoto
* login
* usuários
* permissões
* multi-igreja
* SaaS
* PostgreSQL
* Redis
* microserviços
* Docker
* Kubernetes
* LLM externo
* aplicativo mobile
* editor profissional de vídeo
* streaming próprio

## 6. Modos

O MVP tem dois modos, que funcionam juntos.

### Manual

O operador controla tudo.

### Assistido

O sistema escuta e sugere.

Exemplo:

Áudio detectado:

"Agora vamos cantar Teu Amor."

↓

Possível item:

Música 1 — Teu Amor

94%

[ MOSTRAR ]
[ IGNORAR ]

A decisão final é do operador.

O modo automático não faz parte do MVP.

## 7. Automação

Automação completa não faz parte do primeiro MVP.

A evolução futura poderá ser:

Manual
↓
Assistido
↓
Automático

## 8. Áudio de teste

Como não temos gravação real, os primeiros testes serão controlados.

Ordem dos testes, do mais fácil para o mais difícil:

1. leitura falada do salmo
2. frase de anúncio: "Agora vamos cantar Teu Amor."
3. letra de música falada
4. letra de música cantada sem instrumentos
5. letra de música cantada com instrumentos

Depois de validar essas etapas, testar com áudio real.

## 9. Matching

Começar simples:

1. normalizar texto
2. remover diferenças irrelevantes
3. selecionar candidatos: item atual e próximos itens com texto
4. comparar a transcrição com o título e com cada bloco dos candidatos
5. calcular similaridade
6. gerar confiança
7. sugerir somente acima do limite definido

Não usar inicialmente:

* embeddings
* RAG
* LLM

## 10. Arquitetura

### Aplicação

React
↓
Application
↓
SQLite

### Áudio

Microfone
↓
Script Python local (captura + faster-whisper)
↓
Transcrição
↓
Normalização
↓
Matching (TypeScript)
↓
Sugestão

### Apresentação

Service Item
↓
Renderer nativo
↓
Área de apresentação na janela

## 11. Banco inicial

Somente:

* songs
* services
* service_items
* settings

## 12. Critério de sucesso

O MVP deve conseguir, usando o culto de referência:

Criar músicas
↓
Criar culto com a liturgia
↓
Executar culto
↓
Capturar áudio
↓
Transcrever
↓
Comparar com os próximos itens da sequência
↓
Identificar item e trecho
↓
Mostrar sugestão
↓
Operador confirmar

Isso já será suficiente para validar a primeira hipótese.

## 13. Princípio

O objetivo não é construir muito software.

O objetivo é aprender rapidamente se a ideia funciona.

> Construir a menor implementação capaz de testar a hipótese.
