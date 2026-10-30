#!/bin/bash
# Zip do código-fonte (sem artefatos de build). Para quem vai desenvolver ou recompilar.

set -e
cd "$(dirname "$0")"

VERSION=$(node -p "require('./app/package.json').version" 2>/dev/null || echo "0.1.0")
OUT="pacote/auxiliar-liturgico-fonte-${VERSION}.zip"

mkdir -p pacote
rm -f "$OUT"

zip -r "$OUT" . \
  -x 'app/src-tauri/target/*' \
  -x 'app/node_modules/*' \
  -x 'app/dist/*' \
  -x '.venv/*' \
  -x 'pacote/*' \
  -x 'test_audio/*' \
  -x '.git/*' \
  -x '*/.DS_Store' \
  -x '.DS_Store'

echo "Fonte gerada: $OUT ($(du -h "$OUT" | cut -f1))"
