#!/bin/bash
# Confere se a versão é a mesma nos três arquivos do app (e, opcionalmente, igual à tag do Git).
#   ./scripts/check_version.sh            -> só compara os arquivos
#   ./scripts/check_version.sh v0.3.0     -> compara também com a tag
# Usado por empacotar.sh e pelo workflow de release.
set -e
cd "$(dirname "$0")/.."

PKG=$(node -p "require('./app/package.json').version")
TAURI=$(node -p "require('./app/src-tauri/tauri.conf.json').version")
CARGO=$(sed -n 's/^version = "\(.*\)"/\1/p' app/src-tauri/Cargo.toml | head -1)

echo "package.json:    $PKG"
echo "tauri.conf.json: $TAURI"
echo "Cargo.toml:      $CARGO"

if [ "$PKG" != "$TAURI" ] || [ "$PKG" != "$CARGO" ]; then
  echo "ERRO: as versões acima são diferentes. Use ./scripts/bump_version.sh X.Y.Z" >&2
  exit 1
fi

if [ -n "$1" ]; then
  TAG="${1#v}"
  if [ "$TAG" != "$PKG" ]; then
    echo "ERRO: a tag '$1' não bate com a versão do app ($PKG). Use ./scripts/bump_version.sh $TAG e faça a tag de novo." >&2
    exit 1
  fi
  echo "Tag $1 confere."
fi
echo "Versão $PKG consistente."
