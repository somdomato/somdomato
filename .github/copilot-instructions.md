# Instruções para GitHub Copilot - Rádio Som do Mato

Este projeto é uma rádio web com sistema de pedidos de músicas e AutoDJ.

## Contexto Geral do Sistema

### Stack Tecnológica
- **Frontend/Backend**: Next.js 16 (App Router)
- **Banco de Dados**: SQLite com Drizzle ORM
- **Real-time**: Socket.io para atualizações em tempo real
- **Streaming**: Liquidsoap + Icecast
- **Estilo**: Tailwind CSS

### Fluxo Principal

#### 0. Sistema de Gêneros (Mountpoints)

O sistema suporta 6 mountpoints diferentes:

1. **Geral** - Mountpoint principal que aceita pedidos
   - Toca músicas com `genre='geral'` OU `allowedInGeneral=1`
   - Único mountpoint que aceita pedidos
   - URL: `/geral`

2. **Gaúcha** - Sertanejo gaúcho
   - Toca apenas `genre='gaucha'`
   - AutoDJ puro (sem pedidos)
   - URL: `/gaucha`

3. **Modão** - Modão tradicional
   - Toca apenas `genre='modao'`
   - AutoDJ puro (sem pedidos)
   - URL: `/modao`

4. **Arrocha** - Arrocha e romantic
   - Toca apenas `genre='arrocha'`
   - AutoDJ puro (sem pedidos)
   - URL: `/arrocha`

5. **Romântico** - Músicas românticas
   - Toca apenas `genre='romantico'`
   - AutoDJ puro (sem pedidos)
   - URL: `/romantico`

**Troca de Gênero:**
- Player possui dropdown (clique na capa) para trocar gêneros
- Gênero é salvo no GenreContext e localStorage
- Ao pedir música em gênero != "geral", modal avisa e oferece trocar

#### 1. Sistema de Pedidos
- Usuário acessa modal "Pedidos" (`/pedidos`)
- Se não está no gênero "Geral", modal de aviso aparece
- Se aceitar, troca para "Geral" automaticamente
- Pesquisa música e clica em "Pedir"
- Música inserida em tabela `requests` com timestamp `createdAt`
- Evento Socket.io `request:added` notifica clientes

#### 2. Seleção de Música (AutoDJ)
- Liquidsoap consulta `/api/music?genre=<genero>` quando precisa de uma nova faixa
- API verifica pedidos pendentes (apenas se `genre=geral`)
- **Com pedido**: seleciona mais antigo, remove de `requests` (sem emitir eventos)
- **Sem pedido**: seleciona aleatória respeitando horários/rotação/gênero
  - Para "geral": inclui `genre='geral'` OU `allowedInGeneral=1`
  - Para outros: apenas músicas do gênero específico
- **NÃO** insere em `history` nem emite `song:changed` aqui (a música ainda não tocou)
- Registra a música como "pendente" e limpa o cache de prospecção do gênero

#### 3. Confirmação de Reprodução (`/api/music/started`)
- Chamada pelo `on_track` do Liquidsoap quando a música realmente começa a tocar
- Insere em `history` com timestamp real de reprodução
- Emite evento `song:changed` via Socket.io (UI atualiza aqui)
- Se o `on_track` falhar, o próximo `/api/music` insere o histórico pendente (safety net)

#### 4. Sistema de Prospecção (`src/lib/prospection.ts`)
- Cache em memória (`Map<genre, ProspectedSong>`) com 1 música pré-selecionada por gênero
- **Estável**: entre dois `song:changed`, `/api/songs/next` sempre retorna a mesma música
- **Lazy**: computada na primeira chamada de `/api/songs/next` após limpar
- **Ciclo**: `/api/music` limpa → `/api/music/started` emite `song:changed` → UI chama `/api/songs/next` → recomputa
- **Pending**: rastreia música servida ao Liquidsoap; se `on_track` não disparar, próximo `/api/music` insere histórico

#### 5. Blocos da Interface

**"Últimas" (Last.tsx)**
- Fonte: tabela `history` (últimas 10 por gênero)
- Exibe: Capa, Música, Artista, **Tempo relativo** (ex: "há 5min")
- Atualiza via Socket.io evento `song:changed`
- **Filtro por gênero**: Mostra apenas músicas do gênero selecionado
- API: `GET /api/songs/last?genre=<genero>`

**"Top 10" (Top.tsx)**
- Fonte: agregação de `history` por `songId`
- Ordenação: count DESC, depois createdAt DESC
- Exibe: Capa, Música, Artista, **Número de pedidos** (ex: "15x")
- Atualiza via Socket.io evento `song:changed`

