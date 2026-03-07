#!/usr/bin/env bash

PATH=$PATH:/home/nginx/.local/share/pnpm

NAME=somdomato
SERVICE=$NAME.service
TEMP_DIR=/tmp/$NAME
PROJECT_DIR=/var/www/$NAME

[ -d "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"
cp -a "$PROJECT_DIR" "$TEMP_DIR"
cd "$TEMP_DIR" || exit 1

#git clean -fxd -e .env -e public/covers -e drizzle/somdomato.db
git clean -fxd -e .env -e public/covers
cp .env .env.production 

# Gerar NEXT_SERVER_ACTIONS_ENCRYPTION_KEY se não existir
if ! grep -q "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY" .env; then
  echo "Gerando NEXT_SERVER_ACTIONS_ENCRYPTION_KEY..."
  KEY=$(openssl rand -hex 32)
  echo "" >> .env
  echo "# Chave de criptografia para Server Actions (gerada automaticamente)" >> .env
  echo "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$KEY" >> .env
  echo "✓ Chave gerada e adicionada ao .env"
fi

# Garantir que existe em .env.production também
if ! grep -q "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY" .env.production; then
  echo "Copiando NEXT_SERVER_ACTIONS_ENCRYPTION_KEY para .env.production..."
  KEY=$(grep "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY" .env | cut -d '=' -f2)
  echo "" >> .env.production
  echo "# Chave de criptografia para Server Actions" >> .env.production
  echo "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$KEY" >> .env.production
  echo "✓ Chave copiada para .env.production"
fi

pnpm install
pnpm run push
pnpm run seed
pnpm run build || exit 1

sudo /usr/bin/systemctl stop $SERVICE
#pnpm run seed
rm -rf "$PROJECT_DIR"
mv "$TEMP_DIR" "$PROJECT_DIR"
#ln -sf /var/music/sdm "$PROJECT_DIR/public/music"
sudo /usr/bin/systemctl start $SERVICE