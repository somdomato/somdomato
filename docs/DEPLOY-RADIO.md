# Guia de Deploy do Sistema de Rádio

Este documento explica como fazer deploy completo do sistema de streaming em produção.

## Pré-requisitos

- Servidor Linux (Ubuntu/Debian recomendado)
- Nginx instalado
- Icecast2 instalado (`apt install icecast2`)
- Liquidsoap instalado (`apt install liquidsoap`)
- Certificado SSL configurado (Let's Encrypt)
- DNS configurado para:
  - `somdomato.com`
  - `radio.somdomato.com`
  - `cdn.somdomato.com` (opcional)

## 1. Configurar Icecast

```bash
# Copiar configuração do Icecast
sudo cp ansible/etc/icecast/somdomato.xml /etc/icecast2/somdomato.xml

# Ajustar permissões
sudo chown icecast2:icecast /etc/icecast2/somdomato.xml
sudo chmod 640 /etc/icecast2/somdomato.xml

# Criar diretórios de log se não existirem
sudo mkdir -p /var/log/icecast2
sudo chown icecast2:icecast /var/log/icecast2

# Copiar e habilitar service
sudo cp ansible/etc/systemd/system/icecast2-somdomato.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable icecast2-somdomato
sudo systemctl start icecast2-somdomato

# Verificar status
sudo systemctl status icecast2-somdomato
```

## 2. Configurar Liquidsoap

```bash
# Criar usuário liquidsoap se não existir
sudo useradd -r -s /bin/false -d /var/lib/liquidsoap liquidsoap

# Criar diretórios necessários
sudo mkdir -p /var/lib/liquidsoap
sudo mkdir -p /var/log/liquidsoap
sudo mkdir -p /etc/liquidsoap
sudo chown liquidsoap:liquidsoap /var/lib/liquidsoap
sudo chown liquidsoap:liquidsoap /var/log/liquidsoap

# Copiar script do Liquidsoap
sudo cp ansible/etc/liquidsoap/somdomato.liq /etc/liquidsoap/somdomato.liq
sudo chown liquidsoap:liquidsoap /etc/liquidsoap/somdomato.liq
sudo chmod 644 /etc/liquidsoap/somdomato.liq

# Garantir que liquidsoap tem acesso às músicas (read-only)
sudo chmod -R o+rX /var/music/sdm

# Copiar e habilitar service
sudo cp ansible/etc/systemd/system/liquidsoap-somdomato.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable liquidsoap-somdomato
sudo systemctl start liquidsoap-somdomato

# Verificar status
sudo systemctl status liquidsoap-somdomato
```

## 3. Configurar Nginx

```bash
# Copiar configurações do Nginx
sudo cp ansible/etc/nginx/sites.d/somdomato.com.conf /etc/nginx/sites-available/
sudo cp ansible/etc/nginx/sites.d/radio.somdomato.com.conf /etc/nginx/sites-available/

# Criar symlinks
sudo ln -sf /etc/nginx/sites-available/somdomato.com.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/radio.somdomato.com.conf /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx
```

## 4. Configurar DNS

Adicionar registros DNS:

```
A    radio.somdomato.com    -> IP_DO_SERVIDOR
```

## 5. Obter Certificado SSL para radio.somdomato.com

```bash
# Se usando certbot com wildcard ou adicionar subdomínio
sudo certbot certonly --nginx -d radio.somdomato.com

# Ou se já tem certificado wildcard para *.somdomato.com, apenas recarregar nginx
sudo systemctl reload nginx
```

## 6. Verificar Funcionamento

### Testar Icecast diretamente:
```bash
curl -I http://localhost:8000/geral
curl -I http://localhost:8000/json
```

### Testar via Nginx (localmente):
```bash
curl -I http://localhost/geral  # via somdomato.com local
```

### Testar publicamente:
```bash
curl -I https://radio.somdomato.com/geral
curl https://radio.somdomato.com/json
```

### Verificar logs:
```bash
# Liquidsoap
sudo journalctl -u liquidsoap-somdomato -f

# Icecast
sudo journalctl -u icecast2-somdomato -f
sudo tail -f /var/log/icecast2/error.log

# Nginx
sudo tail -f /var/log/nginx/radio.somdomato.com.access.log
sudo tail -f /var/log/nginx/radio.somdomato.com.error.log

# Next.js
sudo journalctl -u somdomato -f
```

## 7. Deploy da Aplicação Next.js

```bash
# No servidor, como usuário nginx
cd /var/www/somdomato
git pull
pnpm install
pnpm run build
sudo systemctl restart somdomato
```

## Estrutura de Serviços

```
┌──────────────┐
│   Usuário    │
└──────┬───────┘
       │ HTTPS
       ▼
┌──────────────┐
│    Nginx     │ (proxy reverso)
│              │
│ - somdomato.com        -> localhost:3000 (Next.js)
│ - radio.somdomato.com  -> localhost:8000 (Icecast)
└──────┬───────┘
       │
       ├──► Next.js (porta 3000)
       │    └──► Socket.io
       │
       └──► Icecast (porta 8000)
            └──► Liquidsoap
                 └──► Consulta API Next.js
                      └──► Lê arquivos de /var/music/sdm
```

## Ordem de Inicialização

1. **Next.js** (`somdomato.service`) - API que o Liquidsoap consulta
2. **Icecast** (`icecast2-somdomato.service`) - Servidor de streaming
3. **Liquidsoap** (`liquidsoap-somdomato.service`) - AutoDJ
4. **Nginx** - Proxy reverso para todos

## Troubleshooting

### Liquidsoap não consegue conectar à API

**Problema:** Liquidsoap tenta acessar `http://localhost:3000/api/music` mas falha.

**Solução:**
```bash
# Testar localmente
curl http://localhost:3000/api/music?genre=geral

# Verificar se Next.js está rodando
sudo systemctl status somdomato

# Ver logs do Liquidsoap
sudo journalctl -u liquidsoap-somdomato -n 100
```

### Icecast não está recebendo stream do Liquidsoap

**Problema:** Icecast está rodando mas não lista nenhum mountpoint ativo.

**Verificar:**
1. Liquidsoap está rodando? `sudo systemctl status liquidsoap-somdomato`
2. Liquidsoap consegue ler os arquivos? `sudo -u liquidsoap ls /var/music/sdm`
3. API está retornando músicas? `curl http://localhost:3000/api/music?genre=geral`

### Radio.somdomato.com não resolve

**Problema:** DNS não está configurado.

**Solução:**
1. Adicionar registro A no DNS: `radio.somdomato.com -> IP_DO_SERVIDOR`
2. Aguardar propagação (pode levar até 24h)
3. Testar: `dig radio.somdomato.com`

### Certificado SSL inválido para radio.somdomato.com

**Problema:** Certificado não inclui subdomínio.

**Solução:**
```bash
# Adicionar subdomínio ao certificado existente
sudo certbot certonly --nginx -d somdomato.com -d www.somdomato.com -d radio.somdomato.com

# Ou criar certificado separado
sudo certbot certonly --nginx -d radio.somdomato.com
```

## Manutenção

### Reiniciar todos os serviços:
```bash
sudo systemctl restart somdomato icecast2-somdomato liquidsoap-somdomato nginx
```

### Atualizar configuração do Liquidsoap:
```bash
sudo cp ansible/etc/liquidsoap/somdomato.liq /etc/liquidsoap/
sudo systemctl restart liquidsoap-somdomato
```

### Atualizar configuração do Icecast:
```bash
sudo cp ansible/etc/icecast/somdomato.xml /etc/icecast2/
sudo systemctl restart icecast2-somdomato
```

### Ver status de todos os serviços:
```bash
sudo systemctl status somdomato icecast2-somdomato liquidsoap-somdomato nginx
```

## Monitoramento

### Verificar se rádio está transmitindo:
```bash
# Via curl
curl https://radio.somdomato.com/json | jq '.icestats.source'

# Via navegador
https://radio.somdomato.com/status.xsl
```

### Métricas importantes:
- Número de ouvintes: `curl https://radio.somdomato.com/json | jq '.icestats.source[].listeners'`
- Música atual: `curl https://radio.somdomato.com/json | jq '.icestats.source[].title'`
- Uptime do Icecast: `systemctl status icecast2-somdomato`
