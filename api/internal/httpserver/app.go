// Package httpserver monta o roteador HTTP: páginas públicas HTMX, painel
// admin, endpoints internos consumidos pelo Liquidsoap e o stream SSE.
package httpserver

import (
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/somdomato/somdomato/api/config"
	"github.com/somdomato/somdomato/api/internal/analytics"
	"github.com/somdomato/somdomato/api/internal/artistcover"
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
	"github.com/somdomato/somdomato/web/templates/pages"
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

	// ArtistCovers guarda o estado (leitura direta pelos handlers);
	// ArtistCoverResolver é quem sabe buscar/converter/persistir uma capa
	// nova — chamado fire-and-forget de handleMusicStarted. Ver
	// api/internal/artistcover para o fluxo completo.
	ArtistCovers        *artistcover.Store
	ArtistCoverResolver *artistcover.Resolver

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

	var handler http.Handler = withNotFoundPage(mux)
	handler = withLogging(app.Log, handler)
	handler = withRecover(app.Log, handler)
	return handler
}

// withNotFoundPage troca a resposta "404 page not found" em texto puro do
// ServeMux pela página de erro do site — mux.Handler consulta o roteador
// sem executá-lo, então dá para detectar a ausência de rota (pattern vazio)
// antes de decidir entre a rota real e a página 404.
func withNotFoundPage(mux *http.ServeMux) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, pattern := mux.Handler(r); pattern == "" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusNotFound)
			_ = pages.NotFound().Render(r.Context(), w)
			return
		}
		mux.ServeHTTP(w, r)
	})
}
