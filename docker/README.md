# Testando Radio Som do Mato com Docker

Este setup Docker permite testar o sistema de rádio localmente.

## Pré-requisitos

1. Docker e Docker Compose instalados
2. Next.js rodando em `localhost:3000`
3. Músicas na pasta definida em `.env.local`

## Configuração

### 1. Criar arquivo .env.local

```bash
# Ajuste o caminho para onde suas músicas estão
echo "MUSIC_PATH=/home/lucas/music/sdm" > .env.local
```

### 2. Ajustar permissões (se necessário)

```bash
chmod 644 .env.local
chmod +x files/etc/liquidsoap/somdomato-docker.liq
```

## Usar

### Iniciar os serviços

```bash
# Iniciar Next.js primeiro
pnpm dev

# Em outro terminal, iniciar Icecast + Liquidsoap
docker-compose up -d

# Ver logs
docker-compose logs -f
```

### Acessar

- **Stream de áudio**: http://localhost:8000/geral.mp3
- **Admin Icecast**: http://localhost:8000/admin/
  - User: `admin`
  - Password: `hackme`
- **Status Icecast**: http://localhost:8000/status.xsl

### Comandos úteis

```bash
# Parar serviços
docker-compose down

# Rebuildar após mudanças
docker-compose up -d --build

# Ver logs do Liquidsoap
docker-compose logs -f liquidsoap

# Ver logs do Icecast
docker-compose logs -f icecast

# Reiniciar apenas o Liquidsoap
docker-compose restart liquidsoap
```

## Estrutura

```
├── docker-compose.yml          # Orquestração dos containers
├── Dockerfile.liquidsoap        # Image do Liquidsoap
├── .env.local                   # Variáveis locais
├── files/
│   ├── etc/
│   │   ├── icecast/
│   │   │   └── icecast.xml     # Config do Icecast
│   │   └── liquidsoap/
│   │       └── somdomato-docker.liq  # Script do Liquidsoap (usa host.docker.internal)
```

## Diferenças do script de produção

O `somdomato-docker.liq` tem duas diferenças principais:

1. **API do Next.js**: `http://host.docker.internal:3000/api/music` (acessa o host)
2. **Host Icecast**: `host = "icecast"` (usa o nome do serviço Docker)

## Troubleshooting

### Liquidsoap não consegue conectar ao Next.js

Verifique se o Next.js está rodando:
```bash
curl http://localhost:3000/api/music
```

### Músicas não encontradas

Verifique o caminho no `.env.local`:
```bash
ls -la /home/lucas/music/sdm
```

### Icecast não conecta

```bash
# Ver logs
docker-compose logs icecast

# Testar porta
curl http://localhost:8000
```

### Rebuildar tudo do zero

```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## Transmissão ao vivo (Harbor)

Para transmitir ao vivo, conecte-se em:
- **URL**: `http://localhost:8010/aovivo`
- **User**: `dj`
- **Password**: `hackme`
