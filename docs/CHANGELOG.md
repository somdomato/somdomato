# Changelog - Simplificação do Player e Infraestrutura

## 🎯 Problemas Resolvidos

### 1. Metadados não refletiam o gênero selecionado
- **Antes**: Socket.io enviava música de qualquer stream
- **Agora**: API `/api/metadata?genre=<genero>` busca metadados específicos do mountpoint

### 2. Player não carregava metadados na primeira visita
- **Antes**: Aguardava evento Socket.io após fim da música
- **Agora**: Busca imediata ao carregar + polling a cada 10s

### 3. Música não iniciava ao trocar de gênero
- **Antes**: Lógica confusa de play/pause
- **Agora**: `handleGenreChange()` inicia playback automaticamente

### 4. Socket.io 400 Bad Request em desenvolvimento
- **Antes**: Cliente conectava direto em localhost:3000 sem proxy
- **Agora**: Nginx container faz proxy do WebSocket

## 📁 Arquivos Criados

```
docker/nginx.dev.conf          # Proxy reverso Nginx para desenvolvimento
src/app/api/metadata/route.ts  # API de metadados filtrados por gênero
scripts/dev.sh                 # Script para iniciar ambiente completo
.env                           # Config de desenvolvimento
docs/DESENVOLVIMENTO.md        # Guia detalhado de desenvolvimento
QUICKSTART.md                  # Guia rápido de início
```

## 🔧 Arquivos Modificados

### Configurações Centralizadas

**src/config.ts** - Todas as configs em um lugar:
- `RADIO_CONFIG`: URLs, paths, intervalos
- `GENRES`: Array de gêneros/mountpoints
- `DEFAULT_SONG`: Fallback de metadados
- `buildStreamUrl()`: Helper para construir URLs

**.env** - Variáveis de desenvolvimento:
```env
NEXT_PUBLIC_RADIO_SOURCE=http://localhost:8080
NEXT_PUBLIC_RADIO_METADATA=http://localhost:8080/json
```

### Contextos Simplificados

**src/context/AudioContext.tsx**:
- Remove `previewActive` (não usado)
- `setSong()` substitui setTitle/setArtist/setCover individuais
- Tipagem explícita para estados (string em vez de literal)

**src/context/GenreContext.tsx**:
- Importa GENRES e tipos do config.ts
- Remove duplicação de constantes
- `buildStreamUrl()` via config

### Player Refatorado

**src/components/Player.tsx**:
- Remove dependência do Socket.io para metadados
- `fetchMetadata()`: Busca via API REST
- `handleGenreChange()`: Troca e inicia playback
- `handlePlayPause()`, `handleReload()`: Callbacks otimizados
- Polling a cada 10 segundos (configurável)

**src/components/RequestModal.tsx**:
- Atualizado para usar `buildStreamUrl()` do config.ts

### Docker

**docker/docker-compose.yml**:
```yaml
services:
  nginx:        # NOVO: Proxy reverso
  icecast:      # Stream de áudio
  liquidsoap:   # AutoDJ
```

**docker/nginx.dev.conf**:
- `/socket.io/*` → Next.js (WebSocket)
- `/geral`, `/gaucha`, etc. → Icecast (streams)
- `/*` → Next.js (aplicação)

## 🚀 Como Usar

### Setup Inicial

```bash
# 1. Copiar exemplo de configuração
cp .env.local.example .env.local

# 2. Ajustar MUSIC_PATH no .env.local
nano .env.local

# 3. Iniciar ambiente Docker
./scripts/dev.sh

# 4. Em outro terminal, iniciar Next.js
pnpm dev

# 5. Acessar
http://localhost:3000
```

### Estrutura de Portas

| Serviço | Porta | Acesso |
|---------|-------|--------|
| Next.js | 3000 | Aplicação principal |
| Nginx | 8080 | Proxy reverso (não acesse direto) |
| Icecast | 8000 | Streaming direto (opcional) |

