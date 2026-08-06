#!/bin/bash

set -e

# Aguardar 5 minutos antes de processar (caso ainda esteja transferindo)
echo "$(date): Aguardando 5 minutos antes de sincronizar..."
sleep 300

echo "$(date): Iniciando sincronização do banco de dados de músicas..."

# Executar o script TypeScript de sincronização
cd /var/www/somdomato
NODE_ENV=production /home/nginx/.local/share/pnpm/pnpm tsx src/scripts/sync-music.ts

# Sincronizar os arquivos de música usando rsync (com detecção de erros)
echo "$(date): Sincronizando arquivos de música..."
if ! rsync -avz -e 'ssh -p 22000' /var/music/sdm/ lucas@localhost:/home/lucas/music/sdm/ --delete --exclude=".*"; then
  echo "⚠️ $(date): Aviso - rsync de música retornou status não-zero" >&2
fi

echo "$(date): Sincronizando capas de artistas..."
if ! rsync -avz -e 'ssh -p 22000' /var/www/somdomato/public/covers/ lucas@localhost:/home/lucas/code/sdm/somdomato/public/covers/ --exclude=".*"; then
  echo "⚠️ $(date): Aviso - rsync de capas retornou status não-zero" >&2
fi

echo "$(date): Sincronização concluída."
