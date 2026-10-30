# Estado do projeto e próximos passos

Arquivo de retomada. Atualizado em **29/10/2026**. Leia este arquivo primeiro ao voltar ao projeto.

## Onde paramos
O app está na **versão 0.3.0**, compilando e empacotado localmente. Falta **publicar no GitHub** e **validar no app aberto**.
O `AGENTS.md` do MVP foi **descartado e apagado** pelo dono do projeto. O escopo agora é um app profissional,
não mais um MVP mínimo.

## Pendências, em ordem

### 1. Publicar no GitHub (guia: [`PUBLICAR_NO_GITHUB.md`](PUBLICAR_NO_GITHUB.md))
- [ ] Decidir **repositório público ou privado**. Privado desativa a atualização automática dentro do app.
      Recomendado: público, com `*.pdf` e `app/seed/culto_sede_*.sql` no `.gitignore` antes do primeiro commit.
- [ ] Criar o repositório (nome sugerido: `auxiliar-liturgico`).
- [ ] Trocar `SUA-ORG` pelo usuário do GitHub em `app/src-tauri/tauri.conf.json` (`plugins.updater.endpoints`).
- [ ] Cadastrar o secret `TAURI_SIGNING_PRIVATE_KEY` (conteúdo de `~/.tauri/auxiliar.key`). **Não** criar o secret de senha.
- [ ] **Guardar uma cópia de `~/.tauri/auxiliar.key` em local seguro.** Se for perdida, os apps instalados não se atualizam mais.
- [ ] `git init -b main`, conferir `git status` (sem `node_modules`, `target`, `.venv`, `pacote`, `*.key`), commit e push.
      **O projeto ainda não é um repositório git.**
- [ ] `git tag v0.3.0 && git push origin v0.3.0`, esperar o Actions, publicar o rascunho da Release.
- [ ] Conferir o `latest.json` com `curl` (passo 7 do guia).
- [ ] Testar a atualização: instalar a 0.3.0, publicar a 0.3.1 (`./scripts/bump_version.sh 0.3.1`) e atualizar pelo app.

### 2. Validar no app aberto (nada disso foi testado com a janela aberta)
Rodar `cd app && npm run tauri dev` e conferir, com um culto de teste:
- [ ] **Migration 4 no banco real.** Só foi testada em banco vazio. Fazer backup de
      `~/Library/Application Support/com.igreja.auxiliar/auxiliar.db` antes.
- [ ] Projetor e palco: tema, texto que se ajusta, teclas C (limpar texto), L (logo), B (preto).
- [ ] Escuta com microfone: medidor de volume, "última fala há Ns", botão Reiniciar, reinício automático.
- [ ] Contexto do Whisper (`whisper_context.json`) realmente melhorando o reconhecimento de nomes.
- [ ] Celular: ativar em Configurações → Celular, OBS e legendas, abrir o endereço, testar avançar/voltar.
- [ ] Sobreposição no OBS (Fonte de navegador) e legendas ao vivo.
- [ ] Bíblia: importar uma tradução, buscar `Rm 8:28`, citar um versículo em voz alta.
- [ ] Importar música `.txt` e OpenSong; ordem de canto com refrão.
- [ ] Retomada após fechar o app no meio do culto (`last_position`).
- [ ] **Preparar reconhecimento de voz** (só no app instalado, não no `tauri dev`, que usa o `.venv`).
- [ ] Comandos de voz (opcional) e detecção de pausa (`pause_segmentation`) em ambiente real.

### 3. Depois
- [ ] Medir o modelo certo no Mac da igreja: `python python/bench_models.py audio.wav --models tiny small medium`.
- [ ] Ajustar a confiança mínima com o registro de um culto real (Configurações → exportar registro).
- [ ] Notarização da Apple (precisa de conta Developer paga; passo 11 do guia).
- [ ] Windows e Linux (não são gerados; passo 12 do guia).
- [ ] Atualizar `README.md`, `PRODUCT_SPEC.md` e `MVP.md`, que ainda descrevem o escopo antigo de MVP.

## O que já está pronto
Tudo abaixo compila e foi coberto por testes automáticos, exceto o que está na lista de validação acima.

