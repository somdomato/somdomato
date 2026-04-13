# Docker - Ambiente de Desenvolvimento Som do Mato

Setup Docker completo que replica o ambiente de produção (Debian 13) localmente com Next.js, Nginx (SSL), Icecast2 e Liquidsoap.

## Pré-requisitos

1. Docker e Docker Compose instalados
2. Músicas na pasta definida pela variável `MUSIC_PATH`

## Setup Rápido

### Linux / macOS / Git Bash (Windows)

```bash
# 1. Configurar caminho das músicas
export MUSIC_PATH=/home/lucas/music/sdm

# 2. Gerar certificados SSL e iniciar tudo
./scripts/dev.sh
```

### Windows PowerShell

```powershell
# 1. Configurar caminho das músicas
$env:MUSIC_PATH = "C:\Users\Lucas\Music\sdm"

# 2. Gerar certificados SSL
cd docker
bash generate-certs.sh  # ou usar Git Bash

# 3. Iniciar containers
docker compose up -d --build
```

## Configuração do MUSIC_PATH

O caminho das músicas pode ser configurado via variável de ambiente ou `.env` na pasta `docker/`:

```bash
# Opção A: Via .env (crie na pasta docker/)
echo "MUSIC_PATH=/home/lucas/music/sdm" > docker/.env

# Opção B: Via variável de ambiente
export MUSIC_PATH=/home/lucas/music/sdm

# Windows PowerShell
$env:MUSIC_PATH = "C:\Users\Lucas\Music\sdm"
```

### Exemplos de caminhos:

- **Linux**: `MUSIC_PATH=/home/lucas/music/sdm`
- **macOS**: `MUSIC_PATH=/Users/lucas/Music/sdm`
- **Windows**: `MUSIC_PATH=C:\Users\Lucas\Music\sdm` ou `MUSIC_PATH=/c/Users/Lucas/Music/sdm` (Git Bash)

## Serviços

| Serviço    | Porta(s)       | Descrição                         |
|------------|----------------|-----------------------------------|
| Next.js    | 3000 (interno) | App Next.js em modo desenvolvimento |
| Nginx      | 443, 8080      | Proxy reverso com SSL             |
| Icecast2   | 8000           | Servidor de streaming             |
| Liquidsoap | 8081           | AutoDJ + fila dinâmica            |

## Acessar

- **Aplicação (HTTPS)**: https://localhost
- **Aplicação (HTTP)**: http://localhost:8080 (redireciona para HTTPS)
- **Streams**: https://localhost/geral, `/gaucha`, `/modao`, `/arrocha`, `/romantico`
- **Admin Icecast**: https://localhost/admin (user: `admin`, pass: `hackme`)
- **Icecast direto**: http://localhost:8000

> O navegador mostrará aviso de certificado auto-assinado. Aceite para prosseguir.

## Comandos

```bash
# Iniciar
cd docker && docker compose up -d --build

# Ver logs
docker compose logs -f

# Ver logs de um serviço específico
docker compose logs -f nextjs
docker compose logs -f liquidsoap
docker compose logs -f icecast
docker compose logs -f nginx

# Reiniciar um serviço
docker compose restart liquidsoap

# Parar
docker compose down

# Rebuildar do zero
docker compose down -v && docker compose build --no-cache && docker compose up -d
```

## Estrutura

```
docker/
├── docker-compose.yml       # Orquestração dos containers
├── Dockerfile.liquidsoap    # Imagem Liquidsoap (Debian Trixie)
├── Dockerfile.nextjs        # Imagem Next.js (Debian Trixie + Node 24)
├── nginx.dev.conf           # Nginx com SSL auto-assinado
├── generate-certs.sh        # Gera certificados SSL para dev
└── certs/                   # Certificados (gitignored)
    ├── selfsigned.crt
    └── selfsigned.key
```

## Diferenças Docker vs Produção

| Aspecto         | Docker (dev)                  | Produção (VPS)               |
|-----------------|-------------------------------|-------------------------------|
| SSL             | Certificado auto-assinado     | Let's Encrypt                |
| Node.js         | Modo desenvolvimento (`pnpm dev`) | Modo produção (`pnpm start`) |
| Nginx           | Container Docker              | Instalado no host             |
| Icecast hostname| `host.docker.internal`        | `somdomato.com`              |
| Liquidsoap API  | `http://nextjs:3000`          | `http://localhost:3000`      |
| Liquidsoap host | `icecast` (Docker DNS)        | `localhost`                  |

## Transmissão ao vivo (Harbor)

Para transmitir ao vivo, conecte-se em:
- **URL**: `http://localhost:8010/aovivo`
- **User**: `dj`
- **Password**: `hackme`

## Troubleshooting

### Liquidsoap não conecta ao Next.js

```bash
docker compose logs liquidsoap  # Verificar erros
docker compose logs nextjs      # Verificar healthcheck
```

### Músicas não encontradas

```bash
docker compose exec liquidsoap ls /var/music/sdm/
```

### Rebuildar Next.js (dependências mudaram)

```bash
docker compose down -v  # Remove volumes (node_modules cache)
docker compose up -d --build
```
