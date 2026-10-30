# Publicar no GitHub com atualização automática

Repositório: <https://github.com/RodolfoBredoff/auxiliar-liturgico> (público).

**Como funciona:** você trabalha localmente e roda `./publicar.sh`. Ele testa, faz o commit e envia ao GitHub. Para lançar
uma versão, ele também cria uma tag `vX.Y.Z`. O GitHub compila o app para Mac (chip Apple e Intel), assina e publica a
Release. Quem já tem o app instalado atualiza em **Configurações → Atualizações**.

---

## Uso diário

```bash
cd /caminho/do/projeto
./publicar.sh status                          # versão, alterações locais e commits ainda não enviados
./publicar.sh codigo "Ajusta o tema escuro"   # testa, commita e envia (NÃO lança versão)
./publicar.sh versao patch "Corrige a busca"  # lança 0.3.0 -> 0.3.1
./publicar.sh versao minor "Nova função X"    # 0.3.1 -> 0.4.0
./publicar.sh versao major "Mudança grande"   # 0.4.0 -> 1.0.0
./publicar.sh versao 0.5.2 "mensagem"         # versão escolhida
```

O que o `./publicar.sh` faz por você:
- confere que não há arquivos proibidos no commit (`*.key`, PDFs, `node_modules`, `target`, `.venv`, `pacote`) nem arquivos
  acima de 50 MB;
- recusa enviar se o GitHub tem commits que você ainda não baixou (`git pull --rebase origin main` resolve);
- roda TypeScript, os testes do frontend, os do Python e os do Rust (`PULAR_TESTES=1` pula; `SO_RAPIDO=1` pula só o Rust);
- em `versao`: muda a versão nos três arquivos e nos arquivos de trava, cria o commit e a tag e envia os dois.

Acompanhe a compilação em **Actions** (cerca de 20 a 30 minutos na primeira vez; as próximas são mais rápidas pelo cache).
A Release aparece em **Releases** já publicada, com:
- dois `.app.tar.gz` (`aarch64` para chip Apple e `x64` para Intel) e um `.sig` para cada;
- o `latest.json`, que o app lê para descobrir versões novas.

Todo envio para `main` também roda os testes na nuvem (workflow **CI**).

---

## Configuração única (faça antes do primeiro `versao`)

### 1. Secret da chave de assinatura
1. No Terminal: `pbcopy < ~/.tauri/auxiliar.key`
2. No GitHub, no repositório: **Settings → Secrets and variables → Actions → New repository secret**.
3. **Name:** `TAURI_SIGNING_PRIVATE_KEY`. **Secret:** cole (Cmd+V). Clique em **Add secret**.

