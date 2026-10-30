# GitHub e releases

O passo a passo completo (criar o repositório, chave de assinatura, primeira versão e atualização automática)
está em **[`PUBLICAR_NO_GITHUB.md`](PUBLICAR_NO_GITHUB.md)**.

## Resumo

| Tarefa | Como |
| --- | --- |
| Enviar mudanças ao GitHub | `./publicar.sh codigo "mensagem"` |
| Lançar versão (compila e publica na nuvem) | `./publicar.sh versao patch "mensagem"` (cria a tag; workflow [`release.yml`](../.github/workflows/release.yml)) |
| Mudar a versão | `./scripts/bump_version.sh 0.3.1` (atualiza os 3 arquivos e os arquivos de trava) |
| Conferir se as versões batem | `./scripts/check_version.sh [v0.3.1]` |
| Gerar o zip para o Mac que está em uso | `./empacotar.sh` |
| Zip só do código-fonte | `./empacotar-fonte.sh` |

## Versionamento

A versão fica em três arquivos, que precisam ser iguais: `app/package.json`, `app/src-tauri/tauri.conf.json` e
`app/src-tauri/Cargo.toml`. O script `bump_version.sh` muda os três (e `package-lock.json` / `Cargo.lock`).
A tag do Git é a versão com `v` na frente (`v0.3.0`). O workflow recusa a tag se ela não bater com a versão.

## Plataformas

O workflow gera o app **só para Mac** (chip Apple e Intel). O app reconhece o Python no Windows e no Linux
(scripts em [`scripts/`](../scripts)), mas esses sistemas não têm instalador gerado nem foram testados.

## Banco de dados

Fica no perfil do usuário (`~/Library/Application Support/com.igreja.auxiliar/auxiliar.db`), não no instalador.
Trocar a versão do app não apaga cultos nem músicas.

## Segurança do repositório

* A chave de assinatura (`~/.tauri/auxiliar.key`) nunca vai para o repositório (o `.gitignore` bloqueia `*.key`).
* O repositório é **público**. Se virar privado, a atualização automática dentro do app deixa de funcionar (o app não consegue fazer login para baixar o `latest.json`).
* PDFs, `app/seed/culto_sede_*.sql` e `.kiro/` ficam fora do repositório (`.gitignore`); `./publicar.sh` também bloqueia esses arquivos.
