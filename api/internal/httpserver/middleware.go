package httpserver

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/somdomato/somdomato/api/internal/auth"
	"github.com/somdomato/somdomato/api/rbac"
)

func withLogging(log *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		log.Info("http", "method", r.Method, "path", r.URL.Path, "status", rec.status, "duration_ms", time.Since(start).Milliseconds())
	})
}

func withRecover(log *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Error("panic recuperado", "error", rec, "path", r.URL.Path)
				http.Error(w, "erro interno", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// Flush repassa para o ResponseWriter subjacente — sem isso, statusRecorder
// quebra a asserção de tipo http.Flusher que o handler SSE depende para
// fazer streaming (ver api/internal/sse/sse.go).
func (r *statusRecorder) Flush() {
	if f, ok := r.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// --- Autenticação de rotas internas (Liquidsoap) ---------------------------

// requireInternalToken exige o header X-Internal-Token com o segredo
// compartilhado (RADIO_INTERNAL_TOKEN) — substitui a heurística de IP
// (isLocalRequest) do Next.js por um controle explícito, que funciona igual
// em dev (rede Podman) e produção (Liquidsoap chamando localhost).
func requireInternalToken(app *App, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("X-Internal-Token")
		if token == "" || token != app.Cfg.InternalRadioToken {
			http.Error(w, `{"error":"acesso restrito"}`, http.StatusForbidden)
			return
		}
		next(w, r)
	}
}

// --- Autenticação/autorização de admin --------------------------------------

type ctxKey int

const claimsCtxKey ctxKey = iota

const sessionCookieName = "sdm_session"

func setSessionCookie(w http.ResponseWriter, token string, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(auth.SessionTTL.Seconds()),
	})
}

func clearSessionCookie(w http.ResponseWriter, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookieName, Value: "", Path: "/", MaxAge: -1,
		HttpOnly: true, Secure: secure, SameSite: http.SameSiteLaxMode,
	})
}

func claimsFromRequest(app *App, r *http.Request) *auth.Claims {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		return nil
	}
	claims, err := auth.ParseToken(app.Cfg.JWTSecret, cookie.Value)
	if err != nil {
		return nil
	}
	return claims
}

// requireAuth exige uma sessão válida e injeta as claims no contexto.
func requireAuth(app *App, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims := claimsFromRequest(app, r)
		if claims == nil {
			http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
			return
		}
		ctx := context.WithValue(r.Context(), claimsCtxKey, claims)
		next(w, r.WithContext(ctx))
	}
}

// requirePermission exige, além de sessão válida, a permissão informada
// (consultada em `role_permissions` — porta de permissions.ts).
func requirePermission(app *App, perm rbac.Permission, next http.HandlerFunc) http.HandlerFunc {
	return requireAuth(app, func(w http.ResponseWriter, r *http.Request) {
		claims := r.Context().Value(claimsCtxKey).(*auth.Claims)
		perms, err := app.Auth.GetPermissionsForRole(r.Context(), claims.Role)
		if err != nil {
			http.Error(w, "erro interno", http.StatusInternalServerError)
			return
		}
		if !auth.HasPermission(perms, perm) {
			http.Error(w, "acesso negado", http.StatusForbidden)
			return
		}
		next(w, r)
	})
}

// --- CSRF (necessário porque a sessão é um cookie JWT, não um bearer token) -

const csrfCookieName = "sdm_csrf"
const csrfFormField = "csrf_token"

func csrfTokenFromRequest(r *http.Request) string {
	cookie, err := r.Cookie(csrfCookieName)
	if err != nil {
		return ""
	}
	return cookie.Value
}

// requireCSRF valida o padrão double-submit cookie: o valor enviado no
// corpo do formulário (campo csrf_token, injetado pelo template) precisa
// bater com o cookie — só um script rodando na própria origem consegue ler
// o cookie e reenviá-lo no corpo.
func requireCSRF(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet || r.Method == http.MethodHead {
			next(w, r)
			return
		}
		cookieToken := csrfTokenFromRequest(r)
		formToken := r.FormValue(csrfFormField)
		if cookieToken == "" || formToken == "" || cookieToken != formToken {
			http.Error(w, "token CSRF inválido", http.StatusForbidden)
			return
		}
		next(w, r)
	}
}
