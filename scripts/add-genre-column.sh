#!/usr/bin/env bash

# Script para adicionar coluna genre na tabela history

cd /var/www/somdomato 2>/dev/null || cd ~/code/somdomato

echo "Adicionando coluna 'genre' na tabela history..."

sqlite3 drizzle/somdomato.db << 'EOF'
-- Verificar se a coluna já existe
.schema history

-- Adicionar coluna se não existir
ALTER TABLE history ADD COLUMN genre TEXT DEFAULT 'geral' NOT NULL;

-- Verificar resultado
.schema history

-- Mostrar contagem de registros
SELECT COUNT(*) as total_registros FROM history;
EOF

echo "✅ Coluna adicionada com sucesso!"
