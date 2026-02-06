#!/bin/bash

# Script para verificar se todas as portas necessárias estão disponíveis

echo "🔍 Verificando portas disponíveis..."
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${RED}❌ Porta $port OCUPADA${NC} (necessária para $service)"
        lsof -Pi :$port -sTCP:LISTEN
        return 1
    else
        echo -e "${GREEN}✅ Porta $port disponível${NC} ($service)"
        return 0
    fi
}

# Verificar portas necessárias
all_ok=true

check_port 3000 "Next.js" || all_ok=false
echo ""

check_port 8080 "Nginx (proxy)" || all_ok=false
echo ""

check_port 8081 "Liquidsoap (controle)" || all_ok=false
echo ""

check_port 8000 "Icecast (streaming)" || all_ok=false
echo ""

if [ "$all_ok" = true ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Todas as portas estão disponíveis!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Você pode iniciar o ambiente:"
    echo "  ./scripts/dev.sh"
    exit 0
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ Algumas portas estão ocupadas!${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${YELLOW}Para liberar as portas:${NC}"
    echo "  1. Identifique o processo: lsof -i :<PORTA>"
    echo "  2. Mate o processo: kill <PID>"
    echo "  3. Ou pare containers Docker: docker stop <container>"
    exit 1
fi
