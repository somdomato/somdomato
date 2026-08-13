#!/usr/bin/env bash
# Orquestra o deploy a partir de quem chama (máquina de dev ou runner do
# GitHub Actions — nenhum dos dois é o destino): compila o binário Go
# (cross-compile linux/amd64) + assets de web/, envia para a VPS via ssh e
# executa lá scripts/deploy-remote.sh (que roda no destino, sem ssh, e faz
# a troca do binário + restart do serviço). Se a unit somdomato-api.service
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

echo "==> Executando deploy-remote.sh no destino..."
ssh "$HOST" "APP_DIR=$APP_DIR bash -s" < "$REPO_ROOT/scripts/deploy-remote.sh"
