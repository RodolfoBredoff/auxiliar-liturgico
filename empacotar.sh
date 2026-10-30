#!/bin/bash
# Gera o pacote de distribuição para Mac (Apple Silicon ou Intel, conforme este computador):
#   pacote/Auxiliar-Liturgico-<versão>-mac-<arm64|x64>.zip
# contendo o app, o instalador e o manual.
#
# Precisa da chave de assinatura das atualizações (o app é compilado com atualização automática).
# Ela é lida de ~/.tauri/auxiliar.key, ou das variáveis TAURI_SIGNING_PRIVATE_KEY /
# TAURI_SIGNING_PRIVATE_KEY_PATH, se já estiverem definidas. Veja docs/PUBLICAR_NO_GITHUB.md.
set -e
cd "$(dirname "$0")"
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

./scripts/check_version.sh >/dev/null || { ./scripts/check_version.sh; exit 1; }

# Chave de assinatura
KEY_FILE="${TAURI_SIGNING_PRIVATE_KEY_PATH:-$HOME/.tauri/auxiliar.key}"
if [ -z "$TAURI_SIGNING_PRIVATE_KEY" ]; then
  if [ -f "$KEY_FILE" ]; then
    export TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY_FILE")"
  else
    echo "ERRO: chave de assinatura não encontrada em $KEY_FILE." >&2
    echo "Gere uma com:  cd app && npx tauri signer generate -w ~/.tauri/auxiliar.key" >&2
    echo "e coloque a chave pública gerada em app/src-tauri/tauri.conf.json (plugins.updater.pubkey)." >&2
    exit 1
  fi
fi
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"

VERSION=$(node -p "require('./app/package.json').version")
case "$(uname -m)" in
  arm64) ARCH="arm64" ;;
  x86_64) ARCH="x64" ;;
  *) ARCH="$(uname -m)" ;;
esac
NAME="Auxiliar-Liturgico-$VERSION-mac-$ARCH"
OUT="pacote/$NAME"
APP="app/src-tauri/target/release/bundle/macos/Auxiliar Litúrgico.app"

echo "Compilando o app $VERSION (modo release, pode levar vários minutos)..."
(cd app && npm install --no-audit --no-fund >/dev/null && npm run tauri build -- --bundles app)

[ -d "$APP" ] || { echo "ERRO: o app não foi gerado em $APP" >&2; exit 1; }

rm -rf pacote
mkdir -p "$OUT"
ditto "$APP" "$OUT/Auxiliar Litúrgico.app"
cp instalar.command "$OUT/"
chmod +x "$OUT/instalar.command"
cp docs/MANUAL.md "$OUT/MANUAL.md"
ditto -c -k --keepParent "$OUT" "pacote/$NAME.zip"

echo
echo "Pacote gerado: pacote/$NAME.zip"
echo "Para publicar com atualização automática, use a tag no GitHub (docs/PUBLICAR_NO_GITHUB.md)."
