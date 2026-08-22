// Rastreamento de visitas/cliques/online para o painel de estatísticas
// (ver internal/analytics). Cada página pública chama trackPageView; o
// heartbeat do cliente (static/js/analytics.js) bate em /track/ping para
// manter o visitante marcado como online enquanto a aba fica aberta.
package httpserver

import (
	"net/http"
	"time"
)

const visitorCookieName = "sdm_vid"

var pingLimiter = newIPRateLimiter(20, time.Minute)

func registerAnalyticsRoutes(mux *http.ServeMux, app *App) {
	mux.HandleFunc("POST /track/ping", withRateLimit(pingLimiter, handleTrackPing(app)))
}

// ensureVisitorID garante um cookie de identificação anônima e persistente
// (1 ano) — não é a sessão de login, só distingue "mesmo cliente" para
// diferenciar visitas (únicas) de cliques (todos os acessos).
func ensureVisitorID(w http.ResponseWriter, r *http.Request) string {
	if cookie, err := r.Cookie(visitorCookieName); err == nil && cookie.Value != "" {
		return cookie.Value
	}
	id := randomToken(16)
	http.SetCookie(w, &http.Cookie{
		Name:     visitorCookieName,
		Value:    id,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int((365 * 24 * time.Hour).Seconds()),
	})
	return id
}

// trackPageView registra o pageview em background — não deve atrasar nem
// derrubar a resposta da página caso o banco esteja lento.
func trackPageView(app *App, w http.ResponseWriter, r *http.Request, path string) {
	visitorID := ensureVisitorID(w, r)
	go func() {
		if err := app.Analytics.Track(app.backgroundContext(), visitorID, path); err != nil {
			app.Log.Error("registrando pageview", "error", err, "path", path)
		}
	}()
}

func handleTrackPing(app *App) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(visitorCookieName)
		if err != nil || cookie.Value == "" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		path := r.URL.Query().Get("path")
		if path == "" {
			path = "/"
		}
		if err := app.Analytics.Ping(r.Context(), cookie.Value, path); err != nil {
			app.Log.Error("registrando heartbeat de visitante", "error", err)
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
