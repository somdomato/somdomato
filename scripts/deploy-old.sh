#!/usr/bin/env bash
# Orquestra o deploy a partir de quem chama (máquina de dev ou runner do
# GitHub Actions — nenhum dos dois é o destino): compila o binário Go
# (cross-compile linux/amd64) + assets de web/, envia para a VPS via ssh e
# executa lá scripts/deploy-remote.sh (que roda no destino, sem ssh, e faz
# a troca do binário + restart do serviço).
#
# Assume que o host já foi provisionado via Ansible (ver README, seção
# Produção) — provisionar é um passo manual e separado, nunca disparado por
# este script.
#
# Uso: ./scripts/deploy.sh  (ou HOST=usuario@outro-host ./scripts/deploy.sh)
set -euo pipefail

HOST="${HOST:-nginx@tyche}"
APP_DIR="${APP_DIR:-/var/www/somdomato}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Gerando templates, CSS e binário linux/amd64 (make build)..."
cd "$REPO_ROOT"
make build

echo "==> Enviando binário e assets estáticos para $HOST..."
ssh "$HOST" "mkdir -p $APP_DIR/bin"
# Envia pelo mesmo canal de shell do ssh (não via scp/sftp): em alguns hosts
# o subsistema SFTP resolve caminhos num chroot diferente do shell exec, o
# que faz o scp "ter sucesso" escrevendo em outro lugar.
ssh "$HOST" "cat > $APP_DIR/bin/somdomato-server" < "$REPO_ROOT/tmp/somdomato-server"

echo "==> Executando deploy-remote.sh no destino..."
ssh "$HOST" "APP_DIR=$APP_DIR bash -s" < "$REPO_ROOT/scripts/deploy-remote.sh"