| Área | O que existe | Onde |
|---|---|---|
| Confiabilidade | Painel de saúde da escuta, reinício automático, retomada do culto, backup automático e manual, log do culto | `ExecutePage.tsx`, `listener.ts`, `files.ts`, `db.ts` |
| Reconhecimento | Contexto para o Whisper, janela deslizante, distância de edição, corte por pausa, comandos de voz | `matching.ts`, `whisperContext.ts`, `python/listen.py` |
| Apresentação | Temas, texto que se ajusta, transição, logo, limpar texto, próximo slide, tela de palco com cronômetros | `theme.ts`, `PresentationScreen.tsx`, `StagePage.tsx` |
| Conteúdo | Ordem de canto com rótulos, importação `.txt`/OpenSong, Bíblia (importada pelo usuário), detecção de versículo | `blocks.ts`, `songImport.ts`, `bible.ts`, `bibleLookup.ts` |
| Operação | Busca rápida (Ctrl+K), pausar auto (P), bipe, aba Configurações | `QuickSearch.tsx`, `SettingsPage.tsx` |
| Rede | Servidor local: controle pelo celular, sobreposição OBS, legendas ao vivo | `src-tauri/src/remote.rs`, `src-tauri/web/*.html` |
| Instalação | Preparar o Python pelo app | `src-tauri/src/setup.rs`, `PythonSetup.tsx` |
| Distribuição | Atualização automática assinada, workflow de release, scripts de versão | `release.yml`, `scripts/bump_version.sh`, `scripts/check_version.sh`, `empacotar.sh` |

Decisões registradas em [`DECISIONS.md`](DECISIONS.md) (DEC-032 a DEC-041).

## Como verificar que nada quebrou
```bash
cd app
npm run build                 # TypeScript + Vite
npm test                      # 19 testes (matching, Bíblia, blocos, importação)
cd src-tauri && cargo test    # 4 testes (servidor remoto e instalação do Python)
cd ../.. && python3 python/test_listen.py   # 6 testes (corte por pausa, contexto do Whisper)
```
O Rust está em `~/.cargo/bin`. Em um terminal novo, rode `export PATH="$HOME/.cargo/bin:$PATH"` antes de usar `cargo`.

## Cuidados que aprendi pelo caminho
- **Nunca testar contra o banco real** (`~/Library/Application Support/com.igreja.auxiliar/auxiliar.db`). Para testar o app
  compilado, use um `HOME` temporário: `HOME=/tmp/fakehome ./app` em `app/src-tauri/target/debug`.
- O app compilado roda como processo chamado **`./app`**; `pkill -f "debug/app"` **não** o encontra. Use `ps -eo pid,command | grep "[.]/app$"`
  e `kill PID`. Instâncias esquecidas seguram a porta do servidor remoto e confundem os testes.
- O build release (`./empacotar.sh`) é lento (LTO). A ferramenta de terminal interrompe em 30 minutos; rode em segundo plano.
- Assinatura: `TAURI_SIGNING_PRIVATE_KEY` precisa ser o **conteúdo** da chave, não o caminho. O `empacotar.sh` já faz isso.
- No macOS, `sed -i` exige `''` e não aceita regex vazia em intervalo; os scripts usam `node` para editar arquivos.
- Servidor remoto: só comandos da lista fixa chegam ao app (`next`, `previous`, `black`, `clear`, `logo`, `hold`, `accept`, `ignore`, `live`, `goto:N`).
- A Bíblia **não é embutida** (licença). O usuário importa o arquivo da tradução que pode usar.

## Locais importantes
| O quê | Onde |
|---|---|
| Chave privada de assinatura | `~/.tauri/auxiliar.key` (a pública está em `tauri.conf.json`) |
| Banco de dados do app | `~/Library/Application Support/com.igreja.auxiliar/auxiliar.db` |
| Python do app instalado | `~/Library/Application Support/com.igreja.auxiliar/python` |
| Backups, logs, contexto do Whisper | mesma pasta, em `backups/`, `logs/` e `whisper_context.json` |
| Pacote gerado | `pacote/Auxiliar-Liturgico-0.3.0-mac-arm64.zip` |
