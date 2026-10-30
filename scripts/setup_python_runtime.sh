#!/usr/bin/env bash
# Cria venv Python para escuta + track sync (macOS / Linux).
# Uso: ./scripts/setup_python_runtime.sh

set -euo pipefail

DATA_DIR="${AUXILIAR_DATA_DIR:-$HOME/Library/Application Support/com.igreja.auxiliar}"
if [[ "$(uname -s)" == "Linux" ]]; then
  DATA_DIR="${AUXILIAR_DATA_DIR:-$HOME/.local/share/com.igreja.auxiliar}"
fi

VENV="$DATA_DIR/python"

PYTHON=""
for candidate in python3.12 python3.11 python3.13 python3.10 python3; do
  if command -v "$candidate" >/dev/null 2>&1 &&
    "$candidate" -c 'import sys; sys.exit(0 if (3, 9) <= sys.version_info[:2] <= (3, 13) else 1)' 2>/dev/null; then
    PYTHON="$(command -v "$candidate")"
    break
  fi
done

if [[ -z "$PYTHON" ]]; then
  echo "Python 3.9–3.13 não encontrado. Instale 3.12 e tente de novo."
  exit 1
fi

echo "Usando $PYTHON ($("$PYTHON" --version))"
mkdir -p "$DATA_DIR"
"$PYTHON" -m venv "$VENV"
"$VENV/bin/pip" install --quiet --upgrade pip
"$VENV/bin/pip" install --quiet faster-whisper==1.2.1 sounddevice==0.5.6

echo "Baixando modelo Whisper 'small' (primeira vez, ~500 MB)..."
"$VENV/bin/python" -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"

echo "Pronto: $VENV"
echo "Abra o Auxiliar Litúrgico e use Ouvir / track sync."
