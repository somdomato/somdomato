# 🎧 Rádio Som do Mato

![Rádio Som do Mato](https://raw.githubusercontent.com/somdomato/somdomato/refs/heads/main/web/static/images/logo.svg "Rádio Som do Mato")

Infra-estrutura de audio para as massas.

| sistema | url | descrição |
| :--- | ---: | ---: |
| [Site](https://github.com/somdomato/somdomato) | [somdomato.com](https://somdomato.com) | Web Rádio Som do Mato |
| [Stream](https://github.com/somdomato/stream) | [radio.somdomato.com](https://radio.somdomato.com) | IceCast2 & LiquidSoap |
| [Chat](https://github.com/somdomato/chat) | [chat.somdomato.com](https://chat.somdomato.com) | Ergo IRC Server & Gamja IRC Web Client |
| [Mobile](https://github.com/somdomato/mobile) |  | Aplicativos iOS e Android da rádio |
| [Infra](https://github.com/somdomato/infra) |  | Imagens e contêineres do Podman e Ansible Playbooks para desenvolvimento local |

## Descrição

Rádio online sertaneja: 5 streams (Icecast2 + Liquidsoap), AutoDJ com
rotação/proteções anti-repetição, pedidos ao vivo e painel administrativo.

Stack: **Go** (backend, `api/`) + **HTMX** (frontend server-rendered,
`web/`) + **Tailwind CSS v4** + **PostgreSQL**. Realtime via **SSE**
(Server-Sent Events), sem WebSocket/Socket.io. Dev local: postgres/icecast/
liquidsoap via **Podman**, API+HTMX nativa via **air** (`Makefile`);
produção provisionada via **Ansible**, sem containers.

## Escopo desta versão

Núcleo do rádio: streaming, AutoDJ (rotação + proteções de repetição),
pedidos, fila persistida (`queue_entries`), vinhetas, painel admin básico
(login, CRUD de músicas, tocar/pular, pedidos, vinhetas, usuários/papéis),
envio público de músicas novas via Deezer com aprovação automática por IA
(`/enviar`, ver seção própria abaixo).

Fora do escopo por enquanto (schema já preparado para adicionar depois):
likes, estatísticas detalhadas de acesso, painel admin para revisar/forçar
manualmente os uploads (hoje a decisão é 100% da IA).

## Desenvolvimento local

Requer [Podman](https://podman.io) e [Go](https://go.dev) 1.26+ (a API roda
nativa no host, ver `go.mod`).

```bash
cp .env.example .env   # ajuste MUSIC_PATH para seu catálogo local
make setup                # instala templ/tailwind/air e sobe postgres/icecast/liquidsoap
make seed                 # varre MUSIC_PATH e popula o catálogo
make dev                  # roda a API+HTMX localmente com hot-reload (air) + CSS em watch
```

Só postgres/icecast/liquidsoap rodam via Podman; a API Go (e o HTMX que ela
serve) roda nativa no host via [air](https://github.com/air-verse/air), sem
container — `make dev` sobe as duas coisas juntas, `make air` só a API (se
`make up` já estiver rodando à parte).

`.env` na raiz é a única fonte de configuração do projeto: o Make/Podman o
usa no desenvolvimento e o Ansible o usa ao provisionar a VPS. Não há
`podman/.env` nem `.env.production`. Os valores são específicos do ambiente:
antes de executar um provisionamento, confira a seção de produção do mesmo
arquivo. O `.env` contém segredos, é ignorado pelo Git e deve ter permissão
restrita (`chmod 600 .env`).

`DEEZER_ARL` e `GROQ_API_KEY` (também em `.env.example`) são opcionais —
sem eles a aplicação sobe normalmente e só a rota `/enviar` fica
desativada. Ver "Envio de músicas via Deezer" abaixo.

- App: http://localhost:3000
- Rádio (Icecast): http://localhost:8000/geral
- `make logs` / `make logs-liquidsoap` — logs do Podman (postgres/icecast/liquidsoap)
- `make down` — parar os containers

Outros comandos úteis: `make templ` (gera `_templ.go`), `make css-watch`
(Tailwind em watch), `make test` (requer `DATABASE_URL` para os testes de
integração de `internal/queue`), `make lint`.

## Arquitetura

```
api/            Todo o código Go: entrypoints (cmd/), lógica de negócio e
                handlers HTTP (internal/). Nada aqui é importável fora do
                módulo — normal para código de backend.
web/            Tudo que o navegador consome: templates .templ, CSS
                (Tailwind v4), JS vendorizado (htmx + extensão SSE).
                Compilado para dentro do binário via go:embed.
ansible/        Provisionamento da VPS de produção (Postgres, Nginx,
                Icecast2, Liquidsoap nativos + binário Go via systemd).
podman/         SOMENTE dev local: compose com postgres/icecast/liquidsoap
                (a API roda nativa no host via air, não em container).
```

### Fluxo AutoDJ / pedidos (contrato com o Liquidsoap)

O Liquidsoap chama dois endpoints internos, protegidos por um header
`X-Internal-Token` (segredo compartilhado, `RADIO_INTERNAL_TOKEN`) em vez de
uma heurística de IP:

- `GET /internal/music?genre=X` — próxima faixa (vinheta ou música da fila).
- `POST /internal/music/started?songId=&genre=&wasRequested=` — callback
  `on_track`: só aqui a música vira "current" e o evento SSE `song-changed`
  é publicado, garantindo que a UI só atualiza quando o ouvinte de fato
  ouve a nova faixa.

A fila (`queue_entries`) é uma timeline única por gênero:
`scheduled → pending → current → played | skipped`, com um índice único
parcial `(genre) WHERE status = 'current'` garantindo, no banco, no máximo
uma música tocando por gênero. Pedidos sempre têm prioridade sobre o AutoDJ
e ocupam posições negativas na fila. Detalhes e invariantes documentados em
`api/internal/queue/queue.go`.

### Envio de músicas via Deezer (`/enviar`)

Qualquer visitante pode buscar uma faixa no Deezer e pedir o download em
`/enviar`; a música entra automaticamente no catálogo se for aprovada por
IA. Todo o pipeline roda em processo, sem subprocess (ao contrário do
sistema antigo, que chamava o CLI `godeez`) — pensado para aguentar muitos
visitantes simultâneos gastando pouca RAM/CPU:

- **`api/internal/deezerdl`** — cliente Deezer próprio: autentica via cookie
  `DEEZER_ARL` (sessão cacheada em memória e reaproveitada entre downloads,
  não um login por faixa), resolve a URL de mídia e decripta o stream
  Blowfish direto para o arquivo em chunks fixos de 2KB (custo de memória
  constante, nunca bufferiza a faixa inteira). Não é um import do
  [`godeez`](https://github.com/mathismqn/godeez) — os pacotes de origem são
  `internal/` e não podem ser importados fora do módulo — é uma porta
  reduzida ao caminho de "uma faixa por ID", sob licença MIT (atribuição no
  cabeçalho do pacote).
- Um **semáforo global de 3 downloads simultâneos** enfileira rajadas de
  pedidos em vez de abrir N conexões contra a conta Deezer de uma vez; um
  **rate limit de 5 downloads/hora por IP** (mesmo teto do sistema antigo) e
  um **teto de 200 jobs em voo** protegem contra abuso vindo de muitos IPs
  diferentes. Buscas passam por um cache de 60s para não martelar a API
  pública do Deezer a cada tecla digitada.
- O progresso do download é transmitido via SSE (reaproveitando a mesma
  extensão htmx-sse usada no player) calculado a partir de bytes já
  gravados — nunca por parsing de texto de um processo filho.
- **`api/internal/uploads`** guarda a fila (`status`: `pending` →
  `evaluating` → `approved`/`rejected`) até a avaliação.
- **`api/internal/groqeval`** avalia cada upload via
  [Groq](https://console.groq.com) (API compatível com OpenAI,
  `GROQ_API_KEY` + `GROQ_MODEL`). O worker roda num único goroutine,
  pautado por um `time.Ticker` de 60s: **no máximo 1 chamada à Groq por
  minuto, sempre**, não importa quantos uploads estejam na fila nem quantos
  usuários peçam ao mesmo tempo — garantido pela estrutura do código (só
  existe um caminho para chamar a Groq, o tick), não por um rate limiter
  reativo. Aprovada, a faixa entra direto em `songs` (com capa extraída do
  próprio ID3 do MP3); rejeitada ou com falha repetida (`MaxAttempts`),
  fica marcada como `rejected`.

Sem `DEEZER_ARL`, a rota `/enviar/baixar` responde 503 e o resto da app
sobe normal. Sem `GROQ_API_KEY`, os uploads baixados ficam em `pending`
indefinidamente (nada quebra, só não são aprovados sozinhos).

### Capas de artistas (`api/internal/artistcover`)

Além da capa por música (extraída do ID3, `api/internal/cover`), cada
artista tem uma capa própria — usada nos cards de `/artistas` e no topo de
`/artistas/{artist}` — guardada na tabela `artist_covers` (chave livre
`artist_name`, o mesmo texto usado em `songs.artist`; não existe uma tabela
`artists` separada).

**Gatilho: só quando uma música toca de verdade.** Não há worker varrendo o
catálogo em busca de artistas sem capa — isso gastaria CPU/rede numa VPS
pequena por algo que pode esperar. Em vez disso, `handleMusicStarted`
(`api/internal/httpserver/internal_radio.go`), o callback `on_track` do
Liquidsoap, dispara `ArtistCoverResolver.Resolve(ctx, artist)` como
fire-and-forget assim que a música é confirmada como tocando — o mesmo
padrão já usado ali para a capa da própria música
(`resolveCoverAsync`). Se não houver tempo de aparecer *nessa* execução, a
capa fica pronta pra próxima vez que o artista tocar.

`Resolve` decide se vale a pena buscar antes de fazer qualquer chamada de
rede: sai cedo se a capa já foi definida manualmente (`is_manual`), se já
existe uma capa encontrada automaticamente, ou se a última tentativa sem
sucesso foi há menos de **7 dias** (`coverCooldown`, `last_attempt_at` +
`attempts`) — isso evita martelar as APIs externas toda vez que uma música
de um artista sem capa encontrável toca.

**Fontes, em ordem, parando na primeira que encontrar algo** (todas
públicas, sem chave de API):

1. **Deezer** (`api.deezer.com/search/artist`) — mesma API pública usada em
   `internal/deezerdl/search.go`, agora no endpoint de artista.
2. **iTunes Search API** (`itunes.apple.com/search`).
3. **Wikidata via MusicBrainz** — o fallback mais caro (até 4 requisições
   HTTP em cadeia), só tentado se as duas fontes anteriores falharem.
   MusicBrainz não serve foto de artista diretamente (Cover Art Archive é só
   de release), então a cadeia é: busca o artista no MusicBrainz → MBID →
   relações (`inc=url-rels`) → link para a entidade correspondente no
   Wikidata → claim `P18` (imagem) → arquivo resolvido via Wikimedia Commons
   (`Special:FilePath`). As chamadas ao MusicBrainz respeitam o limite de
   uso justo deles (~1 req/s) via um rate-gate simples no processo, com
   `User-Agent` identificando o app.

**Conversão e armazenamento.** A imagem baixada é gravada num arquivo
temporário, convertida para webp via `cwebp` (binário do pacote `webp`,
qualidade 78, redimensionada para no máximo 600px no maior lado) e movida
(rename atômico) para `[COVERS_DIR]/artistas/<slug-do-artista>/cover.webp`
— servida publicamente em `/covers/artistas/<slug>/cover.webp` pelo mesmo
`http.FileServer` que já serve as capas de música. `cwebp` é resolvido uma
vez via `exec.LookPath`; se ausente, a busca de capa de artista vira no-op
(loga um aviso, não impede o boot) — mesmo padrão de degradação usado para
`DEEZER_ARL`/`GROQ_API_KEY` ausentes. Em produção o pacote `webp` já é
instalado pelo Ansible; em dev local (a API roda nativa no host, não em
container) é preciso instalar manualmente: `brew install webp` (Mac) ou
`apt install webp` (Linux).

**Override manual no admin.** Em `/artistas/{artist}`, o admin pode enviar
uma imagem própria (`POST /admin/artistas/{artist}/capa`) — passa pelo mesmo
`SaveCover` (temp → webp → path final) e marca `is_manual = true`: a partir
daí `Resolve` nunca mais sobrescreve esse artista automaticamente. Um botão
"Remover capa customizada" (`POST /admin/artistas/{artist}/capa/remover`)
zera a flag e o cooldown, devolvendo o artista à busca automática na
próxima vez que uma música dele tocar.

## Produção

O `.env` na raiz é a única fonte de verdade para o provisionamento: contém
segredos (senhas e tokens) e topologia (domínio, usuário da aplicação, porta
SSH etc.). O Ansible o lê diretamente (`ansible/playbook.yml`) e usa os
valores para gerar o `.env` do binário Go e as configurações nativas do
Icecast2, Liquidsoap, Nginx e systemd. Nada de segredo fica hardcoded em
`ansible/*.yml`.

O mesmo arquivo também é usado pelo desenvolvimento local. Ao preparar outra
máquina, comece por `.env.example`, ajuste `MUSIC_PATH` para o catálogo local
e preencha **todos** os campos da seção “Provisionamento de produção” antes
de rodar Ansible. Nunca envie `.env` ao Git, e mantenha-o com permissão `600`.
Esta convenção privilegia um único arquivo legível pelo Make e pelo Ansible;
por isso ele não deve ser criptografado com Ansible Vault.

```bash
cp .env.example .env                           # se ainda não existir
chmod 600 .env
# preencha/revise os valores de produção em .env
cd ansible
ansible-galaxy install -r requirements.yml
ansible-playbook -i inventory.ini playbook.yml
```

Isso provisiona o host (Postgres, Nginx, Icecast2, Liquidsoap, firewall,
TLS via Certbot) e cria o serviço systemd `somdomato-api`. É sempre um
passo manual e separado — `scripts/deploy.sh` e o workflow de deploy
assumem que o host já foi provisionado e nunca disparam o Ansible sozinhos.
Para publicar uma nova versão do binário:

```bash
./scripts/deploy.sh                     # usa nginx@tyche por padrão
HOST=root@outro-host ./scripts/deploy.sh # ou aponte para outro usuário/host
```

Só a porta 80/443 (Nginx) e 8000 (Icecast) ficam expostas publicamente — a
API Go e o Postgres escutam somente em `127.0.0.1`.

### Deploy contínuo (GitHub Actions)

`.github/workflows/deploy.yml` roda `make vet` + `make test` (com Postgres
de serviço) a cada push em `main` e, se passar, builda com `make build`
(o mesmo alvo usado localmente e por `scripts/deploy.sh`) e publica na VPS
— autenticando por usuário/senha (não por chave SSH). Configure em
Settings → Secrets and variables → Actions:

| Secret         | Descrição                                   |
| -------------- | -------------------------------------------- |
| `SSH_HOST`     | IP ou hostname da VPS                        |
| `SSH_USER`     | Usuário SSH (precisa poder rodar `systemctl`) |
| `SSH_PASS`     | Senha do usuário SSH                          |
| `SSH_PORT`     | Porta do SSH (opcional, default `22`)         |
| `PROJECT_PATH` | Caminho da app (opcional, default `/var/www/somdomato`) |

## Testes

```bash
export DATABASE_URL=postgres://sdm:sdm@localhost:5432/sdm_test?sslmode=disable
make test
```

Os testes de `internal/queue` são de integração (Postgres real) porque
exercitam as invariantes transacionais (índice único de `current`,
prioridade de pedidos, flush de `pending` órfã) — não fazem sentido
mockados. São pulados automaticamente se `DATABASE_URL` não estiver
setada.
