# Makefile — comandos de conveniência para o ambiente Podman
# Uso: make <target>   (execute na raiz do repositório)

COMPOSE = podman compose -f podman/compose.yml --env-file podman/.env

.PHONY: help up down build build-nextjs restart logs \
        ssl setup \
        nextjs-shell nginx-shell icecast-shell liquidsoap-shell \
        nextjs-restart nginx-restart icecast-restart liquidsoap-restart \
        ps

# ── Ajuda ────────────────────────────────────────────────────────────────────

help: ## Mostra esta ajuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ── Setup inicial ────────────────────────────────────────────────────────────

setup: ## Configura tudo do zero (certs + .env + build + up)
	@echo "⚙️  Setup inicial..."
	@[ -f podman/.env ] || cp podman/.env.example podman/.env && echo "  → podman/.env criado (edite MUSIC_PATH)"
	@bash podman/generate-certs.sh
	@$(MAKE) build
	@$(MAKE) up
	@echo ""
	@echo "✅ Ambiente disponível em https://localhost"
	@echo "   Rádio (Icecast): https://radio.localhost"

ssl: ## Gera certificados TLS locais (mkcert ou openssl)
	bash podman/generate-certs.sh

# ── Ciclo de vida ────────────────────────────────────────────────────────────

up: ## Sobe todos os serviços em background
	$(COMPOSE) up -d

down: ## Para e remove todos os containers
	$(COMPOSE) down

build: ## Reconstrói todas as imagens
	$(COMPOSE) build --build-arg NEXT_PUBLIC_BUILD_SHA=$(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)

build-nextjs: ## Reconstrói apenas a imagem nextjs e reinicia o container
	$(COMPOSE) build --build-arg NEXT_PUBLIC_BUILD_SHA=$(shell git rev-parse --short HEAD 2>/dev/null || echo unknown) nextjs
	$(COMPOSE) up -d --no-deps nextjs

restart: ## Reinicia todos os serviços
	$(COMPOSE) restart

ps: ## Lista containers em execução
	$(COMPOSE) ps

# ── Logs ─────────────────────────────────────────────────────────────────────

logs: ## Logs de todos os serviços (segue)
	$(COMPOSE) logs -f

logs-nextjs: ## Logs do container nextjs
	$(COMPOSE) logs -f nextjs

logs-nginx: ## Logs do container nginx
	$(COMPOSE) logs -f nginx

logs-icecast: ## Logs do container icecast
	$(COMPOSE) logs -f icecast

logs-liquidsoap: ## Logs do container liquidsoap
	$(COMPOSE) logs -f liquidsoap

# ── Shells ────────────────────────────────────────────────────────────────────

nextjs-shell: ## Shell no container nextjs
	$(COMPOSE) exec nextjs sh

nginx-shell: ## Shell no container nginx
	$(COMPOSE) exec nginx sh

icecast-shell: ## Shell no container icecast
	$(COMPOSE) exec icecast sh

liquidsoap-shell: ## Shell no container liquidsoap
	$(COMPOSE) exec liquidsoap sh

# ── Restart individual ────────────────────────────────────────────────────────

nextjs-restart: ## Reinicia apenas o container nextjs
	$(COMPOSE) restart nextjs

nginx-restart: ## Reinicia apenas o container nginx
	$(COMPOSE) restart nginx

icecast-restart: ## Reinicia apenas o container icecast
	$(COMPOSE) restart icecast

liquidsoap-restart: ## Reinicia apenas o container liquidsoap
	$(COMPOSE) restart liquidsoap
