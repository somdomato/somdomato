#!/bin/bash

# Script para iniciar o ambiente de desenvolvimento completo

echo "🚀 Iniciando ambiente de desenvolvimento Som do Mato..."

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Iniciar containers Docker (Nginx + Icecast + Liquidsoap)
echo -e "\n${YELLOW}[1/3]${NC} Iniciando containers Docker..."
cd docker && docker-compose up -d

if [ $? -ne 0 ]; then
    echo "❌ Erro ao iniciar containers Docker"
    exit 1
fi

echo -e "${GREEN}✓${NC} Containers iniciados"
echo "  - Nginx: http://localhost:8080"
echo "  - Icecast: http://localhost:8000 (direto) ou http://localhost:8080 (via proxy)"
echo "  - Liquidsoap: rodando"

# 2. Aguardar containers ficarem prontos
echo -e "\n${YELLOW}[2/3]${NC} Aguardando serviços ficarem prontos..."
sleep 5

# 3. Instruções para o servidor Next.js
echo -e "\n${YELLOW}[3/3]${NC} Para iniciar o servidor Next.js:"
echo "  cd .."
echo "  pnpm dev"

echo -e "\n${GREEN}✓${NC} Ambiente pronto!"
echo -e "\n📻 Acesse: ${GREEN}http://localhost:3000${NC}"
echo "🔧 Admin Icecast: http://localhost:8080/admin (user: admin, pass: hackme)"
echo ""
echo "Para parar os containers:"
echo "  cd docker && docker-compose down"