### Testar Mudanças

```bash
# 1. Abrir player (http://localhost:3000)
# 2. Verificar metadados (deve mostrar "Geral" por padrão)
# 3. Trocar para "Gaúcha" (deve iniciar playback automaticamente)
# 4. Verificar metadados (deve mostrar música da Gaúcha)
# 5. Abrir DevTools → Network → filtrar "metadata"
#    Deve ver polling a cada 10 segundos
```

## 📊 Fluxo de Dados

### Metadados (Novo)

```
[Player.tsx]
    ↓ GET /api/metadata?genre=geral (a cada 10s)
[API /api/metadata]
    ↓ GET http://localhost:8080/json
[Icecast JSON]
    ↓ { icestats: { source: [...] } }
[API filtra por mountpoint]
    ↓ { song: { title, artist, cover } }
[Player atualiza UI]
```

### Troca de Gênero (Corrigido)

```
[Usuário clica "Gaúcha"]
    ↓
[handleGenreChange()]
    ↓
1. setGenre("gaucha")            ← Atualiza contexto
2. buildStreamUrl("gaucha")      ← http://localhost:8080/gaucha
3. await play(streamUrl)         ← Inicia playback IMEDIATAMENTE
4. fetch('/api/metadata?genre=gaucha')  ← Busca metadados
5. setSong({ title, artist, cover })    ← Atualiza UI
```

## 🐛 Debug

### Verificar Nginx

```bash
docker logs -f somdomato-nginx

# Deve mostrar:
# - GET /socket.io/?EIO=4&transport=polling → 200
# - GET /geral → 200
# - GET /json → 200
```

### Verificar Liquidsoap (PORTA CORRIGIDA)

```bash
# DESENVOLVIMENTO: Porta 8081
curl -X POST http://localhost:8081/skip

# PRODUÇÃO: Porta 8080
curl -X POST http://localhost:8080/skip
```

### Verificar Metadados

```bash
# Direto do Icecast
curl http://localhost:8080/json | jq '.icestats.source'

# Via API
curl http://localhost:3000/api/metadata?genre=geral | jq
```

### Verificar Streams

```bash
# Testar todos os mountpoints
for genre in geral gaucha modao arrocha romantico; do
  echo "Testing $genre:"
  curl -I http://localhost:8080/$genre
done
```

## 🔜 Próximos Passos

- [x] Corrigido conflito de portas em desenvolvimento
- [ ] Testar em produção com deploy
- [ ] Implementar cache de metadados (Redis?)
- [ ] Adicionar busca de cover do banco de dados na API
- [ ] Implementar reconexão automática do Socket.io
- [ ] Adicionar indicador visual de "carregando metadados"

## 📝 Notas Importantes

1. **Em desenvolvimento**: Sempre acesse via `http://localhost:3000` (Next.js), nunca `:8080` (Nginx) diretamente

2. **Socket.io ainda é usado**: Para eventos real-time de pedidos e histórico, mas NÃO mais para metadados do player

3. **Polling de 10s**: Configurável em `RADIO_CONFIG.metadataRefreshInterval` (src/config.ts)

4. **Nginx é obrigatório**: Mesmo em dev, para Socket.io funcionar corretamente

5. **Portas diferentes**: 
   - Dev: Liquidsoap = 8081, Nginx = 8080
   - Prod: Liquidsoap = 8080, Nginx = 443 (sem conflito!)

6. **lib/radio.ts**: Pode ser removido futuramente, mas mantido por compatibilidade

## 📖 Documentação

- [DESENVOLVIMENTO.md](docs/DESENVOLVIMENTO.md) - Setup detalhado
- [QUICKSTART.md](QUICKSTART.md) - Início rápido
- [DEPLOY-RADIO.md](docs/DEPLOY-RADIO.md) - Deploy de produção

---

✅ **Todas as mudanças foram testadas e estão prontas para uso!**
