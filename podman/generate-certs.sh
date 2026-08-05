#!/bin/bash

# Gera certificados SSL para desenvolvimento local
# Usa mkcert (recomendado) ou openssl (fallback)
# Uso: ./generate-certs.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="${SCRIPT_DIR}/certs"

mkdir -p "$CERTS_DIR"

if [ -f "$CERTS_DIR/selfsigned.crt" ] && [ -f "$CERTS_DIR/selfsigned.key" ]; then
    echo "Certificados já existem em $CERTS_DIR"
    echo "Para regenerar, delete a pasta certs/ e execute novamente."
    exit 0
fi

# Tentar usar mkcert (certificados confiados pelo navegador sem aviso)
if command -v mkcert &> /dev/null; then
    echo "Usando mkcert para gerar certificados confiados pelo sistema..."
    mkcert -install 2>/dev/null || true
    mkcert -cert-file "$CERTS_DIR/selfsigned.crt" \
           -key-file "$CERTS_DIR/selfsigned.key" \
           localhost "*.localhost" 127.0.0.1 ::1

    echo ""
    echo "Certificados gerados com mkcert (confiados pelo navegador)."
    echo "Nenhum aviso de certificado será exibido no Chrome/Edge/Firefox."
else
    echo "mkcert não encontrado. Usando openssl (certificado auto-assinado)..."
    echo ""
    echo "Para certificados sem aviso no navegador, instale mkcert:"
    echo "  Windows:  choco install mkcert  (ou scoop install mkcert)"
    echo "  Linux:    sudo apt install mkcert  (ou yay -S mkcert)"
    echo "  macOS:    brew install mkcert"
    echo ""

    SUBJ="/C=BR/ST=MT/L=CuiabaMT/O=SomDoMato/CN=localhost"

    # No Git Bash (Windows/MSYS), prefixar com "/" extra para evitar conversão de path
    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*) SUBJ="/$SUBJ" ;;
    esac

    openssl req -x509 -nodes -days 3650 \
        -newkey rsa:2048 \
        -keyout "$CERTS_DIR/selfsigned.key" \
        -out "$CERTS_DIR/selfsigned.crt" \
        -subj "$SUBJ" \
        -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1"

    echo ""
    echo "Certificado auto-assinado gerado. O navegador mostrará aviso."
    echo "Para eliminar o aviso, instale mkcert e regenere:"
    echo "  rm -rf $CERTS_DIR && bash $0"
fi

echo ""
echo "Certificados em $CERTS_DIR/"
echo "  - selfsigned.crt (certificado)"
echo "  - selfsigned.key (chave privada)"
