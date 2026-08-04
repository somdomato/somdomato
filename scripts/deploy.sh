#!/usr/bin/env bash

PATH=$PATH:/home/nginx/.local/share/pnpm

NAME=somdomato
SERVICE=$NAME.service
TEMP_DIR=/tmp/$NAME
PROJECT_DIR=/var/www/$NAME

[ -d "$TEMP_DIR" ] && rm -rf "$TEMP_DIR"
cp -a "$PROJECT_DIR" "$TEMP_DIR"
cd "$TEMP_DIR" || exit 1

git clean -fxd -e .env -e public/covers -e drizzle/somdomato.db -e public/music
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
  echo "Push do banco de dados com sucesso."
  pnpm run seed
else
  echo "Erro ao aplicar push do banco de dados. Abortando deploy."
  exit 1
fi

# if pnpm run migrate; then
#   echo "Migrações aplicadas com sucesso."
# else
#   echo "Erro ao aplicar migrações. Abortando deploy."
#   exit 1
# fi

if pnpm exec tsc --noEmit; then
  echo "Checagem de tipos concluída com sucesso."
else
  echo "Erro na checagem de tipos. Abortando deploy."
  exit 1
fi

# Servidor tem só 1.9GB de RAM compartilhados com outros serviços (Liquidsoap,
# Icecast, bot, outro app Next.js) — sem isso o V8 cresce até o kernel matar o
# processo com OOM-killer (visto em produção: next-build chegando a 1.2GB de RSS).
NODE_OPTIONS="--max-old-space-size=768" pnpm run build || exit 1

sudo /usr/bin/systemctl stop $SERVICE
rm -rf "$PROJECT_DIR"
mv "$TEMP_DIR" "$PROJECT_DIR"

# Criar symlink para servir arquivos de música diretamente via /music/
MUSIC_LINK="$PROJECT_DIR/public/music"
MUSIC_PATH="/var/music/sdm"

if [ ! -L "$MUSIC_LINK" ]; then
  ln -s "$MUSIC_PATH" "$MUSIC_LINK"
  echo "✓ Symlink criado: $MUSIC_LINK -> $MUSIC_PATH"
fi

sudo /usr/bin/systemctl start $SERVICE