#!/bin/bash

# Script para iniciar o ambiente de desenvolvimento completo

echo "🚀 Iniciando ambiente de desenvolvimento Som do Mato..."

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Verificar se Podman está rodando
if ! podman info > /dev/null 2>&1; then
    echo -e "${RED}❌ Podman não está rodando. Inicie o Podman primeiro.${NC}"
    exit 1
fi

# 1. Gerar certificados SSL se necessário
echo -e "\n${YELLOW}[1/3]${NC} Verificando certificados SSL..."
cd podman

if [ ! -f "certs/selfsigned.crt" ]; then
    echo "Gerando certificados SSL auto-assinados..."
    bash generate-certs.sh
fi
echo -e "${GREEN}✓${NC} Certificados SSL prontos"

# 2. Iniciar containers Podman
echo -e "\n${YELLOW}[2/3]${NC} Iniciando containers Podman (Next.js + Nginx + Icecast + Liquidsoap)..."
podman compose up -d --build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro ao iniciar containers Podman${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Containers iniciados"

# 3. Aguardar containers ficarem prontos
echo -e "\n${YELLOW}[3/3]${NC} Aguardando serviços ficarem prontos..."
echo "  Aguardando Next.js (healthcheck)..."

for i in $(seq 1 60); do
    if podman inspect --format='{{.State.Health.Status}}' somdomato-nextjs 2>/dev/null | grep -q "healthy"; then
        break
    fi
    sleep 2
done

echo -e "\n${GREEN}✓${NC} Ambiente pronto!"
echo ""
echo "📻 Aplicação:        https://localhost (SSL)"
echo "📻 Aplicação (HTTP): http://localhost:8080"
echo "🔧 Icecast Admin:    https://localhost/admin (user: admin, pass: hackme)"
echo "📡 Streams:          https://localhost/geral"
echo ""
echo "Para ver logs:"
echo "  podman compose -f podman/compose.yml logs -f"
echo ""
echo "Para parar:"
echo "  podman compose -f podman/compose.yml down"
