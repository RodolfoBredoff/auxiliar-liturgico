# Database

## Banco

SQLite.

O banco deve permanecer pequeno e simples.

## Tabelas do MVP

### songs

Armazena músicas.

Campos:

```text
id
title
lyrics
created_at
updated_at
```

Exemplo:

```text
id: 1
title: Teu Amor
lyrics: ...
```

A letra é dividida em blocos (estrofes) por linha em branco.

Os blocos não são armazenados separadamente. Eles são calculados a partir de `lyrics`.

## services

Armazena cultos.

Campos:

```text
id
title
created_at
updated_at
```

Exemplo:

```text
id: 1
title: Culto de Domingo
```

Para reaproveitar a liturgia, um culto pode ser duplicado (copia o culto e seus itens).

Não existe tabela de modelos de culto.

## service_items

Armazena os itens de cada culto.

Campos:

```text
id
service_id
type
title
content
position
song_id
```

### type

Valores do MVP:

```text
section   separador de ciclo (não é exibido)
text      texto simples, leitura, oração, aviso
song      música cadastrada
image     imagem
blank     tela em branco
```

### content

Depende do tipo:

```text
section   vazio
text      texto colado pelo operador, dividido em blocos por linha em branco
song      vazio (a letra vem de songs.lyrics)
image     caminho do arquivo de imagem no computador
blank     vazio
```

### song_id

Preenchido somente quando `type = song`.

### Exemplo (início do culto de referência)

```text
position  type     title
1         section  Ciclo 1
2         text     Abertura com leitura bíblica
3         blank    Oração espontânea
4         text     Leitura de salmo
5         song     Música 1 — Teu Amor
...
```

## settings

Configurações simples da aplicação.

Campos:

```text
key
value
```

Valores do MVP:

```text
whisper_model          modelo do faster-whisper (ex: small)
audio_device           microfone usado
confidence_threshold   confiança mínima para sugerir
match_window           quantos itens à frente comparar (ex: 3)
```

No MVP estes valores podem ser editados diretamente no banco. Não é necessária tela de configurações.

## Relações

```text
services
   │
   └── service_items
           │
           └── songs
```

## Não criar ainda

Não criar tabelas para:

* users
* churches
* permissions
* media_library
* automation_rules
* automation_events
* integrations
* logs complexos
* subscriptions
* templates de culto
* blocos ou estrofes
* ciclos

Essas estruturas podem ser adicionadas futuramente caso exista necessidade real.

## Tabelas adicionadas na migration 004 (DEC-032)

### songs.arrangement
Texto livre com a ordem de canto, por rótulos: `V1 Refrão V2 Refrão`. Vazio = ordem do texto.

### session_log
| coluna | tipo | |
|---|---|---|
| id | INTEGER PK | |
| service_id | INTEGER | culto em execução |
| at | TEXT | horário (UTC) |
| kind | TEXT | `start`, `transcript`, `suggestion`, `show`, `ignore`, `bible_suggestion`, `show_bible`, `voice_command`, `resume`, `end` |
| data | TEXT | JSON do evento |

### bible_verses
`(version, book, chapter, verse)` é a chave primária; `book` vai de 1 (Gênesis) a 66 (Apocalipse). Preenchida pela importação em Configurações.

### Novas chaves em settings
`pause_segmentation`, `voice_commands`, `alert_sound`, `bible_version`, `bible_detect`, `logo_path`, `theme` (JSON da aparência) e `last_position` (JSON, retomada do culto).
