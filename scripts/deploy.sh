#!/usr/bin/env bash
# Compila o binário Go (cross-compile linux/amd64) + assets de web/ e envia
# para a VPS, reiniciando o serviço systemd. Se a unit somdomato-api.service
# ainda não existir (primeiro deploy), roda `ansible-playbook` primeiro para
# provisionar o host — requer ansible/group_vars/production/vault.yml já
# preenchido e criptografado (ver README, seção Produção).
#
# Uso: ./scripts/deploy.sh  (ou HOST=usuario@outro-host ./scripts/deploy.sh)
set -euo pipefail

HOST="${HOST:-nginx@tyche}"
APP_DIR="${APP_DIR:-/var/www/somdomato}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! ssh "$HOST" "test -f /etc/systemd/system/somdomato-api.service"; then
  echo "==> somdomato-api.service não existe em $HOST — provisionando via Ansible..."
  (cd "$REPO_ROOT/ansible" && ansible-playbook -i inventory.ini playbook.yml --ask-vault-pass)
fi

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
# Envia pelo mesmo canal de shell do ssh (não via scp/sftp): em alguns hosts
# o subsistema SFTP resolve caminhos num chroot diferente do shell exec, o
# que faz o scp "ter sucesso" escrevendo em outro lugar e o mv seguinte
# falhar com "No such file or directory".
ssh "$HOST" "cat > $APP_DIR/bin/somdomato-server.new" < "$REPO_ROOT/tmp/somdomato-server"
ssh "$HOST" "mv $APP_DIR/bin/somdomato-server.new $APP_DIR/bin/somdomato-server && chmod +x $APP_DIR/bin/somdomato-server"

echo "==> Reiniciando serviço (o binário aplica migrations pendentes no boot)..."
# systemctl exige root; o usuário SSH usado no deploy tem uma regra sudoers
# NOPASSWD restrita a esta unit (ver ansible/etc/sudoers.d).
ssh "$HOST" "sudo systemctl enable --now somdomato-api && sudo systemctl restart somdomato-api"

echo "==> Deploy concluído."
