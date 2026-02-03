# Instruções para GitHub Copilot - Rádio Som do Mato

Este projeto é uma rádio web com sistema de pedidos de músicas e AutoDJ.

## Contexto Geral do Sistema

### Stack Tecnológica
- **Frontend/Backend**: Next.js 15 (App Router)
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

6. **Forró** - Forró e derivados
   - Toca apenas `genre='forro'`
   - AutoDJ puro (sem pedidos)
   - URL: `/forro`

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
- Liquidsoap consulta `/api/music?genre=<genero>` periodicamente
- API verifica pedidos pendentes (apenas se `genre=geral`)
- **Com pedido**: seleciona mais antigo, remove de `requests`
- **Sem pedido**: seleciona aleatória respeitando horários/rotação/gênero
  - Para "geral": inclui `genre='geral'` OU `allowedInGeneral=1`
  - Para outros: apenas músicas do gênero específico
- Insere em `history` com timestamp
- Emite evento `song:changed` via Socket.io

#### 3. Blocos da Interface

**"Últimas" (Last.tsx)**
- Fonte: tabela `history` (últimas 10)
- Exibe: Capa, Música, Artista, **Tempo relativo** (ex: "há 5min")
- Atualiza via Socket.io evento `song:changed`

**"Top 10" (Top.tsx)**
- Fonte: agregação de `history` por `songId`
- Ordenação: count DESC, depois createdAt DESC
- Exibe: Capa, Música, Artista, **Número de pedidos** (ex: "15x")
- Atualiza via Socket.io evento `song:changed`

**"Próximas" (Next.tsx)**
- Fonte: tabela `requests` (ordenada por createdAt ASC)
- Mostra até 10 pedidos ou próxima do AutoDJ se vazia
- Exibe: Capa, Música, Artista, **Tempo na fila** (ex: "há 2min")
- Atualiza via Socket.io eventos `request:added`, `request:removed`, `song:changed`

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
  genre: text ("geral"|"gaucha"|"modao"|"arrocha"|"romantico"|"forro")
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

## Convenções de Código

### Componentes React
- Use Client Components (`"use client"`) para interatividade e Socket.io
- Use Server Components para fetch inicial de dados
- Componentes de blocos em `src/components/blocks/`
- Actions do servidor em `src/actions/`

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
pnpm dev              # Iniciar desenvolvimento
pnpm build            # Build para produção
pnpm db:generate      # Gerar migration
pnpm db:migrate       # Aplicar migrations
pnpm db:studio        # UI do banco de dados
docker-compose up -d  # Iniciar Icecast+Liquidsoap
```

## Recursos Importantes

- Documentação completa: `README.md`
- Schema do banco: `src/db/schema.ts`
- Servidor Socket.io: `src/server.ts`
- Configuração Liquidsoap: `files/etc/liquidsoap/`
- Tipos TypeScript: `src/types.ts`

---

**Ao trabalhar neste projeto:**
- Sempre considere o fluxo completo: pedido → requests → /api/music → history → UI
- Mantenha sincronia entre banco de dados e eventos Socket.io
- Teste localmente com Docker antes de deploy
- Documente mudanças significativas no README.md
