# Makefile — comandos de conveniência (dev via Podman, build/deploy nativos)
# Uso: make <target>   (execute na raiz do repositório)

COMPOSE = podman compose -f podman/compose.yml --env-file podman/.env
TAILWIND = ./tailwindcss
GOBIN = $(shell go env GOPATH)/bin

.PHONY: help setup dev up down build-images restart logs ps \
        templ css css-watch migrate seed test lint vet fmt \
        build deploy tools clean \
        provision provision-check provision-tags

help: ## Mostra esta ajuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ── Setup inicial ────────────────────────────────────────────────────────

setup: tools ## Configura tudo do zero (.env + tools + up)
	@[ -f podman/.env ] || cp podman/.env.example podman/.env && echo "  → podman/.env criado (edite MUSIC_PATH)"
	@$(MAKE) up
	@echo "✅ Ambiente disponível em http://localhost:3000 (rádio: http://localhost:8000)"

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

# ── Dev (Podman) ─────────────────────────────────────────────────────────

dev: up ## Sobe o ambiente completo, recompila CSS em watch e acompanha os logs da API
	@trap '$(MAKE) --no-print-directory _dev-stop-css' EXIT; \
	$(MAKE) --no-print-directory css-watch & \
	$(COMPOSE) logs -f api

_dev-stop-css:
	@pkill -f 'tailwindcss --input web/css/input.css' 2>/dev/null || true

up: ## Sobe todos os serviços em background (postgres, api, icecast, liquidsoap)
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

logs-api: ## Logs só da API Go
	$(COMPOSE) logs -f api

logs-liquidsoap: ## Logs só do Liquidsoap
	$(COMPOSE) logs -f liquidsoap

seed: ## Varre MUSIC_PATH e popula o catálogo (idempotente)
	$(COMPOSE) exec api go run ./api/cmd/seed

migrate: ## Aplica migrations pendentes no Postgres
	$(COMPOSE) exec api go run ./api/cmd/migrate

# ── Provisionamento da VPS (Ansible) ─────────────────────────────────────────

provision: ## Provisiona/atualiza a VPS de produção via Ansible
	cd ansible && ansible-playbook -i inventory.ini playbook.yml --ask-vault-pass

provision-check: ## Dry run do provisionamento (não aplica nada)
	cd ansible && ansible-playbook -i inventory.ini playbook.yml --ask-vault-pass --check

provision-tags: ## Provisiona só as tags indicadas (uso: make provision-tags TAGS=nginx,ssl)
	@if [ -z "$(TAGS)" ]; then echo "Uso: make provision-tags TAGS=nginx,ssl"; exit 1; fi
	cd ansible && ansible-playbook -i inventory.ini playbook.yml --ask-vault-pass --tags $(TAGS)

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
