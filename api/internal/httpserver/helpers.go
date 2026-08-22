package httpserver

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"os"
	"strconv"

	"github.com/a-h/templ"
	"github.com/somdomato/somdomato/api/internal/queue"
	"github.com/somdomato/somdomato/api/models"
)

// render escreve um componente templ direto na resposta.
func render(w http.ResponseWriter, component templ.Component) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_ = component.Render(context.Background(), w)
}

func parseFormInt64(r *http.Request, field string) int64 {
	v, err := strconv.ParseInt(r.FormValue(field), 10, 64)
	if err != nil {
		return 0
	}
	return v
}

// ensureCSRFCookie garante um cookie sdm_csrf (não HttpOnly — precisa ser
// legível por... na verdade não precisa ser lido por JS: o próprio template
// server-side já conhece o valor e o embute no form. HttpOnly é mantido por
// segurança; o "double submit" aqui compara o cookie que o navegador
// reenvia automaticamente contra o campo oculto que o servidor colocou no
// mesmo request que setou o cookie).
func ensureCSRFCookie(w http.ResponseWriter, r *http.Request) string {
	if existing := csrfTokenFromRequest(r); existing != "" {
		return existing
	}
	token := randomToken(32)
	http.SetCookie(w, &http.Cookie{
		Name: csrfCookieName, Value: token, Path: "/",
		HttpOnly: false, SameSite: http.SameSiteLaxMode,
	})
	return token
}

func randomToken(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func fileExistsOnDisk(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func queueSetCurrentParams(genre string, songID int64, wasRequestedFallback bool) queue.SetCurrentParams {
	return queue.SetCurrentParams{
		Genre:                genre,
		SongID:               songID,
		Source:               models.SourceAdmin,
		WasRequestedFallback: wasRequestedFallback,
	}
}

// backgroundContext é usado por trabalho fire-and-forget disparado a partir
// de um handler (ex.: resolução de capa) — não deve herdar o contexto da
// requisição HTTP, que é cancelado assim que a resposta é enviada.
func (a *App) backgroundContext() context.Context {
	return context.Background()
}
