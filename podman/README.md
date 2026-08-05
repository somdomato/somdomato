# Podman - Ambiente de Desenvolvimento Som do Mato

Setup Podman completo que replica o ambiente de produção (Debian 13) localmente com Next.js, Nginx (SSL), Icecast2 e Liquidsoap.

## Pré-requisitos

1. Podman e podman-compose (ou `podman compose`, plugin nativo) instalados
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
cd podman
bash generate-certs.sh  # ou usar Git Bash

# 3. Iniciar containers
podman compose up -d --build
```

## Configuração do MUSIC_PATH

O caminho das músicas pode ser configurado via variável de ambiente ou `.env` na pasta `podman/`:

```bash
# Opção A: Via .env (crie na pasta podman/)
echo "MUSIC_PATH=/home/lucas/music/sdm" > podman/.env

# Opção B: Via variável de ambiente
export MUSIC_PATH=/home/lucas/music/sdm

# Windows PowerShell
$env:MUSIC_PATH = "C:\Users\Lucas\Music\sdm"
```

### Exemplos de caminhos:

- **Linux**: `MUSIC_PATH=/home/lucas/music/sdm`
- **macOS**: `MUSIC_PATH=/Users/lucas/Music/sdm`
- **Windows**: `MUSIC_PATH=C:\Users\Lucas\Music\sdm` ou `MUSIC_PATH=/c/Users/Lucas/Music/sdm` (Git Bash)

## Primeiro uso — inicializar o banco

Após subir os containers pela primeira vez (ou após resetar os volumes), aplique o schema do banco dentro do container Next.js:

```bash
podman compose -f podman/compose.yml exec nextjs pnpm run push
```

Sem isso, a API `/api/music` falha com `no such table: settings` e o Liquidsoap não consegue buscar músicas, deixando todos os streams mudos.

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
- **Streams**: https://localhost/radio/geral, `/radio/gaucha`, `/radio/modao`, `/radio/arrocha`, `/radio/romantico`
- **Admin Icecast**: https://localhost/admin (user: `admin`, pass: `hackme`)
- **Icecast direto**: http://localhost:8000

> O navegador mostrará aviso de certificado auto-assinado. Aceite para prosseguir.

## Comandos

```bash
# Iniciar
cd podman && podman compose up -d --build

# Ver logs
podman compose logs -f

# Ver logs de um serviço específico
podman compose logs -f nextjs
podman compose logs -f liquidsoap
podman compose logs -f icecast
podman compose logs -f nginx

# Reiniciar um serviço
podman compose restart liquidsoap

# Parar
podman compose down

# Rebuildar do zero
podman compose down -v && podman compose build --no-cache && podman compose up -d
```

## Estrutura

```
podman/
├── compose.yml               # Orquestração dos containers
├── Containerfile.liquidsoap  # Imagem Liquidsoap (Debian Trixie)
├── Containerfile.nextjs      # Imagem Next.js (Debian Trixie + Node 24)
├── nginx.dev.conf            # Nginx com SSL auto-assinado
├── generate-certs.sh         # Gera certificados SSL para dev
└── certs/                    # Certificados (gitignored)
    ├── selfsigned.crt
    └── selfsigned.key
```

## Diferenças Podman vs Produção

| Aspecto         | Podman (dev)                    | Produção (VPS)               |
|-----------------|----------------------------------|-------------------------------|
| SSL             | Certificado auto-assinado        | Let's Encrypt                |
| Node.js         | Modo desenvolvimento (`pnpm dev`) | Modo produção (`pnpm start`) |
| Nginx           | Container Podman                 | Instalado no host             |
| Icecast hostname| `host.containers.internal`       | `somdomato.com`              |
| Liquidsoap API  | `http://nextjs:3000`             | `http://localhost:3000`      |
| Liquidsoap host | `icecast` (Podman DNS)           | `localhost`                  |

## Transmissão ao vivo (Harbor)

Para transmitir ao vivo, conecte-se em:
- **URL**: `http://localhost:8010/aovivo`
- **User**: `dj`
- **Password**: `hackme`

## Troubleshooting

### Rádio muda mas não toca / Liquidsoap repete "Nenhuma música retornada pela API"

O banco não foi inicializado. Aplique o schema:

```bash
podman compose -f podman/compose.yml exec nextjs pnpm run push
```

Confirme que a API responde:

```bash
podman exec somdomato-liquidsoap curl -s "http://nextjs:3000/api/music?genre=geral"
# Deve retornar JSON com title, artist, path — não {"error":...}
```

### Liquidsoap não conecta ao Next.js

```bash
podman compose logs liquidsoap  # Verificar erros
podman compose logs nextjs      # Verificar healthcheck
```

### Músicas não encontradas

```bash
podman compose exec liquidsoap ls /var/music/sdm/
```

### Rebuildar Next.js (dependências mudaram)

```bash
podman compose down -v  # Remove volumes (node_modules cache)
podman compose up -d --build
```
