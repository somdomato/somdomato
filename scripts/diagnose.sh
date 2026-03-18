#!/bin/bash

# Script de diagnóstico completo do ambiente Docker

echo "🔍 Diagnóstico do Ambiente Som do Mato"
echo "======================================"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. Status dos Containers
echo -e "${BLUE}[1/6] Status dos Containers${NC}"
echo "----------------------------"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep somdomato || echo "Nenhum container rodando!"
echo ""

# 2. Logs recentes do Nginx (últimas 5 linhas)
echo -e "${BLUE}[2/6] Logs do Nginx${NC}"
echo "-------------------"
if docker ps | grep -q somdomato-nginx; then
    docker logs somdomato-nginx 2>&1 | tail -5
    echo ""
else
    echo -e "${RED}❌ Nginx não está rodando${NC}"
    echo ""
fi

# 3. Teste de conectividade - JSON do Icecast
echo -e "${BLUE}[3/6] API JSON do Icecast${NC}"
echo "-------------------------"
if curl -s --max-time 3 http://localhost:8080/json > /dev/null 2>&1; then
    echo -e "${GREEN}✅ JSON acessível via http://localhost:8080/json${NC}"
    STREAMS=$(curl -s http://localhost:8080/json | jq -r '.icestats.source[] | .server_name' 2>/dev/null | wc -l)
    echo "   Streams ativos: $STREAMS/6"
else
    echo -e "${RED}❌ JSON não acessível${NC}"
fi
echo ""

# 4. Teste dos Streams
echo -e "${BLUE}[4/6] Streams de Áudio${NC}"
echo "----------------------"
for genre in geral gaucha modao arrocha romantico forro; do
    if timeout 2 curl -s http://localhost:8080/$genre > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC} /$genre"
    else
        echo -e "${RED}❌${NC} /$genre"
    fi
done
echo ""

# 5. Verificar volumes
echo -e "${BLUE}[5/6] Volumes Montados${NC}"
echo "----------------------"
docker inspect somdomato-liquidsoap 2>/dev/null | jq -r '.[0].Mounts[] | "  \(.Source) → \(.Destination) (\(if .RW then "RW" else "RO" end))"' 2>/dev/null || echo "Container não encontrado"
echo ""

# 6. Teste de portas
echo -e "${BLUE}[6/6] Portas Ativas${NC}"
echo "-------------------"
for port in 3000 8080 8081 8000; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        SERVICE=$(lsof -Pi :$port -sTCP:LISTEN -t | xargs ps -p | tail -1 | awk '{print $NF}')
        echo -e "${GREEN}✅${NC} Porta $port - $SERVICE"
    else
        echo -e "${YELLOW}⚠️${NC}  Porta $port - Disponível"
    fi
done
echo ""

# Resumo
echo "======================================"
echo -e "${BLUE}📊 Resumo${NC}"
echo "======================================"

NGINX_OK=$(docker ps | grep -c somdomato-nginx)
ICECAST_OK=$(docker ps | grep -c somdomato-icecast)
LIQUIDSOAP_OK=$(docker ps | grep -c somdomato-liquidsoap)
JSON_OK=$(curl -s --max-time 2 http://localhost:8080/json > /dev/null 2>&1 && echo 1 || echo 0)

TOTAL=$((NGINX_OK + ICECAST_OK + LIQUIDSOAP_OK + JSON_OK))

if [ $TOTAL -eq 4 ]; then
    echo -e "${GREEN}✅ Sistema 100% operacional!${NC}"
    echo ""
    echo "Acesse:"
    echo "  • Aplicação: http://localhost:3000"
    echo "  • Streams:   http://localhost:8080/geral"
    echo "  • Admin:     http://localhost:8080/admin"
elif [ $TOTAL -ge 2 ]; then
    echo -e "${YELLOW}⚠️  Sistema parcialmente operacional ($TOTAL/4)${NC}"
    echo ""
    echo "Verifique os logs acima para detalhes."
else
    echo -e "${RED}❌ Sistema com problemas sérios ($TOTAL/4)${NC}"
    echo ""
    echo "Execute: cd docker && docker compose up -d"
fi

echo ""
