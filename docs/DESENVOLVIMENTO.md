# Ambiente de Desenvolvimento - Som do Mato

Este guia detalha o setup de desenvolvimento local com Nginx, Icecast, Liquidsoap e Next.js.

## Arquitetura

```
[Navegador :3000]
      ↓
[Next.js :3000] ← Socket.io WebSocket
      ↓
[Nginx :8080] ← Proxy Reverso
      ↓
[Icecast :8000] → 5 Mountpoints (geral, gaucha, modao, arrocha, romantico)
      ↑
[Liquidsoap] → AutoDJ + Pedidos
```

## Pré-requisitos

- Podman e podman-compose (ou plugin `podman compose`)
- Node.js 18+ e pnpm
- Arquivos de música em `/home/lucas/music/sdm`

## Início Rápido

```bash
# Iniciar ambiente completo
./scripts/dev.sh

# Em outro terminal, iniciar Next.js
pnpm dev
```

Acesse: http://localhost:3000

## Configuração Detalhada

### 1. Containers Podman

O arquivo `podman/compose.yml` configura 3 serviços:

- **Nginx** (porta 8080): Proxy reverso que roteia:
  - `/socket.io/*` → Next.js (WebSocket)
  - `/geral`, `/gaucha`, etc. → Icecast
  - `/*` → Next.js (páginas)

- **Icecast** (porta 8000): Servidor de streaming
  - Admin: http://localhost:8080/admin
  - Credentials: admin / hackme

- **Liquidsoap**: AutoDJ que busca músicas da API Next.js

```bash
cd podman
podman compose up -d
podman compose logs -f  # Ver logs
podman compose down     # Parar
```

### 2. Variáveis de Ambiente

Arquivo `.env` (desenvolvimento):

```env
NEXT_PUBLIC_RADIO_SOURCE=http://localhost:8080
NEXT_PUBLIC_RADIO_METADATA=http://localhost:8080/json
LIQUIDSOAP_CONTROL_URL=http://localhost:8081  # ⚠️ Porta 8081 (dev)
```

**Importante**: Todas as URLs de streaming apontam para porta **8080** (Nginx), mas o controle do Liquidsoap usa porta **8081** para evitar conflito.

Em produção, ver [PORTAS.md](PORTAS.md) para diferenças.

### 3. Servidor Next.js

```bash
pnpm dev
# Servidor em http://localhost:3000
```

O servidor Next.js:
- Serve páginas web
- Expõe APIs REST (`/api/*`)
- Mantém conexão Socket.io para eventos real-time
- Comunica com Liquidsoap via HTTP

## Fluxo de Metadados

1. **Liquidsoap** solicita próxima música: `GET http://host.containers.internal:3000/api/music?genre=geral`
2. **Next.js API** retorna música do banco de dados
3. **Liquidsoap** toca a música no Icecast
4. **Player no navegador** busca metadados: `GET /api/metadata?genre=geral`
5. **API de metadados** consulta `http://localhost:8080/json` (Icecast)
6. **Player** atualiza UI com título/artista/capa

**Polling**: Metadados são atualizados a cada 10 segundos.

## Problemas Comuns

### Socket.io Bad Request (400)

**Causa**: Cliente tentando conectar diretamente em `:3000` sem Nginx.

**Solução**: Sempre acessar via http://localhost:3000 (app), não :8080 diretamente.

### Música não carrega ao trocar gênero

**Causa**: URL da stream errada ou Nginx não roteando corretamente.

**Debug**:
```bash
# Ver logs do Nginx
podman logs somdomato-nginx -f

# Testar stream diretamente
curl -I http://localhost:8080/geral
# Deve retornar 200 OK
```

### Metadados mostram gênero errado

**Causa**: API `/api/metadata` não filtrando corretamente por mountpoint.

**Debug**: Verificar resposta do Icecast:
```bash
curl http://localhost:8080/json | jq
```

## Estrutura de Arquivos

```
├── podman/
│   ├── compose.yml              # Orquestração dos containers
│   ├── nginx.dev.conf           # Config Nginx para desenvolvimento
│   └── Containerfile.liquidsoap # Build do Liquidsoap
├── src/
│   ├── config.ts               # ⭐ Configurações centralizadas
│   ├── app/api/
│   │   ├── music/route.ts      # API para Liquidsoap
│   │   └── metadata/route.ts   # ⭐ API de metadados por gênero
│   ├── components/
│   │   └── Player.tsx          # ⭐ Player simplificado
│   └── context/
│       ├── AudioContext.tsx    # ⭐ Estado do player
│       └── GenreContext.tsx    # ⭐ Estado do gênero
├── .env                        # ⭐ Config desenvolvimento
└── .env.production             # Config produção
```

Arquivos marcados com ⭐ foram simplificados.

## Comandos Úteis

```bash
# Reiniciar Liquidsoap
podman restart somdomato-liquidsoap

# Ver status Icecast
curl http://localhost:8080/status.xsl

# Limpar cache Podman
podman compose down -v
podman system prune -af

# Build Liquidsoap
cd podman && podman compose build liquidsoap

# Testar Socket.io
# No navegador console:
io().on("connect", () => console.log("Conectado!"))
```

## Deploy para Produção

Ver [docs/DEPLOY-RADIO.md](../docs/DEPLOY-RADIO.md) para instruções completas.

**Diferenças principais**:
- URLs HTTPS com certificado SSL
- Nginx rodando nativo (não Podman)
- Socket.io atrás de proxy com SSL
- Logging centralizado

## Contribuindo

Antes de fazer PR:
1. Testar localmente com `./scripts/dev.sh`
2. Verificar logs dos 3 containers
3. Testar troca de gêneros no player
4. Fazer pedido de música no mountpoint "Geral"

## Suporte

- Issues: GitHub Issues
- Contato: [seu email]
