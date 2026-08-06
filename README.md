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
(login, CRUD de músicas, tocar/pular, pedidos, vinhetas, usuários/papéis).

Fora do escopo por enquanto (fase 2, schema já preparado para adicionar
depois): uploads via Deezer + aprovação por IA, likes, estatísticas
detalhadas de acesso, resolução de capa via Deezer (hoje só ID3 embutido).

## Desenvolvimento local

Requer [Podman](https://podman.io) e [Go](https://go.dev) 1.23+.

```bash
cp podman/.env.example podman/.env   # ajuste MUSIC_PATH para seu catálogo local
make setup                            # instala templ/tailwind e sobe tudo
make seed                             # varre MUSIC_PATH e popula o catálogo
```

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
