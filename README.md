# Rádio Som do Mato

![Rádio Som do Mato](./public/images/logotipo.svg)

[![Deploy](https://github.com/somdomato/somdomato/actions/workflows/deploy.yml/badge.svg)](https://github.com/somdomato/somdomato/actions/workflows/deploy.yml)

## Arquitetura Completa (Produção)

```
                    ┌─────────────────────────────────────────────────────┐
                    │                    VPS Debian 13                    │
                    │                                                     │
  Internet          │  ┌──────────────┐    ┌──────────────────────────┐   │
 ─────────────────────►│    Nginx     │───►│  Next.js (Node.js 24)   │   │
  HTTPS :443        │  │  :80 / :443  │    │  :3000 (via systemd)    │   │
  (Let's Encrypt)   │  │              │    │                          │   │
                    │  │  somdomato   │    │  ├─ App Router (pages)   │   │
                    │  │  .com        │    │  ├─ API Routes           │   │
                    │  │              │    │  ├─ Socket.io            │   │
                    │  │  radio.sdm   │    │  ├─ Drizzle ORM         │   │
                    │  │  .com ──────────► │  └─ SQLite DB            │   │
                    │  │              │    │                          │   │
                    │  │  cdn.sdm     │    └────────────┬─────────────┘   │
                    │  │  .com ─► /var/www/cdn          │                 │
                    │  └──────┬───────┘                 │ /api/music      │
                    │         │                         ▼                 │
                    │         │              ┌──────────────────────┐     │
                    │         │              │     Liquidsoap       │     │
                    │         │              │  (via systemd)       │     │
                    │         │              │                      │     │
                    │         │              │  ├─ AutoDJ (6 gên.)  │     │
                    │         │              │  ├─ request.dynamic  │     │
                    │         │              │  ├─ Harbor :8010     │     │
                    │         │              │  └─ HTTP ctrl :8080  │     │
                    │         │              └──────────┬───────────┘     │
                    │         │                         │                 │
                    │         │              ┌──────────▼───────────┐     │
                    │         └──────────────│     Icecast2         │     │
                    │           proxy :8000  │  :8000 / :8443       │     │
                    │                       │                      │     │
                    │                       │  6 mountpoints:      │     │
                    │                       │  /geral /gaucha      │     │
                    │                       │  /modao /arrocha     │     │
                    │                       │  /romantico /forro   │     │
                    │                       └──────────────────────┘     │
                    │                                                     │
                    │  ┌──────────────────────────────────────────────┐   │
                    │  │  systemd services:                           │   │
                    │  │  ├─ somdomato.service (Next.js via pnpm)    │   │
                    │  │  ├─ icecast2-somdomato.service               │   │
                    │  │  ├─ liquidsoap-somdomato.service             │   │
                    │  │  ├─ somdomato-sync.path (watch músicas)     │   │
                    │  │  ├─ somdomato-godeez.path (GoDeez import)   │   │
                    │  │  └─ somdomato-remote-sync.path (rsync)      │   │
                    │  └──────────────────────────────────────────────┘   │
                    └─────────────────────────────────────────────────────┘
```

### Stack de Produção

| Componente   | Tecnologia            | Descrição                                |
|--------------|-----------------------|------------------------------------------|
| OS           | Debian 13.3 AMD64     | VPS                                      |
| Runtime      | Node.js v24.14.0      | Via NodeSource                           |
| Gerenciador  | pnpm                  | Via corepack                             |
| Framework    | Next.js 16.1.4        | App Router + TypeScript                  |
| Banco        | SQLite + Drizzle ORM  | Persistência local                       |
| Real-time    | Socket.io             | Eventos de música/pedidos                |
| Proxy        | Nginx                 | SSL (Let's Encrypt) + proxy reverso      |
| Streaming    | Icecast2 :8000/:8443  | 6 mountpoints                            |
| AutoDJ       | Liquidsoap            | Fila dinâmica via API Next.js            |
| Deploy       | GitHub Actions        | CI/CD para VPS                           |
| Provisioning | Ansible               | Configuração automatizada da VPS         |
| Init         | systemd               | Gerenciamento de processos               |

## Arquitetura Local (Docker)

O Docker replica o ambiente de produção para desenvolvimento:

```
  ┌──────────────────────────────────────────────────────────────┐
  │                    Docker Compose                            │
  │                                                              │
  │   ┌──────────────┐     ┌─────────────────────────────────┐   │
  │   │    Nginx     │────►│    Next.js (dev mode)           │   │
  │   │  :443 (SSL)  │     │    :3000 (interno)              │   │
  │   │  :8080 (HTTP)│     │                                  │   │
  │   │              │     │  Debian Trixie + Node 24         │   │
  │   │  Cert auto-  │     │  pnpm dev (hot reload)          │   │
  │   │  assinado    │     │  Volume bind: código fonte       │   │
  │   └──────┬───────┘     └──────────────┬──────────────────┘   │
  │          │                            │                      │
  │          │                            │ http://nextjs:3000   │
  │          │                            ▼                      │
  │          │              ┌─────────────────────────────────┐   │
  │          │              │      Liquidsoap                 │   │
  │          │              │      :8081 (HTTP ctrl)          │   │
  │          │              │                                  │   │
  │          │              │  Debian Trixie                   │   │
  │          │              │  Consulta API via Docker DNS     │   │
  │          │              └──────────────┬──────────────────┘   │
  │          │                            │                      │
  │          │              ┌─────────────▼──────────────────┐   │
  │          └──────────────│      Icecast2                  │   │
  │            proxy :8000  │      :8000                     │   │
  │                         │                                 │   │
  │                         │  6 mountpoints                  │   │
  │                         └─────────────────────────────────┘   │
  │                                                              │
  │   Rede Docker: somdomato-radio-network                       │
  │   Volumes: node_modules, .next cache, /var/music/sdm (bind)  │
  └──────────────────────────────────────────────────────────────┘

  Acesso local:
  ├─ https://localhost       → Nginx (SSL) → Next.js
  ├─ https://localhost/geral → Nginx → Icecast (stream)
  └─ http://localhost:8000   → Icecast (direto)
```

## Desenvolvimento

### Requisitos

- Docker e Docker Compose
- Git
- OpenSSL (para gerar certificados SSL locais)
- Arquivos de música em um diretório local

### Setup Rápido

#### Linux / macOS / Git Bash (Windows)

```bash
# 1. Clonar repositório
git clone https://github.com/somdomato/somdomato.git
cd somdomato

# 2. Configurar caminho das músicas
export MUSIC_PATH=/home/lucas/music/sdm
# Ou criar arquivo .env na pasta docker/:
echo "MUSIC_PATH=/home/lucas/music/sdm" > docker/.env

# 3. Iniciar ambiente completo (gera certs SSL + sobe 4 containers)
./scripts/dev.sh

# 4. Acessar
# https://localhost (aceite o aviso de certificado auto-assinado)
```

#### Windows (PowerShell)

```powershell
# 1. Clonar repositório
git clone https://github.com/somdomato/somdomato.git
cd somdomato

# 2. Configurar caminho das músicas
$env:MUSIC_PATH = "C:\Users\Lucas\Music\sdm"
# Ou criar arquivo .env na pasta docker/:
Set-Content docker\.env "MUSIC_PATH=C:\Users\Lucas\Music\sdm"

# 3. Gerar certificados SSL (via Git Bash ou WSL)
cd docker
bash generate-certs.sh
cd ..

# 4. Iniciar containers
cd docker
docker compose up -d --build

# 5. Acessar
# https://localhost (aceite o aviso de certificado auto-assinado)
```

### Acessos em Desenvolvimento

| URL                          | Serviço                    |
|------------------------------|----------------------------|
| https://localhost            | Aplicação (via Nginx SSL)  |
| http://localhost:8080        | Aplicação (HTTP, redireciona) |
| https://localhost/geral      | Stream Geral (via Nginx)   |
| https://localhost/admin      | Admin Icecast              |
| http://localhost:8000        | Icecast direto             |

**Credenciais Icecast**: user `admin`, senha `hackme`

### Comandos Docker

```bash
# Iniciar
cd docker && docker compose up -d --build

# Ver logs (todos)
docker compose logs -f

# Ver logs de um serviço
docker compose logs -f nextjs
docker compose logs -f liquidsoap

# Reiniciar serviço
docker compose restart liquidsoap

# Parar
docker compose down

# Limpar tudo (volumes inclusos)
docker compose down -v
```

### Via Makefile (monorepo)

Se estiver trabalhando no monorepo (`sdm/`), use o Makefile da raiz para simular a VPS1 completa — Next.js + Nginx + Icecast + Liquidsoap (com os configs do repo `stream/`):

```bash
# Na raiz do monorepo (pasta sdm/)
export MUSIC_PATH=/home/lucas/music/sdm
make vps1       # sobe VPS1 completa
make site       # sobe apenas este repo (compose original)
make logs-vps1  # logs de todos os serviços da VPS1
make down-vps1  # para a VPS1
```

> O `make vps1` usa `stream/docker/icecast.docker.xml` e `stream/docker/somdomato.docker.liq` em vez dos configs deste repo — espelhando o fato de que na produção os dois repos coexistem na mesma VPS.

### Desenvolvimento sem Docker (Next.js local)

Se preferir rodar apenas o Next.js localmente (icecast/liquidsoap continuam no Docker):

```bash
# Instalar dependências
pnpm install

# Rodar Next.js em modo dev
pnpm dev

# Em outro terminal, subir apenas streaming
cd docker && docker compose up -d icecast liquidsoap
```

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

## Deploy em Produção

### Via GitHub Actions (CI/CD)

O deploy é feito automaticamente via GitHub Actions ao fazer push na branch principal.

### Via Ansible (provisioning completo)

Para provisionar uma VPS Debian 13 do zero:

```bash
# 1. Configurar inventário
cd ansible
# Edite inventory.ini com o IP da VPS

# 2. Executar playbook
ansible-playbook -i inventory.ini playbook.yml
```

O playbook instala e configura:
- Node.js 24 + pnpm
- Nginx com sites (somdomato.com, radio.somdomato.com, cdn.somdomato.com)
- Icecast2 com 6 mountpoints
- Liquidsoap com fila dinâmica
- Services systemd para todos os processos
- Let's Encrypt SSL

### Chave de Criptografia (NEXT_SERVER_ACTIONS_ENCRYPTION_KEY)

O Next.js requer uma chave de criptografia para Server Actions em produção:

```bash
# Gerar e atualizar automaticamente o .env
./scripts/generate-encryption-key.sh --update-env
```

### Documentação

- [docs/DEPLOY-RADIO.md](docs/DEPLOY-RADIO.md) - Deploy completo radio
- [docs/QUICKSTART.md](docs/QUICKSTART.md) - Guia rápido
- [docs/DESENVOLVIMENTO.md](docs/DESENVOLVIMENTO.md) - Desenvolvimento detalhado
- [CHANGELOG.md](CHANGELOG.md) - Mudanças recentes

## Convenções de Código

- **Nunca** use índice de array como `key` em elementos React (ex: `key={i}`). Use IDs únicos ou arrays estáticos de strings.

## Testes

```bash
pnpm install
pnpm test
```

## Estrutura do Projeto

```
├── src/
│   ├── app/                  # Páginas e rotas Next.js (App Router)
│   │   ├── api/              # API Routes (music, requests, admin, etc.)
│   │   └── admin/            # Painel administrativo
│   ├── components/           # Componentes React
│   │   └── blocks/           # Blocos da home (Last, Next, Top, etc.)
│   ├── context/              # React Contexts (Audio, Genre)
│   ├── db/                   # Schema Drizzle ORM e utilitários
│   ├── lib/                  # Utilitários (format, cover, protections, etc.)
│   ├── actions/              # Server Actions
│   └── server.ts             # Servidor customizado (Socket.io)
├── docker/
│   ├── docker-compose.yml    # Orquestração local (4 serviços)
│   ├── Dockerfile.nextjs     # Imagem Next.js (Debian Trixie + Node 24)
│   ├── Dockerfile.liquidsoap # Imagem Liquidsoap (Debian Trixie)
│   ├── nginx.dev.conf        # Nginx com SSL auto-assinado
│   └── generate-certs.sh     # Gera certificados SSL para dev
├── ansible/
│   ├── playbook.yml          # Playbook Ansible para provisioning VPS
│   ├── inventory.ini         # Inventário de hosts
│   └── etc/
│       ├── icecast/          # Configuração Icecast2
│       ├── liquidsoap/       # Scripts Liquidsoap (produção + Docker)
│       ├── nginx/            # Configuração Nginx (sites + snippets)
│       └── systemd/          # Services systemd
├── scripts/
│   ├── dev.sh                # Inicia ambiente Docker completo
│   ├── deploy.sh             # Deploy em produção
│   ├── sync-music.ts         # Sincronização de músicas (DB ↔ ID3)
│   └── generate-encryption-key.sh
├── test/                     # Testes (Vitest)
└── docs/                     # Documentação adicional
```
```