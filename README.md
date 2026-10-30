# Auxiliar Litúrgico

Aplicativo para Mac que ajuda o operador de projeção de uma igreja durante o culto.

O app recebe a sequência do culto preparada antes, escuta o áudio localmente, transcreve com faster-whisper, compara com as letras e textos dos próximos itens e **sugere** ao operador o que exibir. O operador sempre confirma.

## Instalar (Mac)

1. Abra a [página de Releases](https://github.com/RodolfoBredoff/auxiliar-liturgico/releases/latest) e baixe o `.app.tar.gz` do seu Mac: `aarch64` para chip Apple (M1 a M4) ou `x64` para Mac Intel.
2. Descompacte e arraste **Auxiliar Litúrgico** para a pasta Aplicativos.
3. Na primeira vez, clique com o botão direito no app e escolha **Abrir** (o app não é assinado pela Apple). Se o macOS ainda bloquear: `xattr -dr com.apple.quarantine "/Applications/Auxiliar Litúrgico.app"`.
4. Em **Configurações**, clique em **Preparar reconhecimento de voz** (precisa de internet e de Python 3.9 a 3.13; baixa cerca de 500 MB).

Depois de instalado, o app se atualiza em **Configurações → Atualizações**. Manual completo: [docs/MANUAL.md](docs/MANUAL.md).

## Para quem desenvolve

```bash
./publicar.sh status                       # versão, alterações e o que falta enviar
./publicar.sh codigo "mensagem"            # testa, commita e envia ao GitHub
./publicar.sh versao patch "mensagem"      # sobe a versão, cria a tag e o GitHub compila e publica a Release
```

Detalhes e primeira configuração: [docs/PUBLICAR_NO_GITHUB.md](docs/PUBLICAR_NO_GITHUB.md).

## Documentação

- Uso: [docs/MANUAL.md](docs/MANUAL.md)
- Escopo e plano: [docs/MVP.md](docs/MVP.md), [PROMPT_MESTRE.md](PROMPT_MESTRE.md)
- Decisões: [docs/DECISIONS.md](docs/DECISIONS.md)
- Janela de projetor: [docs/PROJECTOR.md](docs/PROJECTOR.md)
- Roteiro SEDE (PDF WorshipTools): [docs/ROTEIRO_SEDE.md](docs/ROTEIRO_SEDE.md)
- Avaliação track sync: [docs/TRACK_SYNC_EVAL.md](docs/TRACK_SYNC_EVAL.md)
- Latência Whisper: [docs/LATENCY.md](docs/LATENCY.md)
- **Publicar no GitHub com atualização automática (passo a passo):** [docs/PUBLICAR_NO_GITHUB.md](docs/PUBLICAR_NO_GITHUB.md)
- **Versões, scripts e plataformas:** [docs/GITHUB_E_RELEASES.md](docs/GITHUB_E_RELEASES.md)

## Estado

**Versão 0.3.0** — Etapas 1–11 do `PROMPT_MESTRE.md` + projetor (DEC-026) + roteiro SEDE (PDF/import), blocos 3 s/overlap, auto-avanço em músicas, Presenter (MIDI) e PowerPoint (DEC-027–030), **track sync** com backing de referência (DEC-031). Etapa 12 (validação completa no culto real) continua em andamento.

## Arquitetura

```text
React (UI) ──► SQLite (migrações automáticas na abertura)

Modo texto (liturgia / fallback):
  Microfone ──► listen.py (faster-whisper, blocos ~3 s)
            ──► matching.ts ──► sugestão ou auto-avanço (música)

Modo track (música com backing cadastrado, hybrid):
  Microfone ──► sync_ref.py + track_align.py ──► pos_ms ──► timeline ──► slide

Saída: projetor nativo | MIDI (WorshipTools) | PowerPoint (AppleScript)
```

- Tudo roda localmente. Nenhum áudio sai do computador.
- Python: captura, transcrição e (opcional) alinhamento à faixa de referência. Matching e banco no app (DEC-013, DEC-014).

## Estrutura

```text
PROMPT_MESTRE.md              plano original
docs/                         especificação, decisões e manual
python/listen.py              escuta o microfone (ou um arquivo com --file) e transcreve
python/sync_ref.py            track sync ao vivo (correlação com WAV de referência)
python/track_align.py         núcleo de alinhamento (usado pelo sync_ref)
python/import_roteiro.py      import assistido de PDF WorshipTools → SQL
python/build_timeline.py      gera timeline estrofe↔ms offline
python/eval_track_sync.py     POC / benchmark de track sync
python/transcribe_file.py     transcreve arquivos inteiros (teste da etapa 1)
test_audio/                   áudios de teste e transcrições em blocos (.jsonl)
app/                          aplicativo Tauri + React + TypeScript
  src/                        interface, banco (db.ts), matching (matching.ts)
  src-tauri/                  Rust: plugin SQL, migrações, comandos da escuta
  scripts/                    testes do matching e do pipeline (Node)
  seed/culto_referencia.sql   culto de referência da igreja
instalar.command              instalador para o Mac de destino
empacotar.sh                  gera o pacote de distribuição
```

## Desenvolvimento

Requisitos: macOS, Node 20+, Rust (rustup), Python 3.12.

```bash
# Python da escuta
/opt/homebrew/bin/python3.12 -m venv .venv
.venv/bin/pip install -r python/requirements.txt

# App
cd app
npm install
npm run tauri dev
```

Em modo de desenvolvimento, o app usa `.venv/bin/python` e `python/listen.py` deste repositório.

O banco fica em `~/Library/Application Support/com.igreja.auxiliar/auxiliar.db`. Para criar o culto de referência:

```bash
sqlite3 ~/Library/Application\ Support/com.igreja.auxiliar/auxiliar.db < app/seed/culto_referencia.sql
```

As configurações ficam na tabela `settings` (sem tela ainda): `whisper_model`, `audio_device`, `confidence_threshold`, `match_window`, `block_seconds`, `block_overlap`, `auto_advance_songs`, `follow_verse_auto`, `midi_port`, `midi_note`, `powerpoint_enabled`, `sync_mode` (`hybrid` | `text` | `reference`), `track_min_confidence`, `pa_delay_ms`.

Importar culto a partir do PDF WorshipTools:

```bash
.venv/bin/python python/import_roteiro.py "4 de out - SEDE.pdf" > app/seed/meu_culto.sql
```

## Testes

```bash
cd app
npm run build                      # TypeScript + Vite
(cd src-tauri && cargo build)      # Rust
node scripts/matching_check.ts     # matching e regra de sugestão
node scripts/pipeline_check.ts     # pipeline com transcrições de test_audio/*.jsonl
node scripts/latency_report.ts test_audio/*.jsonl   # transcribe_ms por bloco
node scripts/text_sync_latency.ts ../test_audio/voz_real_1s.jsonl  # teto do pipeline textual
```

Para gerar as transcrições em blocos de um novo áudio:

```bash
.venv/bin/python python/listen.py --file test_audio/arquivo.m4a > test_audio/arquivo.jsonl
```

## Distribuição

Há dois pacotes diferentes. Não confunda o tamanho da pasta do projeto (~GB) com o que você envia.

| Pacote | Comando | Tamanho típico | Para quem |
| --- | --- | --- | --- |
| **App para uso** | `./empacotar.sh` | ~3 MB | Operador em outro Mac (só instalar e usar) |
| **Código-fonte** | `./empacotar-fonte.sh` | ~1 MB | Desenvolver, recompilar ou versionar |

O que **não** entra no zip de fonte (fica só na sua máquina de dev): `app/src-tauri/target/` (build Rust, ~GB), `app/node_modules/`, `.venv/`, `pacote/`, `test_audio/`. Quem recebe o fonte roda `npm install`, cria o `.venv` e compila de novo — veja [Desenvolvimento](#desenvolvimento).

### Repositório Git

Com o `.gitignore` na raiz, um clone traz só o necessário:

```bash
git clone <url-do-repositório>
cd audio   # nome da pasta do repo
# depois: venv, npm install, tauri dev (como em Desenvolvimento)
```

### App para uso (Mac com chip Apple)

**Sim: o deploy para operadores é `./empacotar.sh`.** A versão do zip vem de `app/package.json` (hoje **0.3.0**). Antes de empacotar, confira que `npm run build` e `(cd app/src-tauri && cargo build)` passam na sua máquina.

```bash
chmod +x empacotar.sh   # uma vez
./empacotar.sh
```

Gera `pacote/Auxiliar-Liturgico-<versão>-mac-arm64.zip` com:

- `Auxiliar Litúrgico.app` (recursos embutidos: `listen.py`, `sync_ref.py`, `track_align.py`)
- `instalar.command`: cria o Python em `~/Library/Application Support/com.igreja.auxiliar/python`, instala faster-whisper e sounddevice, baixa o modelo `small` e copia o app para Aplicativos
- `MANUAL.md` (cópia de `docs/MANUAL.md`)

**Atualizar um Mac que já tinha 0.1.0:**

1. Feche o Auxiliar Litúrgico.
2. Descompacte o zip novo e rode **`instalar.command`** de novo (substitui o app em Aplicativos; o venv Python existente continua válido).
3. Abra o app — as migrações SQLite **002** e **003** rodam sozinhas; cultos e músicas em `auxiliar.db` são preservados.
4. Opcional: cadastre por música **áudio de referência** + **timeline JSON** (aba Músicas) para track sync.

No Mac de destino: Python 3.9–3.13 (recomendado 3.12), internet só na instalação/atualização do venv. App não assinado pela Apple — ver manual.

**PowerPoint / Presenter:** exigem Microsoft PowerPoint ou rtpMIDI configurado no Mac do operador; não vêm no zip.

Não é possível gerar instalador Windows a partir do Mac.

### Checklist rápido (quem desenvolve)

| Passo | Comando / ação |
| --- | --- |
| Versão | Igual em `app/package.json`, `app/src-tauri/tauri.conf.json`, `app/src-tauri/Cargo.toml` |
| Build | `cd app && npm run tauri build` (o `empacotar.sh` já faz isso) |
| Entregar | Enviar `pacote/Auxiliar-Liturgico-0.3.0-mac-arm64.zip` |
| Fonte (opcional) | `./empacotar-fonte.sh` para backup ou Git |

### Código-fonte (zip)

```bash
chmod +x empacotar-fonte.sh   # uma vez
./empacotar-fonte.sh
```

Gera `pacote/auxiliar-liturgico-fonte-<versão>.zip` com docs, `app/`, `python/`, `instalar.command` e `empacotar.sh`, sem dependências instaladas nem builds.
