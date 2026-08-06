#!/usr/bin/env bash
# Compila o binário Go (cross-compile linux/amd64) + assets de web/ e envia
# para a VPS via rsync, reiniciando o serviço systemd. Pressupõe que
# `ansible-playbook playbook.yml` já rodou pelo menos uma vez (usuário,
# diretórios e unit do systemd já existem).
#
# Uso: HOST=root@vps.exemplo.com ./scripts/deploy.sh
set -euo pipefail

HOST="${HOST:?defina HOST=usuario@host da VPS}"
APP_DIR="${APP_DIR:-/var/www/somdomato}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Gerando templates e CSS..."
cd "$REPO_ROOT"
templ generate
./tailwindcss --input web/css/input.css --output web/static/css/output.css --minify

echo "==> Compilando binário linux/amd64..."
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build \
  -ldflags="-s -w" \
  -o "$REPO_ROOT/tmp/somdomato-server" \
  ./api/cmd/server

echo "==> Enviando binário e assets estáticos para $HOST..."
ssh "$HOST" "mkdir -p $APP_DIR/bin"
scp "$REPO_ROOT/tmp/somdomato-server" "$HOST:$APP_DIR/bin/somdomato-server.new"
ssh "$HOST" "mv $APP_DIR/bin/somdomato-server.new $APP_DIR/bin/somdomato-server && chmod +x $APP_DIR/bin/somdomato-server"

echo "==> Reiniciando serviço (o binário aplica migrations pendentes no boot)..."
ssh "$HOST" "systemctl enable --now somdomato-api && systemctl restart somdomato-api"

echo "==> Deploy concluído."
