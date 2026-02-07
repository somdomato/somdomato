#!/usr/bin/env bash
#
# Gera uma chave de criptografia para NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
# Uso: ./scripts/generate-encryption-key.sh [--update-env]
#

set -e

#const crypto = require('crypto');
#const key = crypto.randomBytes(32);
#console.log(key.toString('hex'));

KEY=$(openssl rand -hex 32)

echo "=========================================="
echo "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY gerada:"
echo "=========================================="
echo "$KEY"
echo "=========================================="
echo ""
echo "Adicione ao seu arquivo .env:"
echo "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$KEY"
echo ""

# Se --update-env foi passado, atualizar automaticamente
if [ "$1" = "--update-env" ]; then
  if [ -f .env ]; then
    if grep -q "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY" .env; then
      # Atualizar chave existente
      sed -i.bak "s/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=.*/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$KEY/" .env
      echo "✓ Chave atualizada em .env (backup criado em .env.bak)"
    else
      # Adicionar nova chave
      echo "" >> .env
      echo "# Chave de criptografia para Server Actions" >> .env
      echo "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$KEY" >> .env
      echo "✓ Chave adicionada ao .env"
    fi
    
    # Sincronizar com .env.production se existir
    if [ -f .env.production ]; then
      if grep -q "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY" .env.production; then
        sed -i.bak "s/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=.*/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$KEY/" .env.production
      else
        echo "" >> .env.production
        echo "# Chave de criptografia para Server Actions" >> .env.production
        echo "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$KEY" >> .env.production
      fi
      echo "✓ Chave sincronizada com .env.production"
    fi
  else
    echo "⚠ Arquivo .env não encontrado. Crie-o primeiro ou execute na raiz do projeto."
    exit 1
  fi
fi
