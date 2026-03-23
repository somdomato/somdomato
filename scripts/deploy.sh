#!/usr/bin/env bash

PATH=$PATH:/home/nginx/.local/share/pnpm

NAME=somdomato
SERVICE=$NAME.service
TEMP_DIR=/tmp/$NAME
PROJECT_DIR=/var/www/$NAME

[ -d "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"
cp -a "$PROJECT_DIR" "$TEMP_DIR"
cd "$TEMP_DIR" || exit 1

git clean -fxd -e .env -e public/covers -e drizzle/somdomato.db
cp .env .env.production 

if ! grep -q "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY" .env; then
  echo "Gerando NEXT_SERVER_ACTIONS_ENCRYPTION_KEY..."
  KEY=$(openssl rand -hex 32)
  echo "" >> .env
  echo "# Chave de criptografia para Server Actions (gerada automaticamente)" >> .env
  echo "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$KEY" >> .env
  echo "✓ Chave gerada e adicionada ao .env"
fi

pnpm install

if pnpm run push; then
  echo "Migrações aplicadas com sucesso."
  pnpm run seed
else
  echo "Erro ao aplicar migrações. Abortando deploy."
  exit 1
fi

pnpm run build || exit 1

sudo /usr/bin/systemctl stop $SERVICE
rm -rf "$PROJECT_DIR"
mv "$TEMP_DIR" "$PROJECT_DIR"
sudo /usr/bin/systemctl start $SERVICE