#!/usr/bin/env bash
# Roda NO destino (a VPS) — não usa ssh. É enviado e executado remotamente
# depois que o binário novo já foi copiado para $APP_DIR/bin/somdomato-server.
# Só reinicia o serviço; nunca toca em $APP_DIR/.env.
set -euo pipefail

APP_DIR="${APP_DIR:?APP_DIR precisa estar definido}"

chmod +x "$APP_DIR/bin/somdomato-server"

echo "==> Reiniciando serviço (o binário aplica migrations pendentes no boot)..."
# systemctl exige root; o usuário SSH usado no deploy tem uma regra sudoers
# NOPASSWD restrita a esta unit (ver ansible/etc/sudoers.d).
sudo systemctl enable --now somdomato-api
sudo systemctl restart somdomato-api

echo "==> Deploy concluído."