**"Próximas" (Next.tsx)**
- Para **Geral**: mostra pedidos + próxima do AutoDJ (prospecção)
- Para **outros gêneros**: mostra apenas próxima do AutoDJ (prospecção)
- Fonte: tabela `requests` para pedidos, cache de prospecção para AutoDJ
- **Pedidos só desaparecem quando a música começa a tocar** (evento `song:changed`)
- **Preview AutoDJ é estável** (cache de prospecção, não muda até próxima reprodução)
- Exibe: Capa, Música, Artista, **Tempo na fila** (ex: "há 2min") ou badge "AutoDJ"
- Atualiza via Socket.io eventos `request:added`, `request:removed` (admin), `song:changed`
- **Filtro por gênero**: Respeita gênero selecionado no player
- API: `GET /api/songs/next?genre=<genero>`

## Estrutura de Dados

### Tabelas Principais (schema.ts)

```typescript
songs {
  id: int (PK)
  title: text
  artist: text
  path: text (caminho do arquivo MP3)
  cover: text (URL da capa)
  timeSlots: int (bits: 1=madrugada, 2=manhã, 4=tarde, 8=noite, 15=todos)
  rotation: text ("inativo"|"leve"|"normal"|"pesado")
  genre: text ("geral"|"gaucha"|"modao"|"arrocha"|"romantico")
  allowedInGeneral: int (0=não, 1=sim - permite tocar no Geral)
  createdAt: timestamp
}

requests {
  id: int (PK)
  songId: int (FK -> songs.id)
  order: int (ordem manual)
  createdAt: timestamp (quando foi pedida)
}

history {
  id: int (PK)
  songId: int (FK -> songs.id)
  createdAt: timestamp (quando foi tocada)
}
```

### Eventos Socket.io

- `song:changed` - Música mudou (payload: { id, title, artist, cover })
- `request:added` - Pedido criado (payload: { reqId, id, title, artist, cover, requestedAt })
- `request:removed` - Pedido removido (payload: { requestId })
- `requests:updated` - Forçar refresh completo da fila

## Sincronização de Gêneros

### Mapeamento ID3 ↔ Banco de Dados

**IMPORTANTE**: O sistema mantém sincronização entre tags ID3 dos arquivos MP3 e o banco de dados.

| ID3 Tag | Banco de Dados |
|---------|----------------|
| **Sertanejo** | **geral** |
| Sertanejo Gaúcho | gaucha |
| Modão | modao |
| Arrocha | arrocha |
| Romântico | romantico |

**Regra Crítica**: Gênero "Sertanejo" nas tags ID3 é **sempre** traduzido para "geral" no banco de dados.

### Script de Sincronização (sync-music.ts)

Ao executar `pnpm tsx scripts/sync-music.ts`:

1. Escaneia `/var/music/sdm` procurando arquivos de música
2. Lê tags ID3 de arquivos MP3
3. Para músicas **sem gênero ID3** ou com **gênero inválido**:
   - Preenche "Sertanejo" nas tags ID3 do arquivo
   - Salva como "geral" no banco de dados
4. Converte gêneros válidos usando o mapeamento acima
5. Atualiza automaticamente tags ID3 quando necessário

### Sincronização no Admin (actions/admin.ts)

Ao editar uma música via `updateSong()`:

- **Banco → ID3**: Gênero do banco é convertido para tag ID3
  - "geral" → "Sertanejo"
  - "gaucha" → "Sertanejo Gaúcho"
  - etc.
- Tags ID3 são atualizadas automaticamente no arquivo MP3
- Mudanças refletem imediatamente no banco e no arquivo físico

**Exemplo de Fluxo**:
```typescript
// Usuário seleciona "Geral" no admin
// → Salvo no banco: genre = "geral"
// → Salvo no ID3: genre = "Sertanejo"

// Script sync-music.ts encontra MP3 com ID3 = "Sertanejo"
// → Salvo no banco: genre = "geral"
```

## Convenções de Código

### Componentes React
- Use Client Components (`"use client"`) para interatividade e Socket.io
- Use Server Components para fetch inicial de dados
- Componentes de blocos em `src/components/blocks/`
- Actions do servidor em `src/actions/`
- **Nunca** use índice de array como `key` em elementos React (ex: `key={i}`). Use IDs únicos ou arrays estáticos de strings.

### Formatação de Tempo
- Use `formatRelativeTime()` de `@/lib/format` para tempos relativos
- Formato: "agora", "há 5min", "há 2h", "ontem", "há 3d", "há 2sem"
- Atualizar UI a cada 60s com setInterval

