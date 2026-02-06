# Correção do Nginx no Docker

## 🐛 Problema

```
nginx: [emerg] "add_header" directive is not allowed here in /etc/nginx/conf.d/default.conf:24
```

### Causa

As diretivas `add_header` estavam no nível do **server block** junto com uma diretiva `if`. No Nginx, quando há um `if` no nível de server, os `add_header` precisam estar dentro dos **location blocks**.

## ✅ Solução Aplicada

### 1. Nginx Configuration (nginx.dev.conf)

**Antes** (ERRO):
```nginx
server {
    # add_header no nível de server (ERRO!)
    add_header 'Access-Control-Allow-Origin' '*' always;
    
    # if no nível de server (conflito!)
    if ($request_method = 'OPTIONS') {
        add_header ...
        return 204;
    }
    
    location /socket.io/ {
        proxy_pass ...
    }
}
```

**Depois** (CORRETO):
```nginx
server {
    # Sem add_header no nível de server
    
    location /socket.io/ {
        # add_header dentro do location
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, HEAD, POST, OPTIONS' always;
        
        # if dentro do location (OK!)
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            return 204;
        }
        
        proxy_pass ...
    }
    
    location ~ ^/(geral|gaucha|...)$ {
        # add_header dentro de cada location
        add_header 'Access-Control-Allow-Origin' '*' always;
        ...
    }
    
    location / {
        # add_header dentro de cada location
        add_header 'Access-Control-Allow-Origin' '*' always;
        ...
    }
}
```

### 2. Docker Compose - Volumes Nomeados

**Antes** (confuso):
```yaml
volumes:
  - ./nginx.dev.conf:/etc/nginx/conf.d/default.conf:ro
  - ../files/etc/icecast/somdomato.xml:/etc/icecast2/icecast.xml:ro
  - ../files/etc/liquidsoap/somdomato-docker.liq:/etc/liquidsoap/somdomato.liq:ro
  - /home/lucas/music/sdm:/var/music/sdm:ro
```

**Depois** (claro):
```yaml
volumes:
  # Nginx - Configuração
  - type: bind
    source: ./nginx.dev.conf
    target: /etc/nginx/conf.d/default.conf
    read_only: true
    
  # Icecast - Configuração XML
  - type: bind
    source: ../files/etc/icecast/somdomato.xml
    target: /etc/icecast2/icecast.xml
    read_only: true
    
  # Liquidsoap - Script
  - type: bind
    source: ../files/etc/liquidsoap/somdomato-docker.liq
    target: /etc/liquidsoap/somdomato.liq
    read_only: true
    
  # Liquidsoap - Biblioteca de músicas
  - type: bind
    source: /home/lucas/music/sdm
    target: /var/music/sdm
    read_only: true
```

### 3. Network Nomeada

**Antes**:
```yaml
networks:
  radio-network:
    driver: bridge
```

**Depois**:
```yaml
networks:
  radio-network:
    name: somdomato-radio-network  # Nome explícito
    driver: bridge
```

## 🧪 Testes

```bash
# 1. Parar containers antigos
cd docker && docker-compose down

# 2. Iniciar com nova configuração
docker-compose up -d

# 3. Verificar logs (sem erros!)
docker logs somdomato-nginx

# 4. Verificar status
docker ps

# 5. Testar stream
curl -I http://localhost:8080/geral

# 6. Testar JSON do Icecast
curl http://localhost:8080/json
```

## ✅ Resultado

```
✔ Container somdomato-nginx      Running (sem erros!)
✔ Container somdomato-icecast    Running
✔ Container somdomato-liquidsoap Running
✔ Network somdomato-radio-network Created
```

Logs do Nginx:
```
[notice] nginx/1.29.5
[notice] start worker processes
GET /json HTTP/1.1" 200 3457  ✅
GET /geral HTTP/1.1" 200       ✅
```

## 📋 Benefícios

1. **Nginx inicia corretamente** - Sem erros de configuração
2. **CORS funciona** - Headers aplicados em cada location
3. **Volumes claros** - Fácil identificar origem/destino de cada mount
4. **Network nomeada** - Não gera nomes aleatórios
5. **Read-only** - Segurança extra para configs

## 🔗 Referências

- [Nginx add_header documentation](http://nginx.org/en/docs/http/ngx_http_headers_module.html#add_header)
- [Docker Compose volumes](https://docs.docker.com/compose/compose-file/compose-file-v3/#volumes)

---

**Status**: ✅ Corrigido e testado
