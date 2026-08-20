# Env de dev local (fora do Podman) para `make air` / `make migrate` /
# `make seed` — pra ser usado com `. ./scripts/dev-env.sh`, nunca executado
# diretamente. Postgres/Icecast/Liquidsoap continuam no Podman (`make up`);
# só a API+HTMX roda nativa no host, então aponta pra localhost em vez dos
# hostnames de serviço do compose.
set -a
[ -f .env ] && . ./.env
set +a

export APP_ENV="${APP_ENV:-development}"
export HTTP_ADDR="${HTTP_ADDR:-127.0.0.1:3001}"
export DATABASE_URL="${DATABASE_URL:-postgres://${POSTGRES_USER:-sdm}:${POSTGRES_PASSWORD:-sdm_dev_only}@localhost:5432/${POSTGRES_DB:-sdm}?sslmode=disable}"
export MUSIC_PATH="${MUSIC_PATH:?defina MUSIC_PATH no .env}"
export COVERS_DIR="${COVERS_DIR:-$MUSIC_PATH/covers}"
export JINGLES_DIR="${JINGLES_DIR:-$MUSIC_PATH/vinhetas}"
export JWT_SECRET="${JWT_SECRET:-dev-change-me}"
export RADIO_INTERNAL_TOKEN="${RADIO_INTERNAL_TOKEN:-dev-change-me-too}"
export ICECAST_STATUS_URL="${ICECAST_STATUS_URL:-http://localhost:8000/status-json.xsl}"
export STREAM_BASE_URL="${STREAM_BASE_URL:-http://localhost:8000}"
