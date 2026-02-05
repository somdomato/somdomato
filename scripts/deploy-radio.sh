#!/usr/bin/env bash
set -e

# Script de deploy do sistema de rádio Som do Mato
# Configura Icecast, Liquidsoap e Nginx em produção

echo "========================================"
echo "Deploy do Sistema de Rádio Som do Mato"
echo "========================================"
echo

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then 
   echo "❌ Este script precisa ser executado como root (use sudo)"
   exit 1
fi

PROJECT_DIR="/var/www/somdomato"

# Verificar se o diretório do projeto existe
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Diretório do projeto não encontrado: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR" || exit 1

echo "📦 1. Configurando Icecast..."
echo "---"

# Criar diretórios necessários
mkdir -p /var/log/icecast2
chown icecast2:icecast /var/log/icecast2

# Copiar configuração
cp files/etc/icecast/somdomato.xml /etc/icecast2/somdomato.xml
chown icecast2:icecast /etc/icecast2/somdomato.xml
chmod 640 /etc/icecast2/somdomato.xml

# Copiar e habilitar service
cp files/etc/systemd/system/icecast2-somdomato.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable icecast2-somdomato

echo "✅ Icecast configurado"
echo

echo "🎵 2. Configurando Liquidsoap..."
echo "---"

# Criar usuário liquidsoap se não existir
if ! id -u liquidsoap > /dev/null 2>&1; then
    useradd -r -s /bin/false -d /var/lib/liquidsoap liquidsoap
    echo "✅ Usuário liquidsoap criado"
fi

# Criar diretórios necessários
mkdir -p /var/lib/liquidsoap
mkdir -p /var/log/liquidsoap
mkdir -p /etc/liquidsoap
chown liquidsoap:liquidsoap /var/lib/liquidsoap
chown liquidsoap:liquidsoap /var/log/liquidsoap

# Copiar script
cp files/etc/liquidsoap/somdomato.liq /etc/liquidsoap/somdomato.liq
chown liquidsoap:liquidsoap /etc/liquidsoap/somdomato.liq
chmod 644 /etc/liquidsoap/somdomato.liq

# Garantir acesso read-only às músicas
if [ -d "/var/music/sdm" ]; then
    chmod -R o+rX /var/music/sdm
    echo "✅ Permissões de leitura configuradas para /var/music/sdm"
else
    echo "⚠️  Diretório /var/music/sdm não encontrado"
fi

# Copiar e habilitar service
cp files/etc/systemd/system/liquidsoap-somdomato.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable liquidsoap-somdomato

echo "✅ Liquidsoap configurado"
echo

echo "🌐 3. Configurando Nginx..."
echo "---"

# Copiar configurações
cp files/etc/nginx/sites.d/somdomato.com.conf /etc/nginx/sites-available/
cp files/etc/nginx/sites.d/radio.somdomato.com.conf /etc/nginx/sites-available/

# Criar symlinks
ln -sf /etc/nginx/sites-available/somdomato.com.conf /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/radio.somdomato.com.conf /etc/nginx/sites-enabled/

# Testar configuração
if nginx -t; then
    echo "✅ Configuração do Nginx válida"
else
    echo "❌ Erro na configuração do Nginx"
    exit 1
fi

echo

echo "🔄 4. Reiniciando serviços..."
echo "---"

# Reiniciar na ordem correta
echo "▶️  Reiniciando Next.js..."
systemctl restart somdomato

echo "▶️  Reiniciando Icecast..."
systemctl restart icecast2-somdomato

echo "▶️  Reiniciando Liquidsoap..."
systemctl restart liquidsoap-somdomato

echo "▶️  Recarregando Nginx..."
systemctl reload nginx

echo

echo "🔍 5. Verificando status dos serviços..."
echo "---"

services=("somdomato" "icecast2-somdomato" "liquidsoap-somdomato" "nginx")
all_ok=true

for service in "${services[@]}"; do
    if systemctl is-active --quiet "$service"; then
        echo "✅ $service está rodando"
    else
        echo "❌ $service NÃO está rodando"
        all_ok=false
    fi
done

echo

if [ "$all_ok" = true ]; then
    echo "✅ Deploy concluído com sucesso!"
    echo
    echo "🎉 Tudo funcionando!"
    echo
    echo "URLs para testar:"
    echo "  - Next.js:  https://somdomato.com"
    echo "  - Rádio:    https://radio.somdomato.com/geral"
    echo "  - Status:   https://radio.somdomato.com/status.xsl"
    echo "  - Admin:    https://radio.somdomato.com/admin"
    echo
    echo "Comandos úteis:"
    echo "  - Ver logs do Liquidsoap:  sudo journalctl -u liquidsoap-somdomato -f"
    echo "  - Ver logs do Icecast:     sudo journalctl -u icecast2-somdomato -f"
    echo "  - Ver status de tudo:      sudo systemctl status somdomato icecast2-somdomato liquidsoap-somdomato"
else
    echo "⚠️  Alguns serviços não iniciaram corretamente."
    echo "Verifique os logs:"
    echo "  sudo journalctl -u somdomato -n 50"
    echo "  sudo journalctl -u icecast2-somdomato -n 50"
    echo "  sudo journalctl -u liquidsoap-somdomato -n 50"
    exit 1
fi
