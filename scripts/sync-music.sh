#!/bin/bash
set -e

# Aguardar 5 minutos antes de processar (caso ainda esteja transferindo)
echo "$(date): Aguardando 5 minutos antes de sincronizar..."
sleep 300

echo "$(date): Iniciando sincronização do banco de dados de músicas..."

# Executar o script TypeScript de sincronização
cd /var/www/somdomato
NODE_ENV=production /home/nginx/.local/share/pnpm/pnpm tsx scripts/sync-music.ts

echo "$(date): Sincronização concluída."