### API Routes
- Sempre verificar autenticação em rotas admin
- Emitir eventos Socket.io após mutações: `global.io?.emit()`
- Retornar JSON consistente: `Response.json(data)`
- Tratar erros com try-catch e logs descritivos

### Banco de Dados
- Usar Drizzle ORM para queries
- Preferir `.select()` com joins sobre múltiplas queries
- Ordenar requests por `createdAt ASC` (mais antigo primeiro)
- Ordenar history por `createdAt DESC` (mais novo primeiro)
- Filtrar por gênero: usar condições específicas para cada mountpoint
  - Geral: `genre='geral' OR allowedInGeneral=1`
  - Outros: apenas `genre='<genero>'`

### Socket.io
- Global object: `global.io` (configurado em server.ts)
- Sempre verificar se existe antes de emitir: `if (global.io)`
- Listeners nos componentes: montar/desmontar corretamente

## Casos de Uso Comuns

### Adicionar novo bloco na home
1. Criar componente em `src/components/blocks/NomeBloco.tsx`
2. Criar action em `src/actions/songs.ts` para fetch inicial
3. Adicionar ao grid em `src/app/page.tsx`
4. Conectar Socket.io se precisar atualizações real-time

### Modificar lógica de seleção de música
1. Editar `src/app/api/music/route.ts`
2. Respeitar timeSlots (`getCurrentTimeSlot()`)
3. Respeitar proteções (`getBlockedSongIds()`)
4. Inserir em `history` após seleção
5. Emitir `song:changed` via Socket.io

### Adicionar campo ao schema
1. Editar `src/db/schema.ts`
2. Gerar migration: `pnpm db:generate`
3. Aplicar migration: `pnpm db:migrate`
4. Atualizar tipos em queries/actions

## Padrões de Qualidade

- **Performance**: Paralelizar fetches independentes, usar React Suspense
- **Acessibilidade**: Alt text em imagens, labels em formulários
- **UX**: Loading states, mensagens de erro claras
- **SEO**: Metadata adequada, semantic HTML
- **Segurança**: Validar inputs, sanitizar dados, rate limiting

## Comandos Úteis

```bash
# Desenvolvimento (Docker completo)
./scripts/dev.sh            # Gera certs SSL + sobe 4 containers
cd docker && docker compose up -d --build  # Alternativa manual
cd docker && docker compose down           # Parar containers

# Desenvolvimento (Next.js local + Docker streaming)
pnpm dev                    # Iniciar Next.js local
cd docker && docker compose up -d icecast liquidsoap  # Apenas streaming

# Build e DB
pnpm build                  # Build para produção
pnpm push                   # Push schema para DB
pnpm test                   # Testes (Vitest)

# Provisioning VPS (Ansible)
cd ansible && ansible-playbook -i inventory.ini playbook.yml
```

## Recursos Importantes

- Documentação completa: `README.md`
- Schema do banco: `src/db/schema.ts`
- Servidor Socket.io: `src/server.ts`
- Proxy (auth admin): `src/proxy.ts`
- Sistema de prospecção: `src/lib/prospection.ts`
- Configuração Liquidsoap: `ansible/etc/liquidsoap/`
- Configuração Nginx (produção): `ansible/etc/nginx/`
- Configuração Icecast: `ansible/etc/icecast/`
- Services systemd: `ansible/etc/systemd/`
- Playbook Ansible: `ansible/playbook.yml`
- Docker (dev): `docker/docker-compose.yml`
- Tipos TypeScript: `src/types.ts`

## Estrutura de Diretórios

```
├── src/                  # Código fonte Next.js
│   ├── proxy.ts          # Proxy de autenticação admin (ex-middleware.ts)
│   └── server.ts         # Servidor customizado (Socket.io)
├── docker/               # Docker para desenvolvimento local
│   ├── docker-compose.yml
│   ├── Dockerfile.nextjs
│   ├── Dockerfile.liquidsoap
│   ├── nginx.dev.conf
│   └── generate-certs.sh
├── ansible/              # Configurações de produção + provisioning
│   ├── playbook.yml      # Ansible playbook para VPS
│   ├── inventory.ini
│   └── etc/              # Configs que vão para /etc/ na VPS
│       ├── icecast/
│       ├── liquidsoap/
│       ├── nginx/
│       └── systemd/
├── scripts/              # Scripts utilitários
├── test/                 # Testes
└── docs/                 # Documentação adicional
```

## Ambiente de Desenvolvimento

