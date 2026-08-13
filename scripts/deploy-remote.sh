#!/usr/bin/env bash
# Roda NO destino (a VPS) — não usa ssh. É enviado e executado remotamente
# por scripts/deploy.sh via `ssh "$HOST" bash -s < deploy-remote.sh`, depois
# que o binário novo já foi copiado para $APP_DIR/bin/somdomato-server.new.
# Só troca o binário e reinicia o serviço; nunca toca em $APP_DIR/.env.
set -euo pipefail

APP_DIR="${APP_DIR:?APP_DIR precisa estar definido}"

echo "==> Substituindo binário em $APP_DIR/bin..."
mv "$APP_DIR/bin/somdomato-server.new" "$APP_DIR/bin/somdomato-server"
chmod +x "$APP_DIR/bin/somdomato-server"

echo "==> Reiniciando serviço (o binário aplica migrations pendentes no boot)..."
# systemctl exige root; o usuário SSH usado no deploy tem uma regra sudoers
# NOPASSWD restrita a esta unit (ver ansible/etc/sudoers.d).
sudo systemctl enable --now somdomato-api
sudo systemctl restart somdomato-api

echo "==> Deploy concluído."
