#!/bin/bash
# Muda a versão do app nos três arquivos e nos arquivos de trava (package-lock.json e Cargo.lock).
# Uso: ./scripts/bump_version.sh 0.3.1
set -e
cd "$(dirname "$0")/.."
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

NEW="${1#v}"
if ! echo "$NEW" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Uso: ./scripts/bump_version.sh X.Y.Z   (exemplo: 0.3.1)" >&2
  exit 1
fi

echo "Mudando a versão para $NEW..."

# package.json e package-lock.json
(cd app && npm version "$NEW" --no-git-tag-version --allow-same-version >/dev/null)

# tauri.conf.json (mantém o resto do arquivo como está)
node -e '
const fs = require("fs");
const path = "app/src-tauri/tauri.conf.json";
const conf = JSON.parse(fs.readFileSync(path, "utf8"));
conf.version = process.argv[1];
fs.writeFileSync(path, JSON.stringify(conf, null, 2) + "\n");
' "$NEW"

# Cargo.toml: só a primeira linha "version =" (a do [package])
node -e '
const fs = require("fs");
const path = "app/src-tauri/Cargo.toml";
const text = fs.readFileSync(path, "utf8");
fs.writeFileSync(path, text.replace(/^version = ".*"$/m, `version = "${process.argv[1]}"`));
' "$NEW"

# Cargo.lock: atualiza só a versão do próprio app, sem mexer nas dependências
(cd app/src-tauri && cargo update --workspace --quiet)

echo
./scripts/check_version.sh
echo
echo "Próximo passo: git add -A && git commit -m \"Versão $NEW\" && git tag v$NEW && git push origin main --tags"
