# Som do Mato

Rádio online sertaneja: 5 streams (Icecast2 + Liquidsoap), AutoDJ com
rotação/proteções anti-repetição, pedidos ao vivo e painel administrativo.

Stack: **Go** (backend, `api/`) + **HTMX** (frontend server-rendered,
`web/`) + **Tailwind CSS v4** + **PostgreSQL**. Realtime via **SSE**
(Server-Sent Events), sem WebSocket/Socket.io. Dev local via **Podman**
(`Makefile`); produção provisionada via **Ansible**, sem containers.

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

Requer [Podman](https://podman.io) e [Go](https://go.dev) 1.23+.

```bash
cp podman/.env.example podman/.env   # ajuste MUSIC_PATH para seu catálogo local
make setup                            # instala templ/tailwind e sobe tudo
make seed                             # varre MUSIC_PATH e popula o catálogo
```

`DEEZER_ARL` e `GROQ_API_KEY` (também em `podman/.env.example`) são
opcionais — sem eles a aplicação sobe normalmente e só a rota `/enviar`
fica desativada. Ver "Envio de músicas via Deezer" abaixo.

- App: http://localhost:3000
- Rádio (Icecast): http://localhost:8000/geral
- `make logs` / `make logs-api` / `make logs-liquidsoap` — acompanhar logs
- `make down` — parar tudo

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
podman/         SOMENTE dev local: compose com postgres/api/icecast/liquidsoap.
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

## Produção

```bash
cd ansible
cp group_vars/production/vault.yml.example group_vars/production/vault.yml
ansible-vault encrypt group_vars/production/vault.yml   # depois de preencher os segredos
ansible-galaxy install -r requirements.yml
ansible-playbook -i inventory.ini playbook.yml --ask-vault-pass
```

Isso provisiona o host (Postgres, Nginx, Icecast2, Liquidsoap, firewall,
TLS via Certbot) e cria o serviço systemd `somdomato-api`. Para publicar
uma nova versão do binário:

```bash
HOST=root@sua-vps ./scripts/deploy.sh
```

Só a porta 80/443 (Nginx) e 8000 (Icecast) ficam expostas publicamente — a
API Go e o Postgres escutam somente em `127.0.0.1`.

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