- Docker replica o ambiente de produção (Debian 13, Node 24, pnpm)
- 4 containers: Next.js, Nginx (SSL auto-assinado), Icecast2, Liquidsoap
- Nginx no Docker faz proxy reverso idêntico à produção
- Liquidsoap conecta ao Next.js via rede Docker interna (`http://nextjs:3000`)
- SSL via certificado auto-assinado gerado por `docker/generate-certs.sh`
- Acesso: `https://localhost` (aceitar aviso de certificado)

## Ansible (Provisioning VPS)

- Playbook em `ansible/playbook.yml` provisiona VPS Debian 13 completa
- Mesmos arquivos de `ansible/etc/` são usados no Docker e na VPS
- Docker usa variantes `-docker.liq` e `-docker.xml` quando necessário
- Em produção: Liquidsoap usa `localhost:3000`, no Docker usa `nextjs:3000`

## Sistema de Capas (Covers)

### Armazenamento

Capas são armazenadas em `public/covers/{slug}.jpg`, onde `slug` é derivado do nome do artista via `sanitizeArtistForFile()` (em `src/lib/cover.ts`). Uma capa por artista — todas as músicas do mesmo artista compartilham o mesmo arquivo.

Exemplo: "Henrique & Juliano" → `public/covers/henrique-e-juliano.jpg`

### Pipeline de Resolução

`resolveSongCover()` é o ponto de entrada único para resolução de capas. Ordem de prioridade:

1. **Disco** — Verifica se `public/covers/{slug}.jpg` já existe e é >= 1 KB
2. **ID3** — Extrai imagem embutida nas tags ID3 do MP3 (valida magic bytes JPEG/PNG)
3. **Deezer API** — Busca `cover_xl` (1000x1000) via `api.deezer.com/search`
4. **Fallback URL** — URL direta (ex: thumbnail do Deezer salvo na tabela `uploads`)

### Validação (Regra Crítica)

**Toda escrita de `cover` no banco DEVE passar por `validateCoverForDb()`**. Esta função:
- Retorna `null` se o URL é falsy ou é o logo padrão (`/images/logotipo.svg`)
- Verifica se o arquivo existe no disco e é >= 1 KB
- Impede salvar capas quebradas/inexistentes no banco

### Quando a Resolução Acontece

| Momento | Função | Inclui Deezer? |
|---------|--------|----------------|
| Aprovação de upload | `approveUpload()` → `resolveSongCover()` | Sim (+ fallback URL) |
| Seleção AutoDJ (`/api/music`) | Inline (disco + ID3 apenas) | Não (evita latência) |
| Callback on_track (`/api/music/started`) | `triggerCoverResolution()` → `resolveSongCover()` | Sim (async) |
| Admin play (`/api/admin/play`) | `resolveSongCover()` | Sim |
| Scan/sync (`upsertSongFromFile`) | `resolveSongCover()` | Sim |
| Edição no admin (`updateSong`) | `resolveSongCover()` | Sim |

### Eventos Socket.io

- `song:changed` — Inclui `cover` no payload. Player atualiza capa instantaneamente.
- `song:cover` — Emitido após resolução assíncrona. Player atualiza se `songId` corresponde.

### Rename de Artista

Quando o nome do artista muda no admin:
1. A capa é copiada (se outros usam o artista antigo) ou renomeada para o novo slug
2. O campo `cover` é atualizado para o novo URL path
3. Se a migração falha, `resolveSongCover()` roda como fallback

### UI e Fallback Visual

- Todas as `<Image>` de capas usam `className="object-cover"` para manter aspecto 1:1
- Fallback visual: `"/images/logotipo.svg"` — usado apenas na UI, não salvo como capa real
- O endpoint `/api/metadata` retorna a capa real do banco (busca por `title + artist`)

### Arquivos-Chave

- `src/lib/cover.ts` — Funções de capa: resolução, validação, extração, remoção
- `src/lib/upload.ts` — `approveUpload()` — usa `resolveSongCover()` com `fallbackUrl`
- `src/actions/admin.ts` — `updateSong()` — processamento de capa no admin
- `src/app/api/music/started/route.ts` — Resolução assíncrona no play

---

**Ao trabalhar neste projeto:**
- Sempre considere o fluxo completo: pedido → requests → /api/music → history → UI
- Mantenha sincronia entre banco de dados e eventos Socket.io
- Teste localmente com Docker antes de deploy
- Documente mudanças significativas no README.md
- Configs de produção ficam em `ansible/etc/`, NÃO em `files/`
- Docker para dev fica em `docker/`, Ansible para produção fica em `ansible/`
