#!/bin/bash
# Envia as mudanças locais para o GitHub e, se quiser, lança uma versão nova.
#
#   ./publicar.sh status                         mostra versão, alterações e o que falta enviar
#   ./publicar.sh codigo "mensagem"              testa, faz commit e envia (não lança versão)
#   ./publicar.sh versao patch "mensagem"        testa, sobe a versão (0.3.0 -> 0.3.1), faz commit, tag e envia
#   ./publicar.sh versao minor "mensagem"        0.3.1 -> 0.4.0
#   ./publicar.sh versao major "mensagem"        0.4.0 -> 1.0.0
#   ./publicar.sh versao 0.5.2 "mensagem"        versão escolhida
#
# Ao enviar a tag, o GitHub compila o app para Mac, assina e publica a Release.
# Quem já tem o app recebe a atualização em Configurações → Atualizações.
#
# Variáveis opcionais:  PULAR_TESTES=1  (não roda os testes)   SO_RAPIDO=1  (pula o teste do Rust)
set -e
cd "$(dirname "$0")"
[ -f "$HOME/.cargo/env" ] && . "$HOME/.cargo/env"

BRANCH="main"
MAX_MB=50

erro() { printf 'ERRO: %b\n' "$*" >&2; exit 1; }

url_do_repositorio() {
  git remote get-url origin | sed -E 's#^git@github.com:#https://github.com/#; s#\.git$##'
}

versao_atual() { node -p "require('./app/package.json').version"; }

# Confere o ambiente antes de qualquer coisa.
preparar() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || erro "esta pasta não é um repositório git."
  git remote get-url origin >/dev/null 2>&1 || erro "o repositório não tem o remoto 'origin'."
  [ "$(git rev-parse --abbrev-ref HEAD)" = "$BRANCH" ] || erro "mude para a branch $BRANCH (git switch $BRANCH)."
  git fetch origin "$BRANCH" --quiet 2>/dev/null || true
  if git rev-parse "origin/$BRANCH" >/dev/null 2>&1; then
    ATRAS=$(git rev-list --count "HEAD..origin/$BRANCH")
    [ "$ATRAS" = "0" ] || erro "o GitHub tem $ATRAS commit(s) que você não tem. Rode: git pull --rebase origin $BRANCH"
  fi
}

# Impede que arquivos que nunca devem ir para o GitHub entrem no commit.
conferir_arquivos() {
  local proibidos
  proibidos=$(git diff --cached --name-only | grep -E '\.key$|\.pdf$|app/seed/culto_sede_|(^|/)node_modules/|/target/|(^|/)\.venv/|(^|/)pacote/' || true)
  if [ -n "$proibidos" ]; then
    git reset -q
    erro "estes arquivos não podem ser enviados:\n$proibidos"
  fi
  local grandes=""
  while IFS= read -r arquivo; do
    [ -f "$arquivo" ] || continue
    local tamanho
    tamanho=$(stat -f %z "$arquivo")
    if [ "$tamanho" -gt $((MAX_MB * 1024 * 1024)) ]; then grandes="$grandes\n$arquivo ($((tamanho / 1024 / 1024)) MB)"; fi
  done < <(git diff --cached --name-only)
  if [ -n "$grandes" ]; then
    git reset -q
    erro "arquivos maiores que $MAX_MB MB:$grandes"
  fi
}

testar() {
  [ -z "$PULAR_TESTES" ] || { echo "Testes pulados (PULAR_TESTES=1)."; return 0; }
  echo "== Testes"
  (cd app && npm install --no-audit --no-fund >/dev/null && npx tsc --noEmit && npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)")
  python3 python/test_listen.py 2>&1 | tail -1
  if [ -z "$SO_RAPIDO" ]; then
    (cd app/src-tauri && cargo test 2>&1 | grep -E "test result: .* [1-9][0-9]* passed|FAILED|error" || true)
  fi
}

commit_e_push() {
  local mensagem="$1"
  git add -A
  conferir_arquivos
  if git diff --cached --quiet; then
    echo "Nenhuma alteração para commitar."
    return 1
  fi
  git commit -q -m "$mensagem"
  echo "Commit: $(git log -1 --pretty='%h %s')"
  return 0
}

enviar() {
  git push -u origin "$BRANCH" "$@"
}

comando="${1:-}"
case "$comando" in
  status)
    echo "Versão do app: $(versao_atual)"
    echo "Última tag:    $(git describe --tags --abbrev=0 2>/dev/null || echo 'nenhuma')"
    echo "Repositório:   $(url_do_repositorio)"
    echo "== Alterações locais"
    git status --short
    echo "== Commits ainda não enviados"
    git log --oneline "origin/$BRANCH..HEAD" 2>/dev/null || git log --oneline | head -5
    ;;

  codigo)
    mensagem="${2:-}"
    [ -n "$mensagem" ] || erro 'informe a mensagem. Exemplo: ./publicar.sh codigo "Ajusta o tema"'
    preparar
    testar
    if commit_e_push "$mensagem"; then enviar; fi
    echo "Enviado. $(url_do_repositorio)"
    ;;

  versao)
    alvo="${2:-}"
    mensagem="${3:-}"
    [ -n "$alvo" ] || erro 'informe patch, minor, major ou X.Y.Z. Exemplo: ./publicar.sh versao patch "Corrige a busca"'
    preparar
    atual=$(versao_atual)
    case "$alvo" in
      patch|minor|major)
        nova=$(node -e '
          const [a, b, c] = process.argv[1].split(".").map(Number);
          const t = process.argv[2];
          console.log(t === "major" ? `${a + 1}.0.0` : t === "minor" ? `${a}.${b + 1}.0` : `${a}.${b}.${c + 1}`);
        ' "$atual" "$alvo") ;;
      *) nova="${alvo#v}" ;;
    esac
    echo "$nova" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || erro "versão inválida: $nova"
    [ "$nova" != "$atual" ] || erro "a versão já é $atual. Escolha outra."
    git rev-parse -q --verify "refs/tags/v$nova" >/dev/null && erro "a tag v$nova já existe."

    testar
    echo "== Versão $atual -> $nova"
    ./scripts/bump_version.sh "$nova" >/dev/null
    commit_e_push "Versão $nova${mensagem:+: $mensagem}" || erro "nada foi commitado."
    git tag -a "v$nova" -m "Versão $nova${mensagem:+: $mensagem}"
    enviar
    git push origin "v$nova"
    echo
    echo "Versão $nova enviada. O GitHub está compilando (cerca de 20 a 30 minutos na primeira vez)."
    echo "Acompanhe:  $(url_do_repositorio)/actions"
    echo "Release:    $(url_do_repositorio)/releases/tag/v$nova"
    ;;

  *)
    sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
