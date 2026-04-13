# Configuração de Portas - Som do Mato

## 🔌 Mapeamento de Portas

### Desenvolvimento (Docker)

| Serviço | Porta Externa | Porta Interna | Propósito |
|---------|---------------|---------------|-----------|
| **Next.js** | 3000 | 3000 | Aplicação web + API |
| **Nginx** | 8080 | 80 | Proxy reverso (streams + Socket.io) |
| **Icecast** | 8000 | 8000 | Servidor de streaming |
| **Liquidsoap** | 8081 | 8081 | Controle Harbor HTTP |

**URLs de Acesso (Desenvolvimento)**:
- Aplicação: `http://localhost:3000`
- Streams via proxy: `http://localhost:8080/geral`, `/gaucha`, etc
- Icecast direto: `http://localhost:8000/geral` (opcional)
- Liquidsoap skip: `http://localhost:8081/skip`

**Variáveis .env**:
```env
NEXT_PUBLIC_RADIO_SOURCE=http://localhost:8080
NEXT_PUBLIC_RADIO_METADATA=http://localhost:8080/json
LIQUIDSOAP_CONTROL_URL=http://localhost:8081
```

---

### Produção (Nativo)

| Serviço | Porta | Interface | Propósito |
|---------|-------|-----------|-----------|
| **Next.js** | 3000 | localhost | Aplicação web + API |
| **Nginx** | 443 | público | Proxy HTTPS |
| **Icecast** | 8000 | localhost | Servidor de streaming |
| **Liquidsoap** | 8080 | localhost | Controle Harbor HTTP |

**URLs de Acesso (Produção)**:
- Aplicação: `https://somdomato.com`
- Streams: `https://radio.somdomato.com/geral`, `/gaucha`, etc
- Liquidsoap skip: `http://localhost:8080/skip` (interno)

**Variáveis .env.production**:
```env
NEXT_PUBLIC_RADIO_SOURCE=https://radio.somdomato.com
NEXT_PUBLIC_RADIO_METADATA=https://radio.somdomato.com/json
LIQUIDSOAP_CONTROL_URL=http://localhost:8080
```

---

## 🚨 Por Que Portas Diferentes?

### Desenvolvimento

**Problema**: Nginx e Liquidsoap não podem usar a mesma porta (8080)

**Solução**:
- Nginx usa porta **8080** (proxy público acessível)
- Liquidsoap usa porta **8081** (controle interno)

### Produção

**Não há conflito** porque:
- Nginx usa porta **443** (HTTPS público)
- Liquidsoap usa porta **8080** (controle interno, não exposto)
- Icecast usa porta **8000** (interno, proxiado pelo Nginx)

---

## 🔧 Configuração Nginx

### Desenvolvimento (docker/nginx.dev.conf)

```nginx
# Porta 8080 exposta externamente
server {
    listen 80;
    
    # WebSocket para Socket.io
    location /socket.io/ {
        proxy_pass http://host.docker.internal:3000;
    }
    
    # Streams do Icecast
    location ~ ^/(geral|gaucha|modao|arrocha|romantico) {
        proxy_pass http://icecast:8000;
    }
    
    # Next.js
    location / {
        proxy_pass http://host.docker.internal:3000;
    }
}
```

### Produção (ansible/etc/nginx/sites.d/)

**somdomato.com.conf** (aplicação):
```nginx
server {
    listen 443 ssl;
    server_name somdomato.com;
    
    location / {
        proxy_pass http://localhost:3000;
    }
}
```

**radio.somdomato.com.conf** (streaming):
```nginx
server {
    listen 443 ssl;
    server_name radio.somdomato.com;
    
    location / {
        proxy_pass http://localhost:8000;
    }
}
```

---

## 📊 Fluxo de Dados

### Skip de Música (Admin)

**Desenvolvimento**:
```
[Navegador] → POST https://localhost:3000/api/admin/skip
    ↓
[Next.js API] → POST http://localhost:8081/skip
    ↓
[Liquidsoap Container] → Skip na fila
```

**Produção**:
```
[Navegador] → POST https://somdomato.com/api/admin/skip
    ↓
[Next.js API] → POST http://localhost:8080/skip
    ↓
[Liquidsoap Nativo] → Skip na fila
```

### Busca de Metadados

**Desenvolvimento**:
```
[Player] → GET http://localhost:3000/api/metadata?genre=geral
    ↓
[Next.js API] → GET http://localhost:8080/json
    ↓
[Icecast via Nginx]
```

**Produção**:
```
[Player] → GET https://somdomato.com/api/metadata?genre=geral
    ↓
[Next.js API] → GET https://radio.somdomato.com/json
    ↓
[Icecast via Nginx]
```

---

## ✅ Checklist de Verificação

### Desenvolvimento

```bash
# 1. Verificar Nginx
curl -I http://localhost:8080/geral
# Esperado: 200 OK, Content-Type: audio/mpeg

# 2. Verificar Socket.io
curl -I http://localhost:8080/socket.io/
# Esperado: 200 OK ou 400 Bad Request (normal sem cliente WS)

# 3. Verificar Liquidsoap
curl -X POST http://localhost:8081/skip
# Esperado: 200 OK "OK"

# 4. Verificar Next.js
curl http://localhost:3000/api/metadata?genre=geral
# Esperado: {"song":{"title":"...","artist":"...","cover":"..."}}
```

### Produção

```bash
# 1. Verificar aplicação
curl -I https://somdomato.com
# Esperado: 200 OK, text/html

# 2. Verificar streams
curl -I https://radio.somdomato.com/geral
# Esperado: 200 OK, audio/mpeg

# 3. Verificar Liquidsoap (interno)
ssh usuario@servidor
curl -X POST http://localhost:8080/skip
# Esperado: 200 OK "OK"

# 4. Verificar metadados
curl https://radio.somdomato.com/json | jq
# Esperado: JSON com lista de streams
```

---

## 🐛 Debug de Problemas

### "Connection refused" ao chamar Liquidsoap

**Desenvolvimento**: Verificar se container está rodando e porta exposta
```bash
docker ps | grep liquidsoap
docker logs somdomato-liquidsoap
curl -v http://localhost:8081/skip
```

**Produção**: Verificar se serviço está ativo
```bash
sudo systemctl status liquidsoap-somdomato
sudo journalctl -u liquidsoap-somdomato -n 50
curl -v http://localhost:8080/skip
```

### Socket.io não conecta

Sempre acessar via **porta 3000** (Next.js), nunca via porta 8080 (Nginx) diretamente no navegador.

### Stream não toca

1. Verificar se Icecast está rodando: `docker ps` ou `systemctl status icecast2`
2. Testar stream direto: `curl -I http://localhost:8000/geral` (dev) ou `http://localhost:8000/geral` (prod)
3. Ver logs do Liquidsoap

---

## 📝 Resumo

| Ambiente | Nginx | Icecast | Liquidsoap | Next.js |
|----------|-------|---------|------------|---------|
| **Dev** | 8080 | 8000 | **8081** | 3000 |
| **Prod** | 443 | 8000 | **8080** | 3000 |

**Regra de Ouro**: Em produção, `.env.production` está correto com `LIQUIDSOAP_CONTROL_URL=http://localhost:8080`! O problema era apenas no desenvolvimento.
