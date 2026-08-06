// Package httpserver monta o roteador HTTP: páginas públicas HTMX, painel
// admin, endpoints internos consumidos pelo Liquidsoap e o stream SSE.
package httpserver

import (
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lucasbrum/somdomato/api/config"
	"github.com/lucasbrum/somdomato/api/internal/auth"
	"github.com/lucasbrum/somdomato/api/internal/jingles"
	"github.com/lucasbrum/somdomato/api/internal/protections"
	"github.com/lucasbrum/somdomato/api/internal/queue"
	"github.com/lucasbrum/somdomato/api/internal/requests"
	"github.com/lucasbrum/somdomato/api/internal/songs"
	"github.com/lucasbrum/somdomato/api/internal/sse"
	"github.com/lucasbrum/somdomato/web"
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
}

func NewRouter(app *App) http.Handler {
	mux := http.NewServeMux()

	registerInternalRadioRoutes(mux, app)
	registerFileRoutes(mux, app)
	registerSSERoutes(mux, app)
	registerPublicRoutes(mux, app)
	registerAdminRoutes(mux, app)

	fileServer := http.FileServer(http.FS(web.StaticFS()))
	mux.Handle("GET /static/", http.StripPrefix("/static/", fileServer))

	var handler http.Handler = mux
	handler = withLogging(app.Log, handler)
	handler = withRecover(app.Log, handler)
	return handler
}
