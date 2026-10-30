#!/bin/bash
# Instalador do Auxiliar Litúrgico (Mac com chip Apple).
# Prepara o Python (escuta + track sync), baixa o modelo de transcrição e copia o app para Aplicativos.
# Pode ser executado de novo sem problemas.

set -e
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:/Library/Frameworks/Python.framework/Versions/Current/bin:$PATH"

APP_NAME="Auxiliar Litúrgico.app"
DATA_DIR="$HOME/Library/Application Support/com.igreja.auxiliar"
VENV="$DATA_DIR/python"

finish() {
  echo
  read -r -p "Pressione Enter para fechar."
}
trap finish EXIT

echo "=== Instalador do Auxiliar Litúrgico ==="
echo

echo "1/4 Procurando Python (3.9 a 3.13)..."
PYTHON=""
for candidate in python3.12 python3.13 python3.11 python3.10 python3.9 python3; do
  if command -v "$candidate" >/dev/null 2>&1 &&
     "$candidate" -c 'import sys; sys.exit(0 if (3, 9) <= sys.version_info[:2] <= (3, 13) else 1)' 2>/dev/null; then
    PYTHON="$(command -v "$candidate")"
    break
  fi
done

if [ -z "$PYTHON" ]; then
  echo
  echo "Python compatível não encontrado."
  echo "Instale o Python 3.12 em https://www.python.org/downloads/macos/"
  echo "e rode este instalador novamente."
  exit 1
fi
echo "    Usando $PYTHON ($("$PYTHON" --version))"

echo "2/4 Criando ambiente Python em:"
echo "    $VENV"
mkdir -p "$DATA_DIR"
"$PYTHON" -m venv "$VENV"
"$VENV/bin/pip" install --quiet --upgrade pip

echo "3/4 Instalando faster-whisper e sounddevice (pode levar alguns minutos)..."
"$VENV/bin/pip" install --quiet faster-whisper==1.2.1 sounddevice==0.5.6

echo "    Baixando o modelo de transcrição 'small' (~500 MB, só na primeira vez)..."
"$VENV/bin/python" -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"

echo "4/4 Copiando o app para a pasta Aplicativos..."
if [ -d "$APP_NAME" ]; then
  rm -rf "/Applications/$APP_NAME"
  ditto "$APP_NAME" "/Applications/$APP_NAME"
  xattr -dr com.apple.quarantine "/Applications/$APP_NAME" 2>/dev/null || true
  echo "    App instalado em /Applications/$APP_NAME"
else
  echo "    '$APP_NAME' não está ao lado deste instalador. Copie o app manualmente para Aplicativos."
fi

echo
echo "Instalação concluída. Abra o Auxiliar Litúrgico pela pasta Aplicativos."
echo "Na primeira vez que clicar em 'Ouvir', o macOS vai pedir permissão para o microfone."