Não crie `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: a chave não tem senha e o GitHub não aceita secret vazio.

**Guarde uma cópia de `~/.tauri/auxiliar.key` em local seguro** (gerenciador de senhas, por exemplo). Se ela for perdida, os apps
já instalados não conseguem mais se atualizar e precisam ser reinstalados à mão. Nunca coloque essa chave no repositório
(o `.gitignore` bloqueia `*.key`).

### 2. Permissão do Actions
**Settings → Actions → General → Workflow permissions → Read and write permissions → Save.**
Sem isso a criação da Release falha com *Resource not accessible by integration*.

### 3. Login no Git
O repositório usa SSH (`git@github.com:RodolfoBredoff/auxiliar-liturgico.git`). Se `ssh -T git@github.com` responde
*Hi RodolfoBredoff!*, está tudo certo.

---

## Primeiro lançamento (v0.3.0)

A versão do app já é 0.3.0. Depois da configuração única, envie a tag:

```bash
bash scripts/check_version.sh v0.3.0     # deve terminar com "Tag v0.3.0 confere."
git tag -a v0.3.0 -m "Versão 0.3.0"
git push origin v0.3.0
```

Confira a Release e o arquivo que o app lê:

```bash
curl -sL https://github.com/RodolfoBredoff/auxiliar-liturgico/releases/latest/download/latest.json | head -c 700
```

Deve aparecer `"version": "0.3.0"` e as plataformas `darwin-aarch64` e `darwin-x86_64`, cada uma com `signature` e `url`.

**Teste a atualização uma vez antes de depender dela:** instale a 0.3.0, rode `./publicar.sh versao patch "teste"` e atualize pelo app.

---

## Instalar no Mac da igreja (primeira vez)

**Pela Release (recomendado):**
1. Baixe o `.app.tar.gz` do tipo de Mac (`aarch64` para M1 a M4; `x64` para Intel).
2. Descompacte e arraste **Auxiliar Litúrgico** para **Aplicativos**.
3. Na primeira abertura, botão direito no app → **Abrir**. Se o macOS ainda bloquear:
   `xattr -dr com.apple.quarantine "/Applications/Auxiliar Litúrgico.app"`
4. Em **Configurações**, clique em **Preparar reconhecimento de voz** (internet e Python 3.9 a 3.13; leva alguns minutos).

**Pelo pacote com instalador**, gerado no próprio Mac: `./empacotar.sh` cria `pacote/Auxiliar-Liturgico-<versão>-mac-<arm64|x64>.zip`
com o app, o `instalar.command` e o manual.

Cultos e músicas ficam em `~/Library/Application Support/com.igreja.auxiliar/` e **não são apagados** ao atualizar.

---

## Problemas comuns

| Sintoma | Causa provável e solução |
|---|---|
| Build falha com *A public key has been found, but no private key* | O secret `TAURI_SIGNING_PRIVATE_KEY` não existe ou tem outro nome. |
| Build falha em *Conferir versão x tag* | Tag e versão do app diferentes. Use `./publicar.sh versao ...` em vez de criar a tag à mão. Para refazer uma tag: `git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`. |
| *Resource not accessible by integration* | Falta a permissão de escrita do Actions (configuração única, item 2). |
| `./publicar.sh` diz que o GitHub tem commits que você não tem | `git pull --rebase origin main` e rode de novo. |
| `./publicar.sh` recusa por arquivo proibido | O arquivo listado não pode ir para um repositório público. Mova-o ou acrescente ao `.gitignore`. |
| App mostra "não foi possível verificar" | Ainda não há Release publicada, sem internet, ou o `latest.json` não abre (teste o `curl` acima). |
| Mac avisa "desenvolvedor não identificado" | Botão direito → Abrir, ou o `xattr` acima. Só some com a notarização da Apple. |
| Perdi a chave de assinatura | Gere outra (`cd app && npx tauri signer generate -w ~/.tauri/auxiliar.key`), troque `pubkey` em `tauri.conf.json` e o secret. Os apps já instalados precisam ser reinstalados uma vez. |
| Uma das duas compilações (Apple ou Intel) falhou | A Release já está publicada, mas sem aquela plataforma. Em **Actions**, use *Re-run failed jobs*. |

---

## Notarização da Apple (opcional)

Remove o aviso de "desenvolvedor não identificado". Exige conta Apple Developer paga (cerca de US$ 99 por ano). Crie um
certificado *Developer ID Application*, exporte em `.p12` e cadastre os secrets `APPLE_CERTIFICATE`
(`base64 -i certificado.p12 | pbcopy`), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`,
`APPLE_PASSWORD` (senha de app) e `APPLE_TEAM_ID`. Depois descomente as linhas `APPLE_*` em `.github/workflows/release.yml`.
Não descomente antes de criar os secrets: o build quebra.

## Windows e Linux

O workflow compila só para Mac. O app reconhece o Python no Windows e no Linux, mas os instaladores (`.msi`, `.deb`, AppImage)
não são gerados e esses sistemas não foram testados. Para incluí-los é preciso acrescentar esses alvos em `tauri.conf.json`
(`bundle.targets`) e as plataformas no `release.yml`.

## Repositório público: o que fica de fora

Por ser público, o `.gitignore` exclui PDFs, `app/seed/culto_sede_*.sql`, `app/seed/meu_*.sql` e a pasta `.kiro/`. Esses arquivos
continuam no seu computador. Para o roteiro de um culto real, use o importador (`python/import_roteiro.py`) localmente.
