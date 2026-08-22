# Makefile — comandos de conveniência (dev via Podman, build/deploy nativos)
# Uso: make <target>   (execute na raiz do repositório)

COMPOSE = podman compose -f podman/compose.yml --env-file .env
TAILWIND = ./tailwindcss
GOBIN = $(shell go env GOPATH)/bin

.PHONY: help setup dev air up down build-images restart logs ps \
        templ css css-watch migrate seed cleanup-jingles test lint vet fmt \
        build deploy tools clean \
        provision provision-check provision-tags

help: ## Mostra esta ajuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ── Setup inicial ────────────────────────────────────────────────────────

setup: tools ## Configura tudo do zero (.env + tools + up)
	@[ -f .env ] || cp .env.example .env && echo "  → .env criado (edite MUSIC_PATH)"
	@$(MAKE) up
	@echo "✅ Postgres/Icecast/Liquidsoap no ar. Rode 'make dev' para subir a API+HTMX (via air)."

tools: ## Instala templ e o CLI standalone do Tailwind v4 (sem Node.js)
	go install github.com/a-h/templ/cmd/templ@latest
	go install github.com/air-verse/air@latest
	@if [ ! -x ./tailwindcss ]; then \
		OS=$$(uname -s); ARCH=$$(uname -m); \
		if [ "$$OS" = "Darwin" ] && [ "$$ARCH" = "arm64" ]; then BIN=tailwindcss-macos-arm64; \
		elif [ "$$OS" = "Darwin" ]; then BIN=tailwindcss-macos-x64; \
		else BIN=tailwindcss-linux-x64; fi; \
		curl -sSL -o tailwindcss "https://github.com/tailwindlabs/tailwindcss/releases/latest/download/$$BIN"; \
		chmod +x tailwindcss; \
	fi

# ── Dev ──────────────────────────────────────────────────────────────────
# Postgres, Icecast e Liquidsoap sobem via Podman (`make up`); a API+HTMX
# roda nativa no host com hot-reload via air (`make air`) — `make dev` faz
# as duas coisas, mais o Tailwind em watch.

dev: up templ ## Sobe Podman (postgres/icecast/liquidsoap) + CSS em watch + API com hot-reload (air)
	@trap '$(MAKE) --no-print-directory _dev-stop-css' EXIT; \
	$(MAKE) --no-print-directory css-watch & \
	$(MAKE) --no-print-directory air

_dev-stop-css:
	@pkill -f 'tailwindcss --input web/css/input.css' 2>/dev/null || true

air: templ ## Roda só a API+HTMX com hot-reload (requer 'make up' rodando à parte)
	@. ./scripts/dev-env.sh && $(GOBIN)/air -c .air.toml

up: ## Sobe postgres, icecast e liquidsoap em background
	$(COMPOSE) up -d

down: ## Para e remove todos os containers
	$(COMPOSE) down

build-images: ## Reconstrói as imagens Podman
	$(COMPOSE) build

restart: ## Reinicia todos os serviços
	$(COMPOSE) restart

ps: ## Lista containers em execução
	$(COMPOSE) ps

logs: ## Logs de todos os serviços (segue)
	$(COMPOSE) logs -f

logs-liquidsoap: ## Logs só do Liquidsoap
	$(COMPOSE) logs -f liquidsoap

seed: ## Varre MUSIC_PATH e popula o catálogo (idempotente) — requer 'make up'
	. ./scripts/dev-env.sh && go run ./api/cmd/seed

seed-jingles: ## Varre JINGLES_DIR e popula a tabela jingles (idempotente) — requer 'make up'
	. ./scripts/dev-env.sh && go run ./api/cmd/seedjingles

migrate: ## Aplica migrations pendentes no Postgres — requer 'make up'
	. ./scripts/dev-env.sh && go run ./api/cmd/migrate

cleanup-jingles: ## Lista (dry-run) vinhetas indevidamente inseridas em songs — use CONFIRM=1 para apagar
	. ./scripts/dev-env.sh && go run ./api/cmd/cleanupjingles $(if $(CONFIRM),-confirm)

# ── Provisionamento da VPS (Ansible) ─────────────────────────────────────────

provision: ## Provisiona/atualiza a VPS de produção via Ansible
	cd ansible && ansible-playbook -i inventory.ini playbook.yml

provision-check: ## Dry run do provisionamento (não aplica nada)
	cd ansible && ansible-playbook -i inventory.ini playbook.yml --check

provision-tags: ## Provisiona só as tags indicadas (uso: make provision-tags TAGS=nginx,ssl)
	@if [ -z "$(TAGS)" ]; then echo "Uso: make provision-tags TAGS=nginx,ssl"; exit 1; fi
	cd ansible && ansible-playbook -i inventory.ini playbook.yml --tags $(TAGS)

# ── Build local (sem Podman) ─────────────────────────────────────────────

templ: ## Gera os *_templ.go a partir de web/templates/**/*.templ
	$(GOBIN)/templ generate

css: ## Compila o CSS de produção (Tailwind v4, minificado)
	$(TAILWIND) --input web/css/input.css --output web/static/css/output.css --minify

css-watch: ## Recompila o CSS a cada mudança (dev)
	$(TAILWIND) --input web/css/input.css --output web/static/css/output.css --watch

build: templ css ## Compila o binário de produção (linux/amd64, estático)
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o tmp/somdomato-server ./api/cmd/server

# ── Qualidade ────────────────────────────────────────────────────────────

fmt: ## Formata todo o código Go
	gofmt -w $(shell find . -name '*.go' -not -path './tmp/*' -not -name '*_templ.go')

vet: templ ## go vet
	go vet ./...

test: templ ## Roda os testes (integração de queue/protections precisa de DATABASE_URL)
	go test ./...

lint: fmt vet ## Formata e roda vet

clean: ## Remove artefatos de build
	rm -rf tmp/
