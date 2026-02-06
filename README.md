# Rádio Som do Mato

![Rádio Som do Mato](./public/images/logotipo.svg)

[![Deploy](https://github.com/somdomato/somdomato/actions/workflows/deploy.yml/badge.svg)](https://github.com/somdomato/somdomato/actions/workflows/deploy.yml)

## 🚀 Deploy em Produção

Para fazer deploy completo do sistema de rádio (Icecast + Liquidsoap + Nginx):

```bash
# No servidor de produção
cd /var/www/somdomato
sudo ./scripts/deploy-radio.sh
```

**Documentação completa:** [docs/DEPLOY-RADIO.md](docs/DEPLOY-RADIO.md)

## 🎵 Desenvolvimento

### 📋 Requisitos

- Node.js 18+
- pnpm
- Docker e Docker Compose

### ⚡ Setup Rápido

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar ambiente
cp .env.example .env
# O arquivo .env já vem configurado para desenvolvimento
# Ajuste MUSIC_PATH se necessário

# 3. Iniciar ambiente completo (Nginx + Icecast + Liquidsoap)
./scripts/dev.sh

# 4. Em outro terminal, iniciar Next.js
pnpm dev

# 5. Acessar aplicação
# http://localhost:3000
```

**Acessar:**
- Aplicação: http://localhost:3000
- Nginx (proxy): http://localhost:8080
- Admin Icecast: http://localhost:8080/admin (usuário: `admin`, senha: `hackme`)

**Para parar:**
```bash
cd docker && docker-compose down
```

### 📚 Documentação

- **[QUICKSTART.md](QUICKSTART.md)** - Guia de início rápido
- **[DESENVOLVIMENTO.md](docs/DESENVOLVIMENTO.md)** - Guia detalhado de desenvolvimento
- **[CHANGELOG.md](CHANGELOG.md)** - Mudanças recentes e simplificações

### 🏗️ Arquitetura Simplificada

```
┌─────────────┐
│  Navegador  │ :3000
└──────┬──────┘
       │
┌──────▼──────┐
│   Next.js   │ → Player, API, Socket.io
└──────┬──────┘
       │
┌──────▼──────┐
│    Nginx    │ :8080 → Proxy Reverso
└──────┬──────┘
       │
┌──────▼──────┐
│   Icecast   │ :8000 → 6 Streams
└──────▲──────┘
       │
┌──────┴──────┐
│ Liquidsoap  │ → AutoDJ + Pedidos
└─────────────┘
```

### 🎯 Mudanças Recentes (v2.0)

✅ **Configurações centralizadas** em `src/config.ts`  
✅ **Player simplificado** com busca de metadados por gênero  
✅ **Nginx container** para desenvolvimento  
✅ **API de metadados** filtrada por mountpoint  
✅ **Troca de gênero** inicia playback automaticamente  

Ver [CHANGELOG.md](CHANGELOG.md) para detalhes.

## Testes

Para rodar os testes unitários (Vitest):

```bash
# Instalar dependências (se necessário)
pnpm install

# Rodar todos os testes
pnpm test
```

## Arquitetura

- **Next.js**: Frontend e API para gerenciamento de músicas
- **Liquidsoap**: Automação da rádio e streaming
- **Icecast**: Servidor de streaming de áudio
- **Socket.io**: Comunicação em tempo real
- **Drizzle ORM**: Gerenciamento do banco de dados SQLite

## Fluxo do Sistema de Pedidos e Reprodução

### Sistema de Gêneros (Mountpoints)

O sistema suporta 6 mountpoints diferentes, cada um com sua própria seleção de músicas:

1. **Geral** - Mountpoint principal que aceita pedidos
   - Toca músicas com `genre='geral'` OU `allowedInGeneral=1`
   - Único mountpoint que aceita pedidos de usuários
   - Suporta fila de pedidos via tabela `requests`

2. **Gaúcha** - Sertanejo gaúcho
   - Toca apenas músicas com `genre='gaucha'`
   - AutoDJ puro (sem pedidos)

3. **Modão** - Modão tradicional
   - Toca apenas músicas com `genre='modao'`
   - AutoDJ puro (sem pedidos)

4. **Arrocha** - Arrocha e romantic
   - Toca apenas músicas com `genre='arrocha'`
   - AutoDJ puro (sem pedidos)

5. **Romântico** - Músicas românticas
   - Toca apenas músicas com `genre='romantico'`
   - AutoDJ puro (sem pedidos)

6. **Forró** - Forró e derivados
   - Toca apenas músicas com `genre='forro'`
   - AutoDJ puro (sem pedidos)

#### Troca de Gênero no Player

- O player possui um dropdown (clique na capa) para trocar entre gêneros
- Ao selecionar um gênero, o stream é trocado automaticamente
- Gênero selecionado é salvo no localStorage

#### Pedidos de Música

- Pedidos só são aceitos no mountpoint **Geral**
- Ao tentar pedir música em outro gênero, um modal avisa e oferece trocar para Geral
- Se o usuário aceitar, o gênero é trocado e o pedido é feito

### Como Funciona

1. **Pedido de Música**
   - Usuário acessa modal "Pedidos"
   - Pesquisa uma música
   - Clica em "Pedir"
   - Música é inserida na tabela `requests` com `createdAt` preenchido

2. **Seleção da Próxima Música** (`/api/music`)
   - Liquidsoap consulta periodicamente `/api/music?genre=<genero>`
   - API verifica se há pedidos pendentes (apenas para `genre=geral`)
   - Se houver pedido: seleciona o mais antigo
   - Se não houver: seleciona música aleatória via AutoDJ respeitando gênero
   - Para "geral": inclui músicas com `genre='geral'` ou `allowedInGeneral=1`
   - Para outros gêneros: inclui apenas músicas do gênero específico
   - Música escolhida é removida de `requests` (se foi pedido)
   - Registro é criado na tabela `history` com timestamp
   - Evento `song:changed` é emitido via Socket.io

3. **Blocos da Página Inicial**

   **Bloco "Últimas"**
   - Mostra últimas 10 músicas tocadas
   - Fonte: tabela `history` (ordenada por mais recente)
   - Exibe: Capa, Música, Artista, Tempo relativo (ex: "há 5min")
   - Atualiza automaticamente via Socket.io

   **Bloco "Top 10"**
   - Mostra músicas mais pedidas
   - Fonte: agregação da tabela `history`
   - Ordenação: quantidade decrescente, depois data (mais nova primeiro)
   - Exibe: Capa, Música, Artista, Número de pedidos (ex: "15x")
   - Atualiza automaticamente via Socket.io

   **Bloco "Próximas"**
   - Mostra fila de pedidos pendentes
   - Fonte: tabela `requests` (ordenada do mais antigo ao mais novo)
   - Se houver pedidos: lista até 10 pedidos
   - Se não houver: mostra próxima música do AutoDJ
   - Exibe: Capa, Música, Artista, Tempo na fila (ex: "há 2min")
   - Atualiza automaticamente via Socket.io

### Tabelas do Banco

- **songs**: Cadastro de músicas (id, title, artist, path, cover, rotation, timeSlots, genre, allowedInGeneral)
  - `genre`: Define o gênero da música (geral, gaucha, modao, arrocha, romantico, forro)
  - `allowedInGeneral`: Permite que música de outro gênero toque no Geral (0=não, 1=sim)
- **requests**: Fila de pedidos (id, songId, createdAt, order)
- **history**: Histórico de reprodução (id, songId, createdAt)
- **likes**: Curtidas dos usuários (id, songId, userIp, createdAt)

### Sincronização de Gêneros

O sistema mantém sincronização entre 3 camadas:

1. **Tags ID3 dos arquivos MP3**
2. **Banco de dados** (campo `genre` na tabela `songs`)
3. **Interface administrativa**

#### Mapeamento de Gêneros

**IMPORTANTE**: O gênero "Sertanejo" nas tags ID3 é automaticamente convertido para "geral" no banco de dados.

| ID3 Tag | Banco de Dados |
|---------|----------------|
| Sertanejo | geral |
| Sertanejo Gaúcho | gaucha |
| Modão | modao |
| Arrocha | arrocha |
| Romântico | romantico |
| Forró | forro |

#### Comportamento do Script de Sincronização

O script `scripts/sync-music.ts`:
- Escaneia o diretório `/var/music/sdm` 
- Lê tags ID3 de arquivos MP3
- Para músicas **sem gênero** ou com **gênero inválido**:
  - Preenche automaticamente com "Sertanejo" nas tags ID3
  - Salva como "geral" no banco de dados
- Converte gêneros ID3 para formato do banco usando o mapeamento acima
- Atualiza tags ID3 quando necessário

#### Sincronização via Admin

Ao editar uma música pela interface administrativa:
- Gênero selecionado é salvo no banco de dados
- Tags ID3 do arquivo MP3 são atualizadas automaticamente
- Conversão DB → ID3: "geral" vira "Sertanejo", outros mantêm nome formatado

Exemplo:
```typescript
// Ao salvar gênero "geral" no admin:
// → Banco: genre = "geral"
// → ID3: genre = "Sertanejo"
```

### Endpoints Principais

- `GET /api/music?genre=<genero>` - Retorna próxima música a tocar para o gênero especificado (usado pelo Liquidsoap)
  - Padrão: `genre=geral` se não especificado
  - Gêneros válidos: geral, gaucha, modao, arrocha, romantico, forro
- `GET /api/requests` - Lista pedidos pendentes
- `POST /api/admin/request` - Cria novo pedido
- `DELETE /api/admin/request/:id` - Remove pedido da fila
- `GET /api/admin/songs?genre=<genero>` - Lista músicas filtradas por gênero (admin)

### Eventos Socket.io

- `song:changed` - Emitido quando música muda (atualiza "Últimas" e "Top 10")
- `request:added` - Emitido quando pedido é criado (atualiza "Próximas")
- `request:removed` - Emitido quando pedido é removido (atualiza "Próximas")
- `requests:updated` - Emitido para forçar atualização completa da fila

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