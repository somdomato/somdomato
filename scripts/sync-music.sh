#!/bin/bash

set -e

# Aguardar 5 minutos antes de processar (caso ainda esteja transferindo)
echo "$(date): Aguardando 5 minutos antes de sincronizar..."
sleep 300

echo "$(date): Iniciando sincronização do banco de dados de músicas..."

# Executar o script TypeScript de sincronização
cd /var/www/somdomato
NODE_ENV=production /home/nginx/.local/share/pnpm/pnpm tsx scripts/sync-music.ts

# Sincronizar os arquivos de música usando rsync
rsync -avz -e 'ssh -p 22000' /var/music/sdm/ lucas@localhost:/home/lucas/music/sdm/ --delete --exclude=".*" 2> /dev/null 
rsync -avz -e 'ssh -p 22000' /var/www/somdomato/public/covers/ lucas@localhost:/home/lucas/code/somdomato/public/covers/ --exclude=".*" 2> /dev/null

echo "$(date): Sincronização concluída."
