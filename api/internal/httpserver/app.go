// Package httpserver monta o roteador HTTP: páginas públicas HTMX, painel
// admin, endpoints internos consumidos pelo Liquidsoap e o stream SSE.
package httpserver

import (
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/somdomato/somdomato/api/config"
	"github.com/somdomato/somdomato/api/internal/analytics"
	"github.com/somdomato/somdomato/api/internal/auth"
	"github.com/somdomato/somdomato/api/internal/deezerdl"
	"github.com/somdomato/somdomato/api/internal/jingles"
	"github.com/somdomato/somdomato/api/internal/protections"
	"github.com/somdomato/somdomato/api/internal/queue"
	"github.com/somdomato/somdomato/api/internal/requests"
	"github.com/somdomato/somdomato/api/internal/songs"
	"github.com/somdomato/somdomato/api/internal/sse"
	"github.com/somdomato/somdomato/api/internal/uploads"
	"github.com/somdomato/somdomato/web"
)

// App agrega todas as dependências dos handlers — injetadas uma vez em
// main, sem globals.
type App struct {
	Cfg *config.Config
	Log *slog.Logger

	Pool        *pgxpool.Pool
	Queue       *queue.Store
	Protections *protections.Store
	Jingles     *jingles.Store
	Songs       *songs.Store
	Requests    *requests.Store
	Auth        *auth.Store
	Hub         *sse.Hub
	Uploads     *uploads.Store
	Analytics   *analytics.Store

	// Deezer é nil quando DEEZER_ARL não está configurado — /enviar/baixar
	// responde 503 nesse caso em vez de o processo inteiro falhar ao subir.
	Deezer *deezerdl.Client
}

func NewRouter(app *App) http.Handler {
	mux := http.NewServeMux()

	registerInternalRadioRoutes(mux, app)
	registerFileRoutes(mux, app)
	registerSSERoutes(mux, app)
	registerPublicRoutes(mux, app)
	registerEnviarRoutes(mux, app)
	registerAdminRoutes(mux, app)
	registerAnalyticsRoutes(mux, app)

	fileServer := http.FileServer(http.FS(web.StaticFS()))
	mux.Handle("GET /static/", http.StripPrefix("/static/", fileServer))

	var handler http.Handler = mux
	handler = withLogging(app.Log, handler)
	handler = withRecover(app.Log, handler)
	return handler
}
