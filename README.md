# Rádio Som do Mato

![Rádio Som do Mato](./public/images/logotipo.svg)

[![Deploy](https://github.com/somdomato/somdomato/actions/workflows/deploy.yml/badge.svg)](https://github.com/somdomato/somdomato/actions/workflows/deploy.yml)

## Desenvolvimento

### Requisitos

- Node.js 18+
- pnpm
- Docker e Docker Compose (para testar o sistema de rádio localmente)

### Setup Local

```bash
# Instalar dependências
pnpm install

# Iniciar aplicação Next.js
pnpm dev
```

### Testando o Sistema de Rádio com Docker

Para testar o Icecast + Liquidsoap localmente:

```bash
# 1. Configurar caminho das músicas
echo "MUSIC_PATH=/home/lucas/music/sdm" > .env.local

# 2. Garantir que Next.js está rodando
pnpm dev

# 3. Iniciar Icecast e Liquidsoap
docker-compose up -d

# 4. Ver logs
docker-compose logs -f
```

**Acessar:**
- Stream de áudio: http://localhost:8000/geral.mp3
- Admin Icecast: http://localhost:8000/admin/ (usuário: `admin`, senha: `hackme`)
- Status Icecast: http://localhost:8000/status.xsl

**Para parar:**
```bash
docker-compose down
```

Ver documentação completa em [README-docker.md](./README-docker.md)

## Arquitetura

- **Next.js**: Frontend e API para gerenciamento de músicas
- **Liquidsoap**: Automação da rádio e streaming
- **Icecast**: Servidor de streaming de áudio
- **Socket.io**: Comunicação em tempo real
- **Drizzle ORM**: Gerenciamento do banco de dados SQLite

## Estrutura do Projeto

```
├── src/
│   ├── app/              # Páginas e rotas Next.js
│   ├── components/       # Componentes React
│   ├── context/          # Contextos React
│   ├── db/               # Schema e queries do banco
│   ├── lib/              # Utilitários
│   └── server.ts         # Servidor Socket.io
├── files/
│   └── etc/
│       ├── icecast/      # Configuração Icecast
│       ├── liquidsoap/   # Scripts Liquidsoap
│       ├── nginx/        # Configuração Nginx
│       └── systemd/      # Services do systemd
├── scripts/              # Scripts utilitários
├── docker-compose.yml    # Setup Docker local
└── Dockerfile.liquidsoap # Image Liquidsoap
```