# Rádio Som do Mato

![Rádio Som do Mato](https://raw.githubusercontent.com/somdomato/somdomato/refs/heads/main/public/images/logo.svg "Rádio Som do Mato")

[![Deploy](https://github.com/somdomato/somdomato/actions/workflows/deploy.yml/badge.svg)](https://github.com/somdomato/somdomato/actions/workflows/deploy.yml)

Streaming de audio para as massas.

| sistema | url | descrição |
| :--- | ---: | ---: |
| Site | [somdomato.com](https://somdomato.com) | Web Rádio Som do Mato |
| [Stream](https://github.com/somdomato/stream) | [radio.somdomato.com](https://radio.somdomato.com) | IceCast2 & LiquidSoap |
| [Chat](https://github.com/somdomato/chat) | [chat.somdomato.com](https://chat.somdomato.com) | Ergo IRC Server & Gamja IRC Web Client |
| [Mobile](https://github.com/somdomato/mobile) |  | Aplicativos iOS e Android da rádio |
| [Infra](https://github.com/somdomato/infra) |  | Imagens e contêineres do Docker e Ansible Playbooks para desenvolvimento local |

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
                    │         │              │  ├─ AutoDJ (5 gên.)  │     │
                    │         │              │  ├─ request.dynamic  │     │
                    │         │              │  ├─ Harbor :8010     │     │
                    │         │              │  └─ HTTP ctrl :8080  │     │
                    │         │              └──────────┬───────────┘     │
                    │         │                         │                 │
                    │         │              ┌──────────▼───────────┐     │
                    │         └──────────────│     Icecast2         │     │
                    │           proxy :8000  │  :8000 / :8443       │     │
                    │                       │                      │     │
                    │                       │  5 mountpoints:      │     │
                    │                       │  /geral /gaucha      │     │
                    │                       │  /modao /arrocha     │     │
                    │                       │  /romantico    │     │
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
  │   ┌────────────────────┐   ┌──────────────────────────────┐  │
  │   │  Nginx             │──►│  Next.js (dev mode)          │  │
  │   │  Debian Trixie     │   │  :3000 (interno)             │  │
  │   │  :443  localhost   │   │                              │  │
  │   │  :8080 (HTTP→HTTPS)│   │  Debian Trixie + Node 24     │  │
  │   │                    │   │  pnpm dev (hot reload)       │  │
  │   │  localhost         │   │  Volume bind: código fonte   │  │
  │   │  radio.localhost   │   │  /_next/static servido       │  │
  │   │  (virtual hosts)   │   │  diretamente pelo Nginx      │  │
  │   └──────────┬─────────┘   └──────────────┬───────────────┘  │
  │              │                            │                   │
  │              │                            │ /api/music        │
  │              │                            ▼                   │
  │              │              ┌─────────────────────────────┐   │
  │              │              │  Liquidsoap                 │   │
  │              │              │  :8081 (HTTP ctrl)          │   │
  │              │              │                             │   │
  │              │              │  Debian Trixie              │   │
  │              │              │  Consulta API via Docker DNS│   │
  │              │              └──────────────┬──────────────┘   │
  │              │                            │                   │
  │              │              ┌─────────────▼──────────────┐    │
  │              └──────────────│  Icecast2                  │    │
  │               radio.local   │  Debian Trixie             │    │
  │               proxy :8000   │  :8000                     │    │
  │                             │                            │    │
  │                             │  5 mountpoints: /geral     │    │
  │                             │  /gaucha /modao /arrocha   │    │
  │                             │  /romantico                │    │
  │                             └────────────────────────────┘    │
  │                                                               │
  │   Rede Docker: somdomato-radio-network                        │
  │   Volumes: node_modules, .next cache, /var/music/sdm (bind)   │
  └───────────────────────────────────────────────────────────────┘

  Acesso local:
  ├─ https://localhost            → Nginx → Next.js
  ├─ https://radio.localhost      → Nginx → Icecast (produção-like)
  ├─ http://localhost:8080        → HTTP → redireciona HTTPS
  └─ http://localhost:8000        → Icecast (direto)
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

| URL                          | Serviço                                       |
|------------------------------|-----------------------------------------------|
| https://localhost            | Aplicação (Nginx SSL → Next.js)               |
| https://radio.localhost      | Streams Icecast (espelha `radio.somdomato.com`) |
| http://localhost:8080        | HTTP → redireciona para HTTPS                 |
| https://radio.localhost/json | Metadados JSON do Icecast                     |
| http://localhost:8000        | Icecast direto (sem proxy)                    |

**Credenciais Icecast**: user `admin`, senha `hackme`

> `radio.localhost` usa o certificado `*.localhost` gerado pelo `generate-certs.sh` (mkcert ou openssl). Para apontar os streams da UI para este virtual host, defina no `.env`:
> ```
> NEXT_PUBLIC_RADIO_SOURCE=https://radio.localhost
> NEXT_PUBLIC_RADIO_METADATA=https://radio.localhost/json
> ```
> Sem isso, o valor padrão `http://localhost:8080` (proxy via Nginx) continua funcionando.

### Comandos via Makefile

```bash
# Setup inicial (gera certs + .env + build + up)
make setup

# Ciclo de vida
make up              # sobe todos os serviços
make down            # para e remove containers
make build           # reconstrói todas as imagens
make restart         # reinicia tudo
make ps              # lista containers em execução

# Logs (segue)
make logs            # todos os serviços
make logs-nextjs     # apenas Next.js
make logs-nginx      # apenas Nginx
make logs-icecast    # apenas Icecast
make logs-liquidsoap # apenas Liquidsoap

# Shells interativos
make nextjs-shell
make nginx-shell
make icecast-shell
make liquidsoap-shell

# Restart individual
make nextjs-restart
make nginx-restart
make icecast-restart
make liquidsoap-restart

# Ver todos os comandos disponíveis
make help
```

### Comandos Docker diretos

```bash
# Subir com build (da pasta docker/)
docker compose up -d --build

# Rebuildar do zero
docker compose down -v && docker compose build --no-cache && docker compose up -d
```

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
   - Liquidsoap consulta `/api/music?genre=<genero>` quando precisa de uma nova faixa
   - API verifica se há pedidos pendentes (apenas para `genre=geral`)
   - Se houver pedido: seleciona o mais antigo, remove da tabela `requests`
   - Se não houver: seleciona música aleatória via AutoDJ respeitando gênero
   - Para "geral": inclui músicas com `genre='geral'` ou `allowedInGeneral=1`
   - Para outros gêneros: inclui apenas músicas do gênero específico
   - **Nenhum evento Socket.io é emitido neste momento** (a música ainda não começou)
   - A música é registrada como "pendente" aguardando confirmação de reprodução
   - O cache de prospecção do gênero é limpo para recomputação

3. **Confirmação de Reprodução** (`/api/music/started`)
   - Liquidsoap chama via `on_track` quando a música **realmente começa a tocar**
   - Neste momento: registro é criado em `history`, evento `song:changed` é emitido
   - **Esse é o ponto em que a UI atualiza**: "Últimas", "Próximas" e Player
   - Se o callback `on_track` nunca disparar, o próximo `/api/music` insere o histórico pendente como safety net

4. **Sistema de Prospecção de Próximas Músicas** (`src/lib/prospection.ts`)

   O sistema mantém um cache em memória (Map) com a próxima música pré-selecionada para cada gênero.
   Isso garante que o bloco "Próximas" mostre sempre a mesma música AutoDJ entre atualizações.

   **Fluxo:**
   ```
   /api/songs/next (UI pede preview)
     → Cache tem valor? → Retorna (estável!)
     → Cache vazio? → Computa via selectRandomSong(), cacheia, retorna

   /api/music (Liquidsoap pede próxima faixa)
     → Limpa cache do gênero
     → Registra songId servido como "último"

   /api/music/started (Liquidsoap confirma reprodução)
     → Emite song:changed → UI chama /api/songs/next → recomputa e cacheia
   ```

   **Estabilidade**: Entre dois `song:changed`, todas as chamadas a `/api/songs/next` retornam a mesma música.
   O preview só muda quando a música atual de fato termina e a próxima começa a tocar.

   **Pending (safety net)**: Quando `/api/music` serve uma música, ela é registrada como "pendente".
   Se `/api/music/started` não for chamado (ex: crash do Liquidsoap), o próximo `/api/music` detecta
   o pending e insere o histórico retroativamente.

   **6 gêneros**: Cada gênero tem seu próprio slot no cache e no pending. São independentes.

5. **Blocos da Página Inicial**

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
   - Para **Geral**: mostra pedidos pendentes (tabela `requests`) + próxima AutoDJ (prospecção)
   - Para **outros gêneros**: mostra apenas próxima AutoDJ (prospecção)
   - Pedidos só desaparecem da lista quando a música **começa a tocar** (evento `song:changed`)
   - Preview AutoDJ é estável (cache de prospecção), não muda até próxima reprodução
   - Exibe: Capa, Música, Artista, Tempo na fila (ex: "há 2min") ou badge "AutoDJ"
   - Atualiza automaticamente via Socket.io (`song:changed` dispara refresh)

### Tabelas do Banco

- **songs**: Cadastro de músicas (id, title, artist, path, cover, rotation, timeSlots, genre, allowedInGeneral)
  - `genre`: Define o gênero da música (geral, gaucha, modao, arrocha, romantico)
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
  - Gêneros válidos: geral, gaucha, modao, arrocha, romantico
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
│   ├── proxy.ts              # Proteção de rotas admin (Next.js 16+ usa proxy.ts em vez de middleware.ts)
│   └── server.ts             # Servidor customizado (Socket.io)
├── docker/
│   ├── docker-compose.yml    # Orquestração local (4 serviços)
│   ├── Dockerfile.nextjs     # Imagem Next.js (Debian Trixie + Node 24 + pnpm)
│   ├── Dockerfile.nginx      # Imagem Nginx (Debian Trixie — espelha produção)
│   ├── Dockerfile.icecast    # Imagem Icecast2 (Debian Trixie — espelha produção)
│   ├── Dockerfile.liquidsoap # Imagem Liquidsoap (Debian Trixie)
│   ├── nginx.dev.conf        # 2 virtual hosts: localhost + radio.localhost
│   ├── .env.example          # Variáveis para o docker-compose (MUSIC_PATH)
│   └── generate-certs.sh     # Gera certificados SSL (mkcert ou openssl)
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